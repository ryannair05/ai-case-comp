import Foundation
import Vapor

#if canImport(FoundationNetworking)
    import FoundationNetworking
#endif

/// Controller for public-facing Demo logic.
struct DemoController {
    private let openaiApiKey = ProcessInfo.processInfo.environment["OPENAI_API_KEY"] ?? ""

    struct DemoRequest: Content {
        let rfpText: String
        let customerId: String?  // Optional, used for context mapper demo

        enum CodingKeys: String, CodingKey {
            case rfpText = "rfp_text"
            case customerId = "customer_id"
        }
    }

    // MARK: - Generic Streaming Endpoint

    @Sendable
    func generic(_ req: Request) async throws -> Response {
        let body = try req.content.decode(DemoRequest.self)
        guard !body.rfpText.isEmpty else {
            throw Abort(.badRequest, reason: "rfp_text cannot be empty")
        }

        let apiKey = openaiApiKey
        guard !apiKey.isEmpty else {
            throw Abort(.internalServerError, reason: "Missing OPENAI_API_KEY")
        }

        let systemPrompt =
            "You are a helpful AI assistant. Generate a professional proposal for the given RFP. Use Markdown for formatting (headers, lists, bold text)."

        let requestBody: [String: Any] = [
            "model": "gpt-5-nano",  // Fallback to a fast model if nano is unavailable
            "max_completion_tokens": 1500,
            "stream": true,
            "messages": [
                ["role": "system", "content": systemPrompt],
                [
                    "role": "user",
                    "content": "Generate a proposal for this RFP:\n\n\(body.rfpText)",
                ],
            ],
        ]

        guard let requestData = try? JSONSerialization.data(withJSONObject: requestBody) else {
            throw Abort(.internalServerError, reason: "Failed to serialize request")
        }

        let url = URL(string: "https://api.openai.com/v1/chat/completions")!
        var urlReq = URLRequest(url: url)
        urlReq.httpMethod = "POST"
        urlReq.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        urlReq.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlReq.httpBody = requestData

        let request = urlReq
        let response = Response(status: .ok)
        response.headers.contentType = HTTPMediaType(type: "text", subType: "plain")
        response.headers.add(name: "Cache-Control", value: "no-cache")
        response.headers.add(name: "Connection", value: "keep-alive")

        response.body = .init(stream: { writer in
            Task { [request] in
                do {
                    let (stream, urlResponse) = try await URLSession.shared.bytes(for: request)
                    guard let httpRes = urlResponse as? HTTPURLResponse,
                        (200...299).contains(httpRes.statusCode)
                    else {
                        _ = writer.write(
                            .buffer(
                                ByteBuffer(
                                    string:
                                        "Error from OpenAI API: \( (urlResponse as? HTTPURLResponse)?.statusCode ?? 0 )"
                                )))
                        _ = writer.write(.end)
                        return
                    }

                    for try await line in stream.lines {
                        let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard trimmed.hasPrefix("data: ") else { continue }
                        let jsonStr = String(trimmed.dropFirst(6))
                        guard jsonStr != "[DONE]" else { break }

                        if let data = jsonStr.data(using: .utf8),
                            let json = try? JSONSerialization.jsonObject(with: data)
                                as? [String: Any],
                            let choices = json["choices"] as? [[String: Any]],
                            let firstChoice = choices.first,
                            let delta = firstChoice["delta"] as? [String: Any],
                            let content = delta["content"] as? String
                        {
                            _ = writer.write(.buffer(ByteBuffer(string: content)))
                        }
                    }
                    _ = writer.write(.end)
                } catch {
                    req.logger.error("OpenAI stream error: \(error)")
                    _ = writer.write(
                        .buffer(
                            ByteBuffer(string: "\n[Stream Error: \(error.localizedDescription)]")))
                    _ = writer.write(.end)
                }
            }
        })
        return response
    }

    // MARK: - Draftly Context-Mapper Demo Endpoint

    @Sendable
    func draftly(_ req: Request) async throws -> Response {
        let body = try req.content.decode(DemoRequest.self)
        guard !body.rfpText.isEmpty else {
            throw Abort(.badRequest, reason: "rfp_text cannot be empty")
        }

        let customerIdStr = body.customerId ?? "0d1a3e07-5d4a-5f7d-8be7-255a1109bce0"
        guard UUID(uuidString: customerIdStr) != nil else {
            throw Abort(.badRequest, reason: "Invalid customer_id format")
        }

        // Wait to stream context from RAGPipeline. We pretend proposalsIndexed is a high number (e.g. 50)
        // to bypass the cold-start and definitely use the RAG Pipeline for the demo.
        let stream = try await RAGPipeline.shared.generateProposalStream(
            customerId: customerIdStr,
            rfpText: body.rfpText,
            proposalsIndexed: 50,
            industry: "marketing",
            db: req.db
        )

        let response = Response(status: .ok)
        response.headers.contentType = HTTPMediaType(type: "text", subType: "plain")
        response.headers.add(name: "Cache-Control", value: "no-cache")
        response.headers.add(name: "Connection", value: "keep-alive")

        response.body = .init(stream: { writer in
            Task {
                do {
                    for try await chunk in stream {
                        _ = writer.write(.buffer(ByteBuffer(string: chunk)))
                    }
                    _ = writer.write(.end)
                } catch {
                    req.logger.error("Draftly stream error: \(error)")
                    _ = writer.write(.end)
                }
            }
        })
        return response
    }
}
