# CLAUDE.md

This is a learning project (see README.md for the roadmap and current status).
The owner is learning how LLM agents work by building a harness by hand.

## How to work with me here

- **I write the code; you guide.** Explain the relevant concept, give one small
  task, then review what I wrote. Don't write my implementation unless I ask
  (tests, snippets, or a fix I explicitly request are fine).
- **One step at a time.** Don't lay out the whole plan.
- **Keep answers short.** Lists over prose. I have asked more than once for less text.
- **Be precise about where code goes.** I follow instructions literally.
- **Read my files yourself** instead of asking me to paste code.
- **Review means running the checks:** `npx tsc --noEmit` and `npm test`.
  `tsx` does not type-check, so code can run while still being type-wrong.
- Prefer teaching the *why* (what a harness does and why) over just the fix.

## Git

- Commit and push only when asked.
- Use a new branch per chunk of work. I merge through a PR, then pull `main`.

## Commands

```bash
npm install
npx tsx src/main.ts         # run the agent on sample questions
npm run calibrate           # compare estimated vs real prompt tokens
npm run evals               # run all eval cases 20x each, print summary (needs Ollama)
npm test                    # node:test via tsx
npx tsc --noEmit            # type-check
```

## Environment

- TypeScript on Node 22, strict tsconfig (`noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `verbatimModuleSyntax`).
- Ollama runs on Windows and is reachable from WSL at `http://localhost:11434`.
  Model: `llama3.2:3b`.
- Types must be imported with `import type` / `import { type X }`, because
  `tsx` compiles files in isolation.

## Where things are

- `src/main.ts`: entry point; runs the sample questions.
- `src/agent.ts`: the agent loop (`runAgent`).
- `src/ollama.ts`: Ollama client (`fetchWithRetry`, `chat`, `chatStream`, model/url/timeouts).
- `src/tools.ts`: tool registry, `executeTool`, `buildToolsArray`.
- `src/types.ts`: shared types.
- `src/parse.ts`: `parseChatResponse`, `parseChatChunk`, `parseToolCalls` (runtime validation).
- `src/parse.test.ts`: tests for the parsers.
- `src/stream.ts`: `readLines` (byte stream to complete lines).
- `src/stream.test.ts`: tests for `readLines`.
- `src/stream-demo.ts`: throwaway demo of reading a raw stream.
- `src/context.ts`: `estimateTokens` and `trimMessages`.
- `src/context.test.ts`: tests for `trimMessages`.
- `src/calibrate.ts`: compares estimated vs real prompt tokens for prose and JSON filler.
- `src/malformed.ts`: `looksLikeToolCall` (reply text that looks like a typed-out tool call).
- `src/malformed.test.ts`: tests for `looksLikeToolCall`.
- `src/cases.ts`: eval cases (`f1`..`f4`, `add`); each has an `input` and a `check(RunResult)`.
- `src/runner.ts`: `runCase(case, runs)` returns a `CaseReport`.
- `src/evals.ts`: entry point for `npm run evals`; prints one summary line per case.
- `FAILURES.md`: observed model/harness failures (F1-F6); each should become an eval.

## Known design decisions

- Tool validation returns an error *string* to the model instead of throwing,
  so the model can read it and recover.
- Validation checks shape, not meaning (see F1 in `FAILURES.md`).
- Malformed model output (F6: a tool call written as text) is retried, up to
  `maxRetries` (2) in `runAgent`, without adding the bad reply to the history.
  Sending the error back to the model was not tried.
- Evals: a thrown run counts as a failed run; runs are sequential (one local
  model). Compare changes with pooled rates over several N=20 batches, and keep the
  check fixed when comparing prompts. Checks grade outcomes where possible.
- The system prompt must stay a single message at index 0 (`trimMessages` protects
  indexes 0 and 1).
