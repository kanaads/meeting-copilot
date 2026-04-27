"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Settings as SettingsIcon, Download, AlertCircle } from "lucide-react";
import { nanoid } from "nanoid";

import TranscriptPanel from "@/components/TranscriptPanel";
import SuggestionsPanel from "@/components/SuggestionsPanel";
import ChatPanel from "@/components/ChatPanel";
import SettingsModal from "@/components/SettingsModal";

import { AudioCapture } from "@/lib/audioCapture";
import { DEFAULT_MODEL, DEFAULT_SETTINGS, flattenTranscript } from "@/lib/prompts";

// Models that have been deprecated and must be migrated on load
const DEPRECATED_MODELS = new Set([
  "meta-llama/llama-4-maverick-17b-128e-instruct",
  "llama3-70b-8192",
  "llama3-8b-8192",
  "mixtral-8x7b-32768",
  "gemma-7b-it",
]);
import { buildExport, downloadExport } from "@/lib/exportSession";
import type {
  ChatMessage,
  Settings,
  Suggestion,
  SuggestionBatch,
  TranscriptChunk,
} from "@/lib/types";

// ─── localStorage helpers ────────────────────────────────────────────────────
const SETTINGS_KEY = "meeting_settings";
const SETTINGS_VERSION = "v4"; // bump this string every time prompts change

