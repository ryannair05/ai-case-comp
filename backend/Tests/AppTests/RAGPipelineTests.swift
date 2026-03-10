import Testing

@testable import App

@Suite("RAGPipeline")
struct RAGPipelineTests {
    let pipeline = RAGPipeline.shared

    @Test("Short text returns single chunk")
    func shortTextSingleChunk() {
        let text = "This is a short proposal text that fits in one chunk."
        let chunks = pipeline.chunkText(text)
        #expect(chunks.count == 1)
        #expect(chunks[0] == text)
    }

    @Test("Long text creates multiple overlapping chunks")
    func longTextMultipleChunks() {
        let words = Array(repeating: "word", count: 1000)
        let text = words.joined(separator: " ")
        let chunks = pipeline.chunkText(text)
        #expect(chunks.count > 1)
    }

    @Test("Empty text returns zero chunks")
    func emptyTextZeroChunks() {
        let chunks = pipeline.chunkText("   \n\n   ")
        #expect(chunks.isEmpty)
    }

    @Test("Tiny trailing chunks dropped")
    func tinyTrailingChunksDropped() {
        let words = Array(repeating: "word", count: 410)
        let chunks = pipeline.chunkText(words.joined(separator: " "))
        for chunk in chunks {
            #expect(chunk.count > 50)
        }
    }
}
