import "server-only";
import path from "node:path";
import { DATA_DIR } from "@/db";

export const WHISPER_MODEL = process.env.WHISPER_MODEL ?? "Xenova/whisper-small.en";

type Transcriber = (
  audio: Float32Array,
  opts: Record<string, unknown>,
) => Promise<{ text: string; chunks?: { timestamp: [number, number | null]; text: string }[] }>;

let pipelinePromise: Promise<Transcriber> | null = null;

async function getTranscriber(onStatus?: (s: string) => void): Promise<Transcriber> {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline, env } = await import("@huggingface/transformers");
      env.cacheDir = path.join(DATA_DIR, "models");
      onStatus?.("Loading speech model (first run downloads it, a few hundred MB)…");
      const p = await pipeline("automatic-speech-recognition", WHISPER_MODEL, { dtype: "q8" });
      return p as unknown as Transcriber;
    })().catch((e) => {
      pipelinePromise = null;
      throw e;
    });
  }
  return pipelinePromise;
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Transcribe 16 kHz mono PCM. Returns text with [m:ss] timestamps per segment. */
export async function transcribePcm(pcm: Float32Array, onStatus?: (s: string) => void): Promise<string> {
  const transcriber = await getTranscriber(onStatus);
  onStatus?.(`Transcribing ${fmt(pcm.length / 16000)} of audio…`);
  const out = await transcriber(pcm, { chunk_length_s: 30, stride_length_s: 5, return_timestamps: true });
  if (out.chunks?.length) {
    return out.chunks
      .map((c) => `[${fmt(c.timestamp[0] ?? 0)}] ${c.text.trim()}`)
      .filter((l) => l.length > 8)
      .join("\n");
  }
  return out.text.trim();
}
