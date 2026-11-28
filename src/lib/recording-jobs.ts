import "server-only";
import fs from "node:fs/promises";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { activities, companies, contacts, recordings } from "@/db/schema";
import { analyzeTranscript, aiConfigured } from "./analyze";
import { transcribePcm } from "./transcribe";
import { fullName, date } from "./format";

const g = globalThis as unknown as { __recQueue?: Promise<void> };

/** Queue a recording for transcription + analysis. Jobs run one at a time in the background. */
export function enqueueRecording(id: number, opts: { analyzeOnly?: boolean } = {}) {
  const prev = g.__recQueue ?? Promise.resolve();
  g.__recQueue = prev.then(() => processRecording(id, opts)).catch((e) => console.error("recording job failed", e));
}

async function setRec(id: number, patch: Partial<typeof recordings.$inferInsert>) {
  await db.update(recordings).set(patch).where(eq(recordings.id, id));
}

async function contactContext(contactId: number | null): Promise<string> {
  if (!contactId) return "No CRM record linked.";
  const c = await db.query.contacts.findFirst({ where: eq(contacts.id, contactId) });
  if (!c) return "No CRM record linked.";
  const co = c.companyId ? await db.query.companies.findFirst({ where: eq(companies.id, c.companyId) }) : null;
  const recent = await db
    .select()
    .from(activities)
    .where(eq(activities.contactId, contactId))
    .orderBy(desc(activities.occurredAt))
    .limit(8);
  const lines = [
    `Name: ${fullName(c)}`,
    c.title && `Title: ${c.title}`,
    co && `Company: ${co.name}${co.industry ? ` (${co.industry})` : ""}${co.size ? `, size ${co.size}` : ""}`,
    `CRM status: ${c.status}`,
    c.painPoints && `Known pain points: ${c.painPoints}`,
    c.notes && `Notes: ${c.notes}`,
    recent.length && "Recent activity:",
    ...recent.map((a) => `- ${date(a.occurredAt)} ${a.type}${a.outcome ? ` (${a.outcome})` : ""}: ${(a.body ?? "").slice(0, 300)}`),
  ];
  return lines.filter(Boolean).join("\n");
}

export async function processRecording(id: number, opts: { analyzeOnly?: boolean } = {}) {
  const rec = await db.query.recordings.findFirst({ where: eq(recordings.id, id) });
  if (!rec) return;
  try {
    let transcript = rec.transcript;
    if (!transcript && !opts.analyzeOnly) {
      const pcmPath = rec.filePath + ".pcm";
      let buf: Buffer;
      try {
        buf = await fs.readFile(pcmPath);
      } catch {
        throw new Error("No decoded audio found for this recording. Re-upload it or paste a transcript.");
      }
      await setRec(id, { status: "transcribing", progress: "Starting…", error: null });
      const pcm = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
      transcript = await transcribePcm(pcm, (s) => void setRec(id, { progress: s }));
      await setRec(id, { transcript, status: "transcribed", progress: null });
      await fs.rm(pcmPath, { force: true });
      if (rec.activityId) {
        await db.update(activities).set({ recordingId: id }).where(eq(activities.id, rec.activityId));
      }
    }
    if (!transcript) throw new Error("No transcript available.");
    if (!aiConfigured()) {
      await setRec(id, { status: "transcribed", progress: null });
      return;
    }
    await setRec(id, { status: "analyzing", progress: "Claude is reading the call…", error: null });
    const analysis = await analyzeTranscript({ transcript, contactContext: await contactContext(rec.contactId) });
    await setRec(id, { analysis: JSON.stringify(analysis), status: "done", progress: null });
  } catch (e) {
    console.error(e);
    let msg = e instanceof Error ? e.message : String(e);
    if (/fetch failed|ENOTFOUND|ECONNREFUSED|getaddrinfo/i.test(msg) && !(await hasTranscript(id))) {
      msg = "Couldn't download the speech model. The first transcription needs an internet connection; after that it works offline.";
    }
    await setRec(id, { status: "error", progress: null, error: msg });
  }
}

async function hasTranscript(id: number) {
  const r = await db.query.recordings.findFirst({ where: eq(recordings.id, id), columns: { transcript: true } });
  return Boolean(r?.transcript);
}
