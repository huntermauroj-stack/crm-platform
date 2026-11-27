"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { activities, contacts, tasks } from "@/db/schema";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function loadContact(contactId: number) {
  const c = await db.query.contacts.findFirst({ where: eq(contacts.id, contactId) });
  if (!c) throw new Error("Contact not found");
  return c;
}

/** Saves a typed-in address on a contact that doesn't have one yet. */
async function rememberEmail(contactId: number, current: string | null, typed: string | null | undefined) {
  const email = typed?.trim();
  if (!current && email && EMAIL_RE.test(email)) {
    await db.update(contacts).set({ email, updatedAt: new Date() }).where(eq(contacts.id, contactId));
  }
}

/** Logs an email composed in Gmail on the contact's timeline. */
export async function logGmailEmail(input: { contactId: number; to?: string | null; subject: string; body: string }) {
  const c = await loadContact(input.contactId);
  const now = new Date();
  await db.insert(activities).values({
    type: "email",
    contactId: c.id,
    companyId: c.companyId,
    subject: input.subject.trim() || "Email",
    body: [input.to ? `To: ${input.to.trim()}` : null, input.body.trim() || null].filter(Boolean).join("\n\n") || null,
    occurredAt: now,
  });
  await db.update(contacts).set({ lastContactedAt: now, updatedAt: now }).where(eq(contacts.id, c.id));
  await rememberEmail(c.id, c.email, input.to);
  revalidatePath("/", "layout");
}

/** Logs a meeting created in Google Calendar and adds it to Tasks so it shows on the dashboard. */
export async function logCalendarMeeting(input: {
  contactId: number;
  title: string;
  startIso: string;
  durationMin: number;
  details?: string;
  guest?: string | null;
}) {
  const c = await loadContact(input.contactId);
  const start = new Date(input.startIso);
  if (Number.isNaN(start.getTime())) throw new Error("Invalid meeting time");
  const title = input.title.trim() || "Meeting";
  const when = start.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  await db.insert(activities).values({
    type: "meeting",
    contactId: c.id,
    companyId: c.companyId,
    subject: `Meeting booked: ${title}`,
    body: [`${when} (${input.durationMin} min)`, input.details?.trim() || null].filter(Boolean).join("\n\n"),
  });
  await db.insert(tasks).values({
    title,
    type: "meeting",
    contactId: c.id,
    dueAt: start,
    notes: input.details?.trim() || null,
  });
  const now = new Date();
  await db.update(contacts).set({ nextFollowUpAt: start, lastContactedAt: now, updatedAt: now }).where(eq(contacts.id, c.id));
  await rememberEmail(c.id, c.email, input.guest);
  revalidatePath("/", "layout");
}
