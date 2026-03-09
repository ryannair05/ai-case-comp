"use client";

/**
 * Screen 1: Side-by-side streaming demo.
 * Two panels. Same RFP. Left: Generic GPT-4o. Right: Draftly + Context-Mapper.
 * Shows the difference in real time — judges watch it unfold.
 */
import { useState } from "react";

const SAMPLE_RFP = `We are seeking a marketing agency to help us launch our new B2B SaaS product.
We need a comprehensive go-to-market strategy including brand positioning, content marketing,
paid media management, and lead generation. Our budget is flexible for the right partner.
Company: Meridian Analytics | Industry: B2B SaaS | Team: 25 people | Timeline: Q2 launch`;

const LIONTOWN_DEMO_CUSTOMER_ID = "0d1a3e07-5d4a-5f7d-8be7-255a1109bce0";

async function streamGenericGPT(
  rfp: string,
  onChunk: (text: string) => void
): Promise<void> {
  const res = await fetch("/api/demo/generic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rfp_text: rfp }),
  });
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value));
  }
}

async function streamDraftlyContextMapper(
  rfp: string,
  onChunk: (text: string) => void
): Promise<void> {
  const res = await fetch("/api/demo/draftly", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rfp_text: rfp, customer_id: LIONTOWN_DEMO_CUSTOMER_ID }),
  });
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value));
  }
}

export default function DemoPage() {
  const [rfp, setRfp] = useState(SAMPLE_RFP);
  const [genericStream, setGenericStream] = useState("");
  const [draftlyStream, setDraftlyStream] = useState("");
  const [running, setRunning] = useState(false);
  const [showRfpEditor, setShowRfpEditor] = useState(false);

  async function runDemo() {
    setRunning(true);
    setGenericStream("");
    setDraftlyStream("");

    await Promise.all([
      streamGenericGPT(rfp, (chunk) =>
        setGenericStream((prev) => prev + chunk)
      ),
      streamDraftlyContextMapper(rfp, (chunk) =>
        setDraftlyStream((prev) => prev + chunk)
      ),
    ]);

    setRunning(false);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 p-4 flex items-center justify-between">
        <div>
          <span className="text-teal-400 font-bold text-xl">Draftly</span>
          <span className="text-gray-400 text-sm ml-3">Live Demo — Context-Mapper vs Generic AI</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
            LionTown Marketing · 847 proposals indexed
          </span>
          <button
            onClick={() => setShowRfpEditor(!showRfpEditor)}
            className="text-xs text-gray-400 hover:text-white border border-gray-700 px-3 py-1 rounded"
          >
            Edit RFP
          </button>
        </div>
      </div>

      {/* RFP Editor (collapsible) */}
      {showRfpEditor && (
        <div className="border-b border-gray-800 p-4 bg-gray-900">
          <label className="text-xs text-gray-400 block mb-2">RFP / Brief</label>
          <textarea
            value={rfp}
            onChange={(e) => setRfp(e.target.value)}
            className="w-full bg-gray-800 text-white text-sm p-3 rounded border border-gray-700 resize-none h-28 focus:outline-none focus:border-teal-500"
          />
        </div>
      )}

      {/* Two-panel output */}
      <div className="flex-1 grid grid-cols-2 gap-4 p-4">
        {/* Generic GPT */}
        <div className="border border-red-800 rounded-lg flex flex-col overflow-hidden">
          <div className="bg-red-950 px-4 py-3 flex items-center justify-between">
            <div>
              <h2 className="text-red-400 font-bold">Generic GPT-4o</h2>
              <p className="text-xs text-gray-500 mt-0.5">No firm context. Could be any of 500K agencies.</p>
            </div>
            {running && (
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            )}
          </div>
          <div className="flex-1 p-4 overflow-y-auto bg-gray-900">
            {genericStream ? (
              <pre className="whitespace-pre-wrap text-sm text-gray-300 font-mono leading-relaxed">
                {genericStream}
              </pre>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-600 text-sm">
                Generic output will appear here…
              </div>
            )}
          </div>
        </div>

        {/* Draftly + Context-Mapper */}
        <div className="border border-teal-700 rounded-lg flex flex-col overflow-hidden">
          <div className="bg-teal-950 px-4 py-3 flex items-center justify-between">
            <div>
              <h2 className="text-teal-400 font-bold">Draftly + Context-Mapper</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                LionTown's 847 proposals · $4,500 retainer anchor · 73% win rate (Brightfield)
              </p>
            </div>
            {running && (
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            )}
          </div>
          <div className="flex-1 p-4 overflow-y-auto bg-gray-900">
            {draftlyStream ? (
              <pre className="whitespace-pre-wrap text-sm text-gray-100 font-mono leading-relaxed">
                {draftlyStream}
              </pre>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-600 text-sm">
                Context-aware output will appear here…
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Run button */}
      <div className="border-t border-gray-800 p-4">
        <button
          onClick={runDemo}
          disabled={running}
          className="w-full bg-teal-500 hover:bg-teal-400 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold py-4 rounded-lg text-lg transition-colors"
        >
          {running ? "Generating… same RFP, two very different results" : "▶ Run Demo — Same RFP, Two Results"}
        </button>
        <p className="text-center text-xs text-gray-600 mt-2">
          "OpenAI will never fine-tune on LionTown's 847 proposals, $4,500 retainer anchor, 73% win rate, or 8 years of brand voice. We will."
        </p>
      </div>
    </div>
  );
}
