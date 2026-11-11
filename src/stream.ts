export async function* readLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {

    const decoder = new TextDecoder(); // Use if reading text/JSON
    let pending: string = ''

    for await (const chunk of body) {
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

            yield (str)
        }
    }

    if (pending !== '') {
        yield (pending)
    }
}