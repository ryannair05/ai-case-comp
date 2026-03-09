"""
Pinecone Serverless client for Draftly Context-Mapper.

ARCHITECTURE RULE: Every customer gets their OWN namespace.
  namespace = f"customer_{customer_id}"
Zero cross-customer data. This is architectural, not a policy.
Never query Pinecone without a namespace filter.
"""
import os
from pinecone import Pinecone, ServerlessSpec

_pc: Pinecone | None = None

INDEX_NAME = os.environ.get("PINECONE_INDEX_NAME", "draftly-context-mapper")
DIMENSION = 1024   # text-embedding-3-large with dimension reduction (matches existing index)
METRIC = "cosine"


def _get_pc() -> Pinecone:
    """Lazy-initialize the Pinecone client (reads env var on first call)."""
    global _pc
    if _pc is None:
        _pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
    return _pc


def get_or_create_index():
    """Create the shared Pinecone index if it doesn't exist yet."""
    pc = _get_pc()
    existing = [i.name for i in pc.list_indexes()]
    if INDEX_NAME not in existing:
        pc.create_index(
            name=INDEX_NAME,
            dimension=DIMENSION,
            metric=METRIC,
            spec=ServerlessSpec(cloud="aws", region="us-east-1"),
        )
    return pc.Index(INDEX_NAME)


def customer_namespace(customer_id: str) -> str:
    """
    RULE: Every query to Pinecone MUST use this function to get the namespace.
    Never query without a namespace. Never share namespaces between customers.
    """
    return f"customer_{customer_id}"


def upsert_vectors(customer_id: str, vectors: list[dict]) -> None:
    """
    Upsert vectors into the customer's private namespace.

    vectors = [{"id": str, "values": list[float], "metadata": dict}]
    """
    index = get_or_create_index()
    namespace = customer_namespace(customer_id)
    # Pinecone upsert accepts batches; chunk to 100 for safety
    for i in range(0, len(vectors), 100):
        index.upsert(vectors=vectors[i : i + 100], namespace=namespace)


def query_vectors(
    customer_id: str,
    query_vector: list[float],
    top_k: int = 8,
) -> list[dict]:
    """
    Retrieve top-k relevant chunks for this customer ONLY.
    Returns raw Pinecone match objects.
    """
    index = get_or_create_index()
    namespace = customer_namespace(customer_id)
    result = index.query(
        vector=query_vector,
        top_k=top_k,
        namespace=namespace,
        include_metadata=True,
    )
    return result.matches


def delete_customer_data(customer_id: str) -> None:
    """
    One-click data portability — deletes ALL vectors for a customer immediately.
    Called on account deletion (GDPR right to erasure).
    """
    index = get_or_create_index()
    namespace = customer_namespace(customer_id)
    index.delete(delete_all=True, namespace=namespace)


def upsert_kb_vectors(vectors: list[dict]) -> None:
    """
    Upsert vectors into the shared knowledge-base namespace.
    Used for help-centre articles — NOT customer data.
    """
    index = get_or_create_index()
    for i in range(0, len(vectors), 100):
        index.upsert(vectors=vectors[i : i + 100], namespace="kb")


def query_kb_vectors(query_vector: list[float], top_k: int = 5) -> list[dict]:
    """Semantic search over shared KB articles."""
    index = get_or_create_index()
    result = index.query(
        vector=query_vector,
        top_k=top_k,
        namespace="kb",
        include_metadata=True,
    )
    return result.matches
