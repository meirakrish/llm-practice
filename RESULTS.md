# Eval results

Run with `npm run evals` (all cases, 20 runs each) or
`MODEL=<name> npm run evals`. Cases live in `src/cases.ts`; failures are
described in `FAILURES.md`.

## Model comparison, 2026-11-11

Same harness, same system prompt (tuned on llama), 20 runs per case.

| case | what it checks | llama3.2:3b | qwen2.5:3b |
|---|---|---|---|
| f1-no-args | `what is + ?`: no tool call with invented args | 60% | **100%** |
| add-basic | `121 + 566`: answer contains 687 | 100% | 100% |
| f2-number-types | tool args are JSON numbers, not strings | 15% | **95%** |
| f3-exact-result | answer contains the exact sum `777.777` | **100%** | 90% |
| f4-sequencing | `1 + 2, then add 10`: answer contains 13 | **85%** | 75% |
| f6-call-as-text | answer is not a tool call written as text | 100% | 100% |

f4 cost: llama 595 ms / 61 tokens per run; qwen 1242 ms / 144 tokens.

### Reading it
- Real differences (too big for N=20 noise): f1 and f2. Qwen follows the
  argument rules much better.
- Probably noise: f3 and f4. At N=20 a 10-point gap is within the batch-to-batch
  spread (llama f1 alone has scored 60%, 65%, 75% and 85% in different batches).
- Qwen is ~2x slower and uses ~2x the tokens on multi-step tasks.
- Qwen's failures are different in kind: empty replies (F7), wrong answers
  (`30`), and asking the user for numbers they already gave.
- The system prompt was tuned on llama, so this compares harness + prompt + model,
  not the bare models.
- f6 at 100% for qwen may only mean qwen never produces that failure.

## How to read a result
- Compare pooled rates over several batches, not one batch.
- Read the `failures` list, not just the rate.
- Keep the check fixed when comparing prompts or models.
- The first case in a run pays the model's load time (inflated latency).
