import { runAgent } from './agent.js'
import type { ChatResponse } from './types.js'


const tests = [
	'what is 121 + 566 ?',
	'what is 222.222 + 555.555 ?',
	'what is 444 + ?',
	'what is + ?',
	//	'what is 31 * 32 ?',
	//	'what is 31.23 * 32.33 ?',
	//	'what is 55 * -11?'
]

setTimeout(async () => {
	for (const message of tests) {
		console.log('question:', message)
		const chat_res: ChatResponse = await runAgent(message)
		console.log('result:', chat_res.message.content)
		console.log('-----------------------------------------------------------\n')
	}
}, 0)
