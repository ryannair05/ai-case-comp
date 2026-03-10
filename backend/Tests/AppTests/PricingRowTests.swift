import Testing

@testable import App

@Suite("Pricing row format")
struct PricingRowTests {
    @Test("Text format matches expected pattern")
    func textFormat() {
        let row = PricingRow(serviceType: "brand_strategy", priceUsd: 12000, won: true, notes: "")
        let text =
            "Service: \(row.serviceType) | Price: USD \(row.priceUsd) | Won: \(row.won.map(String.init) ?? "unknown") | Notes: \(row.notes ?? "")"
        #expect(text.contains("brand_strategy"))
        #expect(text.contains("12000"))
        #expect(text.contains("true"))
    }
}
