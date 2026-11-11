import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { parseChatResponse, parseChatChunk } from './parse.js'

// Build a full Ollama-style response around a message.
const resp = <M>(message: M, extra: Record<string, unknown> = {}) => ({
	model: 'llama3.2:3b',
	done: true,
	done_reason: 'stop',
	eval_count: 1,
	message,
	...extra,
})

const toolCall = (args: unknown, name: unknown = 'add') => ({
	id: 'call_1',
	function: { index: 0, name, arguments: args },
})

describe('parseChatResponse: valid responses', () => {
	test('plain answer without tool_calls', () => {
		const out = parseChatResponse(resp({ role: 'assistant', content: 'hello' }))
		assert.equal(out.message.content, 'hello')
		assert.equal(out.message.tool_calls, undefined)
	})

	test('tool_calls: null is treated as no tool calls', () => {
		const out = parseChatResponse(resp({ role: 'assistant', content: '', tool_calls: null }))
		assert.equal(out.message.content, '')
	})

	test('tool_calls: [] is treated as no tool calls', () => {
		const out = parseChatResponse(resp({ role: 'assistant', content: '', tool_calls: [] }))
		assert.deepEqual(out.message.tool_calls ?? [], [])
	})

	test('tool call with object arguments', () => {
		const out = parseChatResponse(
			resp({ role: 'assistant', content: '', tool_calls: [toolCall({ a: 1, b: 2 })] }),
		)
		assert.equal(out.message.tool_calls?.length, 1)
		assert.deepEqual(out.message.tool_calls?.[0]?.function.arguments, { a: 1, b: 2 })
	})

	test('arguments given as a JSON string are parsed into an object', () => {
		const out = parseChatResponse(
			resp({ role: 'assistant', content: '', tool_calls: [toolCall('{"a":1,"b":2}')] }),
		)
		assert.deepEqual(out.message.tool_calls?.[0]?.function.arguments, { a: 1, b: 2 })
	})

	test('several tool calls are all kept, in order', () => {
		const out = parseChatResponse(
			resp({
				role: 'assistant',
				content: '',
				tool_calls: [toolCall({ a: 1, b: 2 }, 'add'), toolCall({ a: 3, b: 4 }, 'multiply')],
			}),
		)
		assert.deepEqual(
			out.message.tool_calls?.map((tc) => tc.function.name),
			['add', 'multiply'],
		)
	})

	test('does not modify the input object', () => {
		const input = resp({ role: 'assistant', content: '', tool_calls: [toolCall('{"a":1,"b":2}')] })
		parseChatResponse(input)
		// the original must still hold the raw string
		assert.equal(input.message.tool_calls[0]?.function.arguments, '{"a":1,"b":2}')
	})

	test('prompt_eval_count read properly', () => {
		const input = resp({ role: 'assistant', content: '' }, { prompt_eval_count: 999 })
		const out = parseChatResponse(input)
		assert.equal(out.prompt_eval_count, 999)
	})

	test('prompt_eval_count is not in the input', () => {
		const input = resp({ role: 'assistant', content: ''})
		const out = parseChatResponse(input)
		assert.equal(out.prompt_eval_count, undefined)
	})
})

describe('parseChatResponse: invalid top level', () => {
	for (const [label, value] of [
		['null', null],
		['undefined', undefined],
		['a string', 'hello'],
		['a number', 42],
		['an array', []],
	] as const) {
		test(`data is ${label}`, () => {
			assert.throws(() => parseChatResponse(value), /data is not an object/)
		})
	}
})

describe('parseChatResponse: invalid message', () => {
	test('message missing', () => {
		assert.throws(() => parseChatResponse({ model: 'x' }), /data\.message is not an object/)
	})

	test('message is null', () => {
		assert.throws(() => parseChatResponse(resp(null)), /data\.message is not an object/)
	})

	test('message is a string', () => {
		assert.throws(() => parseChatResponse(resp('hi')), /data\.message is not an object/)
	})

	test('content missing', () => {
		assert.throws(() => parseChatResponse(resp({ role: 'assistant' })), /content is missing/)
	})

	test('content is not a string', () => {
		assert.throws(
			() => parseChatResponse(resp({ role: 'assistant', content: null })),
			/content is not of string type/,
		)
	})

	test('role missing', () => {
		assert.throws(() => parseChatResponse(resp({ content: 'hi' })), /role is missing/)
	})

	test('role is not "assistant"', () => {
		assert.throws(
			() => parseChatResponse(resp({ role: 'user', content: 'hi' })),
			/is not "assistant"/,
		)
	})
})

