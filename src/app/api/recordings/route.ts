import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, DATA_DIR } from "@/db";
import { recordings } from "@/db/schema";
import { enqueueRecording } from "@/lib/recording-jobs";

export async function POST(req: Request) {
  const fd = await req.formData();
  const file = fd.get("file");
  const pcm = fd.get("pcm");
  const transcript = fd.get("transcript");
  const contactId = Number(fd.get("contactId")) || null;
  const activityId = Number(fd.get("activityId")) || null;
  const durationSec = Math.round(Number(fd.get("durationSec"))) || null;

  if (!(file instanceof File) && typeof transcript !== "string") {
    return NextResponse.json({ error: "Upload an audio file or paste a transcript." }, { status: 400 });
  }

  const dir = path.join(DATA_DIR, "recordings");
  await fs.mkdir(dir, { recursive: true });
  const safeName = file instanceof File ? file.name.replace(/[^\w.\-]+/g, "_").slice(-80) : "pasted-transcript.txt";

  const [row] = await db
    .insert(recordings)
    .values({
      contactId,
      activityId,
      fileName: file instanceof File ? file.name : "Pasted transcript",
      filePath: "",
      durationSec,
      transcript: typeof transcript === "string" && transcript.trim() ? transcript.trim() : null,
      status: typeof transcript === "string" && transcript.trim() ? "transcribed" : "uploaded",
    })
    .returning({ id: recordings.id });

  const filePath = path.join(dir, `${row.id}-${safeName}`);
  if (file instanceof File) await fs.writeFile(filePath, Buffer.from(await file.arrayBuffer()));
  if (pcm instanceof File) await fs.writeFile(filePath + ".pcm", Buffer.from(await pcm.arrayBuffer()));
  await db.update(recordings).set({ filePath }).where(eq(recordings.id, row.id));

  enqueueRecording(row.id);
  return NextResponse.json({ id: row.id });
}
