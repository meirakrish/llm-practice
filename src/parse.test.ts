import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { parseChatResponse } from './parse.js'

// Build a full Ollama-style response around a message.
const resp = <M>(message: M) => ({
	model: 'llama3.2:3b',
	done: true,
	done_reason: 'stop',
	eval_count: 1,
	message,
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
