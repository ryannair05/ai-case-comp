import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// HTTP cache backed by Upstash Redis REST API.
/// Provides the 72-hour LLM response cache (AI dependency hedge).
/// Falls back gracefully when Redis is not configured (dev mode).
actor RedisCache {
    static let shared = RedisCache()

    private let baseURL: String?
    private let token: String?
    private let session: URLSession

    private init() {
        baseURL = ProcessInfo.processInfo.environment["UPSTASH_REDIS_REST_URL"]
        token = ProcessInfo.processInfo.environment["UPSTASH_REDIS_REST_TOKEN"]
        session = URLSession.shared
    }

    func get(_ key: String) async -> String? {
        guard let baseURL, let token else { return nil }
        let url = URL(string: "\(baseURL)/get/\(key.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? key)")!
        var req = URLRequest(url: url)
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        guard let (data, _) = try? await session.data(for: req) else { return nil }
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let result = json["result"] as? String else { return nil }
        return result
    }

    func set(_ key: String, value: String, ttlSeconds: Int = 259200) async {
        guard let baseURL, let token else { return }
        let encodedKey = key.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? key
        let url = URL(string: "\(baseURL)/setex/\(encodedKey)/\(ttlSeconds)")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONEncoder().encode([value])
        _ = try? await session.data(for: req)
    }
}
