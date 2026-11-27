import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { recordings } from "@/db/schema";

const TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".mp4": "audio/mp4",
  ".aac": "audio/aac",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".webm": "audio/webm",
  ".amr": "audio/amr",
  ".3gp": "audio/3gpp",
};

export async function GET(_req: Request, ctx: RouteContext<"/api/recordings/[id]/audio">) {
  const { id } = await ctx.params;
  const rec = await db.query.recordings.findFirst({ where: eq(recordings.id, Number(id)) });
  if (!rec?.filePath) return new Response("Not found", { status: 404 });
  try {
    const data = await fs.readFile(rec.filePath);
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": TYPES[path.extname(rec.filePath).toLowerCase()] ?? "application/octet-stream" },
    });
  } catch {
    return new Response("File missing", { status: 404 });
  }
}
