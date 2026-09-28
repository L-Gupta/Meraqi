# agents — LLM-touching code only

**Purpose:** Every Anthropic call in the backend, wrapped as `BaseAgent` subclasses that take Pydantic models in and return Pydantic models out — semantic tasks only, never arithmetic (`.claude/rules/llm-usage.md`).

**Contents**
- `base.py` — `BaseAgent`: shared `AsyncAnthropic` client, mock/real switch (`USE_MOCK_LLM`), tool-use translation (OpenAI-shaped `_tools` → Anthropic format), retry/backoff, token logging, per-agent `model` override. `AgentError`.
- `coa_mapper.py` — `CoAMapperAgent`: account code + description → `ChartOfAccountsCategory` (default model).
- `qoe_reviewer.py` — `QoEReviewerAgent`: accept/reject/modify rule-detected QoE candidates (default model).
- `redflag_analyst.py` — `RedFlagAnalystAgent`: context, diligence questions, impact narrative for High/Medium flags (pinned `claude-opus-5`).
- `contract_parser.py` — `ContractParserAgent` / `parse_debt_from_text`: debt instrument + clause extraction from PDF text (pinned `claude-opus-5`).
- `narrative_drafter.py` — `NarrativeDrafterAgent`: phrases 5 sections from a fact sheet of pre-computed figures (pinned `claude-opus-5`).

**How it fits in:** Called only from `pipeline/*` orchestrators, never from routers. Model assignments and retry details: `docs/ARCHITECTURE.md` §9.

**Gotchas**
- ⚠️ `qoe_reviewer.py` lets a `modify` decision overwrite `adjustment_amount` with the model's `corrected_amount` — an LLM setting a financial figure, which violates the core rule. Flagged, not fixed.
- Real models drift from tool schemas (stringified JSON, prose instead of objects); every agent has recovery code for this — keep it when editing.
- Mock mode (`_mock_response`) is for the `unit` test tier only (`.claude/rules/testing.md`).
- A pinned `model` ignores the `ANTHROPIC_MODEL` env var.
- Docstrings in `qoe_reviewer.py` ("Claude/GPT") and `redflag_analyst.py` ("refined financial impact range estimates") overstate what they do; the analyst only returns prose.
