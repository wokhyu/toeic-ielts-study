/** Browser audio recording for Speaking practice (MediaRecorder). */

export const recordingSupported =
  typeof window !== 'undefined' &&
  typeof window.MediaRecorder !== 'undefined' &&
  Boolean(navigator.mediaDevices?.getUserMedia);

const TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

/** The first audio format this browser can record (Safari records mp4, others webm). */
export function pickMimeType(
  isSupported: (type: string) => boolean = (t) => MediaRecorder.isTypeSupported(t),
) {
  return TYPES.find((t) => isSupported(t)) ?? '';
}

/** File extension and upload content type for a recorded blob type. */
export function fileTypeOf(blobType: string): { ext: string; contentType: string } {
  const base = blobType.split(';')[0].trim() || 'audio/webm';
  const ext =
    base === 'audio/mp4' ? 'm4a' : base === 'audio/ogg' ? 'ogg' : base === 'audio/mpeg' ? 'mp3' : 'webm';
  return { ext, contentType: base };
}

export interface Take {
  blob: Blob;
  url: string;
  seconds: number;
}

/** One recording session: start() asks for the microphone, stop() resolves with the take. */
export class Recording {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = pickMimeType();
    this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start();
    this.startedAt = Date.now();
  }

  stop(): Promise<Take> {
    const recorder = this.recorder;
    if (!recorder) return Promise.reject(new Error('not recording'));
    return new Promise((resolve) => {
      recorder.onstop = () => {
        this.stream?.getTracks().forEach((t) => t.stop());
        const blob = new Blob(this.chunks, { type: recorder.mimeType || 'audio/webm' });
        resolve({
          blob,
          url: URL.createObjectURL(blob),
          seconds: Math.max(1, Math.round((Date.now() - this.startedAt) / 1000)),
        });
      };
      recorder.stop();
    });
  }

  /** Stops without keeping anything (leaving the page mid-recording). */
  cancel(): void {
    if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
    this.stream?.getTracks().forEach((t) => t.stop());
  }
}
