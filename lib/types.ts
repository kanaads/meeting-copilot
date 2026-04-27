export type SuggestionType =
  | "ANSWER"
  | "QUESTION"
  | "FACT_CHECK"
  | "TALKING_POINT"
  | "CLARIFY";

export interface TranscriptChunk {
  id: string;
  text: string;
  timestamp: number; // unix ms
}

export interface Suggestion {
  type: SuggestionType;
  headline: string;
  preview: string;
}

export interface SuggestionBatch {
  id: string;
  suggestions: Suggestion[];
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  fromSuggestion?: string; // suggestion headline that spawned it
}

export interface Settings {
  groqApiKey: string;
  model: string;
  suggestionPrompt: string;
  detailedAnswerPrompt: string;
  chatSystemPrompt: string;
  suggestionContextWords: number;
  refreshIntervalSeconds: number;
}
