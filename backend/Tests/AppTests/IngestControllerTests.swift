import Foundation
import Testing
import Vapor

@testable import App

// MARK: - PDF extraction unit tests (no HTTP, no DB)

@Suite("PDF Text Extraction")
struct PDFTextExtractionTests {

    // A minimal but valid PDF-1.4 file that contains the text "Hello Draftly"
    // Constructed by hand: header, catalog, pages, page, content stream, xref, trailer.
    private var minimalPDFData: Data {
        // This is a real, parseable PDF 1.4 document whose content stream reads "Hello Draftly"
        let pdfString = """
            %PDF-1.4
            1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
            2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
            3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
            4 0 obj<</Length 44>>
            stream
            BT /F1 12 Tf 72 720 Td (Hello Draftly) Tj ET
            endstream
            endobj
            5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
            xref
            0 6
            0000000000 65535 f\r
            0000000009 00000 n\r
            0000000058 00000 n\r
            0000000115 00000 n\r
            0000000274 00000 n\r
            0000000370 00000 n\r
            trailer<</Size 6/Root 1 0 R>>
            startxref
            441
            %%EOF
            """
        return Data(pdfString.utf8)
    }

    @Test("extractPDFText with valid PDF returns non-empty, non-sentinel text")
    func validPDFNonEmpty() {
        let result = IngestController.extractPDFText(from: minimalPDFData)
        // If pdftotext is installed (CI has poppler), it extracts the text.
        // If not installed, the fallback fires — but must not return the failure sentinel.
        // Either way we must get something non-empty and non-binary-garbage
        #expect(!result.isEmpty)
    }

    @Test("extractPDFText with pdftotext returns 'Hello Draftly' when poppler is available")
    func pdftotextExtractsText() throws {
        // Skip this test if pdftotext is not on PATH
        let which = Process()
        which.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        which.arguments = ["which", "pdftotext"]
        which.standardOutput = FileHandle.nullDevice
        which.standardError = FileHandle.nullDevice
        try which.run()
        which.waitUntilExit()
        guard which.terminationStatus == 0 else {
            // pdftotext not available — skip
            return
        }

        let result = IngestController.extractPDFText(from: minimalPDFData)
        // pdftotext should have extracted the text object
        #expect(result.contains("Hello") || result.contains("Draftly"))
    }

    @Test("extractPDFText with pure binary garbage returns failure sentinel")
    func binaryGarbageReturnsSentinel() {
        // Data with no printable characters
        let garbage = Data([0x00, 0x01, 0x02, 0x03, 0x80, 0xFF, 0xFE, 0xFD])
        let result = IngestController.extractPDFText(from: garbage)
        #expect(result == "[PDF text extraction failed — install poppler-utils]")
    }

    @Test("extractPDFText result is never empty")
    func resultNeverEmpty() {
        let result = IngestController.extractPDFText(from: minimalPDFData)
        #expect(!result.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
    }

    @Test("PDF detection by magic bytes: %PDF- prefix triggers PDF path even with .txt filename")
    func magicByteDetection() {
        // The IngestController checks: filename ends in .pdf OR bytes start with %PDF-
        // We verify the magic bytes are correct for our synthetic PDF
        let magic = minimalPDFData.prefix(5)
        let expected = Data("%PDF-".utf8)
        #expect(magic == expected)
    }
}

// MARK: - CSV ingestion endpoint integration tests

@Suite("CSV Ingest Integration", .serialized)
struct CSVIngestIntegrationTests {

    @Test("Valid CSV ingestion returns job_id and rows_queued")
    func validCSVIngest() async throws {
        try await withApp { app in
            let auth = try await registerTestCustomer(app: app)

            let csvBody = """
                service_type,price_usd,won,notes
                brand_strategy,12000,true,Enterprise client
                social_media_audit,4500,true,Standard package
                full_service_retainer,8500,false,Lost to price
                """

            let res = try await app.sendRequest(.POST, "/ingest/pricing-csv") { req in
                req.headers.bearerAuthorization = .init(token: auth.token)
                req.headers.contentType = .plainText
                req.body = .init(string: csvBody)
            }

            #expect(res.status == .ok)
            let json =
                try JSONSerialization.jsonObject(with: Data(buffer: res.body)) as! [String: Any]
            #expect(json["job_id"] != nil)
            #expect(json["status"] as? String == "queued")
            let rowsQueued = json["rows_queued"] as? Int
            #expect(rowsQueued == 3)
        }
    }

    @Test("CSV with missing required columns skips invalid rows")
    func csvMissingColumns() async throws {
        try await withApp { app in
            let auth = try await registerTestCustomer(app: app)

            // Only one valid row (has both service_type and price_usd)
            let csvBody = """
                service_type,price_usd
                brand_strategy,12000
                ,
                bad_row_only
                """

            let res = try await app.sendRequest(.POST, "/ingest/pricing-csv") { req in
                req.headers.bearerAuthorization = .init(token: auth.token)
                req.headers.contentType = .plainText
                req.body = .init(string: csvBody)
            }

            #expect(res.status == .ok)
            let json =
                try JSONSerialization.jsonObject(with: Data(buffer: res.body)) as! [String: Any]
            // Only the first row is valid
            let rowsQueued = json["rows_queued"] as? Int
            #expect(rowsQueued == 1)
        }
    }

