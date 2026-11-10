import { type Message, type ToolDefinition } from './types.js'

const divisor = 3;
const overhead = 25

export const estimateTokens = (messages: Message[], tools: ToolDefinition[]): number => {

    let text_length: number = JSON.stringify(tools).length;

    for (const msg of messages) {
        text_length += msg.content.length;

        if (msg.role === 'assistant' && msg.tool_calls) {
            const json_str = JSON.stringify(msg.tool_calls)
            text_length += json_str.length
        }
    }

    return Math.ceil(text_length / divisor) + overhead
}
