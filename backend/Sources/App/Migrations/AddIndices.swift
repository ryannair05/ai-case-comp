import Fluent
import SQLKit

/// Adds database indices for all hot query paths.
///
/// Every controller filters by `customer_id` — without an index,
/// these are full table scans. This migration adds indices for:
/// - Foreign key lookups (customer_id on 7 child tables)
/// - Compound queries (customer_id + deleted_at, created_at, status, entry_type)
/// - Filtered aggregations (customers.status for analytics/phase gate)
struct AddIndices: AsyncMigration {
    func prepare(on database: any Database) async throws {
        guard let sql = database as? any SQLDatabase else { return }

        // -- proposals --
        try await sql.raw(
            "CREATE INDEX IF NOT EXISTS idx_proposals_customer_id ON proposals(customer_id)"
        ).run()
        try await sql.raw(
            "CREATE INDEX IF NOT EXISTS idx_proposals_cust_deleted ON proposals(customer_id, deleted_at)"
        ).run()
        try await sql.raw(
            "CREATE INDEX IF NOT EXISTS idx_proposals_cust_created ON proposals(customer_id, created_at)"
        ).run()

        // -- pricing_data --
        try await sql.raw(
            "CREATE INDEX IF NOT EXISTS idx_pricing_data_customer_id ON pricing_data(customer_id)"
        ).run()

        // -- brand_voice --
        try await sql.raw(
            "CREATE INDEX IF NOT EXISTS idx_brand_voice_customer_id ON brand_voice(customer_id)"
        ).run()

        // -- support_tickets --
        try await sql.raw(
            "CREATE INDEX IF NOT EXISTS idx_support_tickets_cust_status ON support_tickets(customer_id, status)"
        ).run()

        // -- churn_signals --
        try await sql.raw(
            "CREATE INDEX IF NOT EXISTS idx_churn_signals_customer_id ON churn_signals(customer_id)"
        ).run()

        // -- vector_entries (every query filters customer_id + entry_type) --
        try await sql.raw(
            "CREATE INDEX IF NOT EXISTS idx_vector_entries_cust_type ON vector_entries(customer_id, entry_type)"
        ).run()

        // -- job_records --
        try await sql.raw(
            "CREATE INDEX IF NOT EXISTS idx_job_records_customer_id ON job_records(customer_id)"
        ).run()

        // -- customers (analytics, churn detection, phase gate) --
        try await sql.raw("CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status)")
            .run()
    }

    func revert(on database: any Database) async throws {
        guard let sql = database as? any SQLDatabase else { return }

        try await sql.raw("DROP INDEX IF EXISTS idx_customers_status").run()
        try await sql.raw("DROP INDEX IF EXISTS idx_job_records_customer_id").run()
        try await sql.raw("DROP INDEX IF EXISTS idx_vector_entries_cust_type").run()
        try await sql.raw("DROP INDEX IF EXISTS idx_churn_signals_customer_id").run()
        try await sql.raw("DROP INDEX IF EXISTS idx_support_tickets_cust_status").run()
        try await sql.raw("DROP INDEX IF EXISTS idx_brand_voice_customer_id").run()
        try await sql.raw("DROP INDEX IF EXISTS idx_pricing_data_customer_id").run()
        try await sql.raw("DROP INDEX IF EXISTS idx_proposals_cust_created").run()
        try await sql.raw("DROP INDEX IF EXISTS idx_proposals_cust_deleted").run()
        try await sql.raw("DROP INDEX IF EXISTS idx_proposals_customer_id").run()
    }
}