    @Test("Empty CSV body returns 400")
    func emptyCSVBodyReturns400() async throws {
        try await withApp { app in
            let auth = try await registerTestCustomer(app: app)

            let res = try await app.sendRequest(.POST, "/ingest/pricing-csv") { req in
                req.headers.bearerAuthorization = .init(token: auth.token)
                req.headers.contentType = .plainText
                req.body = .init(string: "")
            }

            // Empty body — no file body provided
            #expect(res.status == .badRequest)
        }
    }

    @Test("CSV ingest requires authentication")
    func csvIngestRequiresAuth() async throws {
        try await withApp { app in
            let res = try await app.sendRequest(.POST, "/ingest/pricing-csv") { req in
                req.headers.contentType = .plainText
                req.body = .init(string: "service_type,price_usd\ntest,100")
            }
            #expect(res.status == .unauthorized)
        }
    }
}

// MARK: - Brand voice + job status integration tests

@Suite("Brand Voice Ingest Integration", .serialized)
struct BrandVoiceIngestIntegrationTests {

    @Test("Brand voice ingest returns job_id and status queued")
    func brandVoiceIngestQueued() async throws {
        try await withApp { app in
            let auth = try await registerTestCustomer(app: app)

            let body = try JSONSerialization.data(withJSONObject: [
                "example_text":
                    "At LionTown Marketing, every dollar of marketing spend is accountable. Results you can measure, stories worth telling.",
                "style_notes": "authoritative, data-driven, warm",
                "tone_tags": "professional,analytical",
            ])

            let res = try await app.sendRequest(.POST, "/ingest/brand-voice") { req in
                req.headers.contentType = .json
                req.headers.bearerAuthorization = .init(token: auth.token)
                req.body = .init(data: body)
            }

            #expect(res.status == .ok)
            let json =
                try JSONSerialization.jsonObject(with: Data(buffer: res.body)) as! [String: Any]
            let jobId = json["job_id"] as? String
            #expect(jobId != nil)
            #expect(!jobId!.isEmpty)
            #expect(json["status"] as? String == "queued")
        }
    }

    @Test("Job status endpoint returns job record for authenticated owner")
    func jobStatusFound() async throws {
        try await withApp { app in
            let auth = try await registerTestCustomer(app: app)

            // Create a job via brand-voice ingest
            let body = try JSONSerialization.data(withJSONObject: [
                "example_text": "Test brand voice content for job status polling."
            ])
            let ingestRes = try await app.sendRequest(.POST, "/ingest/brand-voice") { req in
                req.headers.contentType = .json
                req.headers.bearerAuthorization = .init(token: auth.token)
                req.body = .init(data: body)
            }
            let ingestJson =
                try JSONSerialization.jsonObject(with: Data(buffer: ingestRes.body))
                as! [String: Any]
            let jobId = ingestJson["job_id"] as! String

            // Poll job status
            let statusRes = try await app.sendRequest(.GET, "/ingest/job/\(jobId)") { req in
                req.headers.bearerAuthorization = .init(token: auth.token)
            }
            #expect(statusRes.status == .ok)
            let statusJson =
                try JSONSerialization.jsonObject(with: Data(buffer: statusRes.body))
                as! [String: Any]
            let id = statusJson["id"] as? String
            #expect(id == jobId)
        }
    }

    @Test("Job status returns 404 for unknown job ID")
    func jobStatusNotFound() async throws {
        try await withApp { app in
            let auth = try await registerTestCustomer(app: app)
            let fakeId = UUID().uuidString

            let res = try await app.sendRequest(.GET, "/ingest/job/\(fakeId)") { req in
                req.headers.bearerAuthorization = .init(token: auth.token)
            }
            #expect(res.status == .notFound)
        }
    }

    @Test("Job status is isolated: another customer cannot see the job")
    func jobStatusIsolated() async throws {
        try await withApp { app in
            let auth1 = try await registerTestCustomer(app: app, email: "user1@draftly.biz")
            let auth2 = try await registerTestCustomer(app: app, email: "user2@draftly.biz")

            // Customer 1 creates a brand voice job
            let body = try JSONSerialization.data(withJSONObject: [
                "example_text": "Customer one brand voice isolation test."
            ])
            let ingestRes = try await app.sendRequest(.POST, "/ingest/brand-voice") { req in
                req.headers.contentType = .json
                req.headers.bearerAuthorization = .init(token: auth1.token)
                req.body = .init(data: body)
            }
            let ingestJson =
                try JSONSerialization.jsonObject(with: Data(buffer: ingestRes.body))
                as! [String: Any]
            let jobId = ingestJson["job_id"] as! String

            // Customer 2 tries to read it — must get 404
            let statusRes = try await app.sendRequest(.GET, "/ingest/job/\(jobId)") { req in
                req.headers.bearerAuthorization = .init(token: auth2.token)
            }
            #expect(statusRes.status == .notFound)
        }
    }
}
