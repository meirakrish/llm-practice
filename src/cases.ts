import type { EvalCase, RunResult } from "./types.js"

export const f1: EvalCase = {
    id: 'f1-no-args',
    input: 'what is + ?',
    check: (r: RunResult) => {
        if (r.toolCalls.length > 0) {

            const args: unknown[] = r.toolCalls.map(x => Object.values(x.function.arguments)).flatMap(x => x)
            if (args.every(x => x === null)) {
                return { pass: true, reason: 'all args are null' }
            }

            return { pass: false, reason: JSON.stringify(r.toolCalls) }
        }

        return { pass: true, reason: 'no tool call' }
    }
}

export const add: EvalCase = {
    id: 'add-basic',
    input: 'what is 121 + 566 ?',
    check: (r: RunResult) => {
        if (r.answer.includes("687")) {
            return { pass: true, reason: r.answer }
        }

        return { pass: false, reason: r.answer }
    }
}

// F2: arguments must be JSON numbers, not numeric strings
export const f2: EvalCase = {
    id: 'f2-number-types',
    input: 'what is 222.222 + 555.555 ?',
    check: (r: RunResult) => {
        const args = r.toolCalls.flatMap(c => Object.values(c.function.arguments))
        if (args.length === 0) {
            return { pass: false, reason: 'no tool call' }
        }
        const bad = args.filter(a => typeof a !== 'number')
        if (bad.length > 0) {
            return { pass: false, reason: 'non-number args: ' + JSON.stringify(bad) }
        }
        return { pass: true, reason: 'all args are numbers' }
    }
}

// F3: the final answer must contain the exact tool result
export const f3: EvalCase = {
    id: 'f3-exact-result',
    input: 'what is 222.222 + 555.555 ?',
    check: (r: RunResult) => {
        if (r.answer.includes('777.777')) {
            return { pass: true, reason: r.answer }
        }
        return { pass: false, reason: r.answer }
    }
}

// F4: the second call must use the first call's result (3), and the answer must be 13
export const f4: EvalCase = {
    id: 'f4-sequencing',
    input: 'what is 1 + 2, and then add 10 to that',
    check: (r: RunResult) => {
        if (r.answer.includes('13')) {
            return { pass: true, reason: r.answer }
        }
        return { pass: false, reason: r.answer }
    }
}
// F6: the answer must not be a tool call written as plain text
export const f6: EvalCase = {
    id: 'f6-call-as-text',
    input: 'what is 222.222 + 555.555 ?',
    check: (r: RunResult) => {
        if (r.answer.includes('"name"') || r.answer.includes('"parameters"')) {
            return { pass: false, reason: r.answer }
        }
        return { pass: true, reason: r.answer }
    }
}

// F7: the final answer must not be empty
export const f7: EvalCase = {
    id: 'f7-empty-reply',
    input: 'what is 222.222 + 555.555 ?',
    check: (r: RunResult) => {
        if (r.answer.trim() === '') {
            return { pass: false, reason: 'empty answer' }
        }
        return { pass: true, reason: r.answer }
    }
}
