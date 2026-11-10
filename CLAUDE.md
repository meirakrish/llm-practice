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
- `src/ollama.ts`: Ollama client (`fetchWithRetry`, `chat`, model/url/timeout).
- `src/tools.ts`: tool registry, `executeTool`, `buildToolsArray`.
- `src/types.ts`: shared types.
- `src/parse.ts`: `parseChatResponse` (runtime validation).
- `src/parse.test.ts`: tests for the parser.
- `src/context.ts`: `estimateTokens` (messages + tool definitions).
- `src/calibrate.ts`: work in progress; compares estimates to real token counts.
- `FAILURES.md`: observed model/harness failures; each should become an eval in Phase 2.

## Known design decisions

- Tool validation returns an error *string* to the model instead of throwing,
  so the model can read it and recover.
- Validation checks shape, not meaning (see F1 in `FAILURES.md`).
- Open question, deferred to Phase 2: retry malformed model output, or send the
  error back to the model?
