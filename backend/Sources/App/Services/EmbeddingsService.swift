import Foundation

#if canImport(FoundationNetworking)
    import FoundationNetworking
#endif

/// OpenAI text-embedding-3-large embedding service.
/// RULE: OpenAI is used ONLY for embeddings, never for generation.
/// Produces 1024-dimension vectors (dimension reduction from 3072).
struct EmbeddingsService {
    static let shared = EmbeddingsService()

    private let apiKey: String
    private let model = "text-embedding-3-large"
    private let dimensions = 1024

    private init() {
        apiKey = ProcessInfo.processInfo.environment["OPENAI_API_KEY"] ?? ""
    }

    /// Embed a single text string (query-time).
    func embed(_ text: String) async throws -> [Float] {
        let batch = try await embedBatch([text])
        return batch[0]
    }

    /// Embed a batch of texts (ingest-time).
    func embedBatch(_ texts: [String]) async throws -> [[Float]] {
        guard !apiKey.isEmpty else {
            // Return zero vectors in dev mode (no API key)
            return texts.map { _ in [Float](repeating: 0.0, count: dimensions) }
        }

        var results: [[Float]] = []
        // Process in batches of 100 to respect rate limits
        for i in stride(from: 0, to: texts.count, by: 100) {
            let batch = Array(texts[i..<min(i + 100, texts.count)])
            let batchEmbeddings = try await _callOpenAI(batch)
            results.append(contentsOf: batchEmbeddings)
        }
        return results
    }

    private func _callOpenAI(_ texts: [String]) async throws -> [[Float]] {
        let url = URL(string: "https://api.openai.com/v1/embeddings")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = [
            "model": model,
            "input": texts,
            "dimensions": dimensions,
        ]
        req.httpBody = try JSONSerialization.data(withJSONObject: body)

        // Retry with exponential backoff on HTTP 429
        let maxRetries = 3
        var lastError: (any Error)?
        for attempt in 0..<maxRetries {
            let (data, response) = try await URLSession.shared.data(for: req)
            guard let http = response as? HTTPURLResponse else {
                throw EmbeddingError.apiError("Invalid HTTP response")
            }
            if http.statusCode == 429 {
                // Read Retry-After header or use exponential backoff
                let retryAfter =
                    http.value(forHTTPHeaderField: "Retry-After")
                    .flatMap(Double.init) ?? Double(1 << attempt)
                let delayNs = UInt64(min(retryAfter, 10.0) * 1_000_000_000)
                try await Task.sleep(nanoseconds: delayNs)
                lastError = EmbeddingError.apiError(
                    "Rate limited (429), attempt \(attempt + 1)/\(maxRetries)")
                continue
            }
            guard http.statusCode == 200 else {
                throw EmbeddingError.apiError("OpenAI API returned \(http.statusCode)")
            }

            guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                let dataArray = json["data"] as? [[String: Any]]
            else {
                throw EmbeddingError.parseError
            }

            return try dataArray.map { item in
                guard let embedding = item["embedding"] as? [Double] else {
                    throw EmbeddingError.parseError
                }
                return embedding.map { Float($0) }
            }
        }
        throw lastError ?? EmbeddingError.apiError("Max retries exceeded")
    }

    enum EmbeddingError: Error {
        case apiError(String)
        case parseError
    }
}

/// Cosine similarity between two float vectors.
func cosineSimilarity(_ a: [Float], _ b: [Float]) -> Float {
    guard a.count == b.count, !a.isEmpty else { return 0 }
    var dot: Float = 0
    var normA: Float = 0
    var normB: Float = 0
    for i in 0..<a.count {
        dot += a[i] * b[i]
        normA += a[i] * a[i]
        normB += b[i] * b[i]
    }
    let denom = normA.squareRoot() * normB.squareRoot()
    return denom == 0 ? 0 : dot / denom
}
