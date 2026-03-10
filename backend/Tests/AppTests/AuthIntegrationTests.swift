import Foundation
import Testing
import Vapor

@testable import App

@Suite("Auth Integration")
struct AuthIntegrationTests {

    @Test("Register returns token and customer ID")
    func registerReturnsToken() async throws {
        try await withApp { app in
            let body: [String: String] = [
                "name": "Alice", "email": "alice@test.com",
                "password": "password123", "tier": "starter",
            ]
            let bodyData = try JSONSerialization.data(withJSONObject: body)

            let res = try await app.sendRequest(.POST, "/auth/register") { req in
                req.headers.contentType = .json
                req.body = .init(data: bodyData)
            }
            #expect(res.status == .ok)
            let json =
                try JSONSerialization.jsonObject(with: Data(buffer: res.body)) as! [String: Any]
            #expect(json["token"] is String)
            #expect(json["customer_id"] is String)
            #expect(json["email"] as? String == "alice@test.com")
        }
    }

    @Test("Login with correct password succeeds")
    func loginSucceeds() async throws {
        try await withApp { app in
            // Register first
            let regBody = try JSONSerialization.data(withJSONObject: [
                "name": "Bob", "email": "bob@test.com", "password": "password123",
            ])
            _ = try await app.sendRequest(.POST, "/auth/register") { req in
                req.headers.contentType = .json
                req.body = .init(data: regBody)
            }

            // Login
            let loginBody = try JSONSerialization.data(withJSONObject: [
                "email": "bob@test.com", "password": "password123",
            ])
            let res = try await app.sendRequest(.POST, "/auth/login") { req in
                req.headers.contentType = .json
                req.body = .init(data: loginBody)
            }
            #expect(res.status == .ok)
        }
    }

    @Test("Login with wrong password returns 401")
    func loginFails() async throws {
        try await withApp { app in
            let regBody = try JSONSerialization.data(withJSONObject: [
                "name": "Carol", "email": "carol@test.com", "password": "password123",
            ])
            _ = try await app.sendRequest(.POST, "/auth/register") { req in
                req.headers.contentType = .json
                req.body = .init(data: regBody)
            }

            let loginBody = try JSONSerialization.data(withJSONObject: [
                "email": "carol@test.com", "password": "wrongpassword",
            ])
            let res = try await app.sendRequest(.POST, "/auth/login") { req in
                req.headers.contentType = .json
                req.body = .init(data: loginBody)
            }
            #expect(res.status == .unauthorized)
        }
    }

    @Test("Duplicate email returns 409")
    func duplicateEmail() async throws {
        try await withApp { app in
            let body = try JSONSerialization.data(withJSONObject: [
                "name": "Dan", "email": "dan@test.com", "password": "password123",
            ])
            _ = try await app.sendRequest(.POST, "/auth/register") { req in
                req.headers.contentType = .json
                req.body = .init(data: body)
            }
            let res = try await app.sendRequest(.POST, "/auth/register") { req in
                req.headers.contentType = .json
                req.body = .init(data: body)
            }
            #expect(res.status == .conflict)
        }
    }
}
