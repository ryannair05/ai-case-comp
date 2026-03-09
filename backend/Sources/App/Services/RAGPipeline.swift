import Foundation
import Fluent

/// RAG (Retrieval-Augmented Generation) pipeline for Context-Mapper.
///
/// 1. Chunk long documents into overlapping 400-word chunks
/// 2. Embed and upsert to SQLite vector store (BLOB, SIMD search)
/// 3. Query-time retrieval with 0.72 cosine similarity threshold
/// 4. Context-aware proposal generation via Claude Sonnet 4.6
///
/// BUG FIX: Cold-start branch now passes `industry` to ColdStart.getContext()
/// (the old Python backend had an empty context_chunks list on cold-start).
struct RAGPipeline {
    static let shared = RAGPipeline()
    private init() {}

    private let chunkSize    = 400   // words
    private let chunkOverlap = 80    // words (prevents cutting mid-sentence)

    // MARK: - Chunking

    func chunkText(_ text: String) -> [String] {
        let words = text.split(separator: " ", omittingEmptySubsequences: true).map(String.init)
        var chunks: [String] = []
        var i = 0
        while i < words.count {
            let slice = words[i..<min(i + chunkSize, words.count)]
            let chunk = slice.joined(separator: " ")
            chunks.append(chunk)
            i += chunkSize - chunkOverlap
        }
        // Drop tiny trailing chunks (likely incomplete sentences)
        return chunks.filter { $0.count > 50 }
    }

    // MARK: - Ingest

    /// Chunk, embed, and persist a full proposal document.
    func ingestProposal(
        customerId: String,
        proposalId: String,
        text: String,
        metadata: [String: Any],
        db: any Database
    ) async throws -> Int {
        let chunks = chunkText(text)
        guard !chunks.isEmpty else { return 0 }
        let metas = chunks.map { _ -> [String: Any] in
            var m = metadata
            m["type"] = "proposal_chunk"
            m["customer_id"] = customerId
            m["proposal_id"] = proposalId
            return m
        }
        try await LocalVectorStore.shared.upsert(
            customerId: customerId,
            entryType: "proposal_chunk",
            texts: chunks,
            metadatas: metas,
            db: db
        )
        return chunks.count
    }

    /// Embed and persist brand voice examples.
    func ingestBrandVoice(
        customerId: String,
        brandVoiceId: String,
        text: String,
        metadata: [String: Any],
        db: any Database
    ) async throws -> Int {
        let chunks = chunkText(text)
        guard !chunks.isEmpty else { return 0 }
        let metas = chunks.map { _ -> [String: Any] in
            var m = metadata
            m["type"] = "brand_voice"
            m["customer_id"] = customerId
            m["brand_voice_id"] = brandVoiceId
            return m
        }
        try await LocalVectorStore.shared.upsert(
            customerId: customerId,
            entryType: "brand_voice",
            texts: chunks,
            metadatas: metas,
            db: db
        )
        return chunks.count
    }

    /// Embed and persist pricing rows.
    func ingestPricingRows(
        customerId: String,
        rows: [PricingRow],
        db: any Database
    ) async throws -> Int {
        let texts = rows.map { r in
            "Service: \(r.serviceType) | Price: USD \(r.priceUsd) | Won: \(r.won.map(String.init) ?? "unknown") | Notes: \(r.notes ?? "")"
        }
        let metas = rows.map { r -> [String: Any] in
            [
                "type": "pricing",
                "customer_id": customerId,
                "service_type": r.serviceType,
                "price_usd": r.priceUsd,
                "won": r.won as Any,
            ]
        }
        try await LocalVectorStore.shared.upsert(
            customerId: customerId,
            entryType: "pricing",
            texts: texts,
            metadatas: metas,
            db: db
        )
        return rows.count
    }

    // MARK: - Generate

    /// Full RAG pipeline: retrieve context → generate proposal with Claude.
    /// Automatically switches to cold-start when < 15 proposals indexed.
    /// BUG FIX: passes `industry` to cold-start so customers get the right
    /// template instead of always falling back to consulting defaults.
    func generateProposal(
        customerId: String,
        rfpText: String,
        proposalsIndexed: Int,
        industry: String?,
        db: any Database
    ) async throws -> String {
        let contextChunks: [VectorMatch]
        let coldStart: Bool

        if proposalsIndexed < ColdStart.shared.threshold {
            // Use cold-start templates with the customer's actual industry
            // Default to consulting template when industry is not specified — broadest coverage
        contextChunks = ColdStart.shared.getContext(industry: industry ?? "consulting")
            coldStart = true
        } else {
            contextChunks = try await LocalVectorStore.shared.query(
                customerId: customerId,
                queryText: rfpText,
                db: db
            )
            coldStart = false
        }

        return try await ClaudeService.shared.generateProposal(
            customerId: customerId,
            rfpText: rfpText,
            contextChunks: contextChunks,
            coldStart: coldStart,
            industry: industry
        )
    }
}

/// Lightweight pricing row for ingest requests.
struct PricingRow: Codable {
    let serviceType: String
    let priceUsd: Double
    let won: Bool?
    let notes: String?

    enum CodingKeys: String, CodingKey {
        case serviceType = "service_type"
        case priceUsd    = "price_usd"
        case won, notes
    }
}
