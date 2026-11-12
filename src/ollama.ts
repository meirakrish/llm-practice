import { parseChatChunk, parseChatResponse } from './parse.js'
import { readLines } from './stream.js';
import { type ChatChunk, type ChatResponse, type Message, type ToolCall, type ToolDefinition } from './types.js'

const defaultModel = 'qwen2.5:3b' //"llama3.2:3b"
export const model: string = process.env.MODEL ?? defaultModel;
export const url: string = "http://localhost:11434/api/chat";
const timeout: number = 10 * 1000;
const idleTimeout: number = 30 * 1000;
export const contextWindow = 4096;

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const fetchWithRetry = async (url: string, options: RequestInit, maxAttempts: number = 3): Promise<Response> => {
    let errorMessage: string = '';

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        let retry: boolean = false, isError: boolean = false;
        let retryReason: string = '';
        let backoffMs: number;
        let timer: NodeJS.Timeout | undefined;
        errorMessage = '';

        try {
            const ctrl = new AbortController()
            timer = setTimeout(() => {
                ctrl.abort(new DOMException('timeout', 'TimeoutError'))
            }, timeout)

            const signal: AbortSignal = options.signal ? AbortSignal.any([options.signal, ctrl.signal]) : ctrl.signal;
            const response: Response = await fetch(url, { ...options, signal })
            isError = response.ok !== true

            if (isError) {
                const status: number = response.status
                const err_str = await response.text()

                if (status >= 400 && status < 500) {
                    // all 4xx errors are non-retryable
                    retry = false
                } else if (status >= 500) {
                    // all 5xx errors are retryable
                    retry = true
                    retryReason = 'Error-5XX'
                }

                // extract error details
                try {
                    // json response error
                    const err_msg = JSON.parse(err_str)
                    errorMessage = `LLM Server Error: ${status} - ${err_msg.error}`
                } catch (e) {
                    // text response error
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
        } finally {
            if (timer) {
                clearTimeout(timer)
            }
        }

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

const buildRequest = (messages: Message[], tools: ToolDefinition[], stream: boolean = false): RequestInit => {
    const payload = {
        model,
        messages,
        tools,
        think: false,
        stream,
        options: { num_ctx: contextWindow }
    }
    const headers = { 'Content-Type': 'application/json' }
    const options: RequestInit = {
        method: 'POST',
        body: JSON.stringify(payload),
        headers,
    }
    return options
}

export const chat = async (messages: Message[], tools: ToolDefinition[]): Promise<ChatResponse> => {
    const options: RequestInit = buildRequest(messages, tools, false)
    const response: Response = await fetchWithRetry(url, options, 5)
    const body = await response.json()
    const cr: ChatResponse = parseChatResponse(body)
    return cr
}

const resetTimer = (timer: NodeJS.Timeout | undefined, ctrl: AbortController): NodeJS.Timeout => {
    if (timer) {
        clearTimeout(timer)
    }

    timer = setTimeout(() => {
        ctrl.abort(new DOMException('idle timeout', 'TimeoutError'))
    }, idleTimeout)

    return timer
}
export const chatStream = async (messages: Message[], tools: ToolDefinition[], onToken: (text: string) => void): Promise<ChatResponse> => {
    const ctrl: AbortController = new AbortController();
    const signal: AbortSignal = ctrl.signal;
    const chunkToolCalls: ToolCall[] = []
    let timer: NodeJS.Timeout | undefined;
    let chunkContent = ''
    let lastChunk: ChatChunk | undefined = undefined;

    try {
        const options: RequestInit = { ...buildRequest(messages, tools, true), signal }
        timer = resetTimer(timer, ctrl)
        const response: Response = await fetchWithRetry(url, options, 5)
        if (!response.body) {
            throw new Error("response body is not defined")
        }

        for await (const chunk of readLines(response.body)) {
            timer = resetTimer(timer, ctrl)
            const data: unknown = JSON.parse(chunk);
            const chatChunk = parseChatChunk(data)

            const content = chatChunk.message.content
            const toolCalls = chatChunk.message.tool_calls

            if (content) {
                onToken(content)
                chunkContent += content
            }

            chunkToolCalls.push(...toolCalls || [])

            if (chatChunk.done) {
                lastChunk = chatChunk
            }
        }
    } finally {
        clearTimeout(timer)
    }

    if (!lastChunk) {
        throw new Error('the stream ended early')
    }

    const cr: ChatResponse = {
        message: {
            role: 'assistant',
            content: chunkContent,
        },

        model,
        done: lastChunk.done,
        done_reason: '',
        eval_count: 0,
    }

    if (lastChunk.done_reason) {
        cr.done_reason = lastChunk.done_reason
    }

    if (lastChunk.eval_count) {
        cr.eval_count = lastChunk.eval_count
    }

    if (lastChunk.prompt_eval_count) {
        cr.prompt_eval_count = lastChunk.prompt_eval_count
    }

    if (chunkToolCalls.length > 0) {
        cr.message.tool_calls = chunkToolCalls
    }

    return cr
}