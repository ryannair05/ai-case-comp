import Crypto  // SHA-256 for stable Redis cache keys
import Foundation

#if canImport(FoundationNetworking)
    import FoundationNetworking
#endif

/// Claude Sonnet 4.6 client — PRIMARY LLM for all proposal generation.
///
/// RULES:
/// - Claude Sonnet 4.6 is the ONLY model used for text generation.
/// - OpenAI GPT models are used ONLY for embeddings (EmbeddingsService).
/// - All LLM responses are cached in Redis for 72 hrs (AI dependency hedge).
struct ClaudeService {
    static let shared = ClaudeService()

    private let apiKey: String
    private let model = "claude-sonnet-4-20250514"
    private let baseURL = "https://api.anthropic.com/v1/messages"

    private init() {
        apiKey = ProcessInfo.processInfo.environment["ANTHROPIC_API_KEY"] ?? ""
    }

    // MARK: - Proposal generation

    /// PRIMARY proposal generation. Uses Context-Mapper retrieved chunks.
    /// 72-hr Redis cache = AI dependency hedge if Anthropic is unavailable.
    func generateProposal(
        customerId: String,
        rfpText: String,
        contextChunks: [VectorMatch],
        coldStart: Bool = false,
        industry: String? = nil
    ) async throws -> String {
        // Cache key from customer + RFP hash
        let rfpHash = stableHash(rfpText)
        let cacheKey = "proposal:\(customerId):\(rfpHash)"
        if let cached = await RedisCache.shared.get(cacheKey) { return cached }

        var contextStr = ""
        let pricingChunks = contextChunks.filter { $0.entryType == "pricing" }
        let proposalChunks = contextChunks.filter { $0.entryType == "proposal_chunk" }
        let brandChunks = contextChunks.filter { $0.entryType == "brand_voice" }

        if !pricingChunks.isEmpty {
            contextStr += "\n\nPRICING HISTORY (use these as anchors):\n"
            contextStr += pricingChunks.prefix(3).map(\.text).joined(separator: "\n")
        }
        if !proposalChunks.isEmpty {
            contextStr += "\n\nWINNING PROPOSAL PATTERNS:\n"
            contextStr += proposalChunks.prefix(4).map(\.text).joined(separator: "\n")
        }
        if !brandChunks.isEmpty {
            contextStr += "\n\nBRAND VOICE EXAMPLES:\n"
            contextStr += brandChunks.prefix(2).map(\.text).joined(separator: "\n")
        }

        let coldNote =
            coldStart
            ? "You are generating this proposal without firm-specific history yet. "
                + "Use the industry template library to provide a strong starting point. "
                + "Flag sections where firm-specific data would strengthen the proposal."
            : ""

        let system = """
            You are Draftly, an AI proposal generation assistant.
            You help professional services firms write winning proposals.
            \(coldNote)

            FIRM CONTEXT (from their institutional memory):
            \(contextStr.isEmpty ? "No context available yet — use industry best practices." : contextStr)

            RULES:
            - Reference specific pricing anchors from the firm's history
            - Mirror the firm's brand voice and terminology exactly
            - Cite relevant past wins where appropriate
            - Use the firm's actual service names, not generic descriptions
            - If pricing history shows a retainer anchor, use it as the floor
            - Structure: Executive Summary → Approach → Timeline → Investment → Why Us
            """
        let result = try await call(
            system: system, user: "Generate a proposal for this RFP:\n\n\(rfpText)")
        await RedisCache.shared.set(cacheKey, value: result, ttlSeconds: 72 * 3600)
        return result
    }

    /// Stream proposal generation using Server-Sent Events.
    /// Does not interact with Redis (streaming cache is complex, we just bypass it).
    func generateProposalStream(
        customerId: String,
        rfpText: String,
        contextChunks: [VectorMatch],
        coldStart: Bool = false,
        industry: String? = nil
    ) -> AsyncThrowingStream<String, any Error> {
        let (contextStr, coldNote) = buildContextStr(
            contextChunks: contextChunks, coldStart: coldStart)
        let system = """
            You are Draftly, an AI proposal generation assistant.
            You help professional services firms write winning proposals.
            \(coldNote)

            FIRM CONTEXT (from their institutional memory):
            \(contextStr.isEmpty ? "No context available yet — use industry best practices." : contextStr)

            RULES:
            - Reference specific pricing anchors from the firm's history
            - Mirror the firm's brand voice and terminology exactly
            - Cite relevant past wins where appropriate
            - Use the firm's actual service names, not generic descriptions
            - If pricing history shows a retainer anchor, use it as the floor
            - Structure: Executive Summary → Approach → Timeline → Investment → Why Us
            """

        return streamCall(system: system, user: "Generate a proposal for this RFP:\n\n\(rfpText)")
    }

