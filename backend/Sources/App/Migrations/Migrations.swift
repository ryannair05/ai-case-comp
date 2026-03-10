import Fluent

struct CreateCustomer: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema("customers")
            .id()
            .field("name", .string, .required)
            .field("email", .string, .required)
            .field("password_hash", .string, .required)
            .field("tier", .string, .required, .sql(.default("starter")))
            .field("stripe_id", .string)
            .field("context_mapper_active", .bool, .required, .sql(.default(false)))
            .field("proposals_indexed", .int, .required, .sql(.default(0)))
            .field("industry", .string)
            .field("status", .string, .required, .sql(.default("active")))
            .field("monthly_revenue", .double, .required, .sql(.default(99.0)))
            .field("churned_this_month", .bool, .required, .sql(.default(false)))
            .field("hubspot_connected", .bool, .required, .sql(.default(false)))
            .field("hubspot_token", .string)
            .field("onboarded_at", .datetime)
            .field("created_at", .datetime)
            .field("pipedrive_api_key", .string)
            .field("onboarding_step_completed", .int, .required, .sql(.default(0)))
            .field("is_admin", .bool, .required, .sql(.default(false)))
            .unique(on: "email")
            .create()
    }

    func revert(on database: any Database) async throws {
        try await database.schema("customers").delete()
    }
}

struct CreateProposal: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema("proposals")
            .id()
            .field("customer_id", .uuid, .required)
            .field("title", .string)
            .field("content", .sql(unsafeRaw: "TEXT"), .required)
            .field("client_name", .string)
            .field("value_usd", .double)
            .field("outcome", .string, .required, .sql(.default("pending")))
            .field("win_reason", .string)
            .field("lose_reason", .string)
            .field("created_at", .datetime)
            .field("deleted_at", .datetime)
            .field("quality_score", .int)
            .create()
    }

    func revert(on database: any Database) async throws {
        try await database.schema("proposals").delete()
    }
}

struct CreatePricingData: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema("pricing_data")
            .id()
            .field("customer_id", .uuid, .required)
            .field("service_type", .string, .required)
            .field("price_usd", .double, .required)
            .field("won", .bool)
            .field("notes", .string)
            .field("created_at", .datetime)
            .create()
    }

    func revert(on database: any Database) async throws {
        try await database.schema("pricing_data").delete()
    }
}

struct CreateBrandVoice: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema("brand_voice")
            .id()
            .field("customer_id", .uuid, .required)
            .field("example_text", .sql(unsafeRaw: "TEXT"), .required)
            .field("style_notes", .string)
            .field("tone_tags", .string)
            .field("created_at", .datetime)
            .create()
    }

    func revert(on database: any Database) async throws {
        try await database.schema("brand_voice").delete()
    }
}

struct CreateSupportTicket: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema("support_tickets")
            .id()
            .field("customer_id", .uuid, .required)
            .field("subject", .string)
            .field("body", .sql(unsafeRaw: "TEXT"), .required)
            .field("ai_response", .sql(unsafeRaw: "TEXT"))
            .field("status", .string, .required, .sql(.default("open")))
            .field("severity", .string, .required, .sql(.default("low")))
            .field("created_at", .datetime)
            .field("resolved_at", .datetime)
            .field("admin_reply", .sql(unsafeRaw: "TEXT"))
            .create()
    }

    func revert(on database: any Database) async throws {
        try await database.schema("support_tickets").delete()
    }
}

struct CreateChurnSignal: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema("churn_signals")
            .id()
            .field("customer_id", .uuid, .required)
            .field("usage_drop_pct", .double)
            .field("days_inactive", .int)
            .field("nps_score", .int)
            .field("flagged_at", .datetime)
            .field("outreach_sent", .bool, .required, .sql(.default(false)))
            .field("resolved", .bool, .required, .sql(.default(false)))
            .create()
    }

    func revert(on database: any Database) async throws {
        try await database.schema("churn_signals").delete()
    }
}

struct CreateVectorEntry: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema("vector_entries")
            .id()
            // Customer namespace — mirrors Pinecone namespace isolation rule
            .field("customer_id", .string, .required)
            .field("entry_type", .string, .required)
            .field("text", .sql(unsafeRaw: "TEXT"), .required)
            // Raw packed Float32 bytes (1024 dims = 4 096 B per row).
            // BLOB is the native SQLite type for binary data; fastest round-trip.
            .field("embedding_blob", .data, .required)
            // Metadata stored as compact JSON string (small, rarely parsed)
            .field("metadata_json", .sql(unsafeRaw: "TEXT"), .required)
            .field("created_at", .datetime)
            .create()
    }

    func revert(on database: any Database) async throws {
        try await database.schema("vector_entries").delete()
    }
}

struct CreateJobRecord: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema("job_records")
            .id()
            .field("job_type", .string, .required)
            .field("status", .string, .required, .sql(.default("queued")))
            .field("result_json", .sql(unsafeRaw: "TEXT"))
            .field("customer_id", .string, .required)
            .field("created_at", .datetime)
            .field("completed_at", .datetime)
            .create()
    }

    func revert(on database: any Database) async throws {
        try await database.schema("job_records").delete()
    }
}

struct CreateDealSignal: AsyncMigration {
    func prepare(on database: any Database) async throws {
        try await database.schema("deal_signals")
            .id()
            .field("customer_id", .uuid, .required)
            .field("client_name", .string, .required)
            .field("stage", .string, .required, .sql(.default("discovery")))
            .field("budget_signals", .sql(unsafeRaw: "TEXT"), .required)
            .field("needs_identified", .sql(unsafeRaw: "TEXT"), .required)
            .field("objections", .sql(unsafeRaw: "TEXT"), .required)
            .field("next_actions", .sql(unsafeRaw: "TEXT"), .required)
            .field("proposal_recommended", .bool, .required, .sql(.default(false)))
            .field("created_at", .datetime)
            .create()
    }

    func revert(on database: any Database) async throws {
        try await database.schema("deal_signals").delete()
    }
}
