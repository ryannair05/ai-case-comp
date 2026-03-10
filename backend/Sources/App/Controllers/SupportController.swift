import Fluent
import Foundation
import Vapor

/// Support ticket AI triage — severity classification + auto-response.
/// Target: 80% of tickets get AI first-response in < 5 minutes.
struct SupportController {

    struct CreateTicketRequest: Content {
        let subject: String?
        let body: String
    }

    // MARK: - Create ticket + triage

    @Sendable
    func createTicket(_ req: Request) async throws -> SupportTicket {
        let customer = try await req.authenticatedCustomer()
        let body = try req.content.decode(CreateTicketRequest.self)

        let ticket = SupportTicket(
            customerId: customer.id!,
            subject: body.subject,
            body: body.body
        )
        try await ticket.save(on: req.db)

        // ChatGPT mention detector — flag if customer is considering a switch
        let bodyLower = body.body.lowercased()
        let switchSignals = [
            "chatgpt", "openai", "gemini", "gpt-4", "switching", "cancel", "leaving",
        ]
        let mentionsCompetitor = switchSignals.contains { bodyLower.contains($0) }

        // Fire Slack webhook for competitor mentions (non-blocking, best-effort)
        if mentionsCompetitor {
            if let webhookURL = ProcessInfo.processInfo.environment["SLACK_WEBHOOK_URL"],
                !webhookURL.isEmpty
            {
                let slackMsg =
                    "🚨 Competitor mention from \(customer.name) (\(customer.tier)): \"\(body.body.prefix(200))...\""
                Task.detached {
                    _ = try? await req.client.post(URI(string: webhookURL)) { slackReq in
                        try slackReq.content.encode(["text": slackMsg])
                    }
                }
            }
        }

        // Async AI triage — competitor check runs AFTER AI classification to avoid race condition
        Task.detached { [db = req.db] in
            do {
                // Classify severity with AI first
                let aiSeverity = try await ClaudeService.shared.classifySeverity(body.body)
                // Competitor mention always escalates to high, regardless of AI classification
                ticket.severity = mentionsCompetitor ? "high" : aiSeverity.lowercased()

                // Retrieve KB context for deflection
                let kbChunks = try await LocalVectorStore.shared.queryKB(
                    queryText: body.body,
                    db: db
                )

                // Generate AI response for LOW/MEDIUM tickets
                if ticket.severity != "high" {
                    let response = try await ClaudeService.shared.generateSupportResponse(
                        ticketBody: body.body,
                        kbContext: kbChunks,
                        tier: customer.tier
                    )
                    ticket.aiResponse = response
                    ticket.status = "ai_handled"
                } else {
                    ticket.status = "escalated"
                }
                ticket.resolvedAt = ticket.severity == "high" ? nil : Date()
                try await ticket.save(on: db)
            } catch {
                // Log error but don't crash — ticket already saved
            }
        }

        return ticket
    }

    // MARK: - List tickets

    @Sendable
    func listTickets(_ req: Request) async throws -> [SupportTicket] {
        let customer = try await req.authenticatedCustomer()
        var query = SupportTicket.query(on: req.db)
            .filter(\.$customerId == customer.id!)
            .sort(\.$createdAt, .descending)
        if let status = req.query[String.self, at: "status"] {
            query = query.filter(\.$status == status)
        }
        return try await query.all()
    }
}
