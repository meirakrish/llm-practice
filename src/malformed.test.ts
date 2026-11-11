import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { looksLikeToolCall } from './malformed.js'

describe('looksLikeToolCall', () => {
	test('malformed call text from F6 (missing ":" after parameters)', () => {
		assert.equal(looksLikeToolCall('{"name":"add","parameters{"a":222.222,"b":555.555}}'), true)
	})

	test('well-formed call written as text', () => {
		assert.equal(looksLikeToolCall('{"name": "add", "parameters": {"a": 1, "b": 2}}'), true)
	})

	test('leading and trailing whitespace is ignored', () => {
		assert.equal(looksLikeToolCall('  \n{"name":"add"}\n '), true)
	})

	test('normal answer is not flagged', () => {
		assert.equal(looksLikeToolCall('The result is 777.777.'), false)
	})

	test('prose that mentions a name is not flagged', () => {
		assert.equal(looksLikeToolCall('My "name" is Bob.'), false)
		assert.equal(looksLikeToolCall('My name is Bob.'), false)
	})

	test('JSON without a "name" key is not flagged', () => {
		assert.equal(looksLikeToolCall('{"a": 1}'), false)
	})

	test('a call after some text is not flagged (must start with "{")', () => {
		assert.equal(looksLikeToolCall('Sure: {"name":"add"}'), false)
	})

	test('empty and whitespace-only strings are not flagged', () => {
		assert.equal(looksLikeToolCall(''), false)
		assert.equal(looksLikeToolCall('   '), false)
	})
})
