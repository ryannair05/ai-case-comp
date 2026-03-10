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

    struct ReplyRequest: Content {
        let message: String
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

    // MARK: - List tickets (customer's own)

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

    // MARK: - Admin: list ALL tickets with filters + pagination

    @Sendable
    func listAllTickets(_ req: Request) async throws -> Response {
        // Require admin
        let customer = try await req.authenticatedCustomer()
        guard customer.isAdmin else {
            throw Abort(.forbidden, reason: "Admin access required")
        }

        var query = SupportTicket.query(on: req.db).sort(\.$createdAt, .descending)

        if let severity = req.query[String.self, at: "severity"] {
            query = query.filter(\.$severity == severity)
        }
        if let status = req.query[String.self, at: "status"] {
            query = query.filter(\.$status == status)
        }

        let page = (req.query[Int.self, at: "page"] ?? 1)
        let perPage = 20
        let offset = (page - 1) * perPage

        let tickets = try await query.range(offset..<(offset + perPage)).all()
        let total = try await SupportTicket.query(on: req.db).count()

        // Enrich with customer info
        var enriched: [[String: Any]] = []
        for ticket in tickets {
            let cust = try? await Customer.find(ticket.customerId, on: req.db)
            var t: [String: Any] = [
                "id": ticket.id?.uuidString ?? "",
                "customer_id": ticket.customerId.uuidString,
                "customer_name": cust?.name ?? "Unknown",
                "customer_tier": cust?.tier ?? "unknown",
                "subject": ticket.subject ?? "",
                "body": ticket.body,
                "status": ticket.status,
                "severity": ticket.severity,
                "ai_response": ticket.aiResponse ?? "",
                "admin_reply": ticket.adminReply ?? "",
            ]
            if let createdAt = ticket.createdAt {
                t["created_at"] = ISO8601DateFormatter().string(from: createdAt)
            }
            if let resolvedAt = ticket.resolvedAt {
                t["resolved_at"] = ISO8601DateFormatter().string(from: resolvedAt)
            }
            enriched.append(t)
        }

        let result: [String: Any] = [
            "tickets": enriched,
            "total": total,
            "page": page,
            "per_page": perPage,
        ]
        return try await result.encodeResponse(for: req)
    }

    // MARK: - Admin: reply to ticket

    @Sendable
    func replyToTicket(_ req: Request) async throws -> SupportTicket {
        let customer = try await req.authenticatedCustomer()
        guard customer.isAdmin else {
            throw Abort(.forbidden, reason: "Admin access required")
        }
        let ticketId = try req.parameters.require("id", as: UUID.self)
        guard let ticket = try await SupportTicket.find(ticketId, on: req.db) else {
            throw Abort(.notFound, reason: "Ticket not found")
        }
        let body = try req.content.decode(ReplyRequest.self)
        ticket.adminReply = body.message
        ticket.status = "ai_handled"
        try await ticket.save(on: req.db)
        return ticket
    }

    // MARK: - Admin: resolve ticket

    @Sendable
    func resolveTicket(_ req: Request) async throws -> SupportTicket {
        let customer = try await req.authenticatedCustomer()
        guard customer.isAdmin else {
            throw Abort(.forbidden, reason: "Admin access required")
        }
        let ticketId = try req.parameters.require("id", as: UUID.self)
        guard let ticket = try await SupportTicket.find(ticketId, on: req.db) else {
            throw Abort(.notFound, reason: "Ticket not found")
        }
        ticket.status = "closed"
        ticket.resolvedAt = Date()
        try await ticket.save(on: req.db)
        return ticket
    }
}
