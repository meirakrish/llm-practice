import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readLines } from './stream.js'

const encoder = new TextEncoder()

// Build a stream that delivers exactly these chunks, one read each.
const streamOf = (chunks: (string | Uint8Array)[]): ReadableStream<Uint8Array> =>
	new ReadableStream<Uint8Array>({
		start(controller) {
			for (const c of chunks) {
				controller.enqueue(typeof c === 'string' ? encoder.encode(c) : c)
			}
			controller.close()
		},
	})

const collect = async (body: ReadableStream<Uint8Array>): Promise<string[]> => {
	const lines: string[] = []
	for await (const line of readLines(body)) {
		lines.push(line)
	}
	return lines
}

describe('readLines', () => {
	test('one line per chunk', async () => {
		const out = await collect(streamOf(['a\n', 'b\n', 'c\n']))
		assert.deepEqual(out, ['a', 'b', 'c'])
	})

	test('several lines in one chunk', async () => {
		const out = await collect(streamOf(['a\nb\nc\n']))
		assert.deepEqual(out, ['a', 'b', 'c'])
	})

	test('a line split across chunks is joined', async () => {
		const out = await collect(streamOf(['{"a":', '1}\n{"b"', ':2}\n']))
		assert.deepEqual(out, ['{"a":1}', '{"b":2}'])
	})

	test('a chunk boundary right before the newline', async () => {
		const out = await collect(streamOf(['abc', '\n', 'def', '\n']))
		assert.deepEqual(out, ['abc', 'def'])
	})

	test('empty lines are skipped', async () => {
		const out = await collect(streamOf(['a\n\n\nb\n']))
		assert.deepEqual(out, ['a', 'b'])
	})

	test('a last line without a trailing newline is still yielded', async () => {
		const out = await collect(streamOf(['a\nb']))
		assert.deepEqual(out, ['a', 'b'])
	})

	test('a multi-byte character split across chunks is decoded correctly', async () => {
		const bytes = encoder.encode('é\n') // "é" is 2 bytes
		const out = await collect(streamOf([bytes.slice(0, 1), bytes.slice(1)]))
		assert.deepEqual(out, ['é'])
	})

	test('empty stream yields nothing', async () => {
		assert.deepEqual(await collect(streamOf([])), [])
	})

	test('only newlines yields nothing', async () => {
		assert.deepEqual(await collect(streamOf(['\n\n', '\n'])), [])
	})
})
