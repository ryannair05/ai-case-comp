import Vapor
import Fluent
import Foundation

/// Churn detection — highest-ROI build in Phase 1.
/// At $2,800 LTV per customer, stopping churn is the biggest lever.
struct ChurnController {

    // MARK: - List signals

    @Sendable
    func listSignals(_ req: Request) async throws -> [ChurnSignal] {
        let customer = try await req.authenticatedCustomer()
        return try await ChurnSignal.query(on: req.db)
            .filter(\.$customerId == customer.id!)
            .sort(\.$flaggedAt, .descending)
            .all()
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