    private func buildContextStr(contextChunks: [VectorMatch], coldStart: Bool) -> (String, String)
    {
        var contextStr = ""
        let pricingChunks = contextChunks.filter { $0.entryType == "pricing" }
        let proposalChunks = contextChunks.filter { $0.entryType == "proposal_chunk" }
        let brandChunks = contextChunks.filter { $0.entryType == "brand_voice" }

        if !pricingChunks.isEmpty {
            contextStr += "\n\nPRICING HISTORY (use these as anchors):\n"
            contextStr += pricingChunks.prefix(3).map(\.text).joined(separator: "\n")
        }
        if !proposalChunks.isEmpty {
            contextStr += "\n\nWINNING PROPOSAL PATTERNS:\n"
            contextStr += proposalChunks.prefix(4).map(\.text).joined(separator: "\n")
        }
        if !brandChunks.isEmpty {
            contextStr += "\n\nBRAND VOICE EXAMPLES:\n"
            contextStr += brandChunks.prefix(2).map(\.text).joined(separator: "\n")
        }

        let coldNote =
            coldStart
            ? "You are generating this proposal without firm-specific history yet. "
                + "Use the industry template library to provide a strong starting point. "
                + "Flag sections where firm-specific data would strengthen the proposal."
            : ""
        return (contextStr, coldNote)
    }

    // MARK: - Support ticket

    func classifySeverity(_ ticketBody: String) async throws -> String {
        let result = try await call(
            system: nil,
            user: """
                Classify this support ticket severity as HIGH, MEDIUM, or LOW.
                HIGH = billing/data/auth/integration issues.
                LOW = how-to questions AI can answer fully.

                Ticket: \(ticketBody)

                Respond with just: HIGH, MEDIUM, or LOW
                """,
            maxTokens: 10
        )
        return result.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
    }

    func generateSupportResponse(ticketBody: String, kbContext: [VectorMatch], tier: String)
        async throws -> String
    {
        let cacheKey = "support:\(stableHash(ticketBody))"
        if let cached = await RedisCache.shared.get(cacheKey) { return cached }

        var kbStr = ""
        if !kbContext.isEmpty {
            kbStr =
                "\n\nRELEVANT KNOWLEDGE BASE:\n"
                + kbContext.prefix(3).map(\.text).joined(separator: "\n---\n")
        }
        let result = try await call(
            system: "You are a helpful support agent for Draftly, an AI proposal tool. "
                + "The customer is on the \(tier) tier. Be friendly, concise, and solution-oriented. "
                + "Never expose internal system details or stack traces.\(kbStr)",
            user: ticketBody,
            maxTokens: 800
        )
        await RedisCache.shared.set(cacheKey, value: result, ttlSeconds: 3600)
        return result
    }

    // MARK: - GTM Agent (Phase 2)

    func extractMeetingSignals(customerId: String, notes: String, clientName: String) async throws
        -> [String: Any]
    {
        let cacheKey = "meeting:\(customerId):\(stableHash(notes))"
        if let cached = await RedisCache.shared.get(cacheKey),
            let data = cached.data(using: .utf8),
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        {
            return json
        }
        let raw = try await call(
            system:
                "You are a sales intelligence AI. Extract structured signals from meeting notes. "
                + "Return JSON with keys: budget_signals (array), needs_identified (array), "
                + "objections (array), deal_stage (discovery|proposal|negotiation|closed_won|closed_lost), "
                + "next_actions (array), proposal_recommended (bool).",
            user: "Client: \(clientName)\n\nMeeting notes:\n\(notes)"
        )
        let extracted = extractJSON(from: raw, opening: "{", closing: "}") ?? "{}"
        await RedisCache.shared.set(cacheKey, value: extracted, ttlSeconds: 72 * 3600)
        let data = extracted.data(using: .utf8) ?? Data()
        return (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
    }

    func generateOutreachSequence(
        senderFirm: String, prospect: [String: Any], winContext: [VectorMatch],
        sequenceLength: Int = 4
    ) async throws -> [[String: Any]] {
        let winStories = winContext.prefix(3).map(\.text).joined(separator: "\n")
        let raw = try await call(
            system: "You are writing outreach emails for \(senderFirm). "
                + "Generate a personalized email sequence as a JSON array. "
                + "Each email: {subject, body, send_day, cta}. Reference win stories where relevant. "
                + "Be concise and human.\n\nWIN STORIES:\n\(winStories.isEmpty ? "Not available yet." : winStories)",
            user: "Write a \(sequenceLength)-email sequence for:\n"
                + "Prospect: \(prospect["prospect_name"] ?? "Unknown") at \(prospect["prospect_company"] ?? "Unknown")\n"
                + "Industry: \(prospect["prospect_industry"] ?? "Unknown")\n"
                + "Pain point: \(prospect["pain_point"] ?? "Unknown")\n"
                + "Goal: book a 20-min demo",
            maxTokens: 2000
        )
        let extracted = extractJSON(from: raw, opening: "[", closing: "]") ?? "[]"
        let data = extracted.data(using: .utf8) ?? Data()
        return (try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]) ?? []
    }

