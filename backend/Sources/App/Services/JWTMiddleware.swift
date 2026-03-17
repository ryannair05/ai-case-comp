import Vapor
import JWT

/// Validates Bearer JWT on every protected route.
/// Injects the authenticated customer payload into the request storage.
struct JWTMiddleware: AsyncMiddleware {
    func respond(to request: Request, chainingTo next: any AsyncResponder) async throws -> Response {
        
        let token: String
        if let bearer = request.headers.bearerAuthorization {
            token = bearer.token
        } else if let queryToken = request.query[String.self, at: "token"] {
            token = queryToken
        } else if let cookieToken = request.cookies["draftly_token"]?.string {
            token = cookieToken
        } else {
            throw Abort(.unauthorized, reason: "Missing Bearer token")
        }
        do {
            let payload = try await request.jwt.verify(token, as: CustomerPayload.self)
            request.auth.login(payload)
        } catch {
            throw Abort(.unauthorized, reason: "Invalid or expired token")
        }
        return try await next.respond(to: request)
    }
}

extension CustomerPayload: Authenticatable {}

extension Request {
    /// Convenience — returns the authenticated customer payload or throws 401.
    var customerPayload: CustomerPayload {
        get throws {
            guard let payload = auth.get(CustomerPayload.self) else {
                throw Abort(.unauthorized)
            }
            return payload
        }
    }

    /// Fetch the full Customer model from DB for the authenticated user.
    func authenticatedCustomer() async throws -> Customer {
        let payload = try customerPayload
        guard let id = UUID(uuidString: payload.subject.value) else {
            throw Abort(.unauthorized)
        }
        guard let customer = try await Customer.find(id, on: db) else {
            throw Abort(.notFound, reason: "Customer not found")
        }
        return customer
    }
}
