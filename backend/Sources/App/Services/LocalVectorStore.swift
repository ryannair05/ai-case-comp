import Foundation
import Fluent

/// Local vector store backed by SQLite — replaces Pinecone.
///
/// ## Storage
/// Each embedding is stored as a raw binary BLOB: 1024 × Float32 = 4 096 bytes.
/// Compared to JSON ("0.12345678901234567," × 1024 ≈ 22 KB):
///   - 5× smaller on disk
///   - Zero-parse cost — pointer reinterpretation only
///
/// ## Similarity computation
/// Cosine similarity uses SIMD16<Float> (16-wide FP32 SIMD available on
/// both ARM64 and x86-64).  One instruction processes 16 dimensions, so a
/// 1024-dim dot-product completes in 64 iterations instead of 1024.
///
/// ## Isolation
/// Every query filters on `customer_id`.  A customer NEVER sees another
/// customer's vectors — mirrors Pinecone namespace isolation at the SQL layer.
struct LocalVectorStore {
    static let shared = LocalVectorStore()
    private init() {}

    // Minimum cosine similarity to include in results
    private let relevanceThreshold: Float = 0.72
    // Expected embedding dimensionality
    private let dimensions = 1024

    // MARK: - Upsert

    /// Embed texts and persist them as binary BLOBs for a customer.
    func upsert(
        customerId: String,
        entryType: String,
        texts: [String],
        metadatas: [[String: Any]] = [],
        db: any Database
    ) async throws {
        guard !texts.isEmpty else { return }
        let embeddings = try await EmbeddingsService.shared.embedBatch(texts)

        for (i, (text, embedding)) in zip(texts, embeddings).enumerated() {
            let meta = metadatas.indices.contains(i) ? metadatas[i] : [:]
            let entry = try VectorEntry(
                customerId: customerId,
                entryType: entryType,
                text: text,
                embedding: embedding,
                metadata: meta
            )
            try await entry.save(on: db)
        }
    }

    // MARK: - Query

    /// Retrieve the top-k most relevant chunks for a customer.
    ///
    /// Flow:
    ///   1. Embed the query text (OpenAI)
    ///   2. Load all BLOBs for `customerId` from SQLite
    ///   3. Compute SIMD cosine similarity for each row
    ///   4. Return top-k rows with score ≥ relevanceThreshold
    func query(
        customerId: String,
        queryText: String,
        topK: Int = 8,
        db: any Database
    ) async throws -> [VectorMatch] {
        let queryVec = try await EmbeddingsService.shared.embed(queryText)
        let entries = try await VectorEntry.query(on: db)
            .filter(\.$customerId == customerId)
            .all()
        return simdRankedMatches(
            entries: entries,
            queryVec: queryVec,
            topK: topK,
            threshold: relevanceThreshold
        )
    }

    /// Retrieve from the shared KB namespace (support ticket deflection).
    /// Uses a slightly lower threshold (0.65) for broader matching.
    func queryKB(
        queryText: String,
        topK: Int = 5,
        db: any Database
    ) async throws -> [VectorMatch] {
        let queryVec = try await EmbeddingsService.shared.embed(queryText)
        let entries = try await VectorEntry.query(on: db)
            .filter(\.$customerId == "kb")
            .all()
        return simdRankedMatches(entries: entries, queryVec: queryVec, topK: topK, threshold: 0.65)
    }

    /// Delete all vector data for a customer (GDPR right to erasure).
    func deleteCustomerData(customerId: String, db: any Database) async throws {
        try await VectorEntry.query(on: db)
            .filter(\.$customerId == customerId)
            .delete()
    }

    // MARK: - SIMD cosine similarity

    /// Score every entry against the query vector using SIMD16<Float>,
    /// sort descending, and return top-k results above the threshold.
    private func simdRankedMatches(
        entries: [VectorEntry],
        queryVec: [Float],
        topK: Int,
        threshold: Float
    ) -> [VectorMatch] {
        var scored: [(score: Float, entry: VectorEntry)] = []
        scored.reserveCapacity(entries.count)

        for entry in entries {
            let docVec = VectorEntry.unpack(entry.embeddingBlob)
            guard docVec.count == queryVec.count else { continue }
            let score = simdCosineSimilarity(queryVec, docVec)
            if score >= threshold {
                scored.append((score, entry))
            }
        }

        return scored
            .sorted { $0.score > $1.score }
            .prefix(topK)
            .map { item in
                let meta = (try? JSONSerialization.jsonObject(
                    with: item.entry.metadataJson.data(using: .utf8) ?? Data()
                ) as? [String: Any]) ?? [:]
                return VectorMatch(
                    score: item.score,
                    text: item.entry.text,
                    entryType: item.entry.entryType,
                    metadata: meta
                )
            }
    }
}

// MARK: - SIMD16 cosine similarity

/// Compute cosine similarity using SIMD16<Float>.
/// Processes 16 dimensions per iteration — 64× fewer loop iterations
/// than a scalar loop over 1024 dims, with full vectorisation on any
/// modern CPU (NEON on ARM64, AVX512 / SSE on x86-64).
///
/// Loads vectors via raw pointer binding (guaranteed to compile on both
/// Apple Silicon and x86-64 Linux without relying on SIMD collection inits).
func simdCosineSimilarity(_ a: [Float], _ b: [Float]) -> Float {
    guard a.count == b.count, !a.isEmpty else { return 0 }
    return a.withUnsafeBufferPointer { pA in
        b.withUnsafeBufferPointer { pB in
            let count = a.count
            var dot   = SIMD16<Float>.zero
            var normA = SIMD16<Float>.zero
            var normB = SIMD16<Float>.zero
            var i = 0
            // Process 16 floats at a time using SIMD16
            while i + 16 <= count {
                // Load 16 floats from each array via pointer rebinding
                let va = SIMD16<Float>(
                    pA[i],   pA[i+1], pA[i+2],  pA[i+3],
                    pA[i+4], pA[i+5], pA[i+6],  pA[i+7],
                    pA[i+8], pA[i+9], pA[i+10], pA[i+11],
                    pA[i+12],pA[i+13],pA[i+14], pA[i+15]
                )
                let vb = SIMD16<Float>(
                    pB[i],   pB[i+1], pB[i+2],  pB[i+3],
                    pB[i+4], pB[i+5], pB[i+6],  pB[i+7],
                    pB[i+8], pB[i+9], pB[i+10], pB[i+11],
                    pB[i+12],pB[i+13],pB[i+14], pB[i+15]
                )
                dot   += va * vb
                normA += va * va
                normB += vb * vb
                i += 16
            }
            // Scalar tail
            var sDot  = dot.sum()
            var sNA   = normA.sum()
            var sNB   = normB.sum()
            while i < count {
                sDot += pA[i] * pB[i]
                sNA  += pA[i] * pA[i]
                sNB  += pB[i] * pB[i]
                i += 1
            }
            let denom = sNA.squareRoot() * sNB.squareRoot()
            return denom == 0 ? 0 : sDot / denom
        }
    }
}

// MARK: - Result type

struct VectorMatch {
    let score: Float
    let text: String
    let entryType: String
    let metadata: [String: Any]
}
