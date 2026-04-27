import type { TranscriptChunk, SuggestionBatch, ChatMessage } from "./types";

export interface SessionExport {
  exportedAt: string;
  transcript: {
    id: string;
    timestamp: string;
    text: string;
  }[];
  suggestionBatches: {
    id: string;
    timestamp: string;
    suggestions: {
      type: string;
      headline: string;
      preview: string;
    }[];
  }[];
  chatHistory: {
    id: string;
    timestamp: string;
    role: string;
    content: string;
    fromSuggestion?: string;
  }[];
}

export function buildExport(
  transcriptChunks: TranscriptChunk[],
  suggestionBatches: SuggestionBatch[],
  chatMessages: ChatMessage[]
): SessionExport {
  return {
    exportedAt: new Date().toISOString(),
    transcript: transcriptChunks.map((c) => ({
      id: c.id,
      timestamp: new Date(c.timestamp).toISOString(),
      text: c.text,
    })),
    suggestionBatches: suggestionBatches.map((b) => ({
      id: b.id,
      timestamp: new Date(b.timestamp).toISOString(),
      suggestions: b.suggestions.map((s) => ({
        type: s.type,
        headline: s.headline,
        preview: s.preview,
      })),
    })),
    chatHistory: chatMessages.map((m) => ({
      id: m.id,
      timestamp: new Date(m.timestamp).toISOString(),
      role: m.role,
      content: m.content,
      ...(m.fromSuggestion ? { fromSuggestion: m.fromSuggestion } : {}),
    })),
  };
}

export function downloadExport(data: SessionExport): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `meeting-session-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Opens JSON in a new tab — Chrome renders it as readable formatted JSON.
// No file download / no app association needed.
export function openExportInTab(data: SessionExport): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  // Note: we don't revoke the URL — the tab needs it to stay open.
}


export function downloadExportTxt(data: SessionExport): void {
  const lines: string[] = [];

  lines.push("═══════════════════════════════════════════════════════");
  lines.push("  MEETING COPILOT — SESSION EXPORT");
  lines.push(`  Exported: ${new Date(data.exportedAt).toLocaleString()}`);
  lines.push("═══════════════════════════════════════════════════════");
  lines.push("");

  // Transcript
  lines.push("──────────────────────────────────────────────────────");
  lines.push("  TRANSCRIPT");
  lines.push("──────────────────────────────────────────────────────");
  if (data.transcript.length === 0) {
    lines.push("  (no transcript)");
  } else {
    for (const chunk of data.transcript) {
      const time = new Date(chunk.timestamp).toLocaleTimeString();
      lines.push(`[${time}]  ${chunk.text}`);
    }
  }
  lines.push("");

  // Suggestions
  lines.push("──────────────────────────────────────────────────────");
  lines.push("  SUGGESTIONS");
  lines.push("──────────────────────────────────────────────────────");
  if (data.suggestionBatches.length === 0) {
    lines.push("  (no suggestions)");
  } else {
    data.suggestionBatches.forEach((batch, i) => {
      const time = new Date(batch.timestamp).toLocaleTimeString();
      lines.push(`  BATCH ${data.suggestionBatches.length - i}  ·  ${time}`);
      for (const s of batch.suggestions) {
        lines.push(`    [${s.type}]  ${s.headline}`);
        if (s.preview) lines.push(`             ${s.preview}`);
      }
      lines.push("");
    });
  }

  // Chat
  lines.push("──────────────────────────────────────────────────────");
  lines.push("  CHAT");
  lines.push("──────────────────────────────────────────────────────");
  if (data.chatHistory.length === 0) {
    lines.push("  (no chat messages)");
  } else {
    for (const msg of data.chatHistory) {
      const time = new Date(msg.timestamp).toLocaleTimeString();
      const role = msg.role === "user"
        ? (msg.fromSuggestion ? `YOU · ${msg.fromSuggestion}` : "YOU")
        : "ASSISTANT";
      lines.push(`[${time}]  ${role}`);
      lines.push(`  ${msg.content}`);
      lines.push("");
    }
  }

  const text = lines.join("\n");
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `meeting-session-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
