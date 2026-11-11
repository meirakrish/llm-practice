import { type ChatResponse, type Message, type ToolDefinition, type RunResult, type ToolCall } from './types.js'
import { chatStream, contextWindow } from './ollama.js'
import { executeTool, buildToolsArray } from './tools.js'
import { trimMessages } from './context.js'


const trimLimit = Math.floor(contextWindow * 0.6)


export const runAgent = async (userInput: string, onToken: (text: string) => void): Promise<RunResult> => {
    const tools: ToolDefinition[] = buildToolsArray();
    const messages: Message[] = [
        { role: 'system', content: 'when using the add tool,the user must give two input numbers, otherwise, do not call the add tool; ask for the missing numbers.' },
        { role: 'user', content: userInput }]
    let i: number = 1;

    const start = performance.now()
    let allEvalCount = 0
    const allToolCalls: ToolCall[] = []
    do {

        const trimmed: Message[] = trimMessages(messages, tools, trimLimit)
        // const est_tokens: number = estimateTokens(trimmed, tools)
        const cr: ChatResponse = await chatStream(trimmed, tools, onToken)
        // const deltaTrimmed: number = messages.length - trimmed.length;

        // if (deltaTrimmed) {
        //     console.log(`trimmed ${deltaTrimmed} lines`)
        // }

        // if (cr.prompt_eval_count) {
        //     console.log(`turn number #${i}, prompt used ${cr.prompt_eval_count}, estimated:${est_tokens}`)
        // }
        if (cr.eval_count) {
            allEvalCount += cr.eval_count
        }

        if (!cr.message.tool_calls) {
            const result: RunResult = {
                answer: cr.message.content,
                toolCalls: allToolCalls,
                turns: i,
                durationMs: performance.now() - start,
                evalTokens: allEvalCount

            }
            return result
        }

        messages.push(cr.message)

        for (const tc of cr.message.tool_calls) {
            allToolCalls.push(tc)
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