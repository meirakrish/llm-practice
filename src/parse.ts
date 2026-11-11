import { type ChatResponse, type ToolCall } from './types.js'

export const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

export const parseChatResponse = (data: unknown): ChatResponse => {
    if (!isRecord(data)) {
        throw new Error('data is not an object - value: ' + typeof data)
    }

    if (!isRecord(data.message)) {
        throw new Error('data.message is not an object - value: ' + typeof data.message)
    }

    if (!('content' in data.message)) {
        throw new Error('data.message.content is missing')
    }

    if (!('role' in data.message)) {
        throw new Error('data.message.role is missing')
    }

    if (typeof data.message?.content !== 'string') {
        throw new Error('data.message.content is not of string type - value: ' + typeof data.message?.content)
    }

    if (typeof data.message?.role !== 'string') {
        throw new Error('data.message.role is not of string type - value: ' + typeof data.message?.role)
    }

    if (data.message?.role !== 'assistant') {
        throw new Error('data.message.role value is not "assistant" - value: ' + data.message?.role)
    }

    if (typeof data.prompt_eval_count !== 'undefined' && data.prompt_eval_count !== null && typeof data.prompt_eval_count !== 'number') {
        throw new Error('data.prompt_eval_count is not of number type - value: ' + typeof data.prompt_eval_count)
    }

    if (typeof data.message?.tool_calls === 'undefined' || data.message?.tool_calls === null) {
        // no tool calls, just return the data as ChatResponse
        return data as ChatResponse
    }

    if (!Array.isArray(data.message.tool_calls)) {
        throw new Error('data.message.tool_calls is not an array')
    }

    if (data.message.tool_calls.length === 0) {
        // no tool calls, just return the data as ChatResponse
        return data as ChatResponse
    }

    const tool_calls: ToolCall[] = [];
    for (let i = 0; i < data.message.tool_calls.length; i++) {
        const tc: unknown = data.message.tool_calls[i];

        if (!isRecord(tc)) {
            throw new Error(`data.message.tool_calls[${i}] is not an object`)
        }

        if (typeof tc.id !== 'string') {
            throw new Error(`data.message.tool_calls[${i}].id is not a string`)
        }

        if (!isRecord(tc.function)) {
            throw new Error(`data.message.tool_calls[${i}].function is not an object`)
        }

        if (typeof tc.function.index !== 'number') {
            throw new Error(`data.message.tool_calls[${i}].function.index is not a number`)
        }

        if (typeof tc.function.name !== 'string') {
            throw new Error(`data.message.tool_calls[${i}].function.name is not a string`)
        }

        const raw = tc.function.arguments;
        let args: Record<string, unknown> = {};

        try {
            args = typeof raw === 'string' ? JSON.parse(raw) : raw
        } catch (e) {
            throw new Error(`data.message.tool_calls[${i}].function.arguments is not valid JSON`)
        }

        if (!isRecord(args)) {
            throw new Error(`data.message.tool_calls[${i}].function.arguments is not an object`)
        }

        tool_calls.push({ id: tc.id, function: { index: tc.function.index, name: tc.function.name, arguments: args } })
    }

    return Object.assign({}, data, { message: { ...data.message, tool_calls } }) as ChatResponse
}