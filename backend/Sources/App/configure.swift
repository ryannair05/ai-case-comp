import Fluent
import FluentSQLiteDriver
import JWT
import Vapor

func configure(_ app: Application) async throws {
    // MARK: - Database
    // In testing, the test helper pre-registers .sqlite(.memory) before calling configure.
    if app.environment != .testing {
        app.databases.use(
            .sqlite(.file(Environment.get("SQLITE_PATH") ?? "db.sqlite")),
            as: .sqlite
        )
    }

    // MARK: - Migrations
    app.migrations.add(CreateCustomer())
    app.migrations.add(CreateProposal())
    app.migrations.add(CreatePricingData())
    app.migrations.add(CreateBrandVoice())
    app.migrations.add(CreateSupportTicket())
    app.migrations.add(CreateChurnSignal())
    app.migrations.add(CreateVectorEntry())
    app.migrations.add(CreateJobRecord())
    app.migrations.add(CreateDealSignal())
    app.migrations.add(AddIndices())
    try await app.autoMigrate()

    // MARK: - JWT signing key
    let jwtSecret = Environment.get("JWT_SECRET") ?? "draftly-dev-secret-change-in-production"
    await app.jwt.keys.add(hmac: HMACKey(from: jwtSecret), digestAlgorithm: .sha256)

    // MARK: - CORS
    let corsConfig = CORSMiddleware.Configuration(
        allowedOrigin: .any([
            "https://app.draftly.ai",
            "https://draftly.ai",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]),
        allowedMethods: [.GET, .POST, .PATCH, .DELETE, .OPTIONS],
        allowedHeaders: [.accept, .authorization, .contentType, .origin]
    )
    app.middleware.use(CORSMiddleware(configuration: corsConfig), at: .beginning)

    // MARK: - Routes
    try routes(app)
}
