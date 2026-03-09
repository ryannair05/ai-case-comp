import Fluent
import Vapor

/// Pricing data row — replaces Supabase `pricing_data` table.
final class PricingData: Model, Content, @unchecked Sendable {
    static let schema = "pricing_data"

    @ID(key: .id)
    var id: UUID?

    @Field(key: "customer_id")
    var customerId: UUID

    @Field(key: "service_type")
    var serviceType: String

    @Field(key: "price_usd")
    var priceUsd: Double

    @OptionalField(key: "won")
    var won: Bool?

    @OptionalField(key: "notes")
    var notes: String?

    @Timestamp(key: "created_at", on: .create)
    var createdAt: Date?

    init() {}

    init(customerId: UUID, serviceType: String, priceUsd: Double, won: Bool? = nil, notes: String? = nil) {
        self.customerId = customerId
        self.serviceType = serviceType
        self.priceUsd = priceUsd
        self.won = won
        self.notes = notes
    }
}
