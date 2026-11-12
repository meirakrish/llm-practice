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
| f7-empty-reply | answer is not empty | 100% | 100%* |

\* qwen was 95% (95/100) before the empty-reply retry, 100% (100/100) after.

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

## Effect of the retries (`runAgent`, up to 2, shared counter)
- F6, tool call written as text (llama): ~90% -> 100% (3 x 20 runs).
- F7, empty reply (qwen): 95/100 -> 100/100.
- Not fixed by retry: F8 (qwen asks for numbers it already has; f4 stays at
  ~75%). The reply is complete, just wrong.

## Larger model: qwen3.5:9b, 2026-11-12
Default (strict) prompt, one batch of 20 runs per case, all on the GPU.

| case | llama3.2:3b | qwen2.5:3b | qwen3.5:9b |
|---|---|---|---|
| f1-no-args | ~72% | 92% | 95% |
| add-basic | 100% | 100% | 95% |
| f2-number-types | ~0-15% | ~95% | **100%** |
| f3-exact-result | 100% | ~95% | 100% |
| f4-sequencing | ~77% | 100% | **100%** |
| f6-call-as-text | 100% | 100% | 100% |
| f7-empty-reply | 100% | 100% | 100% |
| avg latency (f4) | ~0.6 s | ~0.9 s | ~6 s |
| avg tokens (f4) | ~65 | ~107 | ~298 |

- The 9B passes almost everything with the simple prompt, so it needs no
  per-model prompt. The cost is ~6-10x the time and ~3-5x the tokens.
- Its 2 failures: invented args on f1 (`add(5, 3)`) and one empty reply on
  add-basic (which survived the retries).
- Outliers: single runs of 30 s (add-basic) and 79 s (f7) in the first batch; they
  did not come back in later batches (slowest 10.7 s, 0 retries), so cause unknown.
- Empty replies (2 batches, add-basic): one survived 2 retries. A model that is empty
  once tends to be empty again.

### qwen3.5:9b is a thinking model
- Its replies carry a hidden `message.thinking` field. Direct test on a trivial
  question: 154 eval tokens by default, 10 with `"think": false`.
- `chat`/`chatStream` now send `think: false` for every model (`buildRequest` in
  `src/ollama.ts`); the small models accept it.
- One batch with `think: false`: 100% on all 7 cases, no empty replies, f4 115 tokens
  (was ~150-298), latency ~1-2.4 s (was ~3-6 s). One batch only: the empty-reply
  fix is consistent with the hypothesis, not proven.
- The table above is the run with thinking on.

- One batch per case: differences of 5% are noise.

## Quantization: qwen2.5:3b Q4_K_M vs Q8_0, 2026-11-12
Same flexible prompt, `think: false`, same harness. Q8 is `qwen2.5:3b-instruct-q8_0`
(3 x 20 runs); Q4 is the default `qwen2.5:3b` (1 fresh batch of 20; f1 earlier 55/60).

| case | Q4_K_M | Q8_0 |
|---|---|---|
| f1-no-args | 95% (earlier 92%) | **0% (0/60)** |
| add-basic, f2, f3, f6, f7 | 100% | 100% |
| f4-sequencing | 95% (earlier 100%) | 98% (59/60) |
| f4 latency / tokens | ~0.9 s / ~106 | ~1.4-1.5 s / ~120 |

- Q8 answers `what is + ?` with `add(1, 2)` or `add(1, 1)` almost every run: the
  failures are near-identical, so it is a fixed habit, not noise.
- More bits did not mean better here: the weights changed which instruction wins
  (the tool-calling habit over the prompt rule). Everything else is equal within noise.
- Q8 is ~1.5x slower (bigger weights to read per token).
- Gotcha: `prompts` in `src/agent.ts` is keyed by the exact model tag, so each
  quantization tag needs its own entry, or it silently gets `strictPrompt`.

## Context window: qwen2.5:3b, `NUM_CTX` 128 to 4096, 2026-11-12
One batch of 20 per size. Fixed overhead (system prompt + tool definitions + template)
is ~267 tokens (`npm run calibrate`), before the question or any tool result.

| `num_ctx` | result |
|---|---|
| 4096, 512, 384 | normal: same pass rates and tokens (~68 / ~105 per run) |
| 256 | broken: add-basic, f3, f4, f7 0%; f2 55%, f6 60%. Loops (`MaxIterationsError`) and empty replies |
| 128 | broken differently: f1 50%, add-basic 0%, f2 0%, f4 5%; f3, f6, f7 100% |

- The cliff is between 256 and 384: the fixed overhead plus question and tool result
  needs roughly 300-350 tokens.
- A smaller window was **not faster**: runs got longer (loops, long rambling replies,
  150-360 tokens instead of ~68). Speed is bound by reading the weights, not the context.
- Nothing raised an error at any size: Ollama truncates the prompt silently, so it
  looks like "the model got dumber".
- At 128 the model invented parameter names (`x`/`y`, `operand1`) and, in f2, made no
  tool call at all. A guess: the tool schema was cut.
- f3, f6 and f7 stayed at 100% at 128 because they grade the answer, and the model
  computed `777.777` itself without the tool. f2 (checks the process) caught it. Same
  lesson as F4: outcome checks can't see that the tool was skipped.
- `trimMessages` can't help: it never drops indexes 0 and 1, and trims at 60% of the window.
- Guard in `runAgent` (`src/agent.ts`): if `estimateTokens(trimmed, tools) > contextWindow`
  it throws before sending. At `NUM_CTX=256` every run fails at once with
  `Estimate tokens is larger than contextWindow, 338>256`. The estimate is rough
  (see README calibration), so it is a safety net, not exact.

## System prompt per model (f1 / f4, 3 x 20 runs each)
Two prompts: `strictPrompt` ("...do not call the add tool; ask for the missing
numbers") and `flexiblePrompt` (adds "a number can also come from an earlier tool
result"). `prompts` in `src/agent.ts` maps a model to its prompt; the default is strict.

| model | strict | flexible |
|---|---|---|
| llama3.2:3b | **f1 ~72%, f4 ~77%** | f1 ~40%, f4 ~70% (with an example in the prompt: f1 37%, f4 65%) |
| qwen2.5:3b | f1 100%, f4 75% | **f1 92%, f4 100%** |

- A prompt tuned on one small model can hurt another, so the prompt is part of the
  per-model setup.
- Concrete examples in a prompt leak into the model's output: with "add 10 to
  that" in the prompt, llama invented `10` and `20` as arguments.
- Llama quotes the flexible rule back at the user ("you mentioned that a number
  can come from an earlier tool result"), treating the system prompt as user speech.

## How to read a result
- Compare pooled rates over several batches, not one batch.
- Read the `failures` list, not just the rate.
- Keep the check fixed when comparing prompts or models.
- The first case in a run pays the model's load time (inflated latency).
