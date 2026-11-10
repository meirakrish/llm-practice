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

export const trimMessages = (messages: Message[], tools: ToolDefinition[], limit: number): Message[] => {
    const resArray: Message[] = [...messages]

    if (resArray.length < 4) {
        return resArray
    }

    do {
        const estimate: number = estimateTokens(resArray, tools);

        if (estimate <= limit) {
            break;
        }

        if (resArray.length === 3) {
            break;
        }

        if (resArray[2]?.role === 'assistant' && resArray[2]?.tool_calls) {
            const tcCount = resArray[2]?.tool_calls.length

            if (resArray.length > (2 + 1 + tcCount)) {
                resArray.splice(2, 1 + tcCount)
            } else {
                break;
            }
        } else {
            resArray.splice(2, 1)
        }


    } while (true)


    return resArray;
}