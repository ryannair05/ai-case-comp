import Fluent
import Vapor

#if canImport(FoundationNetworking)
    import FoundationNetworking
#endif

/// Proposal CRUD, AI generation, DOCX export, and win/loss tracking.
struct ProposalController {

    // MARK: - DTOs

    struct CreateRequest: Content {
        let title: String?
        let content: String
        let clientName: String?
        let valueUsd: Double?
        let outcome: String?
        enum CodingKeys: String, CodingKey {
            case title, content
            case clientName = "client_name"
            case valueUsd = "value_usd"
            case outcome
        }
    }

    struct GenerateRequest: Content {
        let rfpText: String
        let clientName: String?
        let valueUsd: Double?
        enum CodingKeys: String, CodingKey {
            case rfpText = "rfp_text"
            case clientName = "client_name"
            case valueUsd = "value_usd"
        }
    }

    struct UpdateRequest: Content {
        let title: String?
        let content: String?
        let clientName: String?
        let valueUsd: Double?
        let outcome: String?
        let winReason: String?
        let loseReason: String?
        let qualityScore: Int?
        enum CodingKeys: String, CodingKey {
            case title, content, outcome
            case clientName = "client_name"
            case valueUsd = "value_usd"
            case winReason = "win_reason"
            case loseReason = "lose_reason"
            case qualityScore = "quality_score"
        }
    }

    // MARK: - List

    @Sendable
    func list(_ req: Request) async throws -> [Proposal] {
        let customer = try await req.authenticatedCustomer()
        return try await Proposal.query(on: req.db)
            .filter(\.$customerId == customer.id!)
            .filter(\.$deletedAt == nil)
            .sort(\.$createdAt, .descending)
            .limit(50)
            .all()
    }

    // MARK: - Get single

    @Sendable
    func get(_ req: Request) async throws -> Proposal {
        let customer = try await req.authenticatedCustomer()
        guard
            let proposal = try await Proposal.query(on: req.db)
                .filter(\.$customerId == customer.id!)
                .filter(\.$id == req.parameters.require("id", as: UUID.self))
                .first()
        else {
            throw Abort(.notFound, reason: "Proposal not found")
        }
        return proposal
    }

    // MARK: - Create (manual)

    @Sendable
    func create(_ req: Request) async throws -> Proposal {
        let customer = try await req.authenticatedCustomer()
        let body = try req.content.decode(CreateRequest.self)
        let proposal = Proposal(
            customerId: customer.id!,
            title: body.title,
            content: body.content,
            clientName: body.clientName,
            valueUsd: body.valueUsd,
            outcome: body.outcome ?? "pending"
        )
        try await proposal.save(on: req.db)
        // Queue background indexing so it's searchable in Context-Mapper
        Task.detached {
            try? await RAGPipeline.shared.ingestProposal(
                customerId: customer.id!.uuidString,
                proposalId: proposal.id?.uuidString ?? UUID().uuidString,
                text: body.content,
                metadata: ["title": body.title ?? "", "client_name": body.clientName ?? ""],
                db: req.db
            )
        }
        return proposal
    }

    // MARK: - Generate with AI + Context-Mapper

    @Sendable
    func generate(_ req: Request) async throws -> Response {
        let customer = try await req.authenticatedCustomer()
        guard customer.tier != "starter" else {
            throw Abort(
                .forbidden,
                reason: "Context-Mapper requires Professional tier ($249/mo). Upgrade to unlock.")
        }
        let body = try req.content.decode(GenerateRequest.self)
        guard body.rfpText.count >= 50 else {
            throw Abort(.badRequest, reason: "rfp_text must be at least 50 characters")
        }

        let proposal = Proposal(
            customerId: customer.id!,
            title: "Generated Proposal",
            content: "",  // Will be updated after stream completes
            clientName: body.clientName,
            valueUsd: body.valueUsd,
            outcome: "pending"
        )
        try await proposal.save(on: req.db)

        // Bump indexed count and index the new proposal in the background
        customer.proposalsIndexed += 1
        if customer.proposalsIndexed >= 15 { customer.contextMapperActive = true }
        try await customer.save(on: req.db)

        let stream = try await RAGPipeline.shared.generateProposalStream(
            customerId: customer.id!.uuidString,
            rfpText: body.rfpText,
            proposalsIndexed: customer.proposalsIndexed,
            industry: customer.industry,
            db: req.db
        )

        let response = Response(status: .ok)
        response.headers.contentType = HTTPMediaType(type: "text", subType: "event-stream")
        response.headers.add(name: "Cache-Control", value: "no-cache")
        response.headers.add(name: "Connection", value: "keep-alive")

        response.body = .init(stream: { writer in
            Task {
                [
                    db = req.db, custId = customer.id!.uuidString, propId = proposal.id!.uuidString,
                    name = body.clientName
                ] in
                var fullContent = ""
                do {
                    for try await chunk in stream {
                        fullContent += chunk
                        // Format as SSE
                        let sse = "data: \(chunk)\n\n"
                        if let buffer = sse.data(using: .utf8) {
                            let byteBuffer = ByteBuffer(data: buffer)
                            _ = writer.write(.buffer(byteBuffer))
                        }
                    }
                    _ = writer.write(.end)

                    // Stream finished: update DB and ingest in the background
                    Task.detached {
                        if let existing = try? await Proposal.find(UUID(uuidString: propId), on: db)
                        {
                            existing.content = fullContent
                            try? await existing.save(on: db)
                        }
                        try? await RAGPipeline.shared.ingestProposal(
                            customerId: custId,
                            proposalId: propId,
                            text: fullContent,
                            metadata: ["title": "Generated Proposal", "client_name": name ?? ""],
                            db: db
                        )
                    }
                } catch {
                    db.logger.error("Proposal stream error: \(error)")
                    _ = writer.write(.end)
                }
            }
        })
        return response
    }

