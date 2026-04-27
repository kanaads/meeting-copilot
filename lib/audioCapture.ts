// AudioCapture: wraps the MediaRecorder API.
// Records in 30-second segments. On each segment end, calls onChunk with the blob.
// Uses webm (supported by Groq Whisper).

export type ChunkCallback = (blob: Blob, durationMs: number) => void;

export class AudioCapture {
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private segmentStart = 0;
  private onChunk: ChunkCallback;
  private intervalMs: number;

  constructor(onChunk: ChunkCallback, intervalSeconds = 30) {
    this.onChunk = onChunk;
    this.intervalMs = intervalSeconds * 1000;
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 16000,
      },
    });

    this.startSegment();

    this.intervalId = setInterval(() => {
      this.rotateSegment();
    }, this.intervalMs);
  }

  async startTabCapture(): Promise<void> {
    // Chrome requires video:true — we stop video tracks right after
    const display = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });

    // Discard video tracks immediately — we only want audio
    display.getVideoTracks().forEach((t) => t.stop());

    const audioTracks = display.getAudioTracks();
    if (audioTracks.length === 0) {
      throw new Error("No audio track found. Make sure you check 'Share tab audio' when prompted.");
    }

    this.stream = new MediaStream(audioTracks);

    this.startSegment();

    this.intervalId = setInterval(() => {
      this.rotateSegment();
    }, this.intervalMs);
  }


  // Flush the current segment immediately (called by manual refresh)
  flush(): void {
    if (this.mediaRecorder?.state === "recording") {
      this.mediaRecorder.stop();
      // startSegment() is called in onstop handler
    }
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.mediaRecorder?.state === "recording") {
      this.mediaRecorder.stop();
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  private startSegment(): void {
    if (!this.stream) return;

    this.chunks = [];
    this.segmentStart = Date.now();

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => {
      const duration = Date.now() - this.segmentStart;
      if (this.chunks.length > 0) {
        const blob = new Blob(this.chunks, { type: mimeType });
        this.onChunk(blob, duration);
      }
    };

    this.mediaRecorder.start();
  }

  private rotateSegment(): void {
    if (this.mediaRecorder?.state === "recording") {
      // onstop will fire → calls onChunk → then we start a new segment
      const previousStop = this.mediaRecorder.onstop;
      this.mediaRecorder.onstop = (e) => {
        if (previousStop) (previousStop as EventListener)(e);
        this.startSegment();
      };
      this.mediaRecorder.stop();
    }
  }

  get isActive(): boolean {
    return this.mediaRecorder?.state === "recording";
  }
}
