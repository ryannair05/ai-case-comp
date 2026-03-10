import Foundation
import Testing
import Vapor

@testable import App

@Suite("Health Check")
struct HealthCheckTests {

    @Test("Health endpoint returns ok")
    func healthCheck() async throws {
        try await withApp { app in
            let res = try await app.sendRequest(.GET, "/health")
            #expect(res.status == .ok)
            let json =
                try JSONSerialization.jsonObject(with: Data(buffer: res.body)) as! [String: Any]
            #expect(json["status"] as? String == "ok")
        }
    }

    @Test("Protected route without token returns 401")
    func protectedRouteNoAuth() async throws {
        try await withApp { app in
            let res = try await app.sendRequest(.GET, "/proposals")
            #expect(res.status == .unauthorized)
        }
    }
}
