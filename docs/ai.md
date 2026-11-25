# AI Services

`backend/src/services/ai.ts` is the provider adapter. It accepts an OpenAI-compatible chat-completions URL and keeps the secret server-side. `planner.ts` exposes reusable skill-gap, learning-path and assistant functions. Prompts include learner profile, evidence and current state so the assistant is not a generic chatbot.

Production hardening: add schema validators for each provider response, retry/backoff, model-specific token budgets, prompt/version logging and a background job queue for long-running document analysis.
