// ─── Debug logger ──────────────────────────────────────────────────────────────
// Set DEBUG=true in .env.local to enable.
// Prints nothing in production unless explicitly enabled.

const IS_DEBUG = process.env.DEBUG === "true";

const C = {
  reset:   "\x1b[0m",
  bold:    "\x1b[1m",
  dim:     "\x1b[2m",
  cyan:    "\x1b[36m",
  yellow:  "\x1b[33m",
  green:   "\x1b[32m",
  magenta: "\x1b[35m",
  blue:    "\x1b[34m",
  red:     "\x1b[31m",
  white:   "\x1b[37m",
  gray:    "\x1b[90m",
};

function divider(char = "─", width = 70) {
  return C.gray + char.repeat(width) + C.reset;
}

function header(label: string, color = C.cyan) {
  const pad = Math.floor((68 - label.length) / 2);
  const padStr = " ".repeat(Math.max(0, pad));
  return (
    C.gray + "┌" + "─".repeat(68) + "┐\n" +
    C.gray + "│" + padStr + color + C.bold + label + C.reset + padStr + C.gray + " │\n" +
    C.gray + "└" + "─".repeat(68) + "┘" + C.reset
  );
}

function truncate(text: string, maxWords = 50): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(" ") + C.gray + ` ... [+${words.length - maxWords} words]` + C.reset;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ─── Suggestion context log ────────────────────────────────────────────────────
export function logSuggestionContext(params: {
  meetingType: string;
  moment: string;
  fullTranscriptWords: number;
  recentContextWords: number;
  lastSentences: string;
  systemPromptPreview: string;
}) {
  if (!IS_DEBUG) return;

  console.log("\n" + header("SUGGESTION CONTEXT", C.cyan));
  console.log(
    C.bold + C.cyan + "  Meeting Type  " + C.reset +
    C.yellow + C.bold + params.meetingType + C.reset
  );
  console.log(
    C.bold + C.cyan + "  Moment        " + C.reset +
    C.magenta + C.bold + params.moment + C.reset
  );
  console.log(divider());

  console.log(C.bold + C.blue + "  CONTEXT LAYERS" + C.reset);
  console.log(
    C.gray + "  Full transcript  : " + C.reset +
    C.white + params.fullTranscriptWords + " words" + C.reset
  );
  console.log(
    C.gray + "  Recent context   : " + C.reset +
    C.white + params.recentContextWords + " words (last ~800)" + C.reset
  );
  console.log(divider());

  console.log(C.bold + C.blue + "  LAST 3 SENTENCES (highest signal)" + C.reset);
  console.log(C.yellow + "  " + params.lastSentences.replace(/\n/g, "\n  ") + C.reset);
  console.log(divider());

  console.log(C.bold + C.blue + "  SYSTEM PROMPT (first 60 words)" + C.reset);
  console.log(C.dim + "  " + truncate(params.systemPromptPreview, 60).replace(/\n/g, "\n  ") + C.reset);
  console.log(divider("─") + "\n");
}

// ─── Suggestion result log ─────────────────────────────────────────────────────
export function logSuggestionResult(suggestions: {
  type: string;
  headline: string;
  preview: string;
}[]) {
  if (!IS_DEBUG) return;

  console.log(header("SUGGESTIONS GENERATED", C.green));
  suggestions.forEach((s, i) => {
    const typeColor =
      s.type === "ANSWER"        ? C.green :
      s.type === "FACT_CHECK"    ? C.yellow :
      s.type === "QUESTION"      ? C.blue :
      s.type === "TALKING_POINT" ? C.magenta :
      s.type === "CLARIFY"       ? C.cyan : C.white;

    console.log(
      `\n  ${C.bold}[${i + 1}]${C.reset} ` +
      typeColor + C.bold + `[${s.type}]` + C.reset
    );
    console.log(C.white + C.bold + `      ${s.headline}` + C.reset);
    console.log(C.gray + `      ${s.preview}` + C.reset);
  });
  console.log("\n" + divider() + "\n");
}

// ─── Chat context log ──────────────────────────────────────────────────────────
export function logChatContext(params: {
  mode: "SUGGESTION_CLICK" | "FREE_CHAT";
  meetingType: string;
  fullTranscriptWords: number;
  historyTurns: number;
  userMessage: string;
  suggestionClicked?: string;
}) {
  if (!IS_DEBUG) return;

  const modeColor = params.mode === "SUGGESTION_CLICK" ? C.magenta : C.blue;
  console.log("\n" + header("CHAT CONTEXT", modeColor));

  console.log(
    C.bold + C.cyan + "  Mode          " + C.reset +
    modeColor + C.bold + params.mode + C.reset
  );
  console.log(
    C.bold + C.cyan + "  Meeting Type  " + C.reset +
    C.yellow + C.bold + params.meetingType + C.reset
  );
  console.log(divider());

  console.log(
    C.gray + "  Full transcript  : " + C.reset +
    C.white + params.fullTranscriptWords + " words" + C.reset
  );
  console.log(
    C.gray + "  History turns    : " + C.reset +
    C.white + params.historyTurns + C.reset
  );

  if (params.suggestionClicked) {
    console.log(divider());
    console.log(C.bold + C.blue + "  SUGGESTION CLICKED" + C.reset);
    console.log(C.yellow + "  " + params.suggestionClicked + C.reset);
  }

  console.log(divider());
  console.log(C.bold + C.blue + "  USER MESSAGE" + C.reset);
  console.log(C.white + "  " + truncate(params.userMessage, 40) + C.reset);
  console.log(divider() + "\n");
}

// ─── Chat stream complete log ──────────────────────────────────────────────────
export function logChatComplete(responsePreview: string) {
  if (!IS_DEBUG) return;

  console.log(C.green + C.bold + "  ✓ STREAM COMPLETE" + C.reset);
  console.log(C.gray + "  First 40 words: " + C.reset + truncate(responsePreview, 40));
  console.log(divider() + "\n");
}

// ─── Generic debug log ─────────────────────────────────────────────────────────
export function debugLog(label: string, value: unknown) {
  if (!IS_DEBUG) return;
  console.log(C.cyan + C.bold + `  [DEBUG] ${label}: ` + C.reset + JSON.stringify(value, null, 2));
}

export { wordCount };
