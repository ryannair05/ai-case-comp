import Foundation
import Testing
import Vapor

@testable import App

@Suite("Context-Mapper Integration")
struct ContextMapperIntegrationTests {

    @Test("Status returns correct structure")
    func statusReturnsStructure() async throws {
        try await withApp { app in
            let auth = try await registerTestCustomer(app: app)
            let res = try await app.sendRequest(.GET, "/context-mapper/status") { req in
                req.headers.bearerAuthorization = .init(token: auth.token)
            }
            #expect(res.status == .ok)
            let json =
                try JSONSerialization.jsonObject(with: Data(buffer: res.body)) as! [String: Any]
            #expect(json["proposals_indexed"] as? Int == 0)
            #expect(json["pricing_rows"] as? Int == 0)
            #expect(json["brand_examples"] as? Int == 0)
            #expect(json["tier"] as? String == "professional")
        }
    }

    @Test("Switching cost returns moat meter")
    func switchingCost() async throws {
        try await withApp { app in
            let auth = try await registerTestCustomer(app: app)
            let res = try await app.sendRequest(.GET, "/context-mapper/switching-cost") { req in
                req.headers.bearerAuthorization = .init(token: auth.token)
            }
            #expect(res.status == .ok)
            let json =
                try JSONSerialization.jsonObject(with: Data(buffer: res.body)) as! [String: Any]
            #expect(json["total_cost"] != nil)
            #expect(json["milestone"] as? String == "onboarding")
        }
    }
}
