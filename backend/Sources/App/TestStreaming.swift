import Vapor
import AsyncHTTPClient
import NIOCore

func testStreaming(_ req: Request) async throws {
    var httpClientReq = HTTPClientRequest(url: "https://api.openai.com/v1/chat/completions")
    httpClientReq.method = .POST
    let clientRes = try await req.application.http.client.shared.execute(httpClientReq, timeout: .seconds(60))
    for try await chunk in clientRes.body {
        print(chunk)
    }
}
