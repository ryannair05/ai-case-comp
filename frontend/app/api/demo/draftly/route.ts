/**
 * Demo API: Draftly + Context-Mapper streaming endpoint.
 * Calls the real Vapor backend RAG pipeline instead of using hardcoded context.
 * Falls back to direct Claude call with hardcoded context if backend is unreachable.
 */
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "placeholder" });
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const DEMO_JWT_TOKEN = process.env.DEMO_JWT_TOKEN ?? "";

// Fallback context if the backend is unreachable
const LIONTOWN_CONTEXT = `
PRICING HISTORY (use these as anchors):
Service: social_media_audit | Price: USD 4500 | Won: True | LionTown standard pricing
Service: brand_strategy | Price: USD 12000 | Won: True | LionTown standard pricing
Service: full_service_retainer | Price: USD 8500 | Won: True | LionTown standard pricing

WINNING PROPOSAL PATTERNS:
From Brightfield Technologies engagement ($45K, won, 73% win rate):
Deep data analytics positioning + 90-day ROI guarantee sealed the deal.
Problem → Insight → Solution → Evidence → Investment structure used consistently.
Referenced LionTown's measurable ROI methodology across all touchpoints.

From Greenfield Capital engagement ($66K, won):
Brand strategy + retainer combo anchored at $4,500/mo.
Data-driven creative strategy positioning resonated with CFO stakeholder.

BRAND VOICE EXAMPLES:
At LionTown Marketing, we believe every dollar of marketing spend should be accountable.
We don't just tell compelling stories — we build systems that prove those stories drive revenue.
Signature phrase: "Results you can measure, stories worth telling."
Tone: authoritative, data-driven, warm. Avoid: jargon, excessive adjectives.
`;

export async function POST(req: NextRequest) {
  const { rfp_text } = await req.json();

  // Try the real backend RAG pipeline first
  if (DEMO_JWT_TOKEN) {
    try {
      const backendRes = await fetch(`${API_URL}/proposals/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${DEMO_JWT_TOKEN}`,
        },
        body: JSON.stringify({ rfp_text }),
        signal: AbortSignal.timeout(25_000),
      });

      if (backendRes.ok) {
        const data = await backendRes.json();
        const proposalText =
          data.content ?? data.proposal ?? JSON.stringify(data);

        // Stream the proposal text character-by-character for demo polish
        const encoder = new TextEncoder();
        const readable = new ReadableStream({
          async start(controller) {
            const words = proposalText.split(" ");
            for (const word of words) {
              controller.enqueue(encoder.encode(word + " "));
              await new Promise((r) => setTimeout(r, 15));
            }
            controller.close();
          },
        });

        return new Response(readable, {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    } catch {
      // Backend unreachable — fall through to hardcoded context
      console.warn(
        "[demo/draftly] Backend unreachable, falling back to hardcoded context"
      );
    }
  }

  // Fallback: use hardcoded context with direct Claude call
  const system = `You are Draftly, generating a proposal for LionTown Marketing, a Philadelphia-based marketing agency.

FIRM CONTEXT (from their Context-Mapper — 847 proposals indexed):
${LIONTOWN_CONTEXT}

RULES:
- Reference the $4,500 retainer anchor as the pricing floor
- Cite the Brightfield Technologies 73% win rate where relevant
- Use LionTown's signature phrase "Results you can measure, stories worth telling"
- Structure: Executive Summary → Situation Analysis → Strategic Approach → Timeline → Investment → Why LionTown
- Mirror their authoritative, data-driven, warm tone exactly
- Reference specific service names: brand_strategy, social_media_audit, full_service_retainer`;

  const stream = await client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    system,
    messages: [
      {
        role: "user",
        content: `Generate a proposal for this RFP:\n\n${rfp_text}`,
      },
    ],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
