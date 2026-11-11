import type { EvalCase, RunResult } from "./types.js"

export const f1: EvalCase = {
    id: 'f1-no-args',
    input: 'what is + ?',
    check: (r: RunResult) => {
        if (r.toolCalls.length > 0) {
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