import Vapor
import Fluent
import Foundation

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
        let result: [String: Any] = [
            "context_mapper_active": customer.contextMapperActive,
            "proposals_indexed":     customer.proposalsIndexed,
            "pricing_rows":          pricingCount,
            "brand_examples":        brandCount,
            "tier":                  customer.tier,
            "namespace":             "customer_\(customer.id!.uuidString)",
        ]
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
    let monthsActive = customer.onboardedAt.map { date -> Int in
        let diff = Calendar.current.dateComponents([.month], from: date, to: Date())
        return max(1, diff.month ?? 1)
    } ?? 1

    // Base cost formula: $85/hr consultant rate × hours + $50/mo SaaS replacement cost
    let hoursCost = humanHours * 85
    let saasReplacement = monthsActive * 50
    let totalCost = hoursCost + saasReplacement

    let milestone: String
    switch proposals {
    case 0..<5:   milestone = "onboarding"
    case 5..<20:  milestone = "embedded"
    default:      milestone = "entrenched"
    }

    return [
        "total_cost":       totalCost,
        "human_hours":      humanHours,
        "proposals_indexed": proposals,
        "months_active":    monthsActive,
        "milestone":        milestone,
    ]
}
