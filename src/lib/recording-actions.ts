"use server";

import fs from "node:fs/promises";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { activities, companies, contacts, deals, recordings, tasks } from "@/db/schema";
import type { CallAnalysis } from "./analysis-schema";
import { findOrCreateCompany } from "./actions";
import { addDays, fullName } from "./format";

function mergeLines(existing: string | null, add: string[]) {
  const have = new Set((existing ?? "").split("\n").map((l) => l.replace(/^[-•]\s*/, "").trim().toLowerCase()));
  const fresh = add.filter((a) => a.trim() && !have.has(a.trim().toLowerCase()));
  if (!fresh.length) return existing;
  return [existing, ...fresh.map((f) => `• ${f}`)].filter(Boolean).join("\n");
}

export async function applyAnalysis(recordingId: number, fd: FormData) {
  const rec = await db.query.recordings.findFirst({ where: eq(recordings.id, recordingId) });
  if (!rec?.analysis) return;
  const contactIdFromForm = Number(fd.get("contactId")) || null;
  const contactId = contactIdFromForm ?? rec.contactId;
  if (!contactId) return;
  if (contactId !== rec.contactId) await db.update(recordings).set({ contactId }).where(eq(recordings.id, recordingId));
  const a = JSON.parse(rec.analysis) as CallAnalysis;
  const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, contactId) });
  if (!contact) return;
  const on = (k: string) => fd.get(k) === "on";
  const now = new Date();

  // 1. Call summary onto the timeline
  if (on("summary")) {
    const body = [
      a.summary,
      a.keyPoints.length ? "\nKey points:\n" + a.keyPoints.map((p) => `• ${p}`).join("\n") : "",
      a.objections.length ? "\nObjections:\n" + a.objections.map((p) => `• ${p}`).join("\n") : "",
      a.budget ? `\nBudget: ${a.budget}` : "",
      a.timeline ? `\nTimeline: ${a.timeline}` : "",
      a.decisionMakers.length ? `\nDecision makers: ${a.decisionMakers.join(", ")}` : "",
      a.currentTools.length ? `\nCurrent tools: ${a.currentTools.join(", ")}` : "",
      a.nextSteps.length ? "\nNext steps:\n" + a.nextSteps.map((p) => `• ${p}`).join("\n") : "",
    ]
      .filter(Boolean)
      .join("\n");
    if (rec.activityId) {
      const act = await db.query.activities.findFirst({ where: eq(activities.id, rec.activityId) });
      await db
        .update(activities)
        .set({ body: [act?.body, "— AI call summary —\n" + body].filter(Boolean).join("\n\n"), recordingId })
        .where(eq(activities.id, rec.activityId));
    } else {
      const [act] = await db
        .insert(activities)
        .values({
          type: "call",
          contactId,
          companyId: contact.companyId,
          outcome: a.suggestedOutcome,
          subject: "Recorded call",
          body,
          durationSec: rec.durationSec,
          recordingId,
          occurredAt: rec.createdAt,
        })
        .returning({ id: activities.id });
      await db.update(recordings).set({ activityId: act.id }).where(eq(recordings.id, recordingId));
      await db.update(contacts).set({ lastContactedAt: rec.createdAt }).where(eq(contacts.id, contactId));
    }
  }

  // 2. Contact fields
  const patch: Partial<typeof contacts.$inferInsert> = { updatedAt: now };
  if (on("painPoints")) patch.painPoints = mergeLines(contact.painPoints, a.painPoints);
  if (on("personalNotes")) patch.notes = mergeLines(contact.notes, a.personalNotes);
  const u = a.contactUpdates;
  if (on("u_title") && u.title) patch.title = u.title;
  if (on("u_email") && u.email) patch.email = u.email;
  if (on("u_phone") && u.phone) patch.phone = u.phone;
  if (on("u_location") && u.location) patch.location = u.location;
  if (on("u_companyName") && u.companyName) patch.companyId = await findOrCreateCompany(u.companyName);
  if (on("status")) patch.status = a.suggestedStatus;
  await db.update(contacts).set(patch).where(eq(contacts.id, contactId));

  const companyId = patch.companyId ?? contact.companyId;
  if (companyId) {
    const coPatch: Partial<typeof companies.$inferInsert> = {};
    if (on("u_companyIndustry") && u.companyIndustry) coPatch.industry = u.companyIndustry;
    if (on("u_companySize") && u.companySize) coPatch.size = u.companySize;
    if (on("currentTools") && a.currentTools.length) {
      const co = await db.query.companies.findFirst({ where: eq(companies.id, companyId) });
      const existing = (co?.techStack ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      const merged = [...existing];
      for (const t of a.currentTools) if (!merged.some((m) => m.toLowerCase() === t.toLowerCase())) merged.push(t);
      coPatch.techStack = merged.join(", ");
    }
    if (Object.keys(coPatch).length) await db.update(companies).set(coPatch).where(eq(companies.id, companyId));
  }

  // 3. Deal
  if (on("deal") && a.suggestedDealStage) {
    const open = await db.query.deals.findFirst({
      where: and(eq(deals.contactId, contactId), sql`${deals.stage} not in ('won','lost')`),
    });
    if (open) {
      await db
        .update(deals)
        .set({ stage: a.suggestedDealStage, value: open.value ?? a.suggestedDealValue, updatedAt: now })
        .where(eq(deals.id, open.id));
    } else {
      let name = fullName(contact);
      if (companyId) {
        const co = await db.query.companies.findFirst({ where: eq(companies.id, companyId) });
        if (co) name = co.name;
      }
      await db.insert(deals).values({
        name,
        contactId,
        companyId,
        stage: a.suggestedDealStage,
        value: a.suggestedDealValue,
      });
    }
  }

  // 4. Follow-up task
  if (on("followUp") && a.followUpInDays != null) {
    const due = addDays(now, Math.max(0, a.followUpInDays));
    due.setHours(9, 0, 0, 0);
    await db.insert(tasks).values({
      title: `Follow up with ${fullName(contact)}`,
      type: "call",
      contactId,
      dueAt: due,
      notes: a.nextSteps.join("\n") || null,
    });
    await db.update(contacts).set({ nextFollowUpAt: due }).where(eq(contacts.id, contactId));
  }

  await db.update(recordings).set({ analysisAppliedAt: now }).where(eq(recordings.id, recordingId));
  revalidatePath("/", "layout");
}

export async function linkRecording(recordingId: number, contactId: number | null) {
  await db.update(recordings).set({ contactId }).where(eq(recordings.id, recordingId));
  revalidatePath("/", "layout");
}

export async function deleteRecording(recordingId: number) {
  const rec = await db.query.recordings.findFirst({ where: eq(recordings.id, recordingId) });
  if (!rec) return;
  if (rec.filePath) {
    await fs.rm(rec.filePath, { force: true });
    await fs.rm(rec.filePath + ".pcm", { force: true });
  }
  await db.update(activities).set({ recordingId: null }).where(eq(activities.recordingId, recordingId));
  await db.delete(recordings).where(eq(recordings.id, recordingId));
  revalidatePath("/", "layout");
}
