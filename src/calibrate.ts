import { estimateTokens } from './context.js';
import { type ChatResponse, type Message, type ToolDefinition } from './types.js'
import { chat } from './ollama.js'
import { buildToolsArray } from './tools.js'


const sizes: number[] = [0, 200, 1000, 3000];
const textSeed = ['Can I see the menu, please?', 'I drink coffee every morning.', 'I see your point, but I have a different opinion.']
const jsonSeed = ['{"a":1,"b":2}', '{"apple":7,"orange":9}', '{"he":3,"she":4}']

const generateInput = (prefix: string, size: number, json: boolean = false): string => {
    if (size === 0) {
        return ''
    }
    let result = prefix
    let i = 0;
    const seedArray = json ? [...jsonSeed] : [...textSeed]

    while (result.length < size) {
        result += seedArray[i++];

        if (i >= seedArray.length) {
            i = 0;
        }
    }

    return result
}


const test = async () => {

    const tools: ToolDefinition[] = buildToolsArray();

    let i: number = 0, firstReal: number = 0;

    for (const mode of ['text', 'json'])
        for (const size of sizes) {
            i++;
            const userInput: string = generateInput(`run#${i}`, size, mode === 'json');
            // console.log('userinput:', userInput);
            const messages: Message[] = [{ role: 'user', content: userInput }];


            const est_tokens = estimateTokens(messages, tools)
            const cr: ChatResponse = await chat(messages, tools)

            if (cr.prompt_eval_count === undefined || cr.prompt_eval_count === null) {
                continue
            }

            // save first token usage for slope
            if (size === sizes[0]) {
                firstReal = cr.prompt_eval_count
            }
            const slope: number = userInput.length > 0 ? (cr.prompt_eval_count - firstReal) / userInput.length : 0
            console.log(`turn #${i},${mode} input size:${userInput.length}, prompt: ${cr.prompt_eval_count} tokens, estimated:${est_tokens} tokens, slope:${slope.toFixed(3)}\n`)
        }
}


setTimeout(async () => {
    console.log('calibrate!')
    await test()
}, 0)