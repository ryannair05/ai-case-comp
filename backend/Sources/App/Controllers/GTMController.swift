import Vapor
import Fluent
import Foundation

/// GTM Sales Agent — Phase 2 endpoints.
/// Logic already existed in ClaudeService; this router exposes it.
/// Gated by `gtm_agent` tier (or professional tier can preview).
struct GTMController {

    // MARK: - Meeting signal extraction

    struct MeetingSignalsRequest: Content {
        let rawNotes: String
        let clientName: String
        enum CodingKeys: String, CodingKey {
            case rawNotes   = "raw_notes"
            case clientName = "client_name"
        }
    }

    @Sendable
    func extractMeetingSignals(_ req: Request) async throws -> Response {
        let customer = try await req.authenticatedCustomer()
        guard customer.tier == "gtm_agent" || customer.tier == "professional" else {
            throw Abort(.forbidden, reason: "GTM Agent features require the GTM Agent tier ($399/mo).")
        }
        let body = try req.content.decode(MeetingSignalsRequest.self)
        let signals = try await ClaudeService.shared.extractMeetingSignals(
            customerId: customer.id!.uuidString,
            notes: body.rawNotes,
            clientName: body.clientName
        )
        return try await signals.encodeResponse(for: req)
    }

    // MARK: - Outreach sequence generation

    struct OutreachRequest: Content {
        let prospectName: String
        let prospectCompany: String
        let prospectIndustry: String
        let painPoint: String
        let sequenceLength: Int?
        enum CodingKeys: String, CodingKey {
            case prospectName     = "prospect_name"
            case prospectCompany  = "prospect_company"
            case prospectIndustry = "prospect_industry"
            case painPoint        = "pain_point"
            case sequenceLength   = "sequence_length"
        }
    }

    @Sendable
    func generateOutreachSequence(_ req: Request) async throws -> Response {
        let customer = try await req.authenticatedCustomer()
        guard customer.tier == "gtm_agent" || customer.tier == "professional" else {
            throw Abort(.forbidden, reason: "GTM Agent features require the GTM Agent tier ($399/mo).")
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
            "prospect_name":     body.prospectName,
            "prospect_company":  body.prospectCompany,
            "prospect_industry": body.prospectIndustry,
            "pain_point":        body.painPoint,
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
            let body = (e["body"] as? String ?? "")
                + "\n\n---\nThis email was drafted with AI assistance by Draftly."
            e["body"] = body
            return e
        }

        return try await withDisclosure.encodeResponse(for: req)
    }
}
