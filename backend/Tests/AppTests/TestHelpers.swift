import Fluent
import FluentSQLiteDriver
import Testing
import Vapor
import VaporTesting

@testable import App

/// Boots the app with an in-memory SQLite database for fast, isolated tests.
/// Each test gets a fresh DB — no leftover state between runs.
func withApp(_ test: (Application) async throws -> Void) async throws {
    let app = try await Application.make(.testing)
    app.logger.logLevel = .warning

    do {
        // Override DB to in-memory BEFORE configuring routes/migrations
        app.databases.use(.sqlite(.memory), as: .sqlite)
        try await configure(app)
        try await test(app)
        try await app.autoRevert()
    } catch {
        try? await app.autoRevert()
        try await app.asyncShutdown()
        throw error
    }
    try await app.asyncShutdown()
}

/// Register a test customer and return the JWT token for authenticated requests.
func registerTestCustomer(
    app: Application,
    name: String = "Test User",
    email: String = "test@draftly.biz",
    password: String = "testpassword123",
    tier: String = "professional"
) async throws -> (token: String, customerId: String) {
    let registerBody = [
        "name": name,
        "email": email,
        "password": password,
        "tier": tier,
    ]
    let bodyData = try JSONSerialization.data(withJSONObject: registerBody)

    let response = try await app.sendRequest(
        .POST, "/auth/register",
        beforeRequest: { req in
            req.headers.contentType = .json
            req.body = .init(data: bodyData)
        })

    let json = try JSONSerialization.jsonObject(with: Data(buffer: response.body)) as! [String: Any]
    let token = json["token"] as! String
    let customerId = json["customer_id"] as! String
    return (token, customerId)
}
