import Fluent
import Foundation
import Vapor

/// Ingest controller — handles file, CSV, and brand-voice ingestion.
/// All heavy processing runs in a background Task (never blocks HTTP response).
struct IngestController {

    // MARK: - Pricing CSV

    struct IngestJobResponse: Content {
        let jobId: String
        let rowsQueued: Int?
        let status: String
        enum CodingKeys: String, CodingKey {
            case jobId = "job_id"
            case rowsQueued = "rows_queued"
            case status
        }
    }

    @Sendable
    func pricingCsv(_ req: Request) async throws -> IngestJobResponse {
        let customer = try await req.authenticatedCustomer()
        guard let file = req.body.data else {
            throw Abort(.badRequest, reason: "No file body provided")
        }
        let csvString = String(buffer: file)
        let rows = try parseCSV(csvString)
        guard !rows.isEmpty else {
            throw Abort(.badRequest, reason: "CSV contains no valid rows")
        }

        // Persist job record and process in background
        let job = JobRecord(jobType: "ingest_pricing", customerId: customer.id!.uuidString)
        try await job.save(on: req.db)
        let jobId = job.id!.uuidString

        Task.detached { [rows, db = req.db] in
            do {
                _ = try await RAGPipeline.shared.ingestPricingRows(
                    customerId: customer.id!.uuidString,
                    rows: rows,
                    db: db
                )
                // Save pricing rows to relational table
                for row in rows {
                    let pd = PricingData(
                        customerId: customer.id!,
                        serviceType: row.serviceType,
                        priceUsd: row.priceUsd,
                        won: row.won,
                        notes: row.notes
                    )
                    try await pd.save(on: db)
                }
                if let job = try await JobRecord.find(UUID(uuidString: jobId), on: db) {
                    job.status = "completed"
                    job.completedAt = Date()
                    try await job.save(on: db)
                }
            } catch {
                if let job = try? await JobRecord.find(UUID(uuidString: jobId), on: db) {
                    job.status = "failed"
                    job.resultJson = "{\"error\": \"\(error)\"}"
                    try? await job.save(on: db)
                }
            }
        }

        return IngestJobResponse(jobId: jobId, rowsQueued: rows.count, status: "queued")
    }

    // MARK: - Proposal file (PDF/DOCX)

    @Sendable
    func proposalFile(_ req: Request) async throws -> IngestJobResponse {
        let customer = try await req.authenticatedCustomer()
        // Read multipart fields
        let body = try req.content.decode(ProposalFileRequest.self)
        guard let fileData = body.file else {
            throw Abort(.badRequest, reason: "No file provided")
        }

        let job = JobRecord(jobType: "ingest_proposal", customerId: customer.id!.uuidString)
        try await job.save(on: req.db)
        let jobId = job.id!.uuidString
        let proposalId = UUID().uuidString
        let metadata: [String: Any] = [
            "client_name": body.clientName ?? "",
            "value_usd": body.valueUsd ?? 0,
            "outcome": body.outcome ?? "pending",
            "title": body.filename ?? "Uploaded proposal",
        ]

        Task.detached { [db = req.db] in
            do {
                // Extract text from uploaded bytes
                let text: String
                let isPDF =
                    (body.filename?.lowercased().hasSuffix(".pdf") ?? false)
                    || fileData.prefix(5) == Data("%PDF-".utf8)

                if isPDF {
                    text = Self.extractPDFText(from: fileData)
                } else {
                    text =
                        String(data: fileData, encoding: .utf8)
                        ?? String(data: fileData, encoding: .isoLatin1)
                        ?? "[Binary file — text extraction not available]"
                }

                _ = try await RAGPipeline.shared.ingestProposal(
                    customerId: customer.id!.uuidString,
                    proposalId: proposalId,
                    text: text,
                    metadata: metadata,
                    db: db
                )
                if let job = try await JobRecord.find(UUID(uuidString: jobId), on: db) {
                    job.status = "completed"
                    job.completedAt = Date()
                    try await job.save(on: db)
                }
            } catch {
                if let job = try? await JobRecord.find(UUID(uuidString: jobId), on: db) {
                    job.status = "failed"
                    try? await job.save(on: db)
                }
            }
        }

        return IngestJobResponse(jobId: jobId, rowsQueued: nil, status: "queued")
    }

