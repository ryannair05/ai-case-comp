import Foundation
import Testing
import Vapor

@testable import App

@Suite("Proposal CRUD Integration")
struct ProposalIntegrationTests {

    @Test("Create and list proposals")
    func createAndList() async throws {
        try await withApp { app in
            let auth = try await registerTestCustomer(app: app)

            // Create a proposal
            let createBody = try JSONSerialization.data(
                withJSONObject: [
                    "title": "Test Proposal", "content": "This is a test proposal body content.",
                    "client_name": "Acme Corp", "value_usd": 5000,
                ] as [String: Any])
            let createRes = try await app.sendRequest(.POST, "/proposals") { req in
                req.headers.contentType = .json
                req.headers.bearerAuthorization = .init(token: auth.token)
                req.body = .init(data: createBody)
            }
            #expect(createRes.status == .ok)

            // List proposals
            let listRes = try await app.sendRequest(.GET, "/proposals") { req in
                req.headers.bearerAuthorization = .init(token: auth.token)
            }
            #expect(listRes.status == .ok)
            let proposals =
                try JSONSerialization.jsonObject(with: Data(buffer: listRes.body))
                as! [[String: Any]]
            #expect(proposals.count == 1)
            #expect(proposals[0]["title"] as? String == "Test Proposal")
        }
    }

    @Test("Soft delete excludes from list")
    func softDelete() async throws {
        try await withApp { app in
            let auth = try await registerTestCustomer(app: app)

            // Create
            let createBody = try JSONSerialization.data(withJSONObject: [
                "content": "Delete me"
            ])
            let createRes = try await app.sendRequest(.POST, "/proposals") { req in
                req.headers.contentType = .json
                req.headers.bearerAuthorization = .init(token: auth.token)
                req.body = .init(data: createBody)
            }
            let created =
                try JSONSerialization.jsonObject(with: Data(buffer: createRes.body))
                as! [String: Any]
            let proposalId = created["id"] as! String

            // Delete
            let deleteRes = try await app.sendRequest(.DELETE, "/proposals/\(proposalId)") { req in
                req.headers.bearerAuthorization = .init(token: auth.token)
            }
            #expect(deleteRes.status == .ok)

            // List should be empty (soft-deleted)
            let listRes = try await app.sendRequest(.GET, "/proposals") { req in
                req.headers.bearerAuthorization = .init(token: auth.token)
            }
            let proposals =
                try JSONSerialization.jsonObject(with: Data(buffer: listRes.body))
                as! [[String: Any]]
            #expect(proposals.isEmpty)
        }
    }

    @Test("Update proposal fields")
    func updateProposal() async throws {
        try await withApp { app in
            let auth = try await registerTestCustomer(app: app)

            // Create
            let createBody = try JSONSerialization.data(withJSONObject: [
                "title": "Original", "content": "Content here",
            ])
            let createRes = try await app.sendRequest(.POST, "/proposals") { req in
                req.headers.contentType = .json
                req.headers.bearerAuthorization = .init(token: auth.token)
                req.body = .init(data: createBody)
            }
            let created =
                try JSONSerialization.jsonObject(with: Data(buffer: createRes.body))
                as! [String: Any]
            let proposalId = created["id"] as! String

            // Update
            let updateBody = try JSONSerialization.data(withJSONObject: [
                "title": "Updated Title", "outcome": "won", "win_reason": "Great pitch",
            ])
            let updateRes = try await app.sendRequest(.PATCH, "/proposals/\(proposalId)") { req in
                req.headers.contentType = .json
                req.headers.bearerAuthorization = .init(token: auth.token)
                req.body = .init(data: updateBody)
            }
            #expect(updateRes.status == .ok)
            let updated =
                try JSONSerialization.jsonObject(with: Data(buffer: updateRes.body))
                as! [String: Any]
            #expect(updated["title"] as? String == "Updated Title")
            #expect(updated["outcome"] as? String == "won")
        }
    }
}
