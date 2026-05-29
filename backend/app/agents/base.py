"""
BaseAgent — shared foundation for all LLM agents in the FDD Engine.

Responsibilities:
  - Holds the OpenAI async client (one per process, shared across agents)
  - Enforces the mock/real mode switch via USE_MOCK_LLM
  - Provides _call() with exponential-backoff retry for transient API errors
  - Tracks token usage per call for cost visibility
  - Enforces the golden rule: agents never receive DataFrames or return raw numbers
    for arithmetic — inputs and outputs are always Pydantic models or plain dicts

Subclasses override:
  _mock_response(payload) -> dict   used when USE_MOCK_LLM=true
  _build_messages(payload) -> list  the prompt construction
  _parse_response(raw) -> dict      extract structured data from tool-call response
"""

import asyncio
import logging
import time
from typing import Any

from openai import AsyncOpenAI, APIStatusError, APIConnectionError, RateLimitError

from app.config import settings

logger = logging.getLogger(__name__)

# Singleton async client — created once, reused across all agents
_client: AsyncOpenAI | None = None


def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


class AgentError(Exception):
    pass


class BaseAgent:
    """
    Abstract base for all FDD LLM agents.

    Usage pattern:
        agent = SomeAgent()
        result = await agent.run(payload)

    Subclasses must implement: _build_messages, _tools, _parse_response, _mock_response
    """

    #: Override in subclass with the OpenAI function/tool definitions
    _tools: list[dict] = []

    #: Name used in logs
    name: str = "BaseAgent"

    async def run(self, payload: Any) -> Any:
        """
        Entry point. Dispatches to mock or real depending on USE_MOCK_LLM.
        Wraps _call with logging and timing.
        """
        if settings.use_mock_llm:
            logger.debug("[%s] MOCK mode — returning fixture response", self.name)
            return self._mock_response(payload)

        start = time.monotonic()
        result = await self._call(payload)
        elapsed = time.monotonic() - start
        logger.info("[%s] completed in %.2fs", self.name, elapsed)
        return result

    async def _call(self, payload: Any, *, max_retries: int = 3) -> Any:
        """Call the OpenAI API with retry on transient errors."""
        messages = self._build_messages(payload)
        last_exc: Exception | None = None

        for attempt in range(max_retries):
            try:
                kwargs: dict[str, Any] = {
                    "model": settings.openai_model,
                    "messages": messages,
                    "temperature": 0,  # Deterministic output — critical for financial classification
                }
                if self._tools:
                    kwargs["tools"] = self._tools
                    kwargs["tool_choice"] = "required"

                resp = await get_client().chat.completions.create(**kwargs)

                usage = resp.usage
                if usage:
                    logger.info(
                        "[%s] tokens — prompt: %d, completion: %d, total: %d",
                        self.name, usage.prompt_tokens, usage.completion_tokens, usage.total_tokens,
                    )

                return self._parse_response(resp)

            except RateLimitError as exc:
                wait = 2 ** attempt * 5  # 5s, 10s, 20s
                logger.warning("[%s] rate limited — retrying in %ds (attempt %d)", self.name, wait, attempt + 1)
                await asyncio.sleep(wait)
                last_exc = exc

            except APIConnectionError as exc:
                wait = 2 ** attempt * 2
                logger.warning("[%s] connection error — retrying in %ds", self.name, wait)
                await asyncio.sleep(wait)
                last_exc = exc

            except APIStatusError as exc:
                # 4xx errors are not retryable
                raise AgentError(f"[{self.name}] API error {exc.status_code}: {exc.message}") from exc

        raise AgentError(
            f"[{self.name}] failed after {max_retries} attempts: {last_exc}"
        ) from last_exc

    # ── Subclass interface ────────────────────────────────────────────────────

    def _build_messages(self, payload: Any) -> list[dict]:
        raise NotImplementedError

    def _parse_response(self, response: Any) -> Any:
        raise NotImplementedError

    def _mock_response(self, payload: Any) -> Any:
        raise NotImplementedError
