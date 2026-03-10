import Foundation
import Testing

@testable import App

@Suite("DocxExporter")
struct DocxExporterTests {
    @Test("Export produces non-empty Data")
    func exportNonEmpty() throws {
        let data = try DocxExporter.shared.export(
            title: "Test Proposal",
            content: "EXECUTIVE SUMMARY\nThis is a test proposal.",
            clientName: "Acme Corp"
        )
        #expect(data.count > 100)
    }

    @Test("Export starts with ZIP magic bytes")
    func exportIsZIP() throws {
        let data = try DocxExporter.shared.export(
            title: "Test",
            content: "Content",
            clientName: nil
        )
        // ZIP local file header magic: PK\x03\x04
        #expect(data[0] == 0x50)
        #expect(data[1] == 0x4B)
        #expect(data[2] == 0x03)
        #expect(data[3] == 0x04)
    }
}
