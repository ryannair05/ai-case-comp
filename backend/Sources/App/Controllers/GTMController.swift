import Fluent
import Foundation
import Vapor

#if canImport(FoundationNetworking)
    import FoundationNetworking
#endif

/// GTM Sales Agent — Phase 2 endpoints.
/// Logic already existed in ClaudeService; this router exposes it.
/// Gated by `gtm_agent` tier (or professional tier can preview).
struct GTMController {

    // MARK: - Meeting signal extraction

    struct MeetingSignalsRequest: Content {
        let rawNotes: String
        let clientName: String
        enum CodingKeys: String, CodingKey {
            case rawNotes = "raw_notes"
            case clientName = "client_name"
        }
    }

    @Sendable
    func extractMeetingSignals(_ req: Request) async throws -> Response {
        let customer = try await req.authenticatedCustomer()
        guard customer.tier == "gtm_agent" else {
            throw Abort(
                .forbidden,
                reason: customer.tier == "professional"
                    ? "GTM Agent features are preview-only on Professional. Upgrade to GTM Agent ($399/mo) for full access."
                    : "GTM Agent features require the GTM Agent tier ($399/mo)."
            )
        }
        let body = try req.content.decode(MeetingSignalsRequest.self)
        let signals = try await ClaudeService.shared.extractMeetingSignals(
            customerId: customer.id!.uuidString,
            notes: body.rawNotes,
            clientName: body.clientName
        )

        // Persist as a DealSignal record
        let dealSignal = DealSignal(
            customerId: customer.id!,
            clientName: body.clientName,
            stage: signals["deal_stage"] as? String ?? "discovery",
            budgetSignals: signals["budget_signals"] as? [String] ?? [],
            needsIdentified: signals["needs_identified"] as? [String] ?? [],
            objections: signals["objections"] as? [String] ?? [],
            nextActions: signals["next_actions"] as? [String] ?? [],
            proposalRecommended: signals["proposal_recommended"] as? Bool ?? false
        )
        try await dealSignal.save(on: req.db)

        // Auto-push to CRM if connected (non-blocking)
        Task.detached { [db = req.db] in
            if customer.hubspotConnected, let token = customer.hubspotToken {
                let dealBody: [String: Any] = [
                    "properties": [
                        "dealname": "\(body.clientName) — GTM Signal",
                        "dealstage": dealSignal.stage == "closed_won"
                            ? "closedwon"
                            : dealSignal.stage == "closed_lost"
                                ? "closedlost"
                                : "appointmentscheduled",
                        "pipeline": "default",
                    ]
                ]
                var hubReq = URLRequest(
                    url: URL(string: "https://api.hubapi.com/crm/v3/objects/deals")!)
                hubReq.httpMethod = "POST"
                hubReq.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                hubReq.setValue("application/json", forHTTPHeaderField: "Content-Type")
                hubReq.httpBody = try? JSONSerialization.data(withJSONObject: dealBody)
                _ = try? await URLSession.shared.data(for: hubReq)
            }
            if let pipedriveKey = customer.pipedriveApiKey {
                let pipeReq: [String: Any] = [
                    "title": "\(body.clientName) — GTM Signal",
                    "stage_id": 1,
                ]
                var req2 = URLRequest(
                    url: URL(
                        string: "https://api.pipedrive.com/v1/deals?api_token=\(pipedriveKey)")!)
                req2.httpMethod = "POST"
                req2.setValue("application/json", forHTTPHeaderField: "Content-Type")
                req2.httpBody = try? JSONSerialization.data(withJSONObject: pipeReq)
                _ = try? await URLSession.shared.data(for: req2)
            }
        }

        // Return original signal JSON + deal_signal_id
        var response = signals
        response["deal_signal_id"] = dealSignal.id?.uuidString ?? ""
        return try await response.encodeResponse(for: req)
    }

    // MARK: - List deal signals

    @Sendable
    func listDealSignals(_ req: Request) async throws -> Response {
        let customer = try await req.authenticatedCustomer()
        let signals = try await DealSignal.query(on: req.db)
            .filter(\.$customerId == customer.id!)
            .sort(\.$createdAt, .descending)
            .all()

        let result = signals.map { s -> [String: Any] in
            var d: [String: Any] = [
                "id": s.id?.uuidString ?? "",
                "client_name": s.clientName,
                "stage": s.stage,
                "budget_signals": s.budgetSignals,
                "needs_identified": s.needsIdentified,
                "objections": s.objections,
                "next_actions": s.nextActions,
                "proposal_recommended": s.proposalRecommended,
            ]
            if let createdAt = s.createdAt {
                d["created_at"] = ISO8601DateFormatter().string(from: createdAt)
            }
            return d
        }
        return try await result.encodeResponse(for: req)
    }

