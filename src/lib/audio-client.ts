/** Decode an audio file in the browser into 16 kHz mono Float32 PCM for Whisper. */
export async function decodeTo16kMono(file: File): Promise<{ pcm: Float32Array; durationSec: number }> {
  const buf = await file.arrayBuffer();
  const ctx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(buf);
  } finally {
    void ctx.close();
  }
  const targetRate = 16000;
  const length = Math.ceil(decoded.duration * targetRate);
  const offline = new OfflineAudioContext(1, length, targetRate);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  return { pcm: rendered.getChannelData(0), durationSec: decoded.duration };
}

export type UploadResult = { id: number } | { error: string };

export async function uploadRecording(opts: {
  file: File;
  contactId?: number | null;
  activityId?: number | null;
  onStage?: (s: string) => void;
}): Promise<UploadResult> {
  const fd = new FormData();
  fd.append("file", opts.file);
  if (opts.contactId) fd.append("contactId", String(opts.contactId));
  if (opts.activityId) fd.append("activityId", String(opts.activityId));
  opts.onStage?.("Decoding audio…");
  try {
    const { pcm, durationSec } = await decodeTo16kMono(opts.file);
    fd.append("pcm", new Blob([pcm.buffer as ArrayBuffer], { type: "application/octet-stream" }), "audio.pcm");
    fd.append("durationSec", String(durationSec));
  } catch {
    return {
      error:
        "Your browser couldn't decode this audio format. Convert it to MP3, M4A, or WAV, or paste a transcript on the Recordings page.",
    };
  }
  opts.onStage?.("Uploading…");
  const res = await fetch("/api/recordings", { method: "POST", body: fd });
  const json = await res.json();
  if (!res.ok) return { error: json.error ?? "Upload failed" };
  return { id: json.id };
}