function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const saved = JSON.parse(raw);
    // If version mismatch, keep API key but reset all prompts to new defaults
    if (saved.__version !== SETTINGS_VERSION) {
      return { ...DEFAULT_SETTINGS, groqApiKey: saved.groqApiKey ?? "" };
    }
    // Migrate deprecated model IDs to the current default
    if (saved.model && DEPRECATED_MODELS.has(saved.model)) {
      saved.model = DEFAULT_MODEL;
    }
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...s, __version: SETTINGS_VERSION }));
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function Home() {
  // Core state
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [transcriptChunks, setTranscriptChunks] = useState<TranscriptChunk[]>([]);
  const [suggestionBatches, setSuggestionBatches] = useState<SuggestionBatch[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Status
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const [isChatStreaming, setIsChatStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const audioCaptureRef = useRef<AudioCapture | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const settingsRef = useRef<Settings>(settings);
  const transcriptRef = useRef<TranscriptChunk[]>([]);

  // Keep refs in sync
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { transcriptRef.current = transcriptChunks; }, [transcriptChunks]);

  // Load settings from localStorage on mount
  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    if (!s.groqApiKey) setIsSettingsOpen(true);
  }, []);

  // ── API helpers ─────────────────────────────────────────────────────────────

  const apiHeaders = useCallback(
    () => ({
      "Content-Type": "application/json",
      "x-groq-api-key": settingsRef.current.groqApiKey,
    }),
    []
  );

  // Transcribe an audio blob → returns text
  const transcribeBlob = useCallback(async (blob: Blob): Promise<string> => {
    const form = new FormData();
    form.append("audio", blob, "audio.webm");
    const res = await fetch("/api/transcribe", {
      method: "POST",
      headers: { "x-groq-api-key": settingsRef.current.groqApiKey },
      body: form,
    });
    if (!res.ok) throw new Error(`Transcription failed: ${res.status}`);
    const data = await res.json();
    return (data.text ?? "").trim();
  }, []);

  // Fetch suggestions for current transcript
  const fetchSuggestions = useCallback(async (chunks: TranscriptChunk[]) => {
    const s = settingsRef.current;
    if (!s.groqApiKey) return;

    const fullTranscript = flattenTranscript(chunks);
    if (!fullTranscript.trim()) return;

    setIsSuggestionsLoading(true);
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({
          fullTranscript,
          model: s.model,
          suggestionPrompt: s.suggestionPrompt,
          suggestionContextWords: s.suggestionContextWords,
        }),
      });
      if (!res.ok) throw new Error(`Suggestions failed: ${res.status}`);
      const data = await res.json();
      const batch: SuggestionBatch = {
        id: nanoid(),
        suggestions: data.suggestions,
        timestamp: Date.now(),
      };
      setSuggestionBatches((prev) => [batch, ...prev]);
    } catch (e) {
      console.error(e);
      setError("Failed to generate suggestions. Check your API key.");
    } finally {
      setIsSuggestionsLoading(false);
    }
  }, [apiHeaders]);

  // ── Audio & refresh cycle ───────────────────────────────────────────────────

  // Called whenever a 30s audio segment is ready
  const onAudioChunk = useCallback(
    async (blob: Blob) => {
      setIsTranscribing(true);
      try {
        const text = await transcribeBlob(blob);
        if (!text) return;
        const chunk: TranscriptChunk = {
          id: nanoid(),
          text,
          timestamp: Date.now(),
        };
        // Build updated array first, before setState
        // This avoids React 18 batching uncertainty where the setState
        // updater may not run synchronously before fetchSuggestions is called
        const updatedChunks = [...transcriptRef.current, chunk];
        transcriptRef.current = updatedChunks;
        setTranscriptChunks(updatedChunks);
        fetchSuggestions(updatedChunks);
      } catch (e) {
        console.error(e);
        setError("Transcription error. Check your API key and microphone.");
      } finally {
        setIsTranscribing(false);
      }
    },
    [transcribeBlob, fetchSuggestions]
  );

  const startRecording = useCallback(async () => {
    const s = settingsRef.current;
    if (!s.groqApiKey) {
      setIsSettingsOpen(true);
      return;
    }
    setError(null);
    try {
      const capture = new AudioCapture(onAudioChunk, s.refreshIntervalSeconds);
      await capture.start();
      audioCaptureRef.current = capture;
      setIsRecording(true);
    } catch (e) {
      console.error(e);
      setError("Microphone access denied or unavailable.");
    }
  }, [onAudioChunk]);

  const startTabRecording = useCallback(async () => {
    const s = settingsRef.current;
    if (!s.groqApiKey) { setIsSettingsOpen(true); return; }
    setError(null);
    try {
      const capture = new AudioCapture(onAudioChunk, s.refreshIntervalSeconds);
      await capture.startTabCapture();
      audioCaptureRef.current = capture;
      setIsRecording(true);
    } catch (e) {
      console.error(e);
      setError(String(e instanceof Error ? e.message : "Tab capture failed."));
    }
  }, [onAudioChunk]);


  const stopRecording = useCallback(() => {
    audioCaptureRef.current?.stop();
    audioCaptureRef.current = null;
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    setIsRecording(false);
  }, []);

  // Manual refresh: flush current audio segment → transcribe → suggestions
  const handleManualRefresh = useCallback(async () => {
    if (!settingsRef.current.groqApiKey) {
      setIsSettingsOpen(true);
      return;
    }
    if (audioCaptureRef.current?.isActive) {
      audioCaptureRef.current.flush();
    } else {
      // Not recording — just regenerate suggestions from existing transcript
      await fetchSuggestions(transcriptRef.current);
    }
  }, [fetchSuggestions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioCaptureRef.current?.stop();
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, []);

  // ── Chat ────────────────────────────────────────────────────────────────────

  const sendChatMessage = useCallback(
    async (
      userText: string,
      suggestion?: Suggestion
    ) => {
      const s = settingsRef.current;
      if (!s.groqApiKey) {
        setIsSettingsOpen(true);
        return;
      }

      const userMsg: ChatMessage = {
        id: nanoid(),
        role: "user",
        content: userText,
        timestamp: Date.now(),
        fromSuggestion: suggestion?.type
          ? suggestion.type.replace(/_/g, " ")
          : undefined,
      };

      // Optimistically add user message + empty assistant placeholder
      const assistantId = nanoid();
      const assistantPlaceholder: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      };

      setChatMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
      setIsChatStreaming(true);

      const fullTranscript = flattenTranscript(transcriptRef.current);

      // Build history for chat (exclude the placeholder we just added)
      const historyForApi = chatMessages
        .map((m) => ({ role: m.role, content: m.content }))
        .concat({ role: "user" as const, content: userText });

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: apiHeaders(),
          body: JSON.stringify({
            fullTranscript,
            model: s.model,
            chatSystemPrompt: s.chatSystemPrompt,
            detailedAnswerPrompt: s.detailedAnswerPrompt,
            history: historyForApi,
            ...(suggestion
              ? {
                  suggestion: {
                    headline: suggestion.headline,
                    preview: suggestion.preview,
                    type: suggestion.type,
                  },
                }
              : {}),
          }),
        });

        if (!res.ok) throw new Error(`Chat failed: ${res.status}`);

        // Stream tokens into the assistant placeholder
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";

        if (!reader) throw new Error("No response body");

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
            if (payload === "[DONE]") continue;
            try {
              const chunk = JSON.parse(payload);
              accumulated += chunk.token ?? "";
              // Update the assistant message in-place
              setChatMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: accumulated } : m
                )
              );
            } catch {
              // skip
            }
          }
        }
      } catch (e) {
        console.error(e);
        setError("Chat request failed. Check your API key.");
        setChatMessages((prev) => prev.filter((m) => m.id !== assistantId));
      } finally {
        setIsChatStreaming(false);
      }
    },
    [chatMessages, apiHeaders]
  );

  const handleSuggestionClick = useCallback(
    (suggestion: Suggestion) => {
      sendChatMessage(
        `[${suggestion.type}] ${suggestion.headline}\n\n${suggestion.preview}`,
        suggestion
      );
    },
    [sendChatMessage]
  );

  const handleExport = useCallback(() => {
    const data = buildExport(transcriptChunks, suggestionBatches, chatMessages);
    downloadExport(data);
  }, [transcriptChunks, suggestionBatches, chatMessages]);

  const handleSettingsSave = useCallback((s: Settings) => {
    setSettings(s);
    saveSettings(s);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  const hasContent =
    transcriptChunks.length > 0 ||
    suggestionBatches.length > 0 ||
    chatMessages.length > 0;

  return (
    <div className="flex flex-col h-screen bg-bg text-ink">
      {/* Top bar — export + settings only (no heading) */}
      <header className="flex items-center justify-end px-5 py-2 bg-surface border-b border-border flex-shrink-0 gap-2">
        {hasContent && (
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted hover:text-ink border border-border hover:border-accent/40 rounded-lg transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        )}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted hover:text-ink border border-border hover:border-accent/40 rounded-lg transition-all"
        >
          <SettingsIcon className="w-3.5 h-3.5" />
          Settings
        </button>
      </header>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 border-b border-red-500/20 text-xs text-red-400">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400/60 hover:text-red-400"
          >
            ✕
          </button>
        </div>
      )}

      {/* No API key warning */}
      {!settings.groqApiKey && !isSettingsOpen && (
        <div className="flex items-center justify-between px-5 py-2.5 bg-accent/5 border-b border-accent/20 text-xs text-accent-bright">
          <span>Add your Groq API key to get started</span>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="underline hover:no-underline"
          >
            Open Settings
          </button>
        </div>
      )}

      {/* Main 3-column layout */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left — Transcript */}
        <div className="w-[28%] flex-shrink-0 border-r border-border overflow-hidden flex flex-col">
          <TranscriptPanel
            chunks={transcriptChunks}
            isRecording={isRecording}
            isTranscribing={isTranscribing}
            onStart={startRecording}
            onStop={stopRecording}
            onStartTab={startTabRecording}
          />
        </div>

        {/* Middle — Suggestions */}
        <div className="w-[32%] flex-shrink-0 border-r border-border overflow-hidden flex flex-col">
          <SuggestionsPanel
            batches={suggestionBatches}
            isLoading={isSuggestionsLoading}
            onRefresh={handleManualRefresh}
            onSuggestionClick={handleSuggestionClick}
          />
        </div>

        {/* Right — Chat */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <ChatPanel
            messages={chatMessages}
            isStreaming={isChatStreaming}
            onSend={(text) => sendChatMessage(text)}
          />
        </div>
      </main>

      {/* Settings modal */}
      {isSettingsOpen && (
        <SettingsModal
          settings={settings}
          onSave={handleSettingsSave}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  );
}
