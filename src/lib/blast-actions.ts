"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { activities, companies, contacts } from "@/db/schema";
import { fillTemplate, mergeVars, missingFields } from "./google-links";

export type BlastResult = { contactId: number; ok: boolean; error?: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Sends one batch of a blast from your Gmail. The page calls this a few contacts at a time to show progress. */
export async function sendBlastBatch(input: {
  contactIds: number[];
  subject: string;
  body: string;
  blastName: string;
  campaignId?: number;
}): Promise<BlastResult[]> {
  const { sendGmail } = await import("./google");
  const { dailyLimit, sentToday } = await import("./email-templates");
  if (!input.subject.trim() || !input.body.trim()) throw new Error("Add a subject and a message.");
  const limit = dailyLimit();
  let sentSoFar = await sentToday();
  const rows = await db
    .select({ c: contacts, company: companies.name })
    .from(contacts)
    .leftJoin(companies, eq(contacts.companyId, companies.id))
    .where(inArray(contacts.id, input.contactIds.slice(0, 10)));
  const out: BlastResult[] = [];
  for (const { c, company } of rows) {
    if (!c.email) {
      out.push({ contactId: c.id, ok: false, error: "No email address" });
      continue;
    }
    if (c.status === "do_not_contact") {
      out.push({ contactId: c.id, ok: false, error: "Marked do not contact" });
      continue;
    }
    const vars = mergeVars(c, company);
    if (sentSoFar >= limit) {
      out.push({ contactId: c.id, ok: false, error: `Daily send limit reached (${limit}). Change it under Emails, or send the rest tomorrow.` });
      break;
    }
    const missing = missingFields(input.subject + input.body, vars);
    if (missing.length) {
      out.push({ contactId: c.id, ok: false, error: `No ${missing.join(" or ")} in their notes` });
      continue;
    }
    const subject = fillTemplate(input.subject, vars);
    const body = fillTemplate(input.body, vars);
    try {
      const sent = await sendGmail({ to: c.email, subject, body });
      const now = new Date();
      await db.insert(activities).values({
        type: "email",
        contactId: c.id,
        companyId: c.companyId,
        subject: `Sent (${input.blastName}): ${subject}`,
        body: `To: ${c.email}\n\n${body}`,
        occurredAt: now,
        externalId: `gmail:${sent.id}:${c.id}`,
        campaignId: input.campaignId ?? null,
      }).onConflictDoNothing();
      await db.update(contacts).set({ lastContactedAt: now, updatedAt: now }).where(eq(contacts.id, c.id));
      out.push({ contactId: c.id, ok: true });
      sentSoFar++;
    } catch (e) {
      out.push({ contactId: c.id, ok: false, error: e instanceof Error ? e.message : String(e) });
      if (/Google 4(01|03|29)|expired|isn't connected/i.test(String(e))) break;
    }
    await sleep(1200); // Stay well under Gmail's sending limits.
  }
  revalidatePath("/", "layout");
  return out;
}

/** Sends the first recipient's version to yourself. */
export async function sendBlastTest(input: { contactId: number; subject: string; body: string }) {
  const { sendGmail, googleAccount } = await import("./google");
  const me = googleAccount()?.email;
  if (!me) throw new Error("Google isn't connected.");
  const row = await db
    .select({ c: contacts, company: companies.name })
    .from(contacts)
    .leftJoin(companies, eq(contacts.companyId, companies.id))
    .where(and(eq(contacts.id, input.contactId)))
    .limit(1);
  if (!row[0]) throw new Error("Contact not found");
  const vars = mergeVars(row[0].c, row[0].company);
  await sendGmail({ to: me, subject: `[Test] ${fillTemplate(input.subject, vars)}`, body: fillTemplate(input.body, vars) });
  return me;
}
