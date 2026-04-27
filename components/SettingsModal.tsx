"use client";

import { useState } from "react";
import { X, Eye, EyeOff, Save } from "lucide-react";
import type { Settings } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/prompts";

interface Props {
  settings: Settings;
  onSave: (s: Settings) => void;
  onClose: () => void;
}

export default function SettingsModal({ settings, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<Settings>({ ...settings });
  const [showKey, setShowKey] = useState(false);

  const update = (key: keyof Settings, value: string | number) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 bg-surface border border-border rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold tracking-wide">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 text-muted hover:text-ink transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* API Key */}
          <Field label="Groq API Key" hint="Never stored server-side. Sent as a request header.">
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={draft.groqApiKey}
                onChange={(e) => update("groqApiKey", e.target.value)}
                placeholder="gsk_..."
                className={inputClass}
              />
              <button
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>

          {/* Model */}
          <Field label="Model" hint="Groq model used for suggestions and chat.">
            <select
              value={draft.model}
              onChange={(e) => update("model", e.target.value)}
              className={inputClass}
            >
              <optgroup label="Production (recommended)">
                <option value="llama-3.3-70b-versatile">Llama 3.3 70B Versatile</option>
                <option value="llama-3.1-8b-instant">Llama 3.1 8B Instant (fastest)</option>
                <option value="openai/gpt-oss-120b">GPT-OSS 120B</option>
                <option value="openai/gpt-oss-20b">GPT-OSS 20B</option>
              </optgroup>
              <optgroup label="Preview">
                <option value="meta-llama/llama-4-scout-17b-16e-instruct">Llama 4 Scout 17B</option>
                <option value="qwen/qwen3-32b">Qwen3 32B</option>
              </optgroup>
            </select>
          </Field>

          {/* Refresh interval */}
          <Field
            label="Refresh Interval (seconds)"
            hint="How often to auto-update transcript and suggestions."
          >
            <input
              type="number"
              min={10}
              max={120}
              value={draft.refreshIntervalSeconds}
              onChange={(e) =>
                update("refreshIntervalSeconds", Number(e.target.value))
              }
              className={inputClass}
            />
          </Field>

          {/* Suggestion context window */}
          <Field
            label="Suggestion Context Window (words)"
            hint="How many words from the end of transcript are passed as 'recent context'."
          >
            <input
              type="number"
              min={100}
              max={4000}
              value={draft.suggestionContextWords}
              onChange={(e) =>
                update("suggestionContextWords", Number(e.target.value))
              }
              className={inputClass}
            />
          </Field>

          {/* Suggestion prompt */}
          <Field
            label="Live Suggestion Prompt"
            hint="System prompt for generating the 3 suggestion cards."
          >
            <textarea
              rows={8}
              value={draft.suggestionPrompt}
              onChange={(e) => update("suggestionPrompt", e.target.value)}
              className={`${inputClass} resize-y font-mono text-xs leading-relaxed`}
            />
          </Field>

          {/* Detailed answer prompt */}
          <Field
            label="Detailed Answer Prompt"
            hint="System prompt used when a user clicks a suggestion card."
          >
            <textarea
              rows={6}
              value={draft.detailedAnswerPrompt}
              onChange={(e) => update("detailedAnswerPrompt", e.target.value)}
              className={`${inputClass} resize-y font-mono text-xs leading-relaxed`}
            />
          </Field>

          {/* Chat system prompt */}
          <Field
            label="Chat System Prompt"
            hint="System prompt for free-form chat messages."
          >
            <textarea
              rows={5}
              value={draft.chatSystemPrompt}
              onChange={(e) => update("chatSystemPrompt", e.target.value)}
              className={`${inputClass} resize-y font-mono text-xs leading-relaxed`}
            />
          </Field>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex justify-between">
          <button
            onClick={() => setDraft({ ...DEFAULT_SETTINGS, groqApiKey: draft.groqApiKey })}
            className="px-4 py-2 text-xs text-muted hover:text-red-400 border border-border hover:border-red-400/40 rounded-lg transition-colors"
          >
            Reset prompts to defaults
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted hover:text-ink border border-border rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onSave(draft);
                onClose();
              }}
              className="px-4 py-2 text-sm font-medium bg-accent/10 border border-accent/30 text-accent-bright hover:bg-accent/20 rounded-lg transition-all flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-ink">{label}</label>
      {hint && <p className="text-[11px] text-muted">{hint}</p>}
      {children}
    </div>
  );
}

const inputClass =
  "w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-ink placeholder:text-muted outline-none focus:border-accent/50 transition-colors";
