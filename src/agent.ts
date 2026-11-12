import { type ChatResponse, type Message, type ToolDefinition, type RunResult, type ToolCall } from './types.js'
import { chatStream, contextWindow, model } from './ollama.js'
import { executeTool, buildToolsArray } from './tools.js'
import { trimMessages } from './context.js'
import { looksLikeToolCall } from './malformed.js'


const trimLimit = Math.floor(contextWindow * 0.6)
const maxRetries = 2
const strictPrompt = 'when using the add tool,the user must give two input numbers, otherwise, do not call the add tool; ask for the missing numbers.'
const flexiblePrompt = 'when using the add tool,the user must give two input numbers, if the user did not provide two input numbers, ask the user for the missing input, a number can also come from an earlier tool result'
const prompts: Record<string, string> = { 'qwen2.5:3b': flexiblePrompt }

export const runAgent = async (userInput: string, onToken: (text: string) => void): Promise<RunResult> => {
    const tools: ToolDefinition[] = buildToolsArray();
    const messages: Message[] = [
        { role: 'system', content: prompts[model] ?? strictPrompt },
        { role: 'user', content: userInput }]
    let i: number = 1;

    const start = performance.now()
    let allEvalCount = 0, retries = 0;
    const allToolCalls: ToolCall[] = []

    do {

        const trimmed: Message[] = trimMessages(messages, tools, trimLimit)
        const cr: ChatResponse = await chatStream(trimmed, tools, onToken)

        if (cr.eval_count) {
            allEvalCount += cr.eval_count
        }

        if (!cr.message.tool_calls) {
            if (looksLikeToolCall(cr.message.content) && retries < maxRetries) {
                // tool call sent as message
                retries++;
                continue;
            }

            if (cr.message.content.trim() === '' && retries < maxRetries) {
                // empty string
                retries++;
                continue;
            }

            const result: RunResult = {
                answer: cr.message.content,
                toolCalls: allToolCalls,
                turns: i,
                durationMs: performance.now() - start,
                evalTokens: allEvalCount,
                retries
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