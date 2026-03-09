import Vapor
import Fluent
import Foundation

/// Data export + account deletion (GDPR compliance).
/// One-click data export must work at all times.
/// 30-day soft-delete window before hard deletion.
struct ExportController {

    // MARK: - Full data export (ZIP)

    @Sendable
    func fullExport(_ req: Request) async throws -> Response {
        let customer = try await req.authenticatedCustomer()
        let customerId = customer.id!

        // Fetch all customer data
        let proposals = try await Proposal.query(on: req.db).filter(\.$customerId == customerId).all()
        let pricing   = try await PricingData.query(on: req.db).filter(\.$customerId == customerId).all()
        let brand     = try await BrandVoice.query(on: req.db).filter(\.$customerId == customerId).all()
        let tickets   = try await SupportTicket.query(on: req.db).filter(\.$customerId == customerId).all()
        let signals   = try await ChurnSignal.query(on: req.db).filter(\.$customerId == customerId).all()

        // Encode each table as JSON
        let encoder = JSONEncoder()
        encoder.outputFormatting = .prettyPrinted
        encoder.dateEncodingStrategy = .iso8601

        let proposalsData = (try? encoder.encode(proposals)) ?? Data()
        let pricingData   = (try? encoder.encode(pricing))   ?? Data()
        let brandData     = (try? encoder.encode(brand))     ?? Data()
        let ticketsData   = (try? encoder.encode(tickets))   ?? Data()
        let signalsData   = (try? encoder.encode(signals))   ?? Data()

        let customerInfo: [String: Any] = [
            "id":    customerId.uuidString,
            "name":  customer.name,
            "email": customer.email,
            "tier":  customer.tier,
            "exported_at": ISO8601DateFormatter().string(from: Date()),
        ]
        let customerData = (try? JSONSerialization.data(withJSONObject: customerInfo, options: .prettyPrinted)) ?? Data()

        // Build ZIP archive
        let files: [(String, Data)] = [
            ("customer.json",   customerData),
            ("proposals.json",  proposalsData),
            ("pricing.json",    pricingData),
            ("brand_voice.json", brandData),
            ("support_tickets.json", ticketsData),
            ("churn_signals.json",   signalsData),
            ("README.txt", Data("Draftly data export. All your data, yours to keep.\n".utf8)),
        ]

        let zipData = try DocxExporter.shared.buildZipPublic(files: files)

        var headers = HTTPHeaders()
        headers.add(name: .contentType, value: "application/zip")
        headers.add(name: .contentDisposition, value: "attachment; filename=\"draftly-export.zip\"")
        headers.add(name: .contentLength, value: "\(zipData.count)")

        return Response(status: .ok, headers: headers, body: .init(data: zipData))
    }

    // MARK: - Account deletion (soft delete with 30-day window)

    @Sendable
    func deleteAccount(_ req: Request) async throws -> Response {
        let customer = try await req.authenticatedCustomer()
        customer.status = "churned"
        try await customer.save(on: req.db)
        // Hard delete of vectors (GDPR right to erasure — immediate)
        try await LocalVectorStore.shared.deleteCustomerData(
            customerId: customer.id!.uuidString,
            db: req.db
        )
        // Relational data soft-deleted: hard delete happens after 30 days via cron
        let result: [String: Any] = [
            "status": "account_deleted",
            "message": "Your account has been deactivated. Data will be permanently deleted in 30 days. Download your export first.",
        ]
        return try await result.encodeResponse(for: req)
    }
}
