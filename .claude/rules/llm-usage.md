# LLM Usage — Agents Never Touch Numbers

- **Never let an LLM agent compute or alter a financial figure.** This is
  the foundational constraint the whole architecture (and the accuracy bar
  in `docs/PRD.md` §7) depends on — see also `plan.txt`/`session.md`/
  `docs/ARCHITECTURE.md` §9. Agents take Pydantic models in, return
  Pydantic models out; arithmetic happens only in `app/pipeline/*`, in
  Python `Decimal` + Pandas, never float.
- **All LLM calls go through a subclass of
  `app/agents/base.py::BaseAgent`**, Anthropic SDK only
  (`_build_messages`/`_parse_response`/`_mock_response`, tool-use for
  structured output). Never call `anthropic` directly from a router or
  pipeline module — always through an agent subclass, so mock-mode dispatch
  and retry/backoff stay centralized.
- **Anthropic is the only provider.** No OpenAI SDK or other provider SDK;
  treat OpenAI references in older docs (`plan.txt`) as stale.
- **To pin an agent to a non-default model**, set the `model` class
  attribute on the subclass (see `docs/ARCHITECTURE.md` §9.3) rather than
  branching on model inside `_call()`.
- **Existing exception, flagged not endorsed:**
  `frontend/app/api/inquiry/assistant/route.ts` calls the Anthropic Messages
  API directly from Next.js, with none of `BaseAgent`'s retry/mock/logging
  (`docs/ARCHITECTURE.md` §9.2). Don't copy that pattern for new LLM
  features.
- **Mock mode is for the `unit` tier only** — see [testing.md](testing.md).
