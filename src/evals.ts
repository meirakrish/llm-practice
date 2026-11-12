import { f1, add, f2, f3, f4, f6, f7 } from './cases.js'
import { type CaseReport, type EvalCase } from './types.js'
import { runCase } from './runner.js'
import { model } from './ollama.js'

// const cases: EvalCase[] = [f1, f4];
const cases: EvalCase[] = [f1, add, f2, f3, f4, f6, f7];

setTimeout(async () => {
    const reports: CaseReport[] = [];
    const totalCases = cases.length
    for (const [index, ec] of cases.entries()) {
        console.error(`=== case ${index + 1}/${totalCases}: ${ec.id} ===`)
        const report: CaseReport = await runCase(ec, 20)
        reports.push(report)
    }

    console.log('model:', model)
    // print summary
    for (const r of reports) {
        const percent = r.runs > 0 ? (r.passes / r.runs) * 100 : 0
        const percentStr = "(" + percent.toFixed(0) + "%)"
        console.log(`${r.id.padEnd(15)} ${r.passes}/${r.runs} ${percentStr.padEnd(10)} ${r.avgDurationMs.toFixed(1)} ms, ${r.avgEvalTokens.toFixed(1)} tokens`)
        if (r.failures.length > 0) {
            console.log('failures:', r.failures)
        }
    }
}, 0)
