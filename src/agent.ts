import { type ChatResponse, type Message, type ToolDefinition } from './types.js'
import { chatStream, contextWindow } from './ollama.js'
import { executeTool, buildToolsArray } from './tools.js'
import { estimateTokens, trimMessages } from './context.js'


const trimLimit = Math.floor(contextWindow * 0.6)


export const runAgent = async (userInput: string, onToken: (text: string) => void): Promise<ChatResponse> => {
    const tools: ToolDefinition[] = buildToolsArray();
    const messages: Message[] = [
        { role: 'system', content: 'If the user doesn’t give both numbers, ask for them. Never call a tool with made-up values.' },
        { role: 'user', content: userInput }]
    let i: number = 1;

    do {

        const trimmed: Message[] = trimMessages(messages, tools, trimLimit)
        const est_tokens: number = estimateTokens(trimmed, tools)
        const cr: ChatResponse = await chatStream(trimmed, tools, onToken)
        const deltaTrimmed: number = messages.length - trimmed.length;

        if (deltaTrimmed) {
            console.log(`trimmed ${deltaTrimmed} lines`)
        }

        if (cr.prompt_eval_count) {
            console.log(`turn number #${i}, prompt used ${cr.prompt_eval_count}, estimated:${est_tokens}`)
        }

        if (!cr.message.tool_calls) {
            return cr
        }

        messages.push(cr.message)

        for (const tc of cr.message.tool_calls) {
            const tool_res: string = executeTool(tc)
            messages.push({
                role: 'tool',
                tool_name: tc.function.name,
                content: tool_res
            });
        }

        if (i >= 5) {
            throw new Error('MaxIterationsError')
        }
        i++
    } while (true)
}