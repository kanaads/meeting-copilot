import { NextRequest } from "next/server";
import {
  buildChatMessages,
  buildDetailedAnswerMessages,
  detectMeetingType,
} from "@/lib/prompts";
import { logChatContext, wordCount } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-groq-api-key");
  if (!apiKey) {
    return new Response("Missing Groq API key", { status: 401 });
  }

  const body = await req.json();
  const {
    fullTranscript,
    model,
    chatSystemPrompt,
    detailedAnswerPrompt,
    history,
    suggestion,
  } = body as {
    fullTranscript: string;
    model: string;
    chatSystemPrompt: string;
    detailedAnswerPrompt: string;
    history: { role: "user" | "assistant"; content: string }[];
    suggestion?: {
      headline: string;
      preview: string;
      type: string;
    };
  };

  // ── Detect meeting type ─────────────────────────────────────────────────────
  const meetingType = detectMeetingType(fullTranscript);

  // ── Debug: log chat context ─────────────────────────────────────────────────
  const lastUserMessage = suggestion
    ? `[${suggestion.type}] ${suggestion.headline}`
    : (history[history.length - 1]?.content ?? "");

  logChatContext({
    mode:               suggestion ? "SUGGESTION_CLICK" : "FREE_CHAT",
    meetingType,
    fullTranscriptWords: wordCount(fullTranscript),
    historyTurns:        history.length,
    userMessage:         lastUserMessage,
    suggestionClicked:   suggestion
      ? `[${suggestion.type}] ${suggestion.headline} — ${suggestion.preview}`
      : undefined,
  });

  // ── Build messages ──────────────────────────────────────────────────────────
  const messages = suggestion
    ? buildDetailedAnswerMessages(
        detailedAnswerPrompt,
        fullTranscript,
        suggestion.headline,
        suggestion.preview,
        suggestion.type,
        meetingType
      )
    : buildChatMessages(chatSystemPrompt, fullTranscript, history, meetingType);

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
        max_tokens: 250,
        temperature: 0.2,
        stream: true,
      }),
    }
  );

  if (!groqRes.ok) {
    const err = await groqRes.text();
    return new Response(`Groq error: ${err}`, { status: groqRes.status });
  }

  const encoder = new TextEncoder();
  let   firstTokens = "";
  let   tokenCount  = 0;

  const readable = new ReadableStream({
    async start(controller) {
      const reader = groqRes.body?.getReader();
      if (!reader) { controller.close(); return; }

      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const payload = trimmed.slice(6);
            if (payload === "[DONE]") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              continue;
            }
            try {
              const chunk = JSON.parse(payload);
              const token = chunk.choices?.[0]?.delta?.content ?? "";
              if (token) {
                // Collect first ~100 chars for debug preview
                if (firstTokens.length < 200) firstTokens += token;
                tokenCount++;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ token })}\n\n`)
                );
              }
            } catch {
              // skip malformed chunks
            }
          }
        }
      } finally {
        reader.releaseLock();
        controller.close();

        // ── Debug: log stream completion ──────────────────────────────────────
        if (process.env.DEBUG === "true") {
          console.log(
            `\x1b[32m\x1b[1m  ✓ STREAM COMPLETE\x1b[0m` +
            ` \x1b[90m(${tokenCount} tokens)\x1b[0m`
          );
          console.log(
            `\x1b[90m  Preview: \x1b[0m` +
            firstTokens.slice(0, 120).replace(/\n/g, " ") +
            "\x1b[90m...\x1b[0m\n"
          );
        }
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
