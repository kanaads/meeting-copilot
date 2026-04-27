"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ChatMessage } from "@/lib/types";

interface Props {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSend: (text: string) => void;
}

export default function ChatPanel({ messages, isStreaming, onSend }: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    onSend(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Fixed header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <span className="text-[11px] font-semibold tracking-widest uppercase text-muted">
          3. CHAT (DETAILED ANSWERS)
        </span>
        <span className="text-[11px] font-semibold tracking-widest uppercase text-muted">
          SESSION-ONLY
        </span>
      </div>

      {/* Scrollable body — info card + messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-3 pb-2 space-y-4">
          {/* Info card — blue-tinted like prototype */}
          <div className="px-3 py-2.5 rounded-lg border border-accent/20 bg-accent/5 text-xs text-muted leading-relaxed">
            Clicking a suggestion adds it to this chat and streams a detailed answer
            (separate prompt, more context). User can also type questions directly. One
            continuous chat per session — no login, no persistence.
          </div>

          {messages.length === 0 && (
            <p className="text-sm text-muted text-center py-8">
              Click a suggestion or type a question below.
            </p>
          )}

          {messages.map((msg, idx) => {
            const isLast = idx === messages.length - 1;
            const isStreamingThisMsg =
              isStreaming && isLast && msg.role === "assistant";

            const label =
              msg.role === "user"
                ? msg.fromSuggestion
                  ? `YOU · ${msg.fromSuggestion.toUpperCase()}`
                  : "YOU"
                : "ASSISTANT";

            return (
              <div key={msg.id} className="fade-up space-y-1">
                {/* Role label */}
                <p className="text-[10px] font-semibold tracking-widest uppercase text-muted">
                  {label}
                </p>

                {msg.role === "user" ? (
                  /* User message — bordered card */
                  <div className="px-3 py-2.5 rounded-lg border border-border bg-surface-2 text-sm leading-relaxed text-ink">
                    {msg.content}
                  </div>
                ) : (
                  /* Assistant message — plain flowing text, NO card, NO border */
                  <p className={`text-sm leading-relaxed text-ink/90 ${isStreamingThisMsg ? "cursor-blink" : ""}`}>
                    {msg.content
                      ? msg.content.split("\n").map((line, i) => (
                          <span key={i}>
                            {line}
                            {i < msg.content.split("\n").length - 1 && <br />}
                          </span>
                        ))
                      : isStreamingThisMsg ? "" : "…"}
                  </p>
                )}
              </div>
            );
          })}

          {isStreaming &&
            (messages.length === 0 ||
              messages[messages.length - 1].role === "user") && (
              <div className="flex items-center gap-2 text-muted text-xs fade-up">
                <Loader2 className="w-3 h-3 animate-spin" />
                Thinking…
              </div>
            )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Fixed input bar */}
      <div className="px-4 py-3 border-t border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            disabled={isStreaming}
            className="
              flex-1 bg-surface-2 border border-border rounded-lg
              px-3 py-2 text-sm text-ink placeholder:text-muted
              outline-none focus:border-accent/50
              transition-colors duration-150 disabled:opacity-50
            "
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="
              px-4 py-2 rounded-lg bg-accent border border-accent
              text-white text-sm font-medium
              hover:bg-accent/80
              transition-all duration-150
              disabled:opacity-40 disabled:cursor-not-allowed
              flex-shrink-0
            "
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
