import Testing

@testable import App

@Suite("VectorEntry binary packing")
struct VectorPackingTests {
    @Test("Pack/unpack round-trip preserves values")
    func packUnpackRoundTrip() {
        let original: [Float] = (0..<1024).map { Float($0) / 1024.0 }
        let packed = VectorEntry.pack(original)
        let unpacked = VectorEntry.unpack(packed)
        #expect(unpacked.count == original.count)
        for (a, b) in zip(original, unpacked) {
            #expect(abs(a - b) < 1e-6)
        }
    }

    @Test("Packed size is 4 bytes per float")
    func packedSize() {
        let floats: [Float] = Array(repeating: 1.0, count: 1024)
        let packed = VectorEntry.pack(floats)
        #expect(packed.count == 1024 * 4)
    }
}
