"use client";

import { Loader2, RefreshCw } from "lucide-react";
import type { Suggestion, SuggestionBatch } from "@/lib/types";

interface Props {
  batches: SuggestionBatch[];
  isLoading: boolean;
  onRefresh: () => void;
  onSuggestionClick: (suggestion: Suggestion) => void;
}

const TYPE_LABELS: Record<string, string> = {
  ANSWER:        "ANSWER",
  QUESTION:      "QUESTION TO ASK",
  FACT_CHECK:    "FACT-CHECK",
  TALKING_POINT: "TALKING POINT",
  CLARIFY:       "CLARIFY",
};

const TYPE_CARD_STYLE: Record<string, string> = {
  ANSWER:        "border-emerald-500/40 bg-emerald-500/5",
  QUESTION:      "border-blue-500/40    bg-blue-500/5",
  FACT_CHECK:    "border-amber-500/40   bg-amber-500/5",
  TALKING_POINT: "border-purple-500/40  bg-purple-500/5",
  CLARIFY:       "border-pink-500/40    bg-pink-500/5",
};

const TYPE_BADGE_STYLE: Record<string, string> = {
  ANSWER:        "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  QUESTION:      "bg-blue-500/15    text-blue-400    border border-blue-500/30",
  FACT_CHECK:    "bg-amber-500/15   text-amber-400   border border-amber-500/30",
  TALKING_POINT: "bg-purple-500/15  text-purple-400  border border-purple-500/30",
  CLARIFY:       "bg-pink-500/15    text-pink-400    border border-pink-500/30",
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function SuggestionCard({
  suggestion,
  onClick,
  faded,
}: {
  suggestion: Suggestion;
  onClick: () => void;
  faded?: boolean;
}) {
  const cardStyle = TYPE_CARD_STYLE[suggestion.type] ?? "border-border bg-surface-2";
  const badgeStyle = TYPE_BADGE_STYLE[suggestion.type] ?? "bg-surface-2 text-muted border border-border";

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left p-3 rounded-lg border
        transition-all duration-150
        hover:brightness-110
        ${cardStyle}
        ${faded ? "opacity-50" : ""}
      `}
    >
      <div className="mb-2">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded tracking-wider ${badgeStyle}`}>
          {TYPE_LABELS[suggestion.type] ?? suggestion.type}
        </span>
      </div>
      <p className="text-sm font-semibold text-ink leading-snug">
        {suggestion.headline}
      </p>
      {suggestion.preview && (
        <p className="text-xs text-muted leading-relaxed mt-1">{suggestion.preview}</p>
      )}
    </button>
  );
}

export default function SuggestionsPanel({
  batches,
  isLoading,
  onRefresh,
  onSuggestionClick,
}: Props) {
  return (
    <div className="flex flex-col h-full">
      {/* Fixed header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <span className="text-[11px] font-semibold tracking-widest uppercase text-muted">
          2. LIVE SUGGESTIONS
        </span>
        <span className="text-[11px] font-semibold tracking-widest uppercase text-muted">
          {batches.length} BATCHES
        </span>
      </div>

      {/* Fixed reload row */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border flex-shrink-0">
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="
            flex items-center gap-1.5 px-3 py-1.5 rounded-md
            text-xs text-ink
            border border-border hover:border-accent/40
            bg-surface hover:bg-surface-2
            transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed
          "
        >
          {isLoading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          Reload suggestions
        </button>
        <span className="text-xs text-muted">auto-refresh in 30s</span>
      </div>

      {/* Scrollable body — info card + suggestions all scroll together */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-3 pb-4 space-y-3">
          {/* Info card — blue-tinted like prototype */}
          <div className="px-3 py-2.5 rounded-lg border border-accent/20 bg-accent/5 text-xs text-muted leading-relaxed">
            On reload (or auto every ~30s), generate{" "}
            <strong className="text-ink font-semibold">3 fresh suggestions</strong>{" "}
            from recent transcript context. New batch appears at the top; older batches
            push down (faded). Each is a tappable card:{" "}
            <span className="text-blue-400">a question to ask</span>,{" "}
            <span className="text-purple-400">a talking point</span>,{" "}
            <span className="text-emerald-400">an answer</span>, or a{" "}
            <span className="text-amber-400">fact-check</span>. The preview alone
            should already be useful.
          </div>

          {isLoading && batches.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Loader2 className="w-5 h-5 text-accent-bright animate-spin" />
              <p className="text-xs text-muted">Generating suggestions…</p>
            </div>
          )}

          {!isLoading && batches.length === 0 && (
            <p className="text-sm text-muted text-center py-8">
              Suggestions appear here once recording starts.
            </p>
          )}

          {batches.map((batch, batchIdx) => {
            const isLatest = batchIdx === 0;
            return (
              <div key={batch.id} className="fade-up space-y-2">
                {!isLatest && (
                  <div className="flex items-center gap-2 pt-2">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] font-mono text-dim whitespace-nowrap">
                      — BATCH {batches.length - batchIdx} · {formatTime(batch.timestamp)} —
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}
                {batch.suggestions.map((s, i) => (
                  <SuggestionCard
                    key={`${batch.id}-${i}`}
                    suggestion={s}
                    onClick={() => onSuggestionClick(s)}
                    faded={!isLatest}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