    // MARK: - Re-index existing proposal

    @Sendable
    func reindexProposal(_ req: Request) async throws -> IngestJobResponse {
        let customer = try await req.authenticatedCustomer()
        let proposalId = try req.parameters.require("id", as: UUID.self)
        guard
            let proposal = try await Proposal.query(on: req.db)
                .filter(\.$customerId == customer.id!)
                .filter(\.$id == proposalId)
                .first()
        else {
            throw Abort(.notFound, reason: "Proposal not found")
        }

        let job = JobRecord(jobType: "reindex_proposal", customerId: customer.id!.uuidString)
        try await job.save(on: req.db)
        let jobId = job.id!.uuidString

        Task.detached { [content = proposal.content, db = req.db] in
            _ = try? await RAGPipeline.shared.ingestProposal(
                customerId: customer.id!.uuidString,
                proposalId: proposalId.uuidString,
                text: content,
                metadata: ["title": proposal.title ?? ""],
                db: db
            )
            if let job = try? await JobRecord.find(UUID(uuidString: jobId), on: db) {
                job.status = "completed"
                job.completedAt = Date()
                try? await job.save(on: db)
            }
        }

        return IngestJobResponse(jobId: jobId, rowsQueued: nil, status: "queued")
    }

    // MARK: - Brand voice

    @Sendable
    func brandVoice(_ req: Request) async throws -> IngestJobResponse {
        let customer = try await req.authenticatedCustomer()
        let body = try req.content.decode(BrandVoiceRequest.self)

        let bv = BrandVoice(
            customerId: customer.id!,
            exampleText: body.exampleText,
            styleNotes: body.styleNotes,
            toneTags: body.toneTags
        )
        try await bv.save(on: req.db)

        let job = JobRecord(jobType: "ingest_brand_voice", customerId: customer.id!.uuidString)
        try await job.save(on: req.db)
        let jobId = job.id!.uuidString

        Task.detached { [db = req.db] in
            _ = try? await RAGPipeline.shared.ingestBrandVoice(
                customerId: customer.id!.uuidString,
                brandVoiceId: bv.id?.uuidString ?? UUID().uuidString,
                text: body.exampleText,
                metadata: ["style_notes": body.styleNotes ?? ""],
                db: db
            )
            if let job = try? await JobRecord.find(UUID(uuidString: jobId), on: db) {
                job.status = "completed"
                try? await job.save(on: db)
            }
        }

        return IngestJobResponse(jobId: jobId, rowsQueued: nil, status: "queued")
    }

    // MARK: - Job status polling

    @Sendable
    func jobStatus(_ req: Request) async throws -> JobRecord {
        let customer = try await req.authenticatedCustomer()
        guard let jobId = UUID(uuidString: try req.parameters.require("jobId")),
            let job = try await JobRecord.find(jobId, on: req.db),
            job.customerId == customer.id!.uuidString
        else {
            throw Abort(.notFound, reason: "Job not found")
        }
        return job
    }

    // MARK: - Helpers

    private func parseCSV(_ csv: String) throws -> [PricingRow] {
        let lines = csv.components(separatedBy: "\n").filter { !$0.isEmpty }
        guard let header = lines.first else { return [] }
        let keys = header.components(separatedBy: ",").map {
            $0.trimmingCharacters(in: .whitespacesAndNewlines)
        }

        return lines.dropFirst().compactMap { line -> PricingRow? in
            let vals = line.components(separatedBy: ",").map {
                $0.trimmingCharacters(in: .whitespacesAndNewlines)
            }
            guard vals.count >= 2 else { return nil }
            func field(_ k: String) -> String? {
                guard let i = keys.firstIndex(of: k), i < vals.count else { return nil }
                return vals[i].isEmpty ? nil : vals[i]
            }
            guard let svcType = field("service_type"), let priceStr = field("price_usd"),
                let price = Double(priceStr)
            else { return nil }
            let wonStr = field("won")?.lowercased()
            let won: Bool? = wonStr.map { ["true", "1", "yes"].contains($0) }
            return PricingRow(
                serviceType: svcType, priceUsd: price, won: won, notes: field("notes"))
        }
    }

