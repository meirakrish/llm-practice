import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { trimMessages } from './context.js'
import type { Message, Role, ToolCall } from './types.js'

// With no tools, estimate = ceil((totalChars + 2) / 3) + 25 (see context.ts);
// the +2 is the "[]" from JSON.stringify of an empty tools array.
const msg = (role: Role, label: string, length: number): Message => ({
	role,
	content: label.padEnd(length, 'x'),
})

const labels = (messages: Message[]): string[] => messages.map(m => m.content.slice(0, 6).replace(/x+$/, ''))

describe('trimMessages: nothing to trim', () => {
	test('under the limit: same messages, in a new array', () => {
		const input = [msg('system', 'sys', 30), msg('user', 'u1', 300), msg('user', 'newest', 300)]
		const out = trimMessages(input, [], 1000)

		assert.deepEqual(out, input)
		assert.notEqual(out, input)
	})

	test('exactly at the limit: nothing is dropped', () => {
		// 4 messages (3 or fewer return early): 930 chars + 2 for "[]" -> ceil(932 / 3) + 25 = 336 tokens
		const input = [msg('system', 'sys', 30), msg('user', 'task', 300), msg('user', 'm1', 300), msg('user', 'newest', 300)]
		const out = trimMessages(input, [], 336)

		assert.deepEqual(out, input)
	})
})

describe('trimMessages: trimming', () => {
	// Index 0 = system prompt, index 1 = the user's task, last = newest. Those three are protected.
	// 1530 chars + 2 for "[]" -> ceil(1532 / 3) + 25 = 536 tokens
	const build = () => [
		msg('system', 'sys', 30),
		msg('user', 'task', 300),
		msg('assistant', 'm1', 300),
		msg('user', 'm2', 300),
		msg('assistant', 'm3', 300),
		msg('user', 'newest', 300),
	]

	test('drops the oldest unprotected messages first, until it fits', () => {
		// limit 350: drop m1 -> 436, drop m2 -> 336 (fits)
		const out = trimMessages(build(), [], 350)

		assert.deepEqual(labels(out), ['sys', 'task', 'm3', 'newest'])
	})

	test('keeps the system prompt, the task and the newest message', () => {
		const out = trimMessages(build(), [], 350)

		assert.equal(out[0]?.role, 'system')
		assert.equal(out[1]?.content.startsWith('task'), true)
		assert.equal(out.at(-1)?.content.startsWith('newest'), true)
	})

	test('does not modify the input array', () => {
		const input = build()
		const before = structuredClone(input)
		trimMessages(input, [], 350)

		assert.deepEqual(input, before)
	})

	test('impossible limit: keeps only the system prompt, the task and the newest message', () => {
		const out = trimMessages(build(), [], 1)

		assert.deepEqual(labels(out), ['sys', 'task', 'newest'])
	})
})

describe('trimMessages: short arrays', { timeout: 2000 }, () => {
	test('empty array', () => {
		assert.deepEqual(trimMessages([], [], 1), [])
	})

	test('single message', () => {
		const input = [msg('system', 'sys', 300)]
		assert.deepEqual(trimMessages(input, [], 1), input)
	})

	test('two messages over the limit are both kept', () => {
		const input = [msg('system', 'sys', 300), msg('user', 'newest', 300)]
		assert.deepEqual(trimMessages(input, [], 1), input)
	})

	test('three messages over the limit are all kept', () => {
		const input = [msg('system', 'sys', 300), msg('user', 'task', 300), msg('user', 'newest', 300)]
		assert.deepEqual(trimMessages(input, [], 1), input)
	})
})

// Tool-call helpers
const call = (id: string): ToolCall => ({ id, function: { index: 0, name: 'add', arguments: { a: 1, b: 2 } } })

const assistantCalls = (calls: number, label: string = 'asst', length: number = 0): Message => ({
	role: 'assistant',
	content: label.padEnd(length, 'x'),
	tool_calls: Array.from({ length: calls }, (_, i) => call(`c${i}`)),
})

const toolResult = (): Message => ({ role: 'tool', tool_name: 'add', content: '3' })

// A tool message is an orphan when no assistant message with tool_calls comes before it
// (skipping over other tool messages).
const countOrphans = (messages: Message[]): number =>
	messages.filter((m, i) => {
		if (m.role !== 'tool') return false
		let j = i - 1
		while (j >= 0 && messages[j]?.role === 'tool') j--
		return !(messages[j]?.role === 'assistant' && messages[j]?.tool_calls)
	}).length

describe('trimMessages: tool calls', { timeout: 2000 }, () => {
	const sys = () => msg('system', 'sys', 30)
	const task = () => msg('user', 'task', 300)
	const newest = () => msg('user', 'newest', 300)

	test('an assistant message and its tool result are dropped together', () => {
		// dropping only the assistant would already fit (236), leaving an orphan tool result
		const input = [sys(), task(), assistantCalls(1, 'asst', 600), toolResult(), newest()]
		const out = trimMessages(input, [], 240)

		assert.equal(countOrphans(out), 0)
		assert.deepEqual(labels(out), ['sys', 'task', 'newest'])
	})

	test('an assistant with two tool calls is dropped with both results', () => {
		const input = [sys(), task(), assistantCalls(2, 'asst', 600), toolResult(), toolResult(), newest()]
		const out = trimMessages(input, [], 1)

		assert.equal(countOrphans(out), 0)
		assert.deepEqual(labels(out), ['sys', 'task', 'newest'])
	})

	test('a pair in the middle is dropped and the messages after it are kept', () => {
		// pair removed: 30 + 300 + 300 + 300 + 2 -> 336 tokens
		const input = [sys(), task(), assistantCalls(1, 'asst', 300), toolResult(), msg('user', 'm', 300), newest()]
		const out = trimMessages(input, [], 336)

		assert.deepEqual(labels(out), ['sys', 'task', 'm', 'newest'])
	})

	test('a pair that ends with the newest message is never dropped (1 call)', () => {
		const input = [sys(), task(), assistantCalls(1, 'asst', 600), toolResult()]
		const out = trimMessages(input, [], 1)

		assert.deepEqual(out, input)
	})

	test('a group that ends with the newest message is never dropped (2 calls)', () => {
		const input = [sys(), task(), assistantCalls(2, 'asst', 600), toolResult(), toolResult()]
		const out = trimMessages(input, [], 1)

		assert.deepEqual(out, input)
	})
})
