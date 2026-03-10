import Fluent
import Vapor

/// DealSignal — extracted intelligence from a GTM meeting.
/// Stored per client, drives the Kanban board in the GTM dashboard.
final class DealSignal: Model, Content, @unchecked Sendable {
    static let schema = "deal_signals"

    @ID(key: .id)
    var id: UUID?

    @Field(key: "customer_id")
    var customerId: UUID

    @Field(key: "client_name")
    var clientName: String

    /// discovery | proposal | negotiation | closed_won | closed_lost
    @Field(key: "stage")
    var stage: String

    /// JSON-encoded array of budget signal strings
    @Field(key: "budget_signals")
    var budgetSignals: String

    /// JSON-encoded array of needs strings
    @Field(key: "needs_identified")
    var needsIdentified: String

    /// JSON-encoded array of objection strings
    @Field(key: "objections")
    var objections: String

    /// JSON-encoded array of next action strings
    @Field(key: "next_actions")
    var nextActions: String

    @Field(key: "proposal_recommended")
    var proposalRecommended: Bool

    @Timestamp(key: "created_at", on: .create)
    var createdAt: Date?

    init() {}

    init(
        customerId: UUID,
        clientName: String,
        stage: String = "discovery",
        budgetSignals: [String] = [],
        needsIdentified: [String] = [],
        objections: [String] = [],
        nextActions: [String] = [],
        proposalRecommended: Bool = false
    ) {
        self.customerId = customerId
        self.clientName = clientName
        self.stage = stage
        self.budgetSignals = (try? String(data: JSONEncoder().encode(budgetSignals), encoding: .utf8)) ?? "[]"
        self.needsIdentified = (try? String(data: JSONEncoder().encode(needsIdentified), encoding: .utf8)) ?? "[]"
        self.objections = (try? String(data: JSONEncoder().encode(objections), encoding: .utf8)) ?? "[]"
        self.nextActions = (try? String(data: JSONEncoder().encode(nextActions), encoding: .utf8)) ?? "[]"
        self.proposalRecommended = proposalRecommended
    }
}
