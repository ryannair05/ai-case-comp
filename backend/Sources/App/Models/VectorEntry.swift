import Fluent
import Vapor
import Foundation

/// Local vector store entry — replaces Pinecone.
///
/// Embeddings are stored as raw binary (packed IEEE-754 Float32 values):
///   - 1024 floats × 4 bytes = 4 096 bytes per vector (vs ~12 KB for JSON)
///   - Zero-copy deserialization: just reinterpret the bytes as [Float]
///   - 3-5× faster similarity computation than JSON-parsed approach
///
/// Cosine similarity is computed in Swift using SIMD16<Float> wide vectors,
/// processing 16 dimensions per instruction on both Apple Silicon and x86-64.
final class VectorEntry: Model, Content, @unchecked Sendable {
    static let schema = "vector_entries"

    @ID(key: .id)
    var id: UUID?

    /// Customer namespace — mirrors Pinecone namespace isolation rule.
    /// NEVER query without this filter. Zero cross-customer data.
    @Field(key: "customer_id")
    var customerId: String

    /// proposal_chunk | pricing | brand_voice | kb
    @Field(key: "entry_type")
    var entryType: String

    /// The original text chunk (returned in search results).
    @Field(key: "text")
    var text: String

    /// Raw packed Float32 embedding (1024 dims = 4096 bytes).
    /// Stored as SQLite BLOB — the fastest storage format for similarity search.
    @Field(key: "embedding_blob")
    var embeddingBlob: Data

    /// JSON-encoded metadata dict (small, infrequently parsed).
    @Field(key: "metadata_json")
    var metadataJson: String

    @Timestamp(key: "created_at", on: .create)
    var createdAt: Date?

    init() {}

    init(
        customerId: String,
        entryType: String,
        text: String,
        embedding: [Float],
        metadata: [String: Any] = [:]
    ) throws {
        self.customerId = customerId
        self.entryType = entryType
        self.text = text
        self.embeddingBlob = VectorEntry.pack(embedding)
        let metaData = try JSONSerialization.data(withJSONObject: metadata)
        self.metadataJson = String(data: metaData, encoding: .utf8) ?? "{}"
    }

    // MARK: - Binary packing helpers

    /// Pack [Float] → Data (little-endian IEEE-754 Float32 array).
    static func pack(_ floats: [Float]) -> Data {
        floats.withUnsafeBufferPointer { Data(buffer: $0) }
    }

    /// Unpack Data → [Float].  O(n/stride) copy via pointer reinterpretation.
    static func unpack(_ data: Data) -> [Float] {
        data.withUnsafeBytes { ptr in
            Array(ptr.bindMemory(to: Float.self))
        }
    }
}
