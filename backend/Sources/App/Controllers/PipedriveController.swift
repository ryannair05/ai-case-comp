import Foundation
import Vapor

#if canImport(FoundationNetworking)
    import FoundationNetworking
#endif

/// Pipedrive CRM integration — API key-based sync.
/// Customers save their Pipedrive API key via settings; Draftly then pushes
/// won/lost deals as activities and deals in Pipedrive.
struct PipedriveController {

    // MARK: - Save API key

    struct SaveKeyRequest: Content {
        let apiKey: String
        enum CodingKeys: String, CodingKey { case apiKey = "api_key" }
    }

    @Sendable
    func saveApiKey(_ req: Request) async throws -> Response {
        let customer = try await req.authenticatedCustomer()
        let body = try req.content.decode(SaveKeyRequest.self)
        guard !body.apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw Abort(.badRequest, reason: "api_key must not be empty")
        }

        // Verify the key works before persisting it
        let baseURL = "https://api.pipedrive.com/v1"
        let verifyURL = URL(string: "\(baseURL)/users/me?api_token=\(body.apiKey)")!
        guard let (data, resp) = try? await URLSession.shared.data(from: verifyURL),
              (resp as? HTTPURLResponse)?.statusCode == 200,
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              (json["success"] as? Bool) == true
        else {
            throw Abort(.badRequest, reason: "Invalid Pipedrive API key — check your token and try again.")
        }

        customer.pipedriveApiKey = body.apiKey
        try await customer.save(on: req.db)

        let result: [String: Any] = ["status": "connected", "message": "Pipedrive API key saved successfully."]
        return try await result.encodeResponse(for: req)
    }

    // MARK: - Sync deal

    struct SyncDealRequest: Content {
        let proposalId: String
        let clientName: String
        let valueUsd: Double?
        let outcome: String?
        enum CodingKeys: String, CodingKey {
            case proposalId = "proposal_id"
            case clientName = "client_name"
            case valueUsd   = "value_usd"
            case outcome
        }
    }

    @Sendable
    func syncDeal(_ req: Request) async throws -> Response {
        let customer = try await req.authenticatedCustomer()
        guard let apiKey = customer.pipedriveApiKey, !apiKey.isEmpty else {
            throw Abort(.preconditionFailed, reason: "Pipedrive not connected. Save your API key in Settings first.")
        }

        let body = try req.content.decode(SyncDealRequest.self)
        let baseURL = "https://api.pipedrive.com/v1"

        // Map outcome to Pipedrive stage — uses the default pipeline's first stage id (1).
        // Won/lost are special statuses in Pipedrive.
        let status: String
        switch body.outcome {
        case "won":  status = "won"
        case "lost": status = "lost"
        default:     status = "open"
        }

        let dealURL = URL(string: "\(baseURL)/deals?api_token=\(apiKey)")!
        var dealReq = URLRequest(url: dealURL)
        dealReq.httpMethod = "POST"
        dealReq.setValue("application/json", forHTTPHeaderField: "Content-Type")
        var dealBody: [String: Any] = [
            "title": "\(body.clientName) — Draftly Proposal",
            "status": status,
        ]
        if let v = body.valueUsd { dealBody["value"] = v }
        dealReq.httpBody = try JSONSerialization.data(withJSONObject: dealBody)

        guard let (data, _) = try? await URLSession.shared.data(for: dealReq),
              let response = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            throw Abort(.badGateway, reason: "Pipedrive API request failed")
        }

        return try await response.encodeResponse(for: req)
    }

    // MARK: - Connection status

    @Sendable
    func status(_ req: Request) async throws -> Response {
        let customer = try await req.authenticatedCustomer()
        let connected = !(customer.pipedriveApiKey ?? "").isEmpty
        let result: [String: Any] = ["connected": connected]
        return try await result.encodeResponse(for: req)
    }
}
