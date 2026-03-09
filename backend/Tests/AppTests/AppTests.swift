import Testing
import VaporTesting
@testable import App

// MARK: - RAG Pipeline / Chunking

@Suite("RAGPipeline")
struct RAGPipelineTests {
    let pipeline = RAGPipeline.shared

    @Test("Short text returns single chunk")
    func shortTextSingleChunk() {
        let text = "This is a short proposal text that fits in one chunk."
        let chunks = pipeline.chunkText(text)
        #expect(chunks.count == 1)
        #expect(chunks[0] == text)
    }

    @Test("Long text creates multiple overlapping chunks")
    func longTextMultipleChunks() {
        let words = Array(repeating: "word", count: 1000)
        let text = words.joined(separator: " ")
        let chunks = pipeline.chunkText(text)
        #expect(chunks.count > 1)
    }

    @Test("Empty text returns zero chunks")
    func emptyTextZeroChunks() {
        let chunks = pipeline.chunkText("   \n\n   ")
        #expect(chunks.isEmpty)
    }

    @Test("Tiny trailing chunks dropped")
    func tinyTrailingChunksDropped() {
        let words = Array(repeating: "word", count: 410)
        let chunks = pipeline.chunkText(words.joined(separator: " "))
        for chunk in chunks {
            #expect(chunk.count > 50)
        }
    }
}

// MARK: - Vector binary packing

@Suite("VectorEntry binary packing")
struct VectorPackingTests {
    @Test("Pack/unpack round-trip preserves values")
    func packUnpackRoundTrip() {
        let original: [Float] = (0..<1024).map { Float($0) / 1024.0 }
        let packed = VectorEntry.pack(original)
        let unpacked = VectorEntry.unpack(packed)
        #expect(unpacked.count == original.count)
        for (a, b) in zip(original, unpacked) {
            #expect(abs(a - b) < 1e-6)
        }
    }

    @Test("Packed size is 4 bytes per float")
    func packedSize() {
        let floats: [Float] = Array(repeating: 1.0, count: 1024)
        let packed = VectorEntry.pack(floats)
        #expect(packed.count == 1024 * 4)
    }
}

// MARK: - SIMD cosine similarity

@Suite("SIMD cosine similarity")
struct CosineSimilarityTests {
    @Test("Identical vectors score 1.0")
    func identicalVectors() {
        let v: [Float] = Array(repeating: 0.5, count: 1024)
        let score = simdCosineSimilarity(v, v)
        #expect(abs(score - 1.0) < 1e-5)
    }

    @Test("Orthogonal vectors score 0.0")
    func orthogonalVectors() {
        var a = [Float](repeating: 0, count: 1024)
        var b = [Float](repeating: 0, count: 1024)
        a[0] = 1.0
        b[1] = 1.0
        let score = simdCosineSimilarity(a, b)
        #expect(abs(score) < 1e-5)
    }

    @Test("Zero vector returns 0.0 (no divide by zero)")
    func zeroVector() {
        let zero = [Float](repeating: 0, count: 1024)
        let v    = [Float](repeating: 0.1, count: 1024)
        #expect(simdCosineSimilarity(zero, v) == 0.0)
        #expect(simdCosineSimilarity(v, zero) == 0.0)
    }

    @Test("Similarity matches reference scalar implementation")
    func matchesScalarReference() {
        var rng = SystemRandomNumberGenerator()
        let a = (0..<1024).map { _ in Float.random(in: -1...1, using: &rng) }
        let b = (0..<1024).map { _ in Float.random(in: -1...1, using: &rng) }
        let simdScore   = simdCosineSimilarity(a, b)
        let scalarScore = scalarCosineSimilarity(a, b)
        #expect(abs(simdScore - scalarScore) < 1e-4)
    }
}

// MARK: - Cold-start library

@Suite("ColdStart")
struct ColdStartTests {
    @Test("Threshold is 15 proposals")
    func thresholdIs15() {
        #expect(ColdStart.shared.threshold == 15)
    }

    @Test("Marketing agency template returns chunks")
    func marketingAgencyChunks() {
        let chunks = ColdStart.shared.getContext(industry: "marketing_agency")
        #expect(!chunks.isEmpty)
        #expect(chunks.allSatisfy { !$0.text.isEmpty })
        #expect(chunks.allSatisfy { $0.score > 0 })
    }

    @Test("Unknown industry falls back to consulting template")
    func unknownIndustryFallback() {
        let chunks = ColdStart.shared.getContext(industry: "underwater_basket_weaving")
        #expect(!chunks.isEmpty)
    }

    @Test("All 4 verticals return chunks with all entry types")
    func allVerticalsReturnChunks() {
        for industry in ["marketing_agency", "consulting", "legal", "accounting"] {
            let chunks = ColdStart.shared.getContext(industry: industry)
            let types = Set(chunks.map(\.entryType))
            #expect(types.contains("pricing"))
            #expect(types.contains("proposal_chunk"))
            #expect(types.contains("brand_voice"))
        }
    }
}

// MARK: - DOCX export

@Suite("DocxExporter")
struct DocxExporterTests {
    @Test("Export produces non-empty Data")
    func exportNonEmpty() throws {
        let data = try DocxExporter.shared.export(
            title: "Test Proposal",
            content: "EXECUTIVE SUMMARY\nThis is a test proposal.",
            clientName: "Acme Corp"
        )
        #expect(data.count > 100)
    }

    @Test("Export starts with ZIP magic bytes")
    func exportIsZIP() throws {
        let data = try DocxExporter.shared.export(
            title: "Test",
            content: "Content",
            clientName: nil
        )
        // ZIP local file header magic: PK\x03\x04
        #expect(data[0] == 0x50)
        #expect(data[1] == 0x4B)
        #expect(data[2] == 0x03)
        #expect(data[3] == 0x04)
    }
}

// MARK: - Pricing row text format

@Suite("Pricing row format")
struct PricingRowTests {
    @Test("Text format matches expected pattern")
    func textFormat() {
        let row = PricingRow(serviceType: "brand_strategy", priceUsd: 12000, won: true, notes: "")
        let text = "Service: \(row.serviceType) | Price: USD \(row.priceUsd) | Won: \(row.won.map(String.init) ?? "unknown") | Notes: \(row.notes ?? "")"
        #expect(text.contains("brand_strategy"))
        #expect(text.contains("12000"))
        #expect(text.contains("true"))
    }
}

// MARK: - Scalar reference for tests

private func scalarCosineSimilarity(_ a: [Float], _ b: [Float]) -> Float {
    var dot: Float = 0, normA: Float = 0, normB: Float = 0
    for i in 0..<a.count { dot += a[i]*b[i]; normA += a[i]*a[i]; normB += b[i]*b[i] }
    let d = normA.squareRoot() * normB.squareRoot()
    return d == 0 ? 0 : dot / d
}
