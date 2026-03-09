import Fluent
import Vapor

/// Churn signal — replaces Supabase `churn_signals` table.
final class ChurnSignal: Model, Content, @unchecked Sendable {
    static let schema = "churn_signals"

    @ID(key: .id)
    var id: UUID?

    @Field(key: "customer_id")
    var customerId: UUID

    @OptionalField(key: "usage_drop_pct")
    var usageDropPct: Double?

    @OptionalField(key: "days_inactive")
    var daysInactive: Int?

    @OptionalField(key: "nps_score")
    var npsScore: Int?

    @Timestamp(key: "flagged_at", on: .create)
    var flaggedAt: Date?

    @Field(key: "outreach_sent")
    var outreachSent: Bool

    @Field(key: "resolved")
    var resolved: Bool

    init() {}

    init(customerId: UUID, usageDropPct: Double? = nil, daysInactive: Int? = nil) {
        self.customerId = customerId
        self.usageDropPct = usageDropPct
        self.daysInactive = daysInactive
        self.outreachSent = false
        self.resolved = false
    }
}
