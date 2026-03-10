import Testing

@testable import App

@Suite("ColdStart")
struct ColdStartTests {
    @Test("Threshold is 15 proposals")
    func thresholdIs15() {
        #expect(ColdStart.shared.threshold == 15)
    }

    @Test("Marketing agency template returns chunks")
    func marketingAgencyChunks() {
        let chunks = ColdStart.shared.getContext(industry: "marketing_agency")
        #expect(!chunks.isEmpty)
        #expect(chunks.allSatisfy { !$0.text.isEmpty })
        #expect(chunks.allSatisfy { $0.score > 0 })
    }

    @Test("Unknown industry falls back to consulting template")
    func unknownIndustryFallback() {
        let chunks = ColdStart.shared.getContext(industry: "underwater_basket_weaving")
        #expect(!chunks.isEmpty)
    }

    @Test("All 4 verticals return chunks with all entry types")
    func allVerticalsReturnChunks() {
        for industry in ["marketing_agency", "consulting", "legal", "accounting"] {
            let chunks = ColdStart.shared.getContext(industry: industry)
            let types = Set(chunks.map(\.entryType))
            #expect(types.contains("pricing"))
            #expect(types.contains("proposal_chunk"))
            #expect(types.contains("brand_voice"))
        }
    }
}
