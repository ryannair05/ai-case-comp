import Fluent
import Vapor

/// Support ticket — replaces Supabase `support_tickets` table.
final class SupportTicket: Model, Content, @unchecked Sendable {
    static let schema = "support_tickets"

    @ID(key: .id)
    var id: UUID?

    @Field(key: "customer_id")
    var customerId: UUID

    @OptionalField(key: "subject")
    var subject: String?

    @Field(key: "body")
    var body: String

    @OptionalField(key: "ai_response")
    var aiResponse: String?

    /// open | ai_handled | escalated | closed
    @Field(key: "status")
    var status: String

    /// low | medium | high
    @Field(key: "severity")
    var severity: String

    @Timestamp(key: "created_at", on: .create)
    var createdAt: Date?

    @OptionalField(key: "resolved_at")
    var resolvedAt: Date?

    init() {}

    init(customerId: UUID, subject: String? = nil, body: String) {
        self.customerId = customerId
        self.subject = subject
        self.body = body
        self.status = "open"
        self.severity = "low"
    }
}
