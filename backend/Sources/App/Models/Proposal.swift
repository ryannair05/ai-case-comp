import Fluent
import Vapor

/// Proposal record
final class Proposal: Model, Content, @unchecked Sendable {
    static let schema = "proposals"

    @ID(key: .id)
    var id: UUID?

    @Field(key: "customer_id")
    var customerId: UUID

    @OptionalField(key: "title")
    var title: String?

    @Field(key: "content")
    var content: String

    @OptionalField(key: "client_name")
    var clientName: String?

    @OptionalField(key: "value_usd")
    var valueUsd: Double?

    /// won | lost | pending
    @Field(key: "outcome")
    var outcome: String

    @OptionalField(key: "win_reason")
    var winReason: String?

    @OptionalField(key: "lose_reason")
    var loseReason: String?

    @Timestamp(key: "created_at", on: .create)
    var createdAt: Date?

    @OptionalField(key: "deleted_at")
    var deletedAt: Date?

    @OptionalField(key: "quality_score")
    var qualityScore: Int?

    init() {}

    init(
        customerId: UUID,
        title: String? = nil,
        content: String,
        clientName: String? = nil,
        valueUsd: Double? = nil,
        outcome: String = "pending"
    ) {
        self.customerId = customerId
        self.title = title
        self.content = content
        self.clientName = clientName
        self.valueUsd = valueUsd
        self.outcome = outcome
    }
}
