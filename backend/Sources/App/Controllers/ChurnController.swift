import Vapor
import Fluent
import Foundation

/// Churn detection — highest-ROI build in Phase 1.
/// At $2,800 LTV per customer, stopping churn is the biggest lever.
struct ChurnController {

    // MARK: - List signals (customer's own)

    @Sendable
    func listSignals(_ req: Request) async throws -> [ChurnSignal] {
        let customer = try await req.authenticatedCustomer()
        return try await ChurnSignal.query(on: req.db)
            .filter(\.$customerId == customer.id!)
            .sort(\.$flaggedAt, .descending)
            .all()
    }

    // MARK: - Admin: list ALL signals enriched with customer name/tier/MRR

    @Sendable
    func listAllSignals(_ req: Request) async throws -> Response {
        let customer = try await req.authenticatedCustomer()
        guard customer.isAdmin else {
            throw Abort(.forbidden, reason: "Admin access required")
        }

        let signals = try await ChurnSignal.query(on: req.db)
            .sort(\.$flaggedAt, .descending)
            .all()

        var enriched: [[String: Any]] = []
        for signal in signals {
            let cust = try? await Customer.find(signal.customerId, on: req.db)
            var s: [String: Any] = [
                "id": signal.id?.uuidString ?? "",
                "customer_id": signal.customerId.uuidString,
                "customer_name": cust?.name ?? "Unknown",
                "customer_tier": cust?.tier ?? "unknown",
                "customer_mrr": cust?.monthlyRevenue ?? 0.0,
                "usage_drop_pct": signal.usageDropPct ?? 0.0,
                "days_inactive": signal.daysInactive ?? 0,
                "nps_score": signal.npsScore ?? 0,
                "outreach_sent": signal.outreachSent,
                "resolved": signal.resolved,
            ]
            if let flaggedAt = signal.flaggedAt {
                s["flagged_at"] = ISO8601DateFormatter().string(from: flaggedAt)
            }
            enriched.append(s)
        }

        return try await enriched.encodeResponse(for: req)
    }

    // MARK: - Send retention email

    @Sendable
    func sendRetentionEmail(_ req: Request) async throws -> Response {
        let admin = try await req.authenticatedCustomer()
        guard admin.isAdmin else {
            throw Abort(.forbidden, reason: "Admin access required")
        }
        let signalId = try req.parameters.require("id", as: UUID.self)
        guard let signal = try await ChurnSignal.find(signalId, on: req.db) else {
            throw Abort(.notFound, reason: "Churn signal not found")
        }
        signal.outreachSent = true
        try await signal.save(on: req.db)

        // Best-effort Resend email (non-blocking)
        if let cust = try? await Customer.find(signal.customerId, on: req.db),
           let resendKey = ProcessInfo.processInfo.environment["RESEND_API_KEY"],
           !resendKey.isEmpty
        {
            let emailBody: [String: Any] = [
                "from": "support@draftly.ai",
                "to": [cust.email],
                "subject": "We noticed you've been away — let's reconnect",
                "html": "<p>Hi \(cust.name),</p><p>We noticed some inactivity on your Draftly account and wanted to check in. Is there anything we can help with?</p><p>— The Draftly Team</p>"
            ]
            Task.detached {
                var emailReq = URLRequest(url: URL(string: "https://api.resend.com/emails")!)
                emailReq.httpMethod = "POST"
                emailReq.setValue("Bearer \(resendKey)", forHTTPHeaderField: "Authorization")
                emailReq.setValue("application/json", forHTTPHeaderField: "Content-Type")
                emailReq.httpBody = try? JSONSerialization.data(withJSONObject: emailBody)
                _ = try? await URLSession.shared.data(for: emailReq)
            }
        }

        let result: [String: Any] = ["status": "sent", "signal_id": signalId.uuidString]
        return try await result.encodeResponse(for: req)
    }

    // MARK: - Run detection (called by cron or admin)

    @Sendable
    func runDetection(_ req: Request) async throws -> Response {
        // Run detection across all active customers
        let customers = try await Customer.query(on: req.db)
            .filter(\.$status == "active")
            .all()

        var flagged = 0
        for customer in customers {
            if let signal = await detectChurn(for: customer, db: req.db) {
                try await signal.save(on: req.db)
                flagged += 1
                // Mark customer
                customer.churnedThisMonth = true
                try await customer.save(on: req.db)
            }
        }

        let result: [String: Any] = ["customers_scanned": customers.count, "flagged": flagged]
        return try await result.encodeResponse(for: req)
    }
}

/// Churn detection heuristics.
/// Returns a ChurnSignal if the customer shows risk, nil otherwise.
func detectChurn(for customer: Customer, db: any Database) async -> ChurnSignal? {
    guard let customerId = customer.id else { return nil }

    // Heuristic 1: no proposals in last 14 days
    let twoWeeksAgo = Date().addingTimeInterval(-14 * 24 * 3600)
    let recentProposals = (try? await Proposal.query(on: db)
        .filter(\.$customerId == customerId)
        .filter(\.$createdAt >= twoWeeksAgo)
        .count()) ?? 0

    if recentProposals == 0 && customer.proposalsIndexed > 0 {
        let signal = ChurnSignal(
            customerId: customerId,
            usageDropPct: 100.0,
            daysInactive: 14
        )
        return signal
    }

    // Heuristic 2: usage dropped significantly vs prior period
    let thirtyDaysAgo = Date().addingTimeInterval(-30 * 24 * 3600)
    let sixtyDaysAgo  = Date().addingTimeInterval(-60 * 24 * 3600)

    let currentPeriod = (try? await Proposal.query(on: db)
        .filter(\.$customerId == customerId)
        .filter(\.$createdAt >= thirtyDaysAgo).count()) ?? 0
    let priorPeriod = (try? await Proposal.query(on: db)
        .filter(\.$customerId == customerId)
        .filter(\.$createdAt >= sixtyDaysAgo)
        .filter(\.$createdAt < thirtyDaysAgo).count()) ?? 0

    if priorPeriod > 0 {
        let dropPct = Double(priorPeriod - currentPeriod) / Double(priorPeriod) * 100
        if dropPct >= 50 {
            return ChurnSignal(customerId: customerId, usageDropPct: dropPct)
        }
    }

    return nil
}
