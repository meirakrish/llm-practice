import { parseChatResponse } from './parse.js'
import { type ChatResponse, type Message, type ToolDefinition } from './types.js'

export const model: string = "llama3.2:3b";
export const url: string = "http://localhost:11434/api/chat";
const timeout: number = 10 * 1000;
export const contextWindow = 4096;

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const fetchWithRetry = async (url: string, options: RequestInit, maxAttempts: number = 3): Promise<Response> => {
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
            duration = performance.now() - startTime;
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

export const chat = async (messages: Message[], tools: ToolDefinition[], stream: boolean = false): Promise<ChatResponse> => {
    const payload = {
        model,
        messages,
        tools,
        stream,
        options: { num_ctx: contextWindow }
    }
    const headers = { 'Content-Type': 'application/json' }
    const options: RequestInit = {
        method: 'POST',
        body: JSON.stringify(payload),
        headers,
    }

    const response: Response = await fetchWithRetry(url, options, 5)
    const body = await response.json()
    const cr: ChatResponse = parseChatResponse(body)
    return cr
}