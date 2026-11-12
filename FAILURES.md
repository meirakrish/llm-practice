# Known failures

A running log of model/harness failures observed while building the agent.
Each entry should become an eval case in Phase 2, so record the exact input,
what happened, and what we expected.

Format: **Input** → **Observed** → **Expected** → **Status**

## llama3.2:3b

### F1: invents arguments when none are given
- **Input:** `what is + ?` (tools: `add`, `multiply`)
- **Observed:** calls `add` with made-up values. Varies run to run:
  `{a: 0, b: 1}`, `{a: 0, b: 0}`, `{a: '0', b: '0'}`. Sometimes sends
  `null` instead, which is the desired behavior.
- **Expected:** no tool call; asks the user for the two numbers.
- **Status:** open. The system prompt and parameter descriptions reduce it
  but do not remove it. Harness validation can't catch it because the values
  are well-formed numbers (shape is valid, meaning is not).
- **Eval:** `f1-no-args` in `src/cases.ts`. Fails if any tool call has a
  non-null argument (`null` args are rejected by validation, so they pass).
  Pass rate over 3 × 20 runs each:
  - old prompt ("If the user doesn't give both numbers, ask for them. Never
    call a tool with made-up values."): 33% (20/60)
  - new prompt ("when using the add tool, the user must give two input
    numbers, otherwise, do not call the add tool; ask for the missing
    numbers."): 68% (41/60)
  - The remaining failures are mostly `1, 2` and `0, 0`, as numbers or strings.

### F2: sends numbers as strings
- **Input:** e.g. `what is 222.222 + 555.555 ?`
- **Observed:** `{a: '222.222', b: '555.555'}`; also `'-11'`. Intermittent.
- **Expected:** JSON numbers.
- **Status:** mitigated. `toNumber` in the harness accepts numeric strings.
  Worth counting how often coercion happens in Phase 2.

### F3: paraphrases a correct tool result inexactly
- **Input:** `what is 222.222 + 555.555 ?`
- **Observed:** tool returned `777.777`; final answer said "approximately 777.78".
- **Expected:** the exact tool result.
- **Status:** mostly fixed. The root cause was the harness, not the model:
  `222.222 + 555.555` is `777.7769999999999` in JS floating point, and `add`
  returned that raw string, so the model rounded it in different ways.
  `add` now returns `Number(sum.toPrecision(12)).toString()`.
  Eval: `f3-exact-result` (answer must contain `777.777`). Pass rate 85% → 90%
  (N=20); no rounding failures remain, the 2 failures left are F6.
  `multiply` has the same float issue and no case yet.

### F4: ignores sequencing of dependent calls
- **Input:** `what is 1 + 2, and then add 10 to that`
- **Observed:** emits both calls in one turn, so the second call's argument
  is guessed or computed by the model itself, not taken from the first
  tool's result. Sometimes only one call is made and the model does the
  rest in its head.
- **Expected:** call `add(1, 2)`, wait for `3`, then call `add(3, 10)`.
- **Status:** open, but the outcome is mostly right. Eval: `f4-sequencing`
  (answer must contain `13`). Pass rate 90% (N=20). A stricter version that
  required two calls with the second using `3` scored 40%, because the model
  usually computes `1 + 2` itself and makes one `add(3, 10)` call. The check
  grades the outcome, so it can't tell tool use from mental arithmetic.
  Real failures left: answers `4` (wrong call `add(1, 3)`) and `3` (stops
  after the first step).

### F5: misreads a validation error
- **Input:** a call rejected for string arguments
- **Observed:** with the original terse error ("needs numeric a and b"), the
  model concluded the user had not given numbers and asked for them.
- **Status:** mitigated by a more explicit error message that includes what
  was sent.

### F6: writes the tool call as plain text
- **Input:** `what is 222.222 + 555.555 ?`
- **Observed:** the final answer is the text
  `{"name":"add","parameters{"a": "222.222", "b": "555.555"}}`. The model
  wrote the call as text instead of a real tool call, and the JSON is
  malformed (missing `:`). 2 of 20 runs.
- **Expected:** a real tool call, or at least a readable answer.
- **Status:** mitigated. Found by the `f3-exact-result` eval. Own eval:
  `f6-call-as-text` (fails if the answer contains `"name"` or `"parameters"`).
  Before: 90% (N=20, about 4 failures in 40 runs). Fix: `runAgent` retries the
  request (up to `maxRetries = 2`) when the reply has no `tool_calls` but
  `looksLikeToolCall` (in `src/malformed.ts`) says the text looks like a typed-out
  call. The bad reply is not added to the history. After: 100% (3 × 20 runs).
  Not measured: how often the retry fires (`RunResult` has no `retries` field).

## qwen2.5:3b

### F7: empty reply
- **Input:** seen on `what is 222.222 + 555.555 ?` (2 of 20 runs) and
  `what is 1 + 2, and then add 10 to that` (1 of 20).
- **Observed:** the final answer is the empty string `''`.
- **Expected:** a real answer.
- **Status:** mitigated. Eval: `f7-empty-reply` (answer must not be empty).
  Before: qwen2.5:3b 95/100 (5%). Fix: `runAgent` retries an empty reply
  (up to `maxRetries`, sharing the counter with F6) without adding it to the
  history. After: 100/100, plus 20/20 in a full-suite batch. At a 5% rate a
  clean 100 runs happens ~0.6% of the time, so the retry works.

### F8: asks for numbers the user already gave
- **Input:** `what is 1 + 2, and then add 10 to that`
- **Observed:** answers like "Please provide the first number (1) and the second
  number (2)", or a wrong result (`30`). Same family as F5.
- **Status:** open. Seen in 3 of 20 f4 runs.

## Notes
- All results above are single runs unless stated. The model is
  non-deterministic, so rates (N runs per case) are needed before drawing
  conclusions. That is the job of Phase 2.
