import Fluent
import Vapor

/// Background job record for async ingest polling.
final class JobRecord: Model, Content, @unchecked Sendable {
    static let schema = "job_records"

    @ID(key: .id)
    var id: UUID?

    @Field(key: "job_type")
    var jobType: String

    /// queued | running | completed | failed
    @Field(key: "status")
    var status: String

    @OptionalField(key: "result_json")
    var resultJson: String?

    @Field(key: "customer_id")
    var customerId: String

    @Timestamp(key: "created_at", on: .create)
    var createdAt: Date?

    @OptionalField(key: "completed_at")
    var completedAt: Date?

    init() {}

    init(jobType: String, customerId: String) {
        self.jobType = jobType
        self.customerId = customerId
        self.status = "queued"
    }
}
