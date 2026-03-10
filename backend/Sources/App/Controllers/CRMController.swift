import Foundation
import Vapor

#if canImport(FoundationNetworking)
    import FoundationNetworking
#endif

/// HubSpot CRM integration — OAuth + deal logging.
struct CRMController {
    private let hubspotClientId = ProcessInfo.processInfo.environment["HUBSPOT_CLIENT_ID"] ?? ""
    private let hubspotClientSecret =
        ProcessInfo.processInfo.environment["HUBSPOT_CLIENT_SECRET"] ?? ""
    private let redirectURI =
        ProcessInfo.processInfo.environment["HUBSPOT_REDIRECT_URI"]
        ?? "https://api.draftly.ai/crm/hubspot/callback"

    // MARK: - OAuth initiation

    @Sendable
    func hubspotConnect(_ req: Request) async throws -> Response {
        let customer = try await req.authenticatedCustomer()
        let state = customer.id!.uuidString
        let scopes = "crm.objects.deals.write%20crm.objects.contacts.read"
        let url =
            "https://app.hubspot.com/oauth/authorize"
            + "?client_id=\(hubspotClientId)"
            + "&redirect_uri=\(redirectURI.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? redirectURI)"
            + "&scope=\(scopes)"
            + "&state=\(state)"
        return req.redirect(to: url)
    }

    // MARK: - OAuth callback

    @Sendable
    func hubspotCallback(_ req: Request) async throws -> Response {
        // Extract customer ID from the OAuth state parameter
        guard let stateParam = req.query[String.self, at: "state"],
            let customerId = UUID(uuidString: stateParam),
            let customer = try await Customer.find(customerId, on: req.db)
        else {
            throw Abort(.badRequest, reason: "Invalid or missing state parameter")
        }
        guard let code = req.query[String.self, at: "code"] else {
            throw Abort(.badRequest, reason: "Missing authorization code")
        }

        // Exchange code for tokens
        let tokenURL = URL(string: "https://api.hubapi.com/oauth/v1/token")!
        var tokenReq = URLRequest(url: tokenURL)
        tokenReq.httpMethod = "POST"
        tokenReq.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        let body =
            "grant_type=authorization_code"
            + "&client_id=\(hubspotClientId)"
            + "&client_secret=\(hubspotClientSecret)"
            + "&redirect_uri=\(redirectURI)"
            + "&code=\(code)"
        tokenReq.httpBody = body.data(using: .utf8)

        guard let (data, _) = try? await URLSession.shared.data(for: tokenReq),
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let accessToken = json["access_token"] as? String
        else {
            throw Abort(.badGateway, reason: "Failed to exchange code for HubSpot token")
        }

        customer.hubspotConnected = true
        customer.hubspotToken = accessToken
        try await customer.save(on: req.db)

        return req.redirect(to: "/dashboard?crm=connected")
    }

    // MARK: - Log a deal

    struct LogDealRequest: Content {
        let proposalId: String
        let clientName: String
        let valueUsd: Double?
        let outcome: String?
        enum CodingKeys: String, CodingKey {
            case proposalId = "proposal_id"
            case clientName = "client_name"
            case valueUsd = "value_usd"
            case outcome
        }
    }

    @Sendable
    func logDeal(_ req: Request) async throws -> Response {
        let customer = try await req.authenticatedCustomer()
        guard customer.hubspotConnected, let token = customer.hubspotToken else {
            throw Abort(
                .preconditionFailed, reason: "HubSpot not connected. Visit /crm/hubspot/connect")
        }

        let body = try req.content.decode(LogDealRequest.self)
        let dealStage =
            body.outcome == "won"
            ? "closedwon" : body.outcome == "lost" ? "closedlost" : "contractsent"

        let dealURL = URL(string: "https://api.hubapi.com/crm/v3/objects/deals")!
        var dealReq = URLRequest(url: dealURL)
        dealReq.httpMethod = "POST"
        dealReq.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        dealReq.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let dealBody: [String: Any] = [
            "properties": [
                "dealname": "\(body.clientName) — Draftly Proposal",
                "amount": body.valueUsd.map { "\($0)" } ?? "0",
                "dealstage": dealStage,
                "pipeline": "default",
            ]
        ]
        dealReq.httpBody = try JSONSerialization.data(withJSONObject: dealBody)

        guard let (data, _) = try? await URLSession.shared.data(for: dealReq),
            let response = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            throw Abort(.badGateway, reason: "HubSpot API request failed")
        }

        return try await response.encodeResponse(for: req)
    }
}