    // MARK: - Update deal stage

    struct UpdateStageRequest: Content {
        let stage: String
    }

    @Sendable
    func updateDealStage(_ req: Request) async throws -> Response {
        let customer = try await req.authenticatedCustomer()
        let signalId = try req.parameters.require("id", as: UUID.self)
        guard
            let signal = try await DealSignal.query(on: req.db)
                .filter(\.$customerId == customer.id!)
                .filter(\.$id == signalId)
                .first()
        else {
            throw Abort(.notFound, reason: "Deal signal not found")
        }
        let body = try req.content.decode(UpdateStageRequest.self)
        let validStages = ["discovery", "proposal", "negotiation", "closed_won", "closed_lost"]
        guard validStages.contains(body.stage) else {
            throw Abort(
                .badRequest,
                reason: "Invalid stage. Must be one of: \(validStages.joined(separator: ", "))")
        }
        signal.stage = body.stage
        try await signal.save(on: req.db)

        // Push updated stage to CRM if connected (non-blocking)
        Task.detached { [db = req.db] in
            if customer.hubspotConnected, let token = customer.hubspotToken {
                let dealBody: [String: Any] = [
                    "properties": [
                        "dealstage": body.stage == "closed_won"
                            ? "closedwon"
                            : body.stage == "closed_lost"
                                ? "closedlost"
                                : "appointmentscheduled"
                    ]
                ]
                var hubReq = URLRequest(
                    url: URL(string: "https://api.hubapi.com/crm/v3/objects/deals")!)
                hubReq.httpMethod = "POST"
                hubReq.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                hubReq.setValue("application/json", forHTTPHeaderField: "Content-Type")
                hubReq.httpBody = try? JSONSerialization.data(withJSONObject: dealBody)
                _ = try? await URLSession.shared.data(for: hubReq)
            }
        }

        let result: [String: Any] = [
            "id": signal.id?.uuidString ?? "",
            "client_name": signal.clientName,
            "stage": signal.stage,
        ]
        return try await result.encodeResponse(for: req)
    }

    // MARK: - Outreach sequence generation

    struct OutreachRequest: Content {
        let prospectName: String
        let prospectCompany: String
        let prospectIndustry: String
        let painPoint: String
        let sequenceLength: Int?
        enum CodingKeys: String, CodingKey {
            case prospectName = "prospect_name"
            case prospectCompany = "prospect_company"
            case prospectIndustry = "prospect_industry"
            case painPoint = "pain_point"
            case sequenceLength = "sequence_length"
        }
    }

    @Sendable
    func generateOutreachSequence(_ req: Request) async throws -> Response {
        let customer = try await req.authenticatedCustomer()
        guard customer.tier == "gtm_agent" else {
            throw Abort(
                .forbidden,
                reason: customer.tier == "professional"
                    ? "GTM Agent features are preview-only on Professional. Upgrade to GTM Agent ($399/mo) for full access."
                    : "GTM Agent features require the GTM Agent tier ($399/mo)."
            )
        }
        let body = try req.content.decode(OutreachRequest.self)

        // Retrieve win stories from Context-Mapper to personalise emails
        let winContext = try await LocalVectorStore.shared.query(
            customerId: customer.id!.uuidString,
            queryText: "winning proposal \(body.prospectIndustry) \(body.painPoint)",
            topK: 3,
            db: req.db
        )

        let prospect: [String: Any] = [
            "prospect_name": body.prospectName,
            "prospect_company": body.prospectCompany,
            "prospect_industry": body.prospectIndustry,
            "pain_point": body.painPoint,
        ]

        let sequence = try await ClaudeService.shared.generateOutreachSequence(
            senderFirm: customer.name,
            prospect: prospect,
            winContext: winContext,
            sequenceLength: body.sequenceLength ?? 4
        )

        // AI disclosure footer (ethics requirement)
        let withDisclosure = sequence.map { email -> [String: Any] in
            var e = email
            let body =
                (e["body"] as? String ?? "")
                + "\n\n---\nThis email was drafted with AI assistance by Draftly."
            e["body"] = body
            return e
        }

        return try await withDisclosure.encodeResponse(for: req)
    }
}
