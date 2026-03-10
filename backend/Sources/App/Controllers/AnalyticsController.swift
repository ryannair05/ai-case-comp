import Vapor
import Fluent
import Foundation

/// Analytics dashboard — unit economics, win rate, phase gate.
struct AnalyticsController {

    // MARK: - Unit economics

    @Sendable
    func unitEconomics(_ req: Request) async throws -> Response {
        let customers = try await Customer.query(on: req.db)
            .filter(\.$status == "active")
            .all()

        let totalRevenue = customers.reduce(0.0) { $0 + $1.monthlyRevenue }
        let churnedCount = customers.filter { $0.churnedThisMonth }.count
        let churnRate = customers.isEmpty ? 0.0 : Double(churnedCount) / Double(customers.count)
        let blendedARPA = customers.isEmpty ? 175.0 : totalRevenue / Double(customers.count)

        // LTV = ARPA / churn_rate (capped at 36 months)
        let ltv = churnRate > 0 ? min(blendedARPA / churnRate, blendedARPA * 36) : blendedARPA * 36
        let avgSwitchingCost = Double(customers.map { calculateSwitchingCost(customer: $0)["total_cost"] as? Int ?? 0 }.reduce(0, +))
            / max(1, Double(customers.count))

        // AI cost per proposal (~$0.12 based on Claude Sonnet pricing)
        _ = customers.reduce(0) { $0 + $1.proposalsIndexed }
        let aiCostPerProposal: Double = 0.12

        let scenario: String
        switch churnRate {
        case ..<0.035: scenario = "bull"
        case ..<0.055: scenario = "base"
        default:       scenario = "bear"
        }

        let result: [String: Any] = [
            "monthly_churn_rate":       churnRate,
            "avg_customer_lifetime_months": churnRate > 0 ? 1.0 / churnRate : 36.0,
            "blended_arpa_usd":         blendedARPA,
            "ltv_usd":                  ltv,
            "cac_usd":                  0.0,  // $0 CAC (referral/organic)
            "ltv_cac_ratio":            "∞",
            "gross_margin":             0.72,
            "ai_cost_per_proposal":     aiCostPerProposal,
            "avg_switching_cost_usd":   avgSwitchingCost,
            "on_track_for":             scenario,
            "bear_at_churn":            0.075,
            "base_at_churn":            0.055,
            "bull_at_churn":            0.035,
        ]
        return try await result.encodeResponse(for: req)
    }

    // MARK: - Win rate

    @Sendable
    func winRate(_ req: Request) async throws -> Response {
        let customer = try await req.authenticatedCustomer()
        let proposals = try await Proposal.query(on: req.db)
            .filter(\.$customerId == customer.id!)
            .filter(\.$deletedAt == nil)
            .all()

        let decided = proposals.filter { $0.outcome == "won" || $0.outcome == "lost" }
        let won     = proposals.filter { $0.outcome == "won" }
        let lost    = proposals.filter { $0.outcome == "lost" }

        let winRate = decided.isEmpty ? 0.0 : Double(won.count) / Double(decided.count)
        let avgDealSize = won.isEmpty ? 0.0 : won.compactMap(\.valueUsd).reduce(0, +) / Double(max(1, won.count))

        let result: [String: Any] = [
            "total_proposals":    proposals.count,
            "won":                won.count,
            "lost":               lost.count,
            "pending":            proposals.filter { $0.outcome == "pending" }.count,
            "win_rate":           winRate,
            "avg_deal_size_usd":  avgDealSize,
        ]
        return try await result.encodeResponse(for: req)
    }

    // MARK: - Phase gate (Phase 1 → Phase 2)

    @Sendable
    func phaseGate(_ req: Request) async throws -> Response {
        let customers = try await Customer.query(on: req.db)
            .filter(\.$contextMapperActive == true)
            .count()
        let churnedCount = try await Customer.query(on: req.db)
            .filter(\.$churnedThisMonth == true).count()
        let totalActive  = try await Customer.query(on: req.db)
            .filter(\.$status == "active").count()
        let churnRate = totalActive > 0 ? Double(churnedCount) / Double(totalActive) : 0.0

        // Gate 1: ≥50 customers with Context-Mapper active
        let gate1Passed = customers >= 50
        // Gate 2: monthly churn ≤ 5%
        let gate2Passed = churnRate <= 0.05
        // Gate 3: context-mapper PR merged (environment flag)
        let gate3Passed = ProcessInfo.processInfo.environment["CONTEXT_MAPPER_MERGED"] == "true"

        let result: [String: Any] = [
            "gate1": ["label": "≥50 Context-Mapper customers", "current": customers,  "target": 50,    "passed": gate1Passed],
            "gate2": ["label": "Monthly churn ≤5%",            "current": churnRate,  "target": 0.05,  "passed": gate2Passed],
            "gate3": ["label": "context-mapper PR merged",      "current": gate3Passed, "target": true, "passed": gate3Passed],
            "all_passed": gate1Passed && gate2Passed && gate3Passed,
        ]
        return try await result.encodeResponse(for: req)
    }

    // MARK: - ROI summary

    @Sendable
    func roiSummary(_ req: Request) async throws -> Response {
        let customer = try await req.authenticatedCustomer()
        let sevenDaysAgo = Date().addingTimeInterval(-7 * 24 * 3600)
        let recentProposals = try await Proposal.query(on: req.db)
            .filter(\.$customerId == customer.id!)
            .filter(\.$createdAt >= sevenDaysAgo)
            .all()

        let wins = recentProposals.filter { $0.outcome == "won" }
        let hoursSaved = Double(recentProposals.count) * 4.2
        let revenueAttributed = wins.compactMap(\.valueUsd).reduce(0, +)
        let moat = calculateSwitchingCost(customer: customer)

        let result: [String: Any] = [
            "proposals_this_week": recentProposals.count,
            "hours_saved":         hoursSaved,
            "wins_this_week":      wins.count,
            "revenue_attributed":  revenueAttributed,
            "moat":                moat,
        ]
        return try await result.encodeResponse(for: req)
    }
}
