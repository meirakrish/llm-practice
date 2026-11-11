# project-slow-horse

A hands-on learning project for understanding how LLM agents and the models
behind them work, built from scratch without agent frameworks.

## Why
Frameworks hide the interesting parts. This project builds each piece by hand
to understand what a harness does and why, then goes one level deeper into
the models themselves.

## Status

**Phase 1 is done**: agent loop, tools, robustness, context management and
streaming. **Phase 2 (evals) is in progress**: runner, report and cases for
F1–F4 are working. Still open: a case for F6, retry vs. error-back for
malformed output.

## Roadmap

### Phase 1: Agent harness from scratch
Build the core agent loop by hand:
- [x] Send messages, parse tool calls, execute tools, feed results back,
  and decide when to stop (loop with an iteration cap)
- [x] A simple, explicit tool interface with input validation and guardrails
  (tool registry; each tool validates its own arguments and returns errors
  the model can read and recover from)
- [x] Context management: handle a growing conversation within the model's
  context window (token estimate, explicit `num_ctx`, trimming of old messages)
- [x] Robustness: retries, malformed model output, and failure handling
  (server error bodies, per-attempt timeouts, retry with backoff for
  retryable failures only, runtime validation of model responses, unit tests)
- [x] Streaming responses (NDJSON line reader, chunk parser, idle timeout, `onToken` callback)

### Phase 2: Evals
Measure the harness instead of guessing:
- [x] A small suite of tasks with clear success criteria (`src/cases.ts`)
- [x] Track success rate, latency, and token usage (`npm run evals`)
- [~] Compare the effect of prompt, tool-design, and model changes objectively
  (done for the F1 prompt and the F3 float fix; model comparison is Phase 3)

Seed material: [FAILURES.md](FAILURES.md) logs observed failures, each written
so it can become an eval case.

### Phase 3: Local models deep dive
Run the same harness and evals across different models:
- Compare small open models (via Ollama / llama.cpp) against each other
  and against an API model
- Explore tokenization, context limits, and quantization trade-offs
- Measure how reliably each model calls tools

### Phase 4: Model internals
Build a tiny transformer to understand what's inside the box:
- Tokenizer, embeddings, attention, and the training loop
- Train a small model on a toy dataset
- Connect what's learned back to the harness behavior seen in phases 1–3

## Non-goals
- Being a production framework
- Competing with LangChain / agent SDKs

## Stack
- TypeScript on Node 22, run with `tsx` (no build step)
- Local models via [Ollama](https://ollama.com), so everything can be tested locally
- Developed on WSL, with Ollama running on the Windows side

## Running it

Prerequisites:
- Ollama running and the model pulled: `ollama pull llama3.2:3b`
- From WSL, Ollama is reachable at `http://localhost:11434` (no extra setup was needed here)

```bash
npm install
npx tsx src/main.ts         # runs the agent on a few sample questions
npm run calibrate           # compares estimated vs real prompt tokens 
npm run evals               # runs every eval case 20 times and prints a summary (needs Ollama)
npm test                    # unit tests (Node's built-in test runner)
npx tsc --noEmit            # type-check; tsx does not do this for you
```

## Layout

| File | What it holds |
|---|---|
| `src/main.ts` | Entry point: runs the sample questions |
| `src/agent.ts` | The `runAgent` loop |
| `src/ollama.ts` | Ollama client: `fetchWithRetry`, `chat`, `chatStream`, model/url/timeouts |
| `src/tools.ts` | Tool registry, `executeTool`, `buildToolsArray` |
| `src/types.ts` | Shared types |
| `src/parse.ts` | `parseChatResponse`, `parseChatChunk` and `parseToolCalls`, which validate model output at runtime |
| `src/parse.test.ts` | Tests for `parseChatResponse` and `parseChatChunk` |
| `src/stream.ts` | `readLines`: turns a byte stream into complete lines |
| `src/stream.test.ts` | Tests for `readLines` (split lines, merged lines, UTF-8) |
| `src/stream-demo.ts` | Throwaway demo of reading a raw stream |
| `src/context.ts` | `estimateTokens` (messages + tool definitions) and `trimMessages` |
| `src/context.test.ts` | Tests for `trimMessages` |
| `src/calibrate.ts` | compares estimates with the real `prompt_eval_count` |
| `src/cases.ts` | Eval cases (`EvalCase`: an input plus a `check` that grades the `RunResult`) |
| `src/runner.ts` | `runCase`: runs one case N times, returns a `CaseReport` |
| `src/evals.ts` | Entry point for `npm run evals`: runs all cases and prints the summary |
| `FAILURES.md` | Known model/harness failures observed so far |

## Notes for picking this up later
- The model is `llama3.2:3b`. It is non-deterministic, so single runs prove little;
  rates over many runs are the goal of Phase 2.
- Validation checks the *shape* of tool arguments, not whether they make sense
  (see F1 in `FAILURES.md`).
- Open design question: should malformed model output (e.g. broken argument JSON)
  be retried, or sent back to the model as an error message? Deferred to Phase 2,
  where it can be measured.
- Small follow-up: add tests for the `id` and `index` checks in `parseChatResponse`.
- `prompt_eval_count` counts only tokens Ollama processed fresh, not cached prefix
  tokens, so it undercounts the real context size on later turns. Trimming uses
  `estimateTokens` instead.
- Calibration (`npm run calibrate`): fixed overhead (tools + template) is ~267 tokens.
  Prose is ~4.3 chars/token, JSON-like text ~1.9. The estimator uses `chars / 3 + 25`:
  it overcounts prose by ~20-33% and undercounts JSON by ~30%. Trim at about 60% of
  the window, never at 100%.
- Trimming (`trimMessages` in `context.ts`, called from `runAgent`): drops the oldest
  messages first. Always keeps the system prompt (index 0), the user's task (index 1)
  and the newest message. An assistant message with `tool_calls` is dropped together
  with its `tool` results. `runAgent` keeps the full history; only the copy sent to
  the model is trimmed. No summarization yet: dropped messages are simply forgotten.
- The window is set explicitly in `ollama.ts` (`contextWindow`, sent as
  `options.num_ctx`). It must be inside `options`; a top-level `num_ctx` is silently ignored.
- Streaming: Ollama sends one JSON object per line (NDJSON). Network reads do not
  align with lines, so `readLines` buffers partial lines. The request timeout covers
  only waiting for the response to start; after that, `chatStream` aborts if no chunk
  arrives for `idleTimeout`. A timer that only runs while processing a chunk, or that
  is started per chunk and never kept running during the wait, does not detect stalls.
- Evals: `runAgent` returns a `RunResult` (answer, tool calls, turns, duration, tokens).
  A case's `check` grades it. `runCase` runs it N times (sequentially) and counts
  passes; a thrown run counts as a failure. Latency and tokens are averaged over
  runs that completed.
- Reading eval results:
  - 5 runs is too few: the same prompt scored 40%-100% at N=5. At N=20 repeated
    samples still differ by ~10-15 points, so compare pooled rates over several
    batches.
  - Read the `failures` list, not just the rate. Fixing one failure mode exposes
    the next (F3's rounding fix revealed F6).
  - Decide what a check measures. Checking the process (e.g. "made no tool call")
    scored differently from checking the outcome (e.g. "answer contains 13");
    F4 went from 40% to 90% by changing only the check.
  - The first case in a run pays the model's load time; its latency is inflated.
- Results so far (see `FAILURES.md`): F1 prompt change 33% -> ~68% pass; F3's float
  artifact (`777.7769999999999`) was a harness bug, fixed with `toPrecision(12)`.
