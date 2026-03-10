import Foundation

/// Industry-vertical template library for cold-start customers.
/// Activated when a customer has < 15 proposals indexed.
/// Provides Day-1 value before the Context-Mapper moat forms.
struct ColdStart: Sendable {
    static let shared = ColdStart()
    private init() {}

    let threshold = 15

    // Template data is value-typed ([String: Any] is not Sendable, so we use
    // a computed property to build it on each call — cheap since it's small).
    private func templates() -> [String: [String: Any]] {
        [
            "marketing_agency": [
                "typical_pricing": [
                    "brand_strategy": [8000, 15000],
                    "social_media_audit": [3500, 6000],
                    "paid_media": [2000, 4000],
                    "content_strategy": [5000, 8000],
                    "full_service_retainer": [6000, 12000],
                ] as [String: [Int]],
                "structure": ["Executive Summary", "Situation Analysis", "Strategic Approach",
                              "Timeline & Milestones", "Investment", "Why Us", "Next Steps"],
                "winning_phrases": ["data-driven creative strategy", "measurable ROI", "full-funnel approach"],
            ],
            "consulting": [
                "typical_pricing": [
                    "strategy_engagement": [15000, 40000],
                    "process_improvement": [10000, 25000],
                    "change_management": [20000, 60000],
                    "digital_transformation": [30000, 100000],
                ] as [String: [Int]],
                "structure": ["Executive Summary", "Problem Statement", "Proposed Approach",
                              "Deliverables", "Timeline", "Investment", "Team & Credentials"],
                "winning_phrases": ["proven methodology", "measurable outcomes", "stakeholder alignment"],
            ],
            "legal": [
                "typical_pricing": [
                    "corporate_counsel": [5000, 15000],
                    "contract_review": [2000, 8000],
                    "litigation_support": [10000, 50000],
                    "compliance_audit": [8000, 20000],
                ] as [String: [Int]],
                "structure": ["Scope of Engagement", "Approach & Methodology", "Team", "Timeline", "Fee Structure"],
                "winning_phrases": ["risk mitigation", "regulatory compliance", "proven track record"],
            ],
            "accounting": [
                "typical_pricing": [
                    "audit": [5000, 25000],
                    "tax_planning": [3000, 10000],
                    "bookkeeping": [500, 2000],
                    "cfo_services": [5000, 15000],
                ] as [String: [Int]],
                "structure": ["Engagement Overview", "Services", "Timeline", "Fees", "Why Our Firm"],
                "winning_phrases": ["GAAP compliant", "proactive tax strategy", "real-time visibility"],
            ],
        ]
    }

    /// Return template context chunks when customer has < 15 indexed proposals.
    /// Formatted identically to LocalVectorStore results so RAGPipeline is unchanged.
    /// BUG FIX: industry is passed in and used (old Python backend had empty context_chunks).
    func getContext(industry: String) -> [VectorMatch] {
        let tmpl = templates()
        let template = tmpl[industry] ?? tmpl["consulting"]!
        var chunks: [VectorMatch] = []

        // Pricing benchmarks as pseudo context-chunks
        if let pricing = template["typical_pricing"] as? [String: [Int]] {
            for (svc, range) in pricing {
                chunks.append(VectorMatch(
                    score: 0.75,
                    text: "Service: \(svc) | Typical Range: $\(formatted(range[0]))–$\(formatted(range[1])) | Industry benchmark (cold-start template)",
                    entryType: "pricing",
                    metadata: ["cold_start": true]
                ))
            }
        }

        // Proposal structure hint
        if let structure = template["structure"] as? [String] {
            chunks.append(VectorMatch(
                score: 0.75,
                text: "Recommended proposal structure: \(structure.joined(separator: " → "))",
                entryType: "proposal_chunk",
                metadata: ["cold_start": true]
            ))
        }

        // Winning phrases as brand-voice hint
        if let phrases = template["winning_phrases"] as? [String] {
            chunks.append(VectorMatch(
                score: 0.75,
                text: "Effective language patterns for this industry: \(phrases.joined(separator: ", "))",
                entryType: "brand_voice",
                metadata: ["cold_start": true]
            ))
        }

        return chunks
    }

    private func formatted(_ n: Int) -> String {
        let fmt = NumberFormatter()
        fmt.numberStyle = .decimal
        return fmt.string(from: NSNumber(value: n)) ?? "\(n)"
    }
}
