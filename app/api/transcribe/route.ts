import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-groq-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "Missing Groq API key" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const audioFile = formData.get("audio") as File | null;
  if (!audioFile) {
    return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
  }

  // Forward to Groq Whisper
  const groqForm = new FormData();
  groqForm.append("file", audioFile, "audio.webm");
  groqForm.append("model", "whisper-large-v3");
  groqForm.append("response_format", "json");
  groqForm.append("language", "en");

  const groqRes = await fetch(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: groqForm,
    }
  );

  if (!groqRes.ok) {
    const err = await groqRes.text();
    console.error("Groq Whisper error:", err);
    return NextResponse.json(
      { error: `Groq error: ${groqRes.status}` },
      { status: groqRes.status }
    );
  }

  const data = await groqRes.json();
  const text = (data.text ?? "").trim();

  // Filter out garbage transcriptions — Whisper often returns single words
  // like "you", "the", "thank you" when transcribing silence or noise.
  // Require at least 4 words before accepting a transcript chunk.
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < 4) {
    return NextResponse.json({ text: "" });
  }

  return NextResponse.json({ text });
}