describe('parseChatResponse: invalid tool calls', () => {
	const withCalls = (tool_calls: unknown) => resp({ role: 'assistant', content: '', tool_calls })

	test('tool_calls is not an array', () => {
		assert.throws(() => parseChatResponse(withCalls({})), /tool_calls is not an array/)
	})

	test('a tool call is null', () => {
		assert.throws(() => parseChatResponse(withCalls([null])), /tool_calls\[0\] is not an object/)
	})

	test('function is missing', () => {
		assert.throws(
			() => parseChatResponse(withCalls([{ id: 'x' }])),
			/tool_calls\[0\]\.function is not an object/,
		)
	})

	test('function.name is not a string', () => {
		assert.throws(
			() => parseChatResponse(withCalls([toolCall({ a: 1 }, 42)])),
			/function\.name is not a string/,
		)
	})

	test('arguments is a broken JSON string', () => {
		assert.throws(
			() => parseChatResponse(withCalls([toolCall('{"a": 1,')])),
			/not valid JSON/,
		)
	})

	test('arguments is null', () => {
		assert.throws(
			() => parseChatResponse(withCalls([toolCall(null)])),
			/arguments is not an object/,
		)
	})

	test('arguments is an array', () => {
		assert.throws(
			() => parseChatResponse(withCalls([toolCall([1, 2])])),
			/arguments is not an object/,
		)
	})

	test('arguments is a number', () => {
		assert.throws(
			() => parseChatResponse(withCalls([toolCall(5)])),
			/arguments is not an object/,
		)
	})

	test('arguments is a JSON string holding a non-object', () => {
		assert.throws(
			() => parseChatResponse(withCalls([toolCall('[1,2]')])),
			/arguments is not an object/,
		)
	})

	test('the second of two calls is bad', () => {
		assert.throws(
			() => parseChatResponse(withCalls([toolCall({ a: 1 }), toolCall(null)])),
			/tool_calls\[1\]\.function\.arguments is not an object/,
		)
	})
})

describe('parseChatResponse: invalid prompt_eval_count', () => {
	test('prompt_eval_count not a number', () => {
		const input = resp({ role: 'assistant', content: '' }, { prompt_eval_count: 'cow' })

		assert.throws(
			() =>
			 parseChatResponse(input),
			/prompt_eval_count is not of number type/,
		)
	})
})

// A streamed line: like a response, but only message and done are guaranteed.
const chunk = (message: unknown, extra: Record<string, unknown> = {}) => ({
	model: 'llama3.2:3b',
	message,
	done: false,
	...extra,
})

