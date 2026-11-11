import { f1, add, f2, f3, f4 } from './cases.js'
import { type CaseReport, type EvalCase } from './types.js'
import { runCase } from './runner.js'

const cases: EvalCase[] = [f1];
// const cases: EvalCase[] = [f1, add, f2, f3, f4];

setTimeout(async () => {
    const reports: CaseReport[] = [];

    for (const ec of cases) {
        const report: CaseReport = await runCase(ec, 20)
        reports.push(report)
    }

    for (const r of reports) {

        const percent = r.runs > 0 ? (r.passes / r.runs) * 100 : 0
        const percentStr = "(" + percent.toFixed(0) + "%)"
        console.log(`${r.id.padEnd(15)} ${r.passes}/${r.runs} ${percentStr.padEnd(10)} ${r.avgDurationMs.toFixed(1)} ms, ${r.avgEvalTokens} tokens`)
        if (r.failures.length > 0) {
            console.log('failures:', r.failures)
        }
    }
}, 0)
