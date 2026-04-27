import { NextRequest, NextResponse } from "next/server";
import {
  buildSuggestionMessages,
  getRecentContext,
  getLastSentences,
  detectMeetingType,
  detectMoment,
} from "@/lib/prompts";
import {
  logSuggestionContext,
  logSuggestionResult,
  wordCount,
} from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-groq-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "Missing Groq API key" }, { status: 401 });
  }

  const body = await req.json();
  const {
    fullTranscript,
    model,
    suggestionPrompt,
    suggestionContextWords = 800,
  } = body as {
    fullTranscript: string;
    model: string;
    suggestionPrompt: string;
    suggestionContextWords: number;
  };

  // ── Build all 3 context layers ──────────────────────────────────────────────
  const recentContext  = getRecentContext(fullTranscript, suggestionContextWords);
  const lastSentences = getLastSentences(fullTranscript, 3);

  // ── Detect meeting type and conversational moment ───────────────────────────
  const meetingType = detectMeetingType(fullTranscript);
  const moment      = detectMoment(lastSentences);

  // ── Build enriched messages ─────────────────────────────────────────────────
  const messages = buildSuggestionMessages(
    suggestionPrompt,
    fullTranscript,
    recentContext,
    lastSentences,
    meetingType,
    moment
  );

  // ── Debug: log everything being sent to the model ───────────────────────────
  logSuggestionContext({
    meetingType,
    moment,
    fullTranscriptWords:  wordCount(fullTranscript),
    recentContextWords:   wordCount(recentContext),
    lastSentences,
    systemPromptPreview:  messages[0]?.content ?? "",
  });

  const groqRes = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 700,
        temperature: 0.4,
        stream: false,
      }),
    }
  );

  if (!groqRes.ok) {
    const err = await groqRes.text();
    console.error("Groq suggestions error:", err);
    return NextResponse.json(
      { error: `Groq error: ${groqRes.status}` },
      { status: groqRes.status }
    );
  }

  const data = await groqRes.json();
  const raw  = data.choices?.[0]?.message?.content ?? "[]";

  let suggestions;
  try {
    const cleaned = raw.replace(/```json\n?|```/g, "").trim();
    suggestions = JSON.parse(cleaned);
    if (!Array.isArray(suggestions)) throw new Error("Not an array");
    suggestions = suggestions.slice(0, 3).map(
      (s: { type?: string; headline?: string; preview?: string }) => ({
        type:     s.type     ?? "TALKING_POINT",
        headline: s.headline ?? "",
        preview:  s.preview  ?? "",
      })
    );
  } catch (e) {
    console.error("Failed to parse suggestions JSON:", raw, e);
    return NextResponse.json(
      { error: "Failed to parse model response" },
      { status: 500 }
    );
  }

  // ── Debug: log what the model returned ─────────────────────────────────────
  logSuggestionResult(suggestions);

  return NextResponse.json({
    suggestions,
    meta: { meetingType, moment },
  });
}
