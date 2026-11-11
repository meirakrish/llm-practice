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
- **Status:** open. Candidate eval: final answer must contain the tool output.

### F4: ignores sequencing of dependent calls
- **Input:** `what is 1 + 2, and then add 10 to that`
- **Observed:** emits both calls in one turn, so the second call's argument
  is guessed or computed by the model itself, not taken from the first
  tool's result. Sometimes only one call is made and the model does the
  rest in its head.
- **Expected:** call `add(1, 2)`, wait for `3`, then call `add(3, 10)`.
- **Status:** open.

### F5: misreads a validation error
- **Input:** a call rejected for string arguments
- **Observed:** with the original terse error ("needs numeric a and b"), the
  model concluded the user had not given numbers and asked for them.
- **Status:** mitigated by a more explicit error message that includes what
  was sent.

## Notes
- All results above are single runs unless stated. The model is
  non-deterministic, so rates (N runs per case) are needed before drawing
  conclusions. That is the job of Phase 2.
