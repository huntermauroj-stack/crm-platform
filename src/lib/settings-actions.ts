"use server";

import { revalidatePath } from "next/cache";
import { writeConfig } from "./config";

export async function saveApiKey(fd: FormData) {
  const v = fd.get("anthropicApiKey");
  const key = typeof v === "string" ? v.trim() : "";
  if (fd.get("remove")) writeConfig({ anthropicApiKey: undefined });
  else if (key) writeConfig({ anthropicApiKey: key });
  revalidatePath("/", "layout");
}

export async function saveGoogleClient(fd: FormData) {
  const id = String(fd.get("googleClientId") ?? "").trim();
  const secret = String(fd.get("googleClientSecret") ?? "").trim();
  if (fd.get("remove")) writeConfig({ googleClientId: undefined, googleClientSecret: undefined });
  else writeConfig({ ...(id ? { googleClientId: id } : {}), ...(secret ? { googleClientSecret: secret } : {}) });
  revalidatePath("/settings");
}

/** Returns the Google sign-in URL; the page opens it in your browser. */
export async function startGoogleConnect(origin: string) {
  const { buildAuthUrl } = await import("./google");
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) throw new Error("Open Rapport from this computer to connect Google.");
  return buildAuthUrl(origin.replace("localhost", "127.0.0.1"));
}

export async function disconnectGoogleAction() {
  const { disconnectGoogle } = await import("./google");
  await disconnectGoogle();
  revalidatePath("/settings");
}

export async function syncGoogleNow(): Promise<{ ok: true; emails: number; meetings: number } | { ok: false; error: string }> {
  const { syncGoogle } = await import("./google-sync");
  try {
    const r = await syncGoogle();
    revalidatePath("/", "layout");
    return { ok: true, ...r };
  } catch (e) {
    revalidatePath("/settings");
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
