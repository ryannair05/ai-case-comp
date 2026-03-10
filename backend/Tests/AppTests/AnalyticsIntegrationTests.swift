import Foundation
import Testing
import Vapor

@testable import App

@Suite("Analytics Integration")
struct AnalyticsIntegrationTests {

    @Test("Phase gate returns valid structure")
    func phaseGate() async throws {
        try await withApp { app in
            let auth = try await registerTestCustomer(app: app)
            let res = try await app.sendRequest(.GET, "/analytics/phase-gate") { req in
                req.headers.bearerAuthorization = .init(token: auth.token)
            }
            #expect(res.status == .ok)
            let json =
                try JSONSerialization.jsonObject(with: Data(buffer: res.body)) as! [String: Any]
            #expect(json["all_passed"] != nil)
            #expect(json["gate1"] != nil)
            #expect(json["gate2"] != nil)
            #expect(json["gate3"] != nil)
        }
    }

    @Test("Win rate returns zeroes for new customer")
    func winRateEmpty() async throws {
        try await withApp { app in
            let auth = try await registerTestCustomer(app: app)
            let res = try await app.sendRequest(.GET, "/analytics/win-rate") { req in
                req.headers.bearerAuthorization = .init(token: auth.token)
            }
            #expect(res.status == .ok)
            let json =
                try JSONSerialization.jsonObject(with: Data(buffer: res.body)) as! [String: Any]
            #expect(json["total_proposals"] as? Int == 0)
            #expect(json["win_rate"] as? Double == 0.0)
        }
    }
}
