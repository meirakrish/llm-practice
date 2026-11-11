import { type Message } from './types.js'
import { fetchWithRetry, url, model, contextWindow, sleep } from './ollama.js'
import { isRecord } from './parse.js'


const processString = (str: string) => {
    let msg = ''
    const jsonObj: unknown = JSON.parse(str)

    if (!isRecord(jsonObj)) {
        throw new Error('Error, chunk is not an object');
    }

    if (!isRecord(jsonObj.message)) {
        throw new Error('Error, chunk does not contain message object')
    }

    if (typeof jsonObj.message.content !== 'string') {
        throw new Error('Error, chunk message content is not string')
    }

    if (jsonObj.eval_count !== undefined && jsonObj.eval_count !== null && typeof jsonObj.eval_count !== 'number') {
        throw new Error('Error, eval_count is not a number ')
    }

    if (typeof jsonObj.done !== 'boolean') {
        throw new Error('Error, done is not a boolean ')
    }

    if (jsonObj.done) {
        console.log("\neval_count:", jsonObj.eval_count);
        return msg
    }

    msg = jsonObj.message.content
    process.stdout.write(jsonObj.message.content.toString());
    return msg
}

setTimeout(async () => {
    const messages: Message[] = [
        { role: 'user', content: 'count from 1 to 10' }]

    const payload = {
        model,
        messages,
        tools: [],
        stream: true,
        options: { num_ctx: contextWindow }
    }
    const headers = { 'Content-Type': 'application/json' }
    const options: RequestInit = {
        method: 'POST',
        body: JSON.stringify(payload),
        headers,
    }

    const response: Response = await fetchWithRetry(url, options, 5)
    const decoder = new TextDecoder(); // Use if reading text/JSON

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
        return
    }

    let pending: string = ''
    let message: string = '';

    for await (const chunk of response.body) {
        pending += decoder.decode(chunk, { stream: true });
        const splitted: string[] = pending.split("\n")
        const last_item = splitted.pop()

        if (last_item !== undefined && last_item !== null) {
            pending = last_item
        }

        for (const str of splitted) {
            if (str.length === 0) {
                continue;
            }

            const msg: string = processString(str);
            if (msg.length) {
                message += msg
            }
        }
    }

    if (pending !== '') {
        const msg: string = processString(pending);
        if (msg.length) {
            message += msg
        }
    }

    console.log('message:', message)
}, 0)