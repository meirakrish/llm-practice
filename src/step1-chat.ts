import { type ChatResponse, type Message, type ToolCall, parseChatResponse } from './parse.js'

type Tool = {
	name: string,
	description: string,
	parameters: Record<string, unknown>,
	run: (args: Record<string, unknown>) => string
}

type NumbersResult =
	| { ok: true; a: number; b: number }
	| { ok: false; error: string }

const model: string = "llama3.2:3b";
const timeout: number = 10 * 1000;
const url: string = "http://localhost:11434/api/chat";

const toNumber = (value: unknown): number | undefined => {

	const num = Number(value)
	const to = typeof value
	// console.log('value',value,'num:',num,'typeof',to)

	if (value === null) {
		return undefined
	}

	if (isNaN(num)) {
		return undefined
	}

	if (num && Number.isFinite(num)) {
		return num
	}

	if (typeof value === 'number' && Number.isFinite(num)) {
		return num
	}

	return undefined
}

const parseArgs = (args: Record<string, unknown>): NumbersResult => {
	const { a, b } = args

	const tn_a = toNumber(a)
	const tn_b = toNumber(b)

	if (tn_a === undefined || tn_b === undefined) {
		return { ok: false, error: `error: a and b must be JSON numbers (not strings). You sent: ${JSON.stringify(args)}. If the user didn't give a number, ask them for it` }
	}

	return { ok: true, a: tn_a, b: tn_b }
}

const registry = new Map<string, Tool>([
	["add", {
		name: "add",
		description: "Add two given numbers, otherwise fail",
		parameters: {
			type: "object",

			properties: {
				a: { type: "number", description: "the first number to add, must be specified by the user" },
				b: { type: "number", description: "the second number to add, must be specified by the user" },
			},
			required: ["a", "b"],
		},
		run: (args: Record<string, unknown>) => {
			const pa_res = parseArgs(args)
			// console.log('parseArgs:',pa_res)

			if (!pa_res.ok) {
				return pa_res.error
			}

			return (pa_res.a + pa_res.b).toString()
		}
	}],
	["multiply", {
		name: "multiply",
		description: "Multiplies two given numbers, otherwise fail",
		parameters: {
			type: "object",

			properties: {
				a: { type: "number", description: "the first number to multiply, must be specified by the user" },
				b: { type: "number", description: "the second number to multiply, must be specified by the user" },
			},
			required: ["a", "b"],
		},
		run: (args: Record<string, unknown>) => {
			const pa_res = parseArgs(args)
			console.log('parseArgs:', pa_res)

			if (!pa_res.ok) {
				return pa_res.error
			}

			return (pa_res.a * pa_res.b).toString()
		}
	}]

]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithRetry = async (url: string, options: RequestInit, maxAttempts: number = 3): Promise<Response> => {
	let errorMessage: string = '';

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		let retry: boolean = false, isError: boolean = false;
		let retryReason: string = '';
		let duration: number, backoffMs: number;
		const startTime: number = performance.now();
		errorMessage = '';

		try {
			const response: Response = await fetch(url, { ...options, signal: AbortSignal.timeout(timeout) })
			isError = response.ok !== true

			if (isError) {
				const status = response.status
				const err_str = await response.text()

				const num_status = toNumber(status)
				const divv: number | undefined = num_status !== undefined ? (num_status - (num_status % 100)) / 100 : undefined;

				if (divv === 4) {
					// all 4xx errors are non-retryable
					retry = false
				} else if (divv === 5) {
					// all 5xx errors are retryable
					retry = true
					retryReason = 'Error-5XX'
				}

				// console.log( 'status',status,'retry:',retry,'div',divv)
				// extract error details
				try {
					// json response error
					const err_msg = JSON.parse(err_str)
					errorMessage = `LLM Server Error: ${status} - ${err_msg.error}`
				} catch (e) {
					// text response error
					// console.error('LLM Server Error',status,err_str)
					errorMessage = `LLM Server Error: ${status} - ${err_str}`
				}
			} else {
				return response;
			}

		} catch (err: any) {
			isError = true
			const errorCause = err.cause?.code
			const errorName = err.name

			if (errorName === 'TimeoutError') {
				retry = true
				retryReason = errorName
			} else if (errorCause === 'ECONNREFUSED' || errorCause === 'ECONNRESET') {
				retry = true
				retryReason = errorCause
			}

			errorMessage = `LLM Server Error: ${errorName} - ${err.message} - ${errorCause}`
			// console.log('Name:', err.name);
			// console.log('Cause:', err.cause?.code);
			// console.log('Message:', err.message);
			// console.log('Code:', err.code);       // e.g., 'ENOENT' for system errors
			// console.log('Stack Trace:', err.stack);
			// console.log('fetchWithRetry:error',err)	
			// throw err
		} finally {
			duration = performance.now() - startTime;
		}

		// console.log('LLM-request-duration:',duration,'isError:',isError)

		if (retry) {
			// error that are retryable
			console.log(`retry #${attempt}, reason:${retryReason}`)

			if (attempt + 1 === maxAttempts) {
				// skip sleep on last iteration
				continue
			}
			// sleep before retrying 
			switch (attempt) {
				case 0:
					backoffMs = 1000
					break

				case 1:
					backoffMs = 2000
					break

				default:
					backoffMs = 4000
					break
			}

			console.log('sleeping for ', backoffMs)
			await sleep(backoffMs)
			continue
		}

		if (errorMessage) {
			// error that are not-retryable
			throw new Error(errorMessage)
		}
	}

	throw new Error(`MaxAttemptsError:${errorMessage}`)
}


const chat = async (messages: Message[]): Promise<ChatResponse> => {
	const tools: { type: string, function: { name: string, description: string, parameters: Record<string, unknown> } }[] = [...registry.values()].map(x => ({
		type: "function", function: {
			name: x.name, description: x.description, parameters: x.parameters
		}
	}));
	const payload = {
		model,
		messages,
		tools,
		stream: false
	}
	const headers = { 'Content-Type': 'application/json' }
	const options: RequestInit = {
		method: 'POST',
		body: JSON.stringify(payload),
		headers
	}

	const response: Response = await fetchWithRetry(url, options, 5)
	const body = await response.json()
	const cr: ChatResponse = parseChatResponse(body)
	return cr
}

const executeTool = (tc: ToolCall): string => {
	// console.log('executing tool:',tc.function.name)
	// console.log('args:',tc.function.arguments);
	const name: string = tc.function.name;

	const tool: Tool | undefined = registry.get(name)

	if (tool) {
		const tool_res: string = tool.run(tc.function.arguments)
		return tool_res
	}

	return `unknown tool ${name}`
}

const runAgent = async (userInput: string): Promise<ChatResponse> => {
	const messages: Message[] = [
		{ role: 'system', content: 'If the user doesn’t give both numbers, ask for them. Never call a tool with made-up values.' },
		{ role: 'user', content: userInput }]
	let i: number = 1;

	do {
		//console.log(`iteration #${i}`)
		const cr: ChatResponse = await chat(messages)
		if (cr.message.tool_calls) {
			messages.push(cr.message)

			for (const tc of cr.message.tool_calls) {
				const tool_res: string = executeTool(tc)
				messages.push({
					role: 'tool',
					tool_name: tc.function.name,
					content: tool_res
				});
			}
		} else {
			return cr
		}

		if (i >= 5) {
			throw new Error('MaxIterationsError')
		}
		i++
	} while (true)
}

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
