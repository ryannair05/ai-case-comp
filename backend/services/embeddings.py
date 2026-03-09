"""
OpenAI text-embedding-3-large embedding service.

RULE: OpenAI is used ONLY for embeddings, never for generation.
      Claude Sonnet 4.6 is the PRIMARY LLM for all text generation.
"""
import asyncio
import os

from openai import AsyncOpenAI

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
    return _client

MODEL = "text-embedding-3-large"   # best accuracy:cost ratio
DIMENSIONS = 1024                   # matches existing Pinecone index (dimension reduction)
MAX_INPUT_CHARS = 8192 * 4          # ~8K tokens in chars


async def embed_text(text: str) -> list[float]:
    """
    Embed a single text string.
    Used at query time to embed the user's RFP/query for retrieval.
    """
    resp = await _get_client().embeddings.create(
        model=MODEL,
        input=text.strip()[:MAX_INPUT_CHARS],
        dimensions=DIMENSIONS,
    )
    return resp.data[0].embedding


async def embed_batch(texts: list[str]) -> list[list[float]]:
    """
    Embed a batch of text strings.
    Used at ingest time to embed document chunks.
    Processes in chunks of 100 to respect OpenAI rate limits.
    """
    results: list[list[float]] = []
    for i in range(0, len(texts), 100):
        batch = texts[i : i + 100]
        resp = await _get_client().embeddings.create(
            model=MODEL,
            input=[t.strip()[:MAX_INPUT_CHARS] for t in batch],
            dimensions=DIMENSIONS,
        )
        results.extend([d.embedding for d in resp.data])
        # Gentle rate limiting between batches
        await asyncio.sleep(0.1)
    return results
