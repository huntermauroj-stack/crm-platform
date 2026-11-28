"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { emailCampaigns, emailTemplates } from "@/db/schema";
import { writeConfig } from "./config";

export async function saveTemplate(input: { id?: number; name: string; subject: string; body: string }) {
  const name = input.name.trim();
  if (!name) throw new Error("Give the template a name.");
  if (!input.subject.trim() || !input.body.trim()) throw new Error("Add a subject and a message.");
  const values = { name, subject: input.subject, body: input.body, updatedAt: new Date() };
  let id = input.id;
  if (id) await db.update(emailTemplates).set(values).where(eq(emailTemplates.id, id));
  else id = (await db.insert(emailTemplates).values(values).returning({ id: emailTemplates.id }))[0].id;
  revalidatePath("/", "layout");
  return id;
}

export async function deleteTemplate(id: number) {
  await db.delete(emailTemplates).where(eq(emailTemplates.id, id));
  revalidatePath("/", "layout");
}

/** Starts a campaign record; the composer passes its id with each batch it sends. */
export async function createCampaign(input: { name: string; subject: string; body: string }) {
  const [row] = await db
    .insert(emailCampaigns)
    .values({ name: input.name.trim() || "Campaign", subject: input.subject, body: input.body })
    .returning({ id: emailCampaigns.id });
  return row.id;
}

export async function saveDailyLimit(formData: FormData) {
  const n = Math.round(Number(formData.get("limit")));
  if (!Number.isFinite(n) || n < 1 || n > 2000) throw new Error("Pick a number from 1 to 2,000.");
  writeConfig({ emailDailyLimit: n });
  revalidatePath("/emails");
}
