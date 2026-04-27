"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { TranscriptChunk } from "@/lib/types";

interface Props {
  chunks: TranscriptChunk[];
  isRecording: boolean;
  isTranscribing: boolean;
  onStart: () => void;
  onStop: () => void;
  onStartTab?: () => void;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export default function TranscriptPanel({
  chunks,
  isRecording,
  isTranscribing,
  onStart,
  onStop,
  onStartTab,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chunks]);

  return (
    <div className="flex flex-col h-full">
      {/* Fixed header — column title */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold tracking-widest uppercase text-muted">
            1. MIC &amp; TRANSCRIPT
          </span>
          {isTranscribing && (
            <Loader2 className="w-3 h-3 text-accent-bright animate-spin" />
          )}
        </div>
        <span className="text-[11px] font-semibold tracking-widest uppercase text-muted">
          {isRecording ? (
            <span className="flex items-center gap-1.5">
              <span className="record-dot w-1.5 h-1.5 rounded-full bg-red-500 block" />
              <span className="text-red-400">REC</span>
            </span>
          ) : (
            "IDLE"
          )}
        </span>
      </div>

      {/* Fixed mic button row */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 flex-shrink-0">
        <button
          onClick={isRecording ? onStop : onStart}
          className={`
            w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0
            border transition-all duration-200
            ${isRecording
              ? "bg-red-500/10 border-red-500/30 hover:bg-red-500/20"
              : "bg-surface-2 border-border hover:border-accent/50"
            }
          `}
          title={isRecording ? "Stop recording" : "Start recording"}
        >
          {isRecording ? (
            <span className="w-3.5 h-3.5 rounded-sm bg-red-500 block" />
          ) : (
            <span className="w-3 h-3 rounded-full bg-accent-bright block" />
          )}
        </button>
        <p className="text-xs text-muted leading-relaxed flex-1">
          {isRecording
            ? "Recording… Transcript appends every ~30s."
            : "Click mic to start. Transcript appends every ~30s."}
        </p>
        {!isRecording && onStartTab && (
          <button
            onClick={onStartTab}
            title="Capture audio from a browser tab"
            className="
              flex-shrink-0 px-3 py-1.5 rounded-lg border border-border
              bg-surface-2 text-xs font-medium text-muted hover:text-ink
              hover:border-accent/50 transition-all duration-200 whitespace-nowrap
            "
          >
            Capture Tab
          </button>
        )}
      </div>

      {/* Scrollable body — info card + transcript chunks scroll together */}
      <div className="flex-1 overflow-y-auto">
        {/* Info card — blue-tinted like prototype */}
        <div className="mx-4 mb-4 px-3 py-2.5 rounded-lg border border-accent/20 bg-accent/5 text-xs text-muted leading-relaxed">
          The transcript scrolls and appends new chunks every ~30 seconds while
          recording. Click the mic button to start or stop. Export the full session
          using the button in the top bar.
        </div>

        {/* Transcript chunks */}
        <div className="px-4 pb-4 space-y-4">
          {chunks.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">
              No transcript yet — start the mic.
            </p>
          ) : (
            chunks.map((chunk) => (
              <div key={chunk.id} className="fade-up">
                <p className="text-sm leading-relaxed text-ink/90">
                  <span className="font-mono text-muted text-xs mr-2">
                    {formatTime(chunk.timestamp)}
                  </span>
                  {chunk.text}
                </p>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
