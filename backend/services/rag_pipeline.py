"""
RAG (Retrieval-Augmented Generation) pipeline for Context-Mapper.

Handles:
1. Chunking long documents into overlapping 400-token chunks
2. Embedding and upserting to Pinecone (customer-isolated namespace)
3. Query-time retrieval with relevance filtering
4. Context-aware proposal generation via Claude Sonnet 4.6
"""
import uuid

from services.embeddings import embed_batch, embed_text
from services.pinecone_client import upsert_vectors, query_vectors, query_kb_vectors
from services.claude_client import generate_with_context

CHUNK_SIZE = 400        # tokens (~300 words)
CHUNK_OVERLAP = 80      # prevents cutting mid-sentence
RELEVANCE_THRESHOLD = 0.72  # minimum cosine similarity score


def chunk_text(text: str) -> list[str]:
    """
    Split text into overlapping word-boundary chunks.
    Overlap ensures semantic search finds relevant sections even at chunk boundaries.
    """
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i : i + CHUNK_SIZE])
        chunks.append(chunk)
        i += CHUNK_SIZE - CHUNK_OVERLAP
    # Drop tiny trailing chunks (likely incomplete sentences)
    return [c for c in chunks if len(c.strip()) > 50]


async def ingest_proposal_text(
    customer_id: str,
    proposal_id: str,
    text: str,
    metadata: dict,
) -> int:
    """
    Chunk, embed, and upsert a full proposal document to the customer's namespace.

    metadata should include: title, client_name, outcome, value_usd, win_reason
    Returns the number of vectors upserted.
    """
    chunks = chunk_text(text)
    if not chunks:
        return 0

    embeddings = await embed_batch(chunks)
    vectors = [
        {
            "id": f"prop_{proposal_id}_chunk_{i}",
            "values": emb,
            "metadata": {
                "type": "proposal_chunk",
                "customer_id": customer_id,
                "proposal_id": proposal_id,
                "chunk_index": i,
                "text": chunks[i],
                **metadata,
            },
        }
        for i, emb in enumerate(embeddings)
    ]
    upsert_vectors(customer_id, vectors)
    return len(vectors)


async def ingest_brand_voice_text(
    customer_id: str,
    brand_voice_id: str,
    text: str,
    metadata: dict,
) -> int:
    """Embed and upsert brand voice examples to the customer's namespace."""
    chunks = chunk_text(text)
    if not chunks:
        return 0

    embeddings = await embed_batch(chunks)
    vectors = [
        {
            "id": f"bv_{brand_voice_id}_chunk_{i}",
            "values": emb,
            "metadata": {
                "type": "brand_voice",
                "customer_id": customer_id,
                "brand_voice_id": brand_voice_id,
                "chunk_index": i,
                "text": chunks[i],
                **metadata,
            },
        }
        for i, emb in enumerate(embeddings)
    ]
    upsert_vectors(customer_id, vectors)
    return len(vectors)


async def ingest_pricing_rows(customer_id: str, rows: list[dict]) -> int:
    """
    Embed pricing rows and upsert to the customer's namespace.
    Text format: "Service: {type} | Price: USD {price} | Won: {won} | Notes: {notes}"
    """
    texts = [
        f"Service: {r['service_type']} | Price: USD {r['price_usd']} | "
        f"Won: {r.get('won', 'unknown')} | Notes: {r.get('notes', '')}"
        for r in rows
    ]
    embeddings = await embed_batch(texts)
    vectors = [
        {
            "id": f"pricing_{customer_id}_{i}_{uuid.uuid4().hex[:8]}",
            "values": emb,
            "metadata": {
                "type": "pricing",
                "customer_id": customer_id,
                "service_type": rows[i]["service_type"],
                "price_usd": rows[i]["price_usd"],
                "won": rows[i].get("won"),
                "text": texts[i],
            },
        }
        for i, emb in enumerate(embeddings)
    ]
    upsert_vectors(customer_id, vectors)
    return len(vectors)


async def retrieve_context(
    customer_id: str,
    query: str,
    top_k: int = 8,
) -> list[dict]:
    """
    RAG retrieval: embed the query, find the most relevant chunks for this customer.
    Filters by relevance threshold (0.72) to avoid noise.
    Returns list of metadata dicts sorted by relevance score.
    """
    query_vector = await embed_text(query)
    matches = query_vectors(customer_id, query_vector, top_k=top_k)
    return [
        {
            "score": m.score,
            "text": m.metadata.get("text", ""),
            "type": m.metadata.get("type", ""),
            **m.metadata,
        }
        for m in matches
        if m.score > RELEVANCE_THRESHOLD
    ]


async def retrieve_kb_context(query: str, top_k: int = 5) -> list[dict]:
    """Retrieve relevant KB articles for support ticket deflection."""
    query_vector = await embed_text(query)
    matches = query_kb_vectors(query_vector, top_k=top_k)
    return [
        {
            "score": m.score,
            "text": m.metadata.get("text", ""),
            **m.metadata,
        }
        for m in matches
        if m.score > 0.65  # slightly lower threshold for KB (broader match)
    ]


async def generate_proposal_with_rag(
    customer_id: str,
    rfp_text: str,
    proposals_indexed: int,
) -> str:
    """
    Full RAG pipeline: retrieve context → generate proposal with Claude.
    Automatically switches to cold-start mode when < 15 proposals indexed.
    """
    from services.cold_start import COLD_START_THRESHOLD, get_cold_start_context

    if proposals_indexed < COLD_START_THRESHOLD:
        # Use industry template library for cold-start customers
        # customer industry needs to come from caller
        context_chunks = []
        result = await generate_with_context(
            customer_id=customer_id,
            rfp_text=rfp_text,
            context_chunks=context_chunks,
            cold_start=True,
        )
    else:
        context_chunks = await retrieve_context(customer_id, rfp_text)
        result = await generate_with_context(
            customer_id=customer_id,
            rfp_text=rfp_text,
            context_chunks=context_chunks,
            cold_start=False,
        )
    return result
