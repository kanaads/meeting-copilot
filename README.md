# Meeting Copilot

A real-time meeting copilot that listens to your mic, transcribes speech, and continuously surfaces 3 contextually-aware suggestions while a conversation is happening. Clicking a suggestion opens a detailed answer in the chat panel.

## Live Demo

> **[meeting-copilot-live](https://meeting-copilot-7vm9w9bfz-kanaads-projects.vercel.app/)** 

---

## Quick Start

```bash
git clone <repo>
cd meeting-copilot
npm install
npm run dev
# Open http://localhost:3000
# Click Settings → paste your Groq API key → Save
```

**Requirements**: Node 18+, a Groq API key from [console.groq.com](https://console.groq.com), Chrome or Firefox.

---

## Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 (App Router) | API routes + React in one deploy, zero config on Vercel |
| Styling | Tailwind CSS | Fast iteration, no runtime overhead |
| Audio | Browser MediaRecorder API | No dependencies, native webm/opus support |
| Transcription | Groq Whisper Large V3 | Required; fast and accurate |
| LLM | Groq `llama-3.3-70b-versatile` | Required OSS model; streaming supported |
| Deploy | Vercel | One command, zero config |
| State | React `useState` / `useRef` | No Redux — unnecessary at this scale |
| IDs | nanoid | Lightweight, collision-free unique IDs |

---

## Architecture

```
app/
  page.tsx                 # All state, orchestration, audio → transcript → suggestions pipeline
  api/
    transcribe/route.ts    # Proxies audio blobs → Groq Whisper, filters garbage transcripts
    suggestions/route.ts   # Detects meeting type + moment, builds 3-layer context, calls LLM
    chat/route.ts          # Streaming LLM chat with meeting domain persona injected

components/
  TranscriptPanel.tsx      # Left column: mic control + auto-scrolling transcript
  SuggestionsPanel.tsx     # Middle column: batched suggestion cards, faded older batches
  ChatPanel.tsx            # Right column: streaming chat with newline-aware rendering
  SettingsModal.tsx        # API key + all prompts + config — editable at runtime

lib/
  types.ts                 # Shared TypeScript interfaces
  prompts.ts               # All prompt templates, meeting type detection, moment detection
  audioCapture.ts          # MediaRecorder wrapper — 30s segments, flush on manual refresh
  exportSession.ts         # JSON export: transcript + suggestion batches + chat history
  logger.ts                # Debug logger — set DEBUG=true in .env.local to enable
```

**API key flow**: Stored in `localStorage`, sent as `x-groq-api-key` header per request. Never hardcoded, never logged server-side.

---

## Prompt Strategy

### The Core Problem
Generic suggestions kill trust instantly. "Ask a follow-up question" could come from any app about any meeting. The goal is suggestions so specific that the user feels the app is reading the room — because it is.

### Three-Layer Context
Every suggestion call passes three layers of context:

| Layer | Size | Purpose |
|---|---|---|
| Full transcript | Entire session | Topic awareness, background facts, names |
| Recent context | Last 800 words | What is being discussed right now |
| Last 3 sentences | ~50–80 words | The exact conversational moment to react to |

The model uses the last 3 sentences for moment detection and suggestion type selection, the 800-word window for topic relevance, and the full transcript for answering questions that reference earlier discussion.

### Meeting Type Auto-Detection
Before every suggestion call, the transcript is keyword-scored and classified as one of six types. Each type injects a domain-specific persona into the system prompt:

| Type | Detected from | Persona behaviour |
|---|---|---|
| `TECHNICAL` | architecture, redis, kafka, latency, kubernetes… | Cites real company infra decisions. Requires specific benchmarks. |
| `SALES` | pricing, objection, contract, deal, ROI… | Always helps the seller. Verbatim phrasing over analysis. |
| `INTERVIEW` | resume, candidate, experience, hire… | Always helps the candidate, never the panel. Bans invented achievements. |
| `INVESTOR` | runway, ARR, TAM, moat, raise… | Helps the founder. Only cites numbers from the transcript. |
| `EDUCATION` | student, attendance, counselor, absent… | Welfare framing. No ROI language. No invented statistics. |
| `GENERAL` | fallback | Balanced suggestions, specificity still required. |

### Moment Detection
The last 3 sentences are classified before each call:

| Moment | Trigger | Effect on suggestion order |
|---|---|---|
| `QUESTION_ASKED` | `?` or question words | `ANSWER` forced to position 0 |
| `CLAIM_MADE` | Numbers, superlatives, strong assertions | `FACT_CHECK` leads |
| `OBJECTION_RAISED` | "but", "concern", "not sure", "problem" | `TALKING_POINT` leads |
| `AMBIGUITY_DETECTED` | Vague buzzwords ("enterprise-ready", "scalable") | `CLARIFY` leads |
| `TRANSITION` | Topic shift or closing signals | `QUESTION` leads |
| `NEUTRAL` | No strong signal | Best contextual mix |

### Suggestion Types
Five types, selected and mixed based on the moment:
- **ANSWER** — the specific words the speaker should say right now
- **QUESTION** — a sharp question to ask the other party
- **TALKING_POINT** — a concrete argument or fact to strengthen the speaker's position
- **FACT_CHECK** — external knowledge that corrects or confirms a claim just made
- **CLARIFY** — precise definition of a vague term with why it matters here

### Preview Quality Rule
The prompt explicitly bans teasers. Every preview must deliver standalone value — a user who reads only the preview and never clicks must walk away with something immediately useful. The prompt includes explicit FAIL/PASS examples to enforce this.

### Anti-Hallucination
Enforced in both the suggestion prompt and per-persona rules:
- Never invent statistics, percentages, or study citations
- Never invent names of people or organizations not in the transcript
- Never invent achievements for interview candidates
- `FACT_CHECK` must contain the actual fact in the preview — never "go check the records"
- When transcript is thin (under 100 words), reduce to fewer suggestions rather than inventing filler

### Detailed Answer (on click)
A separate prompt with a fixed format: direct answer sentence → bullet points → one concrete next step. Hard limit of 250 words enforced at the API `max_tokens` level, not just the prompt. Meeting persona injected so technical meetings get technical depth, education meetings get policy knowledge.

### Chat
Streaming with `max_tokens: 250` at the API level. Full transcript injected into every chat call. Hard rules against "based on the transcript" phrasing and invented statistics. Meeting domain persona ensures domain-appropriate answers.

### Settings
All three prompts are editable at runtime via the Settings panel with optimised defaults pre-filled. A version-based reset system (`SETTINGS_VERSION`) ensures prompt updates are picked up automatically while preserving the user's saved API key.

---

## Tradeoffs

| Decision | Tradeoff |
|---|---|
| 30s audio chunks via MediaRecorder | Simpler than streaming Whisper; still meets the 30s requirement. Real product would use WebSocket streaming for sub-second updates. |
| Suggestions fire per transcript chunk | Tied to audio cadence. Independent timer would allow refresh mid-chunk but adds complexity without clear benefit at this scale. |
| No speaker diarization | Multi-speaker meetings work but suggestions don't distinguish who said what. Labelled turns would improve targeting significantly. |
| In-memory state only | Requirement explicitly says no persistence. Reload clears everything intentionally. |
| User-supplied API key | No server-side storage, no auth, no accounts. Key sent as request header, never logged. |
| Tab audio capture | Supported via `getDisplayMedia` — allows capturing audio from any browser tab, useful for testing with recorded meetings or capturing remote calls. |

**What I'd build with more time:**
- WebSocket streaming transcription for near-instant transcript updates
- Speaker diarization — pass labelled turns to the suggestion prompt
- Suggestion deduplication across batches — avoid surfacing the same FACT_CHECK twice
- Pre-meeting context injection (title, attendees, agenda) for better cold-start suggestions
- Eval suite with LLM-as-judge scoring on specificity, timeliness, and actionability

---

## Deployment

```bash
npx vercel --prod
```

No environment variables required on the server. The Groq API key is user-supplied at runtime via the in-app Settings panel.

To enable debug logging locally (prints context layers, meeting type, moment, and suggestions to terminal):

```bash
# .env.local
DEBUG=true
```