    func extractWinPatterns(proposalContent: String, winReason: String) async throws -> String {
        try await call(
            system:
                "Extract key winning patterns from this proposal and win reason. "
                + "Return a JSON object with these exact keys: "
                + "pricing_tier_won (string: 'starter'|'professional'|'gtm_agent'|'enterprise'|'unknown'), "
                + "client_industry (string), "
                + "deal_size_usd (number or null), "
                + "key_objection (string: main objection that was overcome), "
                + "differentiator_used (string: main differentiator that won the deal), "
                + "win_patterns (array of 3-5 actionable pattern strings). "
                + "Return only valid JSON, no markdown.",
            user: "Win reason: \(winReason)\n\nProposal:\n\(String(proposalContent.prefix(3000)))",
            maxTokens: 700
        )
    }

    // MARK: - Low-level HTTP call

    private func call(system: String?, user: String, maxTokens: Int = 4096) async throws -> String {
        guard !apiKey.isEmpty else {
            return "[Claude API key not configured — set ANTHROPIC_API_KEY]"
        }
        let url = URL(string: baseURL)!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("Bearer \(apiKey)", forHTTPHeaderField: "x-api-key")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")

        var body: [String: Any] = [
            "model": model,
            "max_tokens": maxTokens,
            "messages": [["role": "user", "content": user]],
        ]
        if let system { body["system"] = system }

        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw ClaudeError.apiError(
                "HTTP \((response as? HTTPURLResponse)?.statusCode ?? 0): \(body)")
        }
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
            let content = json["content"] as? [[String: Any]],
            let text = content.first?["text"] as? String
        else {
            throw ClaudeError.parseError
        }
        return text
    }

    private func streamCall(system: String?, user: String, maxTokens: Int = 4096)
        -> AsyncThrowingStream<String, any Error>
    {
        AsyncThrowingStream { continuation in
            Task {
                guard !self.apiKey.isEmpty else {
                    continuation.yield("[Claude API key not configured — set ANTHROPIC_API_KEY]")
                    continuation.finish()
                    return
                }

                let url = URL(string: self.baseURL)!
                var req = URLRequest(url: url)
                req.httpMethod = "POST"
                req.setValue("Bearer \(self.apiKey)", forHTTPHeaderField: "x-api-key")
                req.setValue("application/json", forHTTPHeaderField: "Content-Type")
                req.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")

                var body: [String: Any] = [
                    "model": self.model,
                    "max_tokens": maxTokens,
                    "messages": [["role": "user", "content": user]],
                    "stream": true,
                ]
                if let system { body["system"] = system }

                do {
                    req.httpBody = try JSONSerialization.data(withJSONObject: body)
                    let (result, response) = try await URLSession.shared.bytes(for: req)

                    guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                        throw ClaudeError.apiError(
                            "HTTP \( (response as? HTTPURLResponse)?.statusCode ?? 0 )")
                    }

                    for try await line in result.lines {
                        guard line.hasPrefix("data: ") else { continue }
                        let jsonString = String(line.dropFirst(6))
                        guard jsonString != "[DONE]" else { break }

                        if let data = jsonString.data(using: .utf8),
                            let json = try? JSONSerialization.jsonObject(with: data)
                                as? [String: Any],
                            let type = json["type"] as? String,
                            type == "content_block_delta",
                            let delta = json["delta"] as? [String: Any],
                            let text = delta["text"] as? String
                        {
                            continuation.yield(text)
                        }
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    /// Extract the first complete JSON object or array from a Claude response.
    private func extractJSON(from text: String, opening: String, closing: String) -> String? {
        guard let start = text.range(of: opening),
            let end = text.range(of: closing, options: .backwards),
            start.lowerBound <= end.upperBound
        else { return nil }
        return String(text[start.lowerBound..<text.index(after: end.upperBound)])
    }

    /// Stable 16-char SHA-256 prefix for Redis cache keys.
    /// Swift's hashValue is NOT stable across process restarts — using CryptoKit SHA-256 instead.
    private func stableHash(_ s: String) -> String {
        let digest = SHA256.hash(data: Data(s.utf8))
        return digest.prefix(8).map { String(format: "%02x", $0) }.joined()
    }

    enum ClaudeError: Error {
        case apiError(String)
        case parseError
    }
}
