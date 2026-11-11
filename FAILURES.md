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
- **Status:** open. Found by the `f3-exact-result` eval, which has no check
  of its own for it. Related to the open question: retry malformed model
  output, or send an error back to the model?

## Notes
- All results above are single runs unless stated. The model is
  non-deterministic, so rates (N runs per case) are needed before drawing
  conclusions. That is the job of Phase 2.
