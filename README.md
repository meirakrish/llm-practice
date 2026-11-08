# project-slow-horse

A hands-on learning project for understanding how LLM agents and the models
behind them work, built from scratch without agent frameworks.

## Why
Frameworks hide the interesting parts. This project builds each piece by hand
to understand what a harness does and why, then goes one level deeper into
the models themselves.

## Roadmap

### Phase 1: Agent harness from scratch
Build the core agent loop by hand:
- Send messages, parse tool calls, execute tools, feed results back,
  and decide when to stop
- A simple, explicit tool interface with input validation and guardrails
- Context management: handle a growing conversation within the model's
  context window
- Robustness: retries, malformed model output, and failure handling
- Streaming responses

### Phase 2: Evals
Measure the harness instead of guessing:
- A small suite of tasks with clear success criteria
- Track success rate, latency, and token usage
- Compare the effect of prompt, tool-design, and model changes objectively

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
- Local models via [Ollama](https://ollama.com), so everything can be tested locally
- Developed on WSL