describe('parseChatChunk: valid chunks', () => {
	test('a content piece', () => {
		const out = parseChatChunk(chunk({ role: 'assistant', content: ' we' }))

		assert.equal(out.message.content, ' we')
		assert.equal(out.message.role, 'assistant')
		assert.equal(out.done, false)
	})

	test('empty content is valid', () => {
		const out = parseChatChunk(chunk({ role: 'assistant', content: '' }))
		assert.equal(out.message.content, '')
	})

	test('final chunk keeps done, done_reason and the counts', () => {
		const out = parseChatChunk(
			chunk({ role: 'assistant', content: '' }, { done: true, done_reason: 'stop', eval_count: 34, prompt_eval_count: 32 }),
		)

		assert.equal(out.done, true)
		assert.equal(out.done_reason, 'stop')
		assert.equal(out.eval_count, 34)
		assert.equal(out.prompt_eval_count, 32)
	})

	test('optional fields are absent when the input has none', () => {
		const out = parseChatChunk(chunk({ role: 'assistant', content: 'a' }))

		assert.equal('eval_count' in out, false)
		assert.equal('prompt_eval_count' in out, false)
		assert.equal('done_reason' in out, false)
		assert.equal('tool_calls' in out.message, false)
	})

	test('null counts are treated as absent', () => {
		const out = parseChatChunk(chunk({ role: 'assistant', content: 'a' }, { eval_count: null, prompt_eval_count: null }))

		assert.equal('eval_count' in out, false)
		assert.equal('prompt_eval_count' in out, false)
	})

	test('a count of 0 is kept', () => {
		const out = parseChatChunk(chunk({ role: 'assistant', content: '' }, { eval_count: 0 }))
		assert.equal(out.eval_count, 0)
	})

	test('tool_calls are parsed', () => {
		const out = parseChatChunk(
			chunk({ role: 'assistant', content: '', tool_calls: [toolCall('{"a":1,"b":2}')] }),
		)

		assert.equal(out.message.tool_calls?.length, 1)
		assert.deepEqual(out.message.tool_calls?.[0]?.function.arguments, { a: 1, b: 2 })
	})

	test('tool_calls null or [] are treated as absent', () => {
		const a = parseChatChunk(chunk({ role: 'assistant', content: '', tool_calls: null }))
		const b = parseChatChunk(chunk({ role: 'assistant', content: '', tool_calls: [] }))

		assert.equal('tool_calls' in a.message, false)
		assert.equal('tool_calls' in b.message, false)
	})
})

describe('parseChatChunk: invalid chunks', () => {
	test('data is not an object', () => {
		assert.throws(() => parseChatChunk('hello'), /data is not an object/)
		assert.throws(() => parseChatChunk(null), /data is not an object/)
	})

	test('message missing or not an object', () => {
		assert.throws(() => parseChatChunk({ done: false }), /data.message is not an object/)
		assert.throws(() => parseChatChunk(chunk('text')), /data.message is not an object/)
	})

	test('content missing or not a string', () => {
		assert.throws(() => parseChatChunk(chunk({ role: 'assistant' })), /content is not of string type/)
		assert.throws(() => parseChatChunk(chunk({ role: 'assistant', content: 5 })), /content is not of string type/)
	})

	test('role missing or not a string', () => {
		assert.throws(() => parseChatChunk(chunk({ content: 'a' })), /role is not of string type/)
		assert.throws(() => parseChatChunk(chunk({ role: 5, content: 'a' })), /role is not of string type/)
	})

	test('role is not "assistant"', () => {
		assert.throws(() => parseChatChunk(chunk({ role: 'user', content: 'a' })), /role value is not assistant - value: user/)
	})

	test('done missing or not a boolean', () => {
		assert.throws(
			() => parseChatChunk({ message: { role: 'assistant', content: 'a' } }),
			/done is not of boolean type/,
		)
		assert.throws(
			() => parseChatChunk(chunk({ role: 'assistant', content: 'a' }, { done: 'yes' })),
			/done is not of boolean type/,
		)
	})

	test('eval_count not a number', () => {
		assert.throws(
			() => parseChatChunk(chunk({ role: 'assistant', content: '' }, { eval_count: '34' })),
			/eval_count is not of number type/,
		)
	})

	test('prompt_eval_count not a number', () => {
		assert.throws(
			() => parseChatChunk(chunk({ role: 'assistant', content: '' }, { prompt_eval_count: 'x' })),
			/prompt_eval_count is not of number type/,
		)
	})

	test('done_reason not a string', () => {
		assert.throws(
			() => parseChatChunk(chunk({ role: 'assistant', content: '' }, { done_reason: 1 })),
			/done_reason is not of string type/,
		)
	})

	test('tool_calls not an array', () => {
		assert.throws(
			() => parseChatChunk(chunk({ role: 'assistant', content: '', tool_calls: 'x' })),
			/tool_calls is not an array/,
		)
	})

	test('an invalid tool call is rejected', () => {
		assert.throws(
			() => parseChatChunk(chunk({ role: 'assistant', content: '', tool_calls: [null] })),
			/tool_calls\[0\] is not an object/,
		)
	})
})
