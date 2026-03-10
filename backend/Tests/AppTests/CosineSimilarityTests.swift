import Testing

@testable import App

private func scalarCosineSimilarity(_ a: [Float], _ b: [Float]) -> Float {
    var dot: Float = 0
    var normA: Float = 0
    var normB: Float = 0
    for i in 0..<a.count {
        dot += a[i] * b[i]
        normA += a[i] * a[i]
        normB += b[i] * b[i]
    }
    let d = normA.squareRoot() * normB.squareRoot()
    return d == 0 ? 0 : dot / d
}

@Suite("SIMD cosine similarity")
struct CosineSimilarityTests {
    @Test("Identical vectors score 1.0")
    func identicalVectors() {
        let v: [Float] = Array(repeating: 0.5, count: 1024)
        let score = simdCosineSimilarity(v, v)
        #expect(abs(score - 1.0) < 1e-5)
    }

    @Test("Orthogonal vectors score 0.0")
    func orthogonalVectors() {
        var a = [Float](repeating: 0, count: 1024)
        var b = [Float](repeating: 0, count: 1024)
        a[0] = 1.0
        b[1] = 1.0
        let score = simdCosineSimilarity(a, b)
        #expect(abs(score) < 1e-5)
    }

    @Test("Zero vector returns 0.0 (no divide by zero)")
    func zeroVector() {
        let zero = [Float](repeating: 0, count: 1024)
        let v = [Float](repeating: 0.1, count: 1024)
        #expect(simdCosineSimilarity(zero, v) == 0.0)
        #expect(simdCosineSimilarity(v, zero) == 0.0)
    }

    @Test("Similarity matches reference scalar implementation")
    func matchesScalarReference() {
        var rng = SystemRandomNumberGenerator()
        let a = (0..<1024).map { _ in Float.random(in: -1...1, using: &rng) }
        let b = (0..<1024).map { _ in Float.random(in: -1...1, using: &rng) }
        let simdScore = simdCosineSimilarity(a, b)
        let scalarScore = scalarCosineSimilarity(a, b)
        #expect(abs(simdScore - scalarScore) < 1e-4)
    }
}
