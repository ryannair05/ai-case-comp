import Fluent
import Foundation
import Vapor

/// Context-Mapper status and switching cost endpoints.
struct ContextMapperController {

    // MARK: - Status

    @Sendable
    func status(_ req: Request) async throws -> Response {
        let customer = try await req.authenticatedCustomer()
        let pricingCount = try await PricingData.query(on: req.db)
            .filter(\.$customerId == customer.id!).count()
        let brandCount = try await BrandVoice.query(on: req.db)
            .filter(\.$customerId == customer.id!).count()

        let indexed = customer.proposalsIndexed
        let milestoneTarget: Int
        let nextMilestone: String
        switch indexed {
        case 0..<5:
            milestoneTarget = 5
            nextMilestone = "embedded"
        case 5..<15:
            milestoneTarget = 15
            nextMilestone = "context_mapper_active"
        case 15..<20:
            milestoneTarget = 20
            nextMilestone = "entrenched"
        default:
            milestoneTarget = 50
            nextMilestone = "irreplaceable"
        }

        let proposalsToNext = max(0, milestoneTarget - indexed)
        let milestonePct = milestoneTarget > 0
            ? min(100, Int(Double(indexed) / Double(milestoneTarget) * 100))
            : 100

        // Estimate days to next milestone based on proposals/week (last 30 days)
        let thirtyDaysAgo = Date().addingTimeInterval(-30 * 24 * 3600)
        let recentCount = (try? await Proposal.query(on: req.db)
            .filter(\.$customerId == customer.id!)
            .filter(\.$createdAt >= thirtyDaysAgo)
            .count()) ?? 0
        let proposalsPerDay = Double(recentCount) / 30.0
        let estimatedDays = proposalsPerDay > 0
            ? Int(ceil(Double(proposalsToNext) / proposalsPerDay))
            : nil

        var result: [String: Any] = [
            "context_mapper_active": customer.contextMapperActive,
            "proposals_indexed": indexed,
            "pricing_rows": pricingCount,
            "brand_examples": brandCount,
            "tier": customer.tier,
            "namespace": "customer_\(customer.id!.uuidString)",
            "next_milestone": nextMilestone,
            "proposals_to_next_milestone": proposalsToNext,
            "milestone_progress_pct": milestonePct,
            "milestone_target": milestoneTarget,
        ]
        if let days = estimatedDays {
            result["estimated_days_to_milestone"] = days
        }
        return try await result.encodeResponse(for: req)
    }

    // MARK: - Switching cost (Moat Meter)

    @Sendable
    func switchingCost(_ req: Request) async throws -> Response {
        let customer = try await req.authenticatedCustomer()
        let cost = calculateSwitchingCost(customer: customer)
        return try await cost.encodeResponse(for: req)
    }
}

/// Calculate the switching cost for a customer (Moat Meter value).
func calculateSwitchingCost(customer: Customer) -> [String: Any] {
    let proposals = customer.proposalsIndexed
    // 4.2 hrs per proposal (from financial model)
    let humanHours = proposals * 4
    let monthsActive =
        customer.onboardedAt.map { date -> Int in
            let diff = Calendar.current.dateComponents([.month], from: date, to: Date())
            return max(1, diff.month ?? 1)
        } ?? 1

    // Base cost formula: $39/hr consultant rate × hours + $500/mo SaaS replacement cost
    let hoursCost = humanHours * 39
    let saasReplacement = monthsActive * 500
    let totalCost = hoursCost + saasReplacement

    let milestone: String
    switch proposals {
    case 0..<5: milestone = "onboarding"
    case 5..<20: milestone = "embedded"
    case 20..<50: milestone = "entrenched"
    default: milestone = "irreplaceable"
    }

    return [
        "total_cost": totalCost,
        "human_hours": humanHours,
        "proposals_indexed": proposals,
        "months_active": monthsActive,
        "milestone": milestone,
    ]
}
