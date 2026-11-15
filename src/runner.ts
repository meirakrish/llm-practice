import { runAgent } from "./agent.js"
import { resetTimer } from './tools.js';
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
const runTimeout: number = 60 * 1000;


export const runCase = async (c: EvalCase, runs: number): Promise<CaseReport> => {
    let passes: number = 0;
    let outcome = '';
    let timer: NodeJS.Timeout | undefined;

    const durations: number[] = [], tokens: number[] = [], failures: string[] = []
    for (let i = 0; i < runs; i++) {
        const ctrl = new AbortController()
        const signal: AbortSignal = ctrl.signal;
        timer = resetTimer(timer, ctrl, 'run', runTimeout)

        const t0 = performance.now();
        let retriesUsed = 0, turnsUsed = 0;
        try {
            const rr: RunResult = await runAgent(c.input, noop, signal)
            retriesUsed = rr.retries;
            turnsUsed = rr.turns;
            durations.push(rr.durationMs)
            tokens.push(rr.evalTokens)

            const result: { pass: boolean, reason: string } = c.check(rr)
            if (result.pass) {
                passes++;
                outcome = 'pass'
            } else {
                outcome = 'fail'
                failures.push(result.reason)
            }
        } catch (e: any) {
            outcome = 'error'
            failures.push(e.message)
        } finally {
            if (timer) {
                clearTimeout(timer)
            }
        }
        console.error(`case ${c.id},  run ${i + 1}/${runs}  ${outcome} ${Math.round(performance.now() - t0)}ms, retries ${retriesUsed}, turns ${turnsUsed}.`)
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