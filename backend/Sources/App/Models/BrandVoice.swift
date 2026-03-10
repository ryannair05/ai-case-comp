import Fluent
import Vapor

/// Brand voice example
final class BrandVoice: Model, Content, @unchecked Sendable {
    static let schema = "brand_voice"

    @ID(key: .id)
    var id: UUID?

    @Field(key: "customer_id")
    var customerId: UUID

    @Field(key: "example_text")
    var exampleText: String

    @OptionalField(key: "style_notes")
    var styleNotes: String?

    @OptionalField(key: "tone_tags")
    var toneTags: String?  // comma-separated tags stored as string

    @Timestamp(key: "created_at", on: .create)
    var createdAt: Date?

    init() {}

    init(customerId: UUID, exampleText: String, styleNotes: String? = nil, toneTags: String? = nil)
    {
        self.customerId = customerId
        self.exampleText = exampleText
        self.styleNotes = styleNotes
        self.toneTags = toneTags
    }
}
