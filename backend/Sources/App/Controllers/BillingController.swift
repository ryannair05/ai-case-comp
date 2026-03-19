import Fluent
import Vapor

#if canImport(FoundationNetworking)
    import FoundationNetworking
#endif

struct BillingController: RouteCollection {
    func boot(routes: any RoutesBuilder) throws {
        let billing = routes.grouped("billing")
        billing.post("confirm-upgrade", use: confirmUpgrade)
        billing.post("create-checkout", use: createCheckout)
        billing.post("create-portal", use: createPortal)
    }

    struct CheckoutResponse: Content {
        let url: String
    }

    @Sendable
    func createCheckout(req: Request) async throws -> CheckoutResponse {
        struct CheckoutReq: Content {
            let tier: String
            let email: String?
        }
        let body = try req.content.decode(CheckoutReq.self)

        let stripeKey = Environment.get("STRIPE_SECRET_KEY") ?? "sk_test_placeholder"
        let prices: [String: String] = [
            "Starter": Environment.get("STRIPE_PRICE_STARTER") ?? "price_1",
            "Professional": Environment.get("STRIPE_PRICE_PROFESSIONAL") ?? "price_2",
            "GTM Agent": Environment.get("STRIPE_PRICE_GTM_AGENT") ?? "price_3",
            "starter": Environment.get("STRIPE_PRICE_STARTER") ?? "price_1",
            "professional": Environment.get("STRIPE_PRICE_PROFESSIONAL") ?? "price_2",
            "gtm_agent": Environment.get("STRIPE_PRICE_GTM_AGENT") ?? "price_3",
        ]

        guard let priceId = prices[body.tier] else {
            throw Abort(.badRequest, reason: "Invalid tier")
        }

        let origin =
            req.headers.first(name: "origin") ?? Environment.get("NEXT_PUBLIC_APP_URL")
            ?? "http://localhost:3000"
        let successUrl = "\(origin)/billing?success=true"
        let cancelUrl = "\(origin)/billing?canceled=true"

        var queryItems = [
            URLQueryItem(name: "mode", value: "subscription"),
            URLQueryItem(name: "line_items[0][price]", value: priceId),
            URLQueryItem(name: "line_items[0][quantity]", value: "1"),
            URLQueryItem(name: "success_url", value: successUrl),
            URLQueryItem(name: "cancel_url", value: cancelUrl),
            URLQueryItem(name: "metadata[tier]", value: body.tier),
        ]
        if let email = body.email {
            queryItems.append(URLQueryItem(name: "customer_email", value: email))
        }

        var components = URLComponents()
        components.queryItems = queryItems
        let formString = components.query ?? ""

        var headers = HTTPHeaders()
        headers.bearerAuthorization = BearerAuthorization(token: stripeKey)
        headers.contentType = .urlEncodedForm

        let res = try await req.client.post(
            "https://api.stripe.com/v1/checkout/sessions", headers: headers
        ) { req in
            req.body = .init(string: formString)
        }

        struct StripeSession: Content {
            let url: String
        }

        if res.status != .ok {
            throw Abort(
                .internalServerError, reason: "Stripe error: \(String(buffer: res.body ?? .init()))"
            )
        }

        let session = try res.content.decode(StripeSession.self)
        return CheckoutResponse(url: session.url)
    }

    @Sendable
    func createPortal(req: Request) async throws -> CheckoutResponse {
        struct PortalReq: Content {
            let email: String?
        }
        let body = try req.content.decode(PortalReq.self)
        guard let email = body.email, !email.isEmpty else {
            throw Abort(.badRequest, reason: "Missing email")
        }

        let stripeKey = Environment.get("STRIPE_SECRET_KEY") ?? "sk_test_placeholder"
        var headers = HTTPHeaders()
        headers.bearerAuthorization = BearerAuthorization(token: stripeKey)

        var listQuery = URLComponents()
        listQuery.queryItems = [
            URLQueryItem(name: "email", value: email),
            URLQueryItem(name: "limit", value: "1"),
        ]

        let listRes = try await req.client.get(
            "https://api.stripe.com/v1/customers?\(listQuery.query!)", headers: headers)

        struct StripeList: Content {
            struct Customer: Content { let id: String }
            let data: [Customer]
        }

        var customerId = ""
        if listRes.status == .ok, let list = try? listRes.content.decode(StripeList.self),
            let first = list.data.first
        {
            customerId = first.id
        } else {
            var createQuery = URLComponents()
            createQuery.queryItems = [URLQueryItem(name: "email", value: email)]
            headers.contentType = .urlEncodedForm
            let createRes = try await req.client.post(
                "https://api.stripe.com/v1/customers", headers: headers
            ) { req in
                req.body = .init(string: createQuery.query!)
            }
            struct CreateRes: Content { let id: String }
            if let created = try? createRes.content.decode(CreateRes.self) {
                customerId = created.id
            } else {
                let errString = createRes.body.map { String(buffer: $0) } ?? "unknown"
                throw Abort(.internalServerError, reason: "Failed to create customer, list status: \(listRes.status), create status: \(createRes.status), err: \(errString)")
            }
        }

        let origin =
            req.headers.first(name: "origin") ?? Environment.get("NEXT_PUBLIC_APP_URL")
            ?? "http://localhost:3000"
        let returnUrl = "\(origin)/billing"

        var portalQuery = URLComponents()
        portalQuery.queryItems = [
            URLQueryItem(name: "customer", value: customerId),
            URLQueryItem(name: "return_url", value: returnUrl),
        ]
        headers.contentType = .urlEncodedForm
        let portalRes = try await req.client.post(
            "https://api.stripe.com/v1/billing_portal/sessions", headers: headers
        ) { sr in
            sr.body = .init(string: portalQuery.query!)
        }

        struct PortalSession: Content { let url: String }
        if portalRes.status != .ok {
            let errString = portalRes.body.map { String(buffer: $0) } ?? "unknown"
            throw Abort(.internalServerError, reason: "Failed to create portal session: \(errString)")
        }
        let session = try portalRes.content.decode(PortalSession.self)
        return CheckoutResponse(url: session.url)
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

        guard
            let customer = try await Customer.query(on: req.db)
                .filter(\.$email == body.customer_email)
                .first()
        else {
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
