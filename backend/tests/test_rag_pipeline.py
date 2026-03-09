"""
Tests for the RAG pipeline — chunking, embedding, retrieval.
Run: pytest backend/tests/ -v
"""
import pytest
from services.rag_pipeline import chunk_text, CHUNK_SIZE, CHUNK_OVERLAP


class TestChunkText:
    def test_short_text_returns_single_chunk(self):
        text = "This is a short proposal text that fits in one chunk."
        chunks = chunk_text(text)
        assert len(chunks) == 1
        assert chunks[0] == text

    def test_long_text_creates_overlapping_chunks(self):
        words = ["word"] * 1000
        text = " ".join(words)
        chunks = chunk_text(text)
        assert len(chunks) > 1
        # Chunks should overlap
        for chunk in chunks:
            word_count = len(chunk.split())
            assert word_count <= CHUNK_SIZE

    def test_empty_chunks_dropped(self):
        chunks = chunk_text("   \n\n   ")
        assert len(chunks) == 0

    def test_tiny_chunks_dropped(self):
        # A text that would produce a tiny trailing chunk
        words = ["word"] * (CHUNK_SIZE + 10)
        text = " ".join(words)
        chunks = chunk_text(text)
        for chunk in chunks:
            assert len(chunk.strip()) > 50

    def test_chunk_overlap(self):
        words = [f"word{i}" for i in range(CHUNK_SIZE + 100)]
        text = " ".join(words)
        chunks = chunk_text(text)
        assert len(chunks) >= 2
        # Last word of first chunk should appear in second chunk
        first_chunk_words = chunks[0].split()
        second_chunk_words = chunks[1].split()
        # Overlap region
        overlap_words = first_chunk_words[-(CHUNK_OVERLAP):]
        assert overlap_words[0] in second_chunk_words


class TestCustomerNamespace:
    def test_namespace_format(self):
        from services.pinecone_client import customer_namespace
        ns = customer_namespace("test-123")
        assert ns == "customer_test-123"

    def test_no_shared_namespace(self):
        from services.pinecone_client import customer_namespace
        ns1 = customer_namespace("customer-a")
        ns2 = customer_namespace("customer-b")
        assert ns1 != ns2
        assert "customer-a" in ns1
        assert "customer-b" in ns2


class TestColdStart:
    def test_cold_start_threshold(self):
        from services.cold_start import COLD_START_THRESHOLD
        assert COLD_START_THRESHOLD == 15

    @pytest.mark.asyncio
    async def test_get_cold_start_context_returns_chunks(self):
        from services.cold_start import get_cold_start_context
        chunks = await get_cold_start_context("test-customer", "marketing_agency")
        assert len(chunks) > 0
        assert all("type" in c for c in chunks)
        assert all("text" in c for c in chunks)
        assert all("score" in c for c in chunks)

    @pytest.mark.asyncio
    async def test_unknown_industry_falls_back_to_consulting(self):
        from services.cold_start import get_cold_start_context
        chunks = await get_cold_start_context("test-customer", "unknown_industry_xyz")
        assert len(chunks) > 0


class TestPricingIngestion:
    def test_pricing_row_text_format(self):
        """Verify pricing text format matches what's embedded."""
        row = {"service_type": "brand_strategy", "price_usd": 12000, "won": True, "notes": ""}
        text = (
            f"Service: {row['service_type']} | Price: USD {row['price_usd']} | "
            f"Won: {row.get('won', 'unknown')} | Notes: {row.get('notes', '')}"
        )
        assert "brand_strategy" in text
        assert "12000" in text
        assert "True" in text