    // MARK: - Update (including win/loss)

    @Sendable
    func update(_ req: Request) async throws -> Proposal {
        let customer = try await req.authenticatedCustomer()
        let body = try req.content.decode(UpdateRequest.self)
        guard
            let proposal = try await Proposal.query(on: req.db)
                .filter(\.$customerId == customer.id!)
                .filter(\.$id == req.parameters.require("id", as: UUID.self))
                .first()
        else {
            throw Abort(.notFound, reason: "Proposal not found")
        }

        if let t = body.title { proposal.title = t }
        if let c = body.content { proposal.content = c }
        if let n = body.clientName { proposal.clientName = n }
        if let v = body.valueUsd { proposal.valueUsd = v }
        if let o = body.outcome { proposal.outcome = o }
        if let w = body.winReason { proposal.winReason = w }
        if let l = body.loseReason { proposal.loseReason = l }
        if let q = body.qualityScore { proposal.qualityScore = q }
        try await proposal.save(on: req.db)

        // Winning proposal → update playbook in background
        if body.outcome == "won" {
            let content = proposal.content
            let winReason = body.winReason ?? ""
            let custId = customer.id!.uuidString
            let propId = proposal.id!.uuidString
            Task.detached { [db = req.db] in
                let p = try? await ClaudeService.shared.extractWinPatterns(
                    proposalContent: content,
                    winReason: winReason
                )
                if let p = p {
                    try? await RAGPipeline.shared.ingestProposal(
                        customerId: custId,
                        proposalId: UUID().uuidString,
                        text: p,
                        metadata: ["entry_type": "win_pattern", "source_proposal": propId],
                        db: db
                    )
                }
            }
        }

        // Auto CRM sync — push deal to HubSpot and/or Pipedrive on outcome change
        if let outcome = body.outcome, outcome == "won" || outcome == "lost" {
            let clientName = proposal.clientName ?? ""
            let valueUsd = proposal.valueUsd
            let propId = proposal.id!.uuidString

            // HubSpot sync
            if customer.hubspotConnected, let token = customer.hubspotToken {
                Task.detached {
                    let dealStage =
                        outcome == "won"
                        ? "closedwon" : outcome == "lost" ? "closedlost" : "contractsent"
                    let dealURL = URL(string: "https://api.hubapi.com/crm/v3/objects/deals")!
                    var dealReq = URLRequest(url: dealURL)
                    dealReq.httpMethod = "POST"
                    dealReq.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                    dealReq.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    let dealBody: [String: Any] = [
                        "properties": [
                            "dealname": "\(clientName) — Draftly Proposal",
                            "amount": valueUsd.map { "\($0)" } ?? "0",
                            "dealstage": dealStage,
                            "pipeline": "default",
                            "draftly_proposal_id": propId,
                        ]
                    ]
                    dealReq.httpBody = try? JSONSerialization.data(withJSONObject: dealBody)
                    _ = try? await URLSession.shared.data(for: dealReq)
                }
            }

            // Pipedrive sync
            if let apiKey = customer.pipedriveApiKey, !apiKey.isEmpty {
                Task.detached {
                    let status: String
                    switch outcome {
                    case "won": status = "won"
                    case "lost": status = "lost"
                    default: status = "open"
                    }
                    let baseURL = "https://api.pipedrive.com/v1"
                    let dealURL = URL(string: "\(baseURL)/deals?api_token=\(apiKey)")!
                    var dealReq = URLRequest(url: dealURL)
                    dealReq.httpMethod = "POST"
                    dealReq.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    var dealBody: [String: Any] = [
                        "title": "\(clientName) — Draftly Proposal",
                        "status": status,
                    ]
                    if let v = valueUsd { dealBody["value"] = v }
                    dealReq.httpBody = try? JSONSerialization.data(withJSONObject: dealBody)
                    _ = try? await URLSession.shared.data(for: dealReq)
                }
            }
        }

        return proposal
    }

    // MARK: - Soft delete

    @Sendable
    func delete(_ req: Request) async throws -> [String: String] {
        let customer = try await req.authenticatedCustomer()
        guard
            let proposal = try await Proposal.query(on: req.db)
                .filter(\.$customerId == customer.id!)
                .filter(\.$id == req.parameters.require("id", as: UUID.self))
                .first()
        else {
            throw Abort(.notFound, reason: "Proposal not found")
        }
        proposal.deletedAt = Date()
        try await proposal.save(on: req.db)
        return ["status": "deleted", "proposal_id": proposal.id?.uuidString ?? ""]
    }

    // MARK: - Export as DOCX (P0 feature)

    @Sendable
    func exportDocx(_ req: Request) async throws -> Response {
        let customer = try await req.authenticatedCustomer()
        guard
            let proposal = try await Proposal.query(on: req.db)
                .filter(\.$customerId == customer.id!)
                .filter(\.$id == req.parameters.require("id", as: UUID.self))
                .first()
        else {
            throw Abort(.notFound, reason: "Proposal not found")
        }

        let docxData = try DocxExporter.shared.export(
            title: proposal.title ?? "Proposal",
            content: proposal.content,
            clientName: proposal.clientName
        )

        let safeName = (proposal.title ?? "proposal")
            .replacingOccurrences(of: " ", with: "_")
            .lowercased()

        var headers = HTTPHeaders()
        headers.add(
            name: .contentType,
            value: "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        headers.add(name: .contentDisposition, value: "attachment; filename=\"\(safeName).docx\"")
        headers.add(name: .contentLength, value: "\(docxData.count)")

        return Response(status: .ok, headers: headers, body: .init(data: docxData))
    }
}
