/**
 * Demo API: Generic GPT-4o streaming endpoint (no context).
 * Used to show the contrast with Draftly + Context-Mapper.
 */
import OpenAI from "openai";
import { NextRequest } from "next/server";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: NextRequest) {
  const { rfp_text } = await req.json();

  const stream = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 1500,
    stream: true,
    messages: [
      {
        role: "system",
        content:
          "You are a helpful AI assistant. Generate a professional proposal for the given RFP.",
      },
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
        const text = chunk.choices[0]?.delta?.content ?? "";
        if (text) {
          controller.enqueue(encoder.encode(text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
