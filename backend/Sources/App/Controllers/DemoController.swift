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
        guard !openaiApiKey.isEmpty else {
            throw Abort(.internalServerError, reason: "Missing OPENAI_API_KEY")
        }

        let systemPrompt = "You are a helpful AI assistant. Generate a professional proposal for the given RFP. Use Markdown for formatting (headers, lists, bold text)."
        
        let requestBody: [String: Any] = [
            "model": "gpt-5-nano",
            "max_completion_tokens": 1500,
            "stream": true,
            "messages": [
                ["role": "system", "content": systemPrompt],
                ["role": "user", "content": "Generate a proposal for this RFP:\n\n\(body.rfpText)"]
            ],
            "reasoning_effort":"minimal"
        ]

        let requestData = try JSONSerialization.data(withJSONObject: requestBody)
        var urlReq = URLRequest(url: URL(string: "https://api.openai.com/v1/chat/completions")!)
        urlReq.httpMethod = "POST"
        urlReq.setValue("Bearer \(openaiApiKey)", forHTTPHeaderField: "Authorization")
        urlReq.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlReq.httpBody = requestData

        // Extract stream creation to keep the endpoint clean
        let stream = streamOpenAICall(urlReq: urlReq)

        let response = Response(status: .ok)
        response.headers.contentType = .plainText
        response.headers.replaceOrAdd(name: .cacheControl, value: "no-cache")
        response.headers.replaceOrAdd(name: .connection, value: "keep-alive")

        response.body = .init(stream: { writer in
            Task {
                do {
                    for try await chunk in stream {
                        let buffer = req.byteBufferAllocator.buffer(string: chunk)
                        try await writer.write(.buffer(buffer)).get()
                    }
                    _ = try await writer.write(.end).get()
                } catch {
                    req.logger.error("OpenAI stream error: \(error)")
                    let errorBuffer = req.byteBufferAllocator.buffer(string: "\n[Stream Error: \(error.localizedDescription)]")
                    _ = try await writer.write(.buffer(errorBuffer)).get()
                    _ = try await writer.write(.end).get()
                }
            }
        })

        return response
    }
    
    // MARK: - OpenAI Stream Helper
    
    private func streamOpenAICall(urlReq: URLRequest) -> AsyncThrowingStream<String, any Error> {
        AsyncThrowingStream { continuation in
            let delegate = OpenAIStreamDelegate(continuation: continuation)
            let session = URLSession(configuration: .default, delegate: delegate, delegateQueue: nil)
            let task = session.dataTask(with: urlReq)
            
            continuation.onTermination = { @Sendable _ in
                task.cancel()
                session.finishTasksAndInvalidate() // Prevent memory leaks on early exit
            }
            task.resume()
        }
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

        let stream = try await RAGPipeline.shared.generateProposalStream(
            customerId: customerIdStr,
            rfpText: body.rfpText,
            proposalsIndexed: 50,
            industry: "marketing",
            db: req.db
        )

        let response = Response(status: .ok)
        response.headers.contentType = .plainText
        response.headers.replaceOrAdd(name: .cacheControl, value: "no-cache")
        response.headers.replaceOrAdd(name: .connection, value: "keep-alive")

        response.body = .init(stream: { writer in
            Task {
                do {
                    for try await chunk in stream {
                        let buffer = req.byteBufferAllocator.buffer(string: chunk)
                        try await writer.write(.buffer(buffer)).get()
                    }
                    _ = try await writer.write(.end).get()
                } catch {
                    req.logger.error("Draftly stream error: \(error)")
                    _ = try await writer.write(.end).get()
                }
            }
        })
        return response
    }
}

// MARK: - OpenAI Delegate

private final class OpenAIStreamDelegate: NSObject, URLSessionDataDelegate, @unchecked Sendable {
    let continuation: AsyncThrowingStream<String, any Error>.Continuation
    var buffer: String = ""
    var isDone = false
    
    init(continuation: AsyncThrowingStream<String, any Error>.Continuation) {
        self.continuation = continuation
    }
    
    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse, completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
        if let http = response as? HTTPURLResponse, http.statusCode != 200 {
            continuation.finish(throwing: NSError(
                domain: "OpenAIError",
                code: http.statusCode,
                userInfo: [NSLocalizedDescriptionKey: "HTTP \(http.statusCode)"]
            ))
            completionHandler(.cancel)
            return
        }
        completionHandler(.allow)
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        guard !isDone, let str = String(data: data, encoding: .utf8) else { return }
        buffer += str
        var lines = buffer.components(separatedBy: .newlines)
        guard !lines.isEmpty else { return }
        
        // Keep the last incomplete line in the buffer
        buffer = lines.removeLast()
        
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            guard trimmed.hasPrefix("data: ") else { continue }
            
            let jsonString = String(trimmed.dropFirst(6)).trimmingCharacters(in: .whitespaces)
            guard jsonString != "[DONE]" else {
                isDone = true
                continuation.finish()
                return
            }
            
            if let data = jsonString.data(using: .utf8),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let choices = json["choices"] as? [[String: Any]],
               let firstChoice = choices.first,
               let delta = firstChoice["delta"] as? [String: Any],
               let content = delta["content"] as? String {
                   continuation.yield(content)
            }
        }
    }
    
    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: (any Error)?) {
        guard !isDone else {
            session.finishTasksAndInvalidate()
            return
        }
        isDone = true
        if let error = error {
            continuation.finish(throwing: error)
        } else {
            continuation.finish()
        }
        session.finishTasksAndInvalidate() // Prevent memory leaks on natural completion
    }
}
