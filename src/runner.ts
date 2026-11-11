import { runAgent } from "./agent.js"
import type { EvalCase, RunResult, CaseReport } from "./types.js"

const noop = (text: string): void => { }

const sum = (numbers: number[]): number => {
    return numbers.reduce((acc, current) => acc += current, 0)
}

const avg = (numbers: number[]): number => {
    if (numbers.length === 0) {
        return 0
    }
    return sum(numbers) / numbers.length
}

export const runCase = async (c: EvalCase, runs: number): Promise<CaseReport> => {
    let passes: number = 0;
    const durations: number[] = [], tokens: number[] = [], failures: string[] = []
    for (let i = 0; i < runs; i++) {

        try {
            const rr: RunResult = await runAgent(c.input, noop)
            durations.push(rr.durationMs)
            tokens.push(rr.evalTokens)

            const result: { pass: boolean, reason: string } = c.check(rr)
            if (result.pass) {
                passes++;
            } else {
                failures.push(result.reason)
            }
        } catch (e: any) {
            failures.push(e.message)
        }
    }

    const cr: CaseReport = {
        id: c.id,
        passes,
        runs,
        failures,
        avgDurationMs: avg(durations),
        avgEvalTokens: avg(tokens)
    }
    return cr;
}