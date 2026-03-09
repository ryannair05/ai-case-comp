import Vapor
import JWT
import Fluent

/// Authentication controller — register and login endpoints.
/// Issues JWT tokens for use on all protected routes.
struct AuthController {

    // MARK: - DTOs

    struct RegisterRequest: Content {
        let name: String
        let email: String
        let password: String
        let tier: String?
        let industry: String?
    }

    struct LoginRequest: Content {
        let email: String
        let password: String
    }

    struct AuthResponse: Content {
        let token: String
        let customerId: String
        let email: String
        let name: String
        let tier: String
        enum CodingKeys: String, CodingKey {
            case token, email, name, tier
            case customerId = "customer_id"
        }
    }

    // MARK: - Handlers

    @Sendable
    func register(_ req: Request) async throws -> AuthResponse {
        let body = try req.content.decode(RegisterRequest.self)
        guard body.password.count >= 8 else {
            throw Abort(.badRequest, reason: "Password must be at least 8 characters")
        }
        // Ensure unique email
        let existing = try await Customer.query(on: req.db)
            .filter(\Customer.$email == body.email)
            .first()
        if existing != nil { throw Abort(.conflict, reason: "Email already registered") }

        let hash = try Bcrypt.hash(body.password)
        let customer = Customer(
            name: body.name,
            email: body.email,
            passwordHash: hash,
            tier: body.tier ?? "starter",
            industry: body.industry
        )
        try await customer.save(on: req.db)
        return try await issueToken(customer: customer, req: req)
    }

    @Sendable
    func login(_ req: Request) async throws -> AuthResponse {
        let body = try req.content.decode(LoginRequest.self)
        guard let customer = try await Customer.query(on: req.db)
            .filter(\Customer.$email == body.email)
            .first() else {
            throw Abort(.unauthorized, reason: "Invalid email or password")
        }
        guard try Bcrypt.verify(body.password, created: customer.passwordHash) else {
            throw Abort(.unauthorized, reason: "Invalid email or password")
        }
        return try await issueToken(customer: customer, req: req)
    }

    // MARK: - Private

    private let jwtExpirationSeconds: Double = 30 * 24 * 3600  // 30 days

    private func issueToken(customer: Customer, req: Request) async throws -> AuthResponse {
        guard let id = customer.id else { throw Abort(.internalServerError) }
        let expiry = Date().addingTimeInterval(jwtExpirationSeconds)
        let payload = CustomerPayload(
            subject: SubjectClaim(value: id.uuidString),
            expiration: ExpirationClaim(value: expiry),
            tier: customer.tier,
            email: customer.email
        )
        let token = try await req.jwt.sign(payload)
        return AuthResponse(
            token: token,
            customerId: id.uuidString,
            email: customer.email,
            name: customer.name,
            tier: customer.tier
        )
    }
}
