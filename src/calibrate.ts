import { estimateTokens } from './context.js';
import { type ChatResponse, type Message, type ToolDefinition } from './types.js'
import { chat } from './ollama.js'
import { buildToolsArray } from './tools.js'


const test = async () => {

    const tools: ToolDefinition[] = buildToolsArray();

    const userInput: string = 'hello!'
    const messages: Message[] = [{ role: 'user', content: userInput }]

    const est_tokens = estimateTokens(messages, tools)
    const cr: ChatResponse = await chat(messages, tools)
    console.log(`turn number #${userInput}, prompt used ${cr.prompt_eval_count}, estimated:${est_tokens}`)
}


setTimeout(async () => {
    console.log('calibrate!')
    await test()
}, 0)