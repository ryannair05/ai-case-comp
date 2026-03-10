import Fluent
import Vapor
import JWT

/// Customer record — replaces Supabase `customers` table.
final class Customer: Model, Content, @unchecked Sendable {
    static let schema = "customers"

    @ID(key: .id)
    var id: UUID?

    @Field(key: "name")
    var name: String

    @Field(key: "email")
    var email: String

    @Field(key: "password_hash")
    var passwordHash: String

    /// starter | professional | gtm_agent
    @Field(key: "tier")
    var tier: String

    @OptionalField(key: "stripe_id")
    var stripeId: String?

    @Field(key: "context_mapper_active")
    var contextMapperActive: Bool

    @Field(key: "proposals_indexed")
    var proposalsIndexed: Int

    @OptionalField(key: "industry")
    var industry: String?

    /// active | churned | suspended
    @Field(key: "status")
    var status: String

    @Field(key: "monthly_revenue")
    var monthlyRevenue: Double

    @Field(key: "churned_this_month")
    var churnedThisMonth: Bool

    @Field(key: "hubspot_connected")
    var hubspotConnected: Bool

    @OptionalField(key: "hubspot_token")
    var hubspotToken: String?

    @Timestamp(key: "onboarded_at", on: .none)
    var onboardedAt: Date?

    @Timestamp(key: "created_at", on: .create)
    var createdAt: Date?

    init() {}

    init(
        id: UUID? = nil,
        name: String,
        email: String,
        passwordHash: String,
        tier: String = "starter",
        industry: String? = nil
    ) {
        self.id = id
        self.name = name
        self.email = email
        self.passwordHash = passwordHash
        self.tier = tier
        self.contextMapperActive = false
        self.proposalsIndexed = 0
        self.industry = industry
        self.status = "active"
        self.monthlyRevenue = tier == "professional" ? 249.0 : 99.0
        self.churnedThisMonth = false
        self.hubspotConnected = false
    }
}

/// JWT payload — embeds customer id and tier for stateless auth.
struct CustomerPayload: JWTPayload, Equatable {
    enum CodingKeys: String, CodingKey {
        case subject = "sub"
        case expiration = "exp"
        case tier
        case email
    }

    var subject: SubjectClaim
    var expiration: ExpirationClaim
    var tier: String
    var email: String

    func verify(using _: some JWTAlgorithm) async throws {
        try expiration.verifyNotExpired()
    }
}
