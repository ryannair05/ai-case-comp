import Fluent
import Vapor

struct BillingController: RouteCollection {
    func boot(routes: any RoutesBuilder) throws {
        let billing = routes.grouped("billing")
        billing.post("confirm-upgrade", use: confirmUpgrade)
    }

    /// Internal endpoint called by the Stripe Webhook in the frontend.
    /// Gated by a simple shared secret for demo purposes.
    @Sendable
    func confirmUpgrade(req: Request) async throws -> HTTPStatus {
        let internalSecret = Environment.get("INTERNAL_WEBHOOK_SECRET") ?? "webhook-internal"
        guard req.headers.first(name: "X-Webhook-Secret") == internalSecret else {
            throw Abort(.forbidden, reason: "Invalid internal webhook secret")
        }

        struct UpgradeBody: Content {
            let customer_email: String
            let tier: String
            let monthly_revenue: Double
        }

        let body = try req.content.decode(UpgradeBody.self)

        guard let customer = try await Customer.query(on: req.db)
            .filter(\.$email == body.customer_email)
            .first() else {
            throw Abort(.notFound, reason: "Customer not found")
        }

        customer.tier = body.tier
        customer.monthlyRevenue = body.monthly_revenue
        
        // If they upgrade to professional or GTM agent, make sure they are "active"
        customer.status = "active"

        try await customer.save(on: req.db)
        
        req.logger.info("Successfully upgraded \(body.customer_email) to \(body.tier)")

        return .ok
    }
}