    // MARK: - PDF text extraction via pdftotext (poppler-utils)

    /// Extract text from PDF data using the `pdftotext` command-line tool.
    /// Requires `poppler-utils` installed (`brew install poppler` on macOS,
    /// `apt install poppler-utils` in Docker).
    /// Falls back to stripping non-printable bytes if pdftotext is unavailable.
    static func extractPDFText(from data: Data) -> String {
        let tempDir = FileManager.default.temporaryDirectory
        let pdfPath = tempDir.appendingPathComponent(UUID().uuidString + ".pdf")
        let txtPath = tempDir.appendingPathComponent(UUID().uuidString + ".txt")

        defer {
            try? FileManager.default.removeItem(at: pdfPath)
            try? FileManager.default.removeItem(at: txtPath)
        }

        do {
            try data.write(to: pdfPath)
        } catch {
            return Self.fallbackExtractText(from: data)
        }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = ["pdftotext", "-layout", pdfPath.path, txtPath.path]
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice

        do {
            try process.run()
            process.waitUntilExit()
        } catch {
            return Self.fallbackExtractText(from: data)
        }

        guard process.terminationStatus == 0,
            let result = try? String(contentsOf: txtPath, encoding: .utf8),
            !result.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else {
            return Self.fallbackExtractText(from: data)
        }

        return result
    }

    /// Fallback: strip non-printable bytes and extract readable substrings.
    private static func fallbackExtractText(from data: Data) -> String {
        let ascii = data.compactMap { byte -> Character? in
            guard byte < 128 else { return nil }
            let scalar = Unicode.Scalar(byte)
            return
                (scalar.properties.isASCIIHexDigit || CharacterSet.alphanumerics.contains(scalar)
                || CharacterSet.whitespaces.contains(scalar)
                || CharacterSet.punctuationCharacters.contains(scalar))
                ? Character(scalar) : nil
        }
        let text = String(ascii)
        return text.isEmpty ? "[PDF text extraction failed — install poppler-utils]" : text
    }

    // MARK: - KB article ingestion (for Support AI context)

    struct KBArticleRequest: Content {
        let title: String
        let body: String
    }

    @Sendable
    func kbArticle(_ req: Request) async throws -> IngestJobResponse {
        // Simple admin-key gating
        let adminKey = ProcessInfo.processInfo.environment["ADMIN_API_KEY"] ?? ""
        guard let provided = req.headers.first(name: "X-Admin-Key"),
            !adminKey.isEmpty, provided == adminKey
        else {
            throw Abort(.forbidden, reason: "Admin API key required")
        }

        let body = try req.content.decode(KBArticleRequest.self)
        let job = JobRecord(jobType: "ingest_kb", customerId: "kb")
        try await job.save(on: req.db)
        let jobId = job.id!.uuidString

        Task.detached { [db = req.db] in
            let text = "## \(body.title)\n\n\(body.body)"
            try? await LocalVectorStore.shared.upsert(
                customerId: "kb",
                entryType: "kb_article",
                texts: [text],
                metadatas: [["title": body.title, "type": "kb_article"]],
                db: db
            )
            if let job = try? await JobRecord.find(UUID(uuidString: jobId), on: db) {
                job.status = "completed"
                job.completedAt = Date()
                try? await job.save(on: db)
            }
        }

        return IngestJobResponse(jobId: jobId, rowsQueued: 1, status: "queued")
    }
}

// MARK: - Request DTOs

struct ProposalFileRequest: Content {
    var file: Data?
    var filename: String?
    var clientName: String?
    var valueUsd: Double?
    var outcome: String?
    enum CodingKeys: String, CodingKey {
        case file, filename
        case clientName = "client_name"
        case valueUsd = "value_usd"
        case outcome
    }
}

struct BrandVoiceRequest: Content {
    let exampleText: String
    let styleNotes: String?
    let toneTags: String?
    enum CodingKeys: String, CodingKey {
        case exampleText = "example_text"
        case styleNotes = "style_notes"
        case toneTags = "tone_tags"
    }
}
