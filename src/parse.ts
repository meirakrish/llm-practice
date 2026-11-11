import { type ChatChunk, type ChatResponse, type ToolCall, type Role } from './types.js'

export const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

export const parseToolCalls = (rawArray: unknown[]): ToolCall[] => {
    const tool_calls: ToolCall[] = [];
    for (let i = 0; i < rawArray.length; i++) {
        const tc: unknown = rawArray[i];

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

    return tool_calls
}

export const parseChatChunk = (data: unknown): ChatChunk => {
    if (!isRecord(data)) {
        throw new Error('data is not an object - value: ' + typeof data)
    }

    if (!isRecord(data.message)) {
        throw new Error('data.message is not an object - value: ' + typeof data.message)
    }

    if (typeof data.message?.content !== 'string') {
        throw new Error('data.message.content is not of string type - value: ' + typeof data.message?.content)
    }

    if (typeof data.message?.role !== 'string') {
        throw new Error('data.message.role is not of string type - value: ' + typeof data.message?.role)
    }

    if (typeof data.done !== 'boolean') {
        throw new Error('data.done is not of boolean type - value: ' + typeof data.done)
    }

    if (typeof data.eval_count !== 'undefined' && data.eval_count !== null && typeof data.eval_count !== 'number') {
        throw new Error('data.eval_count is not of number type - value: ' + typeof data.eval_count)
    }

    if (typeof data.prompt_eval_count !== 'undefined' && data.prompt_eval_count !== null && typeof data.prompt_eval_count !== 'number') {
        throw new Error('data.prompt_eval_count is not of number type - value: ' + typeof data.prompt_eval_count)
    }

    if (typeof data.done_reason !== 'undefined' && data.done_reason !== null && typeof data.done_reason !== 'string') {
        throw new Error('data.done_reason is not of string type - value: ' + typeof data.done_reason)
    }

    if (data.message?.role !== 'assistant') {
        throw new Error('data.message.role value is not assistant - value: ' + data.message?.role)
    }


    let tc: ToolCall[] = []
    if (typeof data.message?.tool_calls !== 'undefined' && data.message?.tool_calls !== null) {

        if (!Array.isArray(data.message.tool_calls)) {
            throw new Error('data.message.tool_calls is not an array')
        }

        tc = parseToolCalls(data.message.tool_calls);
    }

    const res: ChatChunk = {
        message: {
            role: data.message.role,
            content: data.message?.content,
        },
        done: data.done,
    };

    if (tc.length > 0) {
        res.message.tool_calls = tc;
    }

    if (typeof data.done_reason !== 'undefined' && data.done_reason !== null) {
        res.done_reason = data.done_reason
    }

    if (typeof data.eval_count !== 'undefined' && data.eval_count !== null) {
        res.eval_count = data.eval_count
    }

    if (typeof data.prompt_eval_count !== 'undefined' && data.prompt_eval_count !== null) {
        res.prompt_eval_count = data.prompt_eval_count
    }

    return res
}

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

    const tool_calls: ToolCall[] = parseToolCalls(data.message.tool_calls);

    return Object.assign({}, data, { message: { ...data.message, tool_calls } }) as ChatResponse
}