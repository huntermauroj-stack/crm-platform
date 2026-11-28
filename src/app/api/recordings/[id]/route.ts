import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { recordings } from "@/db/schema";
import { enqueueRecording } from "@/lib/recording-jobs";
import { aiConfigured } from "@/lib/analyze";

export async function GET(_req: Request, ctx: RouteContext<"/api/recordings/[id]">) {
  const { id } = await ctx.params;
  const rec = await db.query.recordings.findFirst({ where: eq(recordings.id, Number(id)) });
  if (!rec) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const pending =
    ["uploaded", "transcribing", "analyzing"].includes(rec.status) ||
    (rec.status === "transcribed" && aiConfigured() && !rec.analysis);
  return NextResponse.json({ id: rec.id, status: rec.status, progress: rec.progress, error: rec.error, pending });
}

/** Re-run analysis, optionally replacing the transcript. */
export async function POST(req: Request, ctx: RouteContext<"/api/recordings/[id]">) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { transcript?: string };
  const recId = Number(id);
  if (body.transcript?.trim()) {
    await db.update(recordings).set({ transcript: body.transcript.trim() }).where(eq(recordings.id, recId));
  }
  await db.update(recordings).set({ status: "analyzing", error: null }).where(eq(recordings.id, recId));
  enqueueRecording(recId, { analyzeOnly: true });
  return NextResponse.json({ ok: true });
}
