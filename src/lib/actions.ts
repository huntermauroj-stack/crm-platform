"use server";

import { and, eq, inArray, isNull, max, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  activities,
  CALL_OUTCOMES,
  companies,
  contacts,
  CONTACT_STATUSES,
  DEAL_STAGES,
  deals,
  listMembers,
  lists,
  tasks,
  type CallOutcome,
  type ContactStatus,
  type DealStage,
} from "@/db/schema";
import { addDays, fullName, parseDateInput } from "./format";
import { OUTCOME_FOLLOW_UP_DAYS, OUTCOME_LABELS } from "./labels";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

function num(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (v == null) return null;
  const n = Number(v.replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function refresh() {
  revalidatePath("/", "layout");
}

/** Find a company by name (case-insensitive) or create it. */
export async function findOrCreateCompany(name: string | null): Promise<number | null> {
  if (!name) return null;
  const existing = await db
    .select({ id: companies.id })
    .from(companies)
    .where(sql`lower(${companies.name}) = lower(${name})`)
    .limit(1);
  if (existing[0]) return existing[0].id;
  const [row] = await db.insert(companies).values({ name }).returning({ id: companies.id });
  return row.id;
}

// ---------- Contacts ----------

function contactFields(fd: FormData) {
  const status = str(fd, "status") as ContactStatus | null;
  return {
    firstName: str(fd, "firstName") ?? "Unknown",
    lastName: str(fd, "lastName"),
    title: str(fd, "title"),
    email: str(fd, "email"),
    phone: str(fd, "phone"),
    mobile: str(fd, "mobile"),
    linkedinUrl: str(fd, "linkedinUrl"),
    location: str(fd, "location"),
    source: str(fd, "source"),
    tags: str(fd, "tags"),
    painPoints: str(fd, "painPoints"),
    notes: str(fd, "notes"),
    status: status && CONTACT_STATUSES.includes(status) ? status : "prospect",
  };
}

export async function createContact(fd: FormData) {
  const companyId = await findOrCreateCompany(str(fd, "companyName"));
  const [row] = await db
    .insert(contacts)
    .values({ ...contactFields(fd), companyId })
    .returning({ id: contacts.id });
  const listId = num(fd, "listId");
  if (listId) await addContactsToList(listId, [row.id]);
  refresh();
  redirect(`/contacts/${row.id}`);
}

export async function updateContact(id: number, fd: FormData) {
  const companyId = await findOrCreateCompany(str(fd, "companyName"));
  await db
    .update(contacts)
    .set({ ...contactFields(fd), companyId, nextFollowUpAt: parseDateInput(fd.get("nextFollowUpAt")), updatedAt: new Date() })
    .where(eq(contacts.id, id));
  refresh();
}

export async function setContactStatus(id: number, status: ContactStatus) {
  await db.update(contacts).set({ status, updatedAt: new Date() }).where(eq(contacts.id, id));
  refresh();
}

export async function deleteContact(id: number) {
  await db.delete(contacts).where(eq(contacts.id, id));
  refresh();
  redirect("/contacts");
}

// ---------- Companies ----------

function companyFields(fd: FormData) {
  return {
    name: str(fd, "name") ?? "Untitled company",
    domain: str(fd, "domain"),
    industry: str(fd, "industry"),
    size: str(fd, "size"),
    location: str(fd, "location"),
    phone: str(fd, "phone"),
    linkedinUrl: str(fd, "linkedinUrl"),
    description: str(fd, "description"),
    techStack: str(fd, "techStack"),
    notes: str(fd, "notes"),
  };
}

export async function createCompany(fd: FormData) {
  const [row] = await db.insert(companies).values(companyFields(fd)).returning({ id: companies.id });
  refresh();
  redirect(`/companies/${row.id}`);
}

export async function updateCompany(id: number, fd: FormData) {
  await db.update(companies).set({ ...companyFields(fd), updatedAt: new Date() }).where(eq(companies.id, id));
  refresh();
}

export async function deleteCompany(id: number) {
  await db.delete(companies).where(eq(companies.id, id));
  refresh();
  redirect("/companies");
}

// ---------- Deals ----------

export async function createDeal(fd: FormData) {
  const stage = (str(fd, "stage") as DealStage) ?? "new_lead";
  const contactId = num(fd, "contactId");
  let companyId = num(fd, "companyId");
  if (!companyId && contactId) {
    const c = await db.query.contacts.findFirst({ where: eq(contacts.id, contactId) });
    companyId = c?.companyId ?? null;
  }
  await db.insert(deals).values({
    name: str(fd, "name") ?? "New deal",
    stage: DEAL_STAGES.includes(stage) ? stage : "new_lead",
    value: num(fd, "value"),
    billing: (str(fd, "billing") as "one_time" | "monthly" | "annual") ?? "one_time",
    service: str(fd, "service"),
    contactId,
    companyId,
    expectedCloseAt: parseDateInput(fd.get("expectedCloseAt")),
    notes: str(fd, "notes"),
  });
  if (contactId) await bumpStatusForStage(contactId, stage);
  refresh();
}

export async function updateDeal(id: number, fd: FormData) {
  const stage = str(fd, "stage") as DealStage;
  await db
    .update(deals)
    .set({
      name: str(fd, "name") ?? "Deal",
      stage: DEAL_STAGES.includes(stage) ? stage : "new_lead",
      value: num(fd, "value"),
      billing: (str(fd, "billing") as "one_time" | "monthly" | "annual") ?? "one_time",
      service: str(fd, "service"),
      expectedCloseAt: parseDateInput(fd.get("expectedCloseAt")),
      notes: str(fd, "notes"),
      updatedAt: new Date(),
    })
    .where(eq(deals.id, id));
  const d = await db.query.deals.findFirst({ where: eq(deals.id, id) });
  if (d?.contactId) await bumpStatusForStage(d.contactId, d.stage);
  refresh();
}

export async function moveDeal(id: number, stage: DealStage, beforeId: number | null) {
  if (!DEAL_STAGES.includes(stage)) return;
  const inStage = await db
    .select({ id: deals.id })
    .from(deals)
    .where(and(eq(deals.stage, stage), ne(deals.id, id)))
    .orderBy(deals.position, deals.id);
  const ids = inStage.map((d) => d.id);
  const idx = beforeId ? ids.indexOf(beforeId) : -1;
  ids.splice(idx === -1 ? ids.length : idx, 0, id);
  await db.transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx
        .update(deals)
        .set(ids[i] === id ? { stage, position: i, updatedAt: new Date() } : { position: i })
        .where(eq(deals.id, ids[i]));
    }
  });
  const d = await db.query.deals.findFirst({ where: eq(deals.id, id) });
  if (d?.contactId) await bumpStatusForStage(d.contactId, stage);
  refresh();
}

export async function deleteDeal(id: number) {
  await db.delete(deals).where(eq(deals.id, id));
  refresh();
}

const STATUS_RANK: Record<ContactStatus, number> = {
  do_not_contact: -1,
  prospect: 0,
  lead: 1,
  opportunity: 2,
  past_client: 2,
  client: 3,
};

async function bumpStatus(contactId: number, target: ContactStatus) {
  const c = await db.query.contacts.findFirst({ where: eq(contacts.id, contactId) });
  if (!c || c.status === "do_not_contact") return;
  if (STATUS_RANK[target] > STATUS_RANK[c.status]) {
    await db.update(contacts).set({ status: target, updatedAt: new Date() }).where(eq(contacts.id, contactId));
  }
}

async function bumpStatusForStage(contactId: number, stage: DealStage) {
  if (stage === "won") await bumpStatus(contactId, "client");
  else if (["discovery", "proposal", "negotiation"].includes(stage)) await bumpStatus(contactId, "opportunity");
  else if (stage !== "lost") await bumpStatus(contactId, "lead");
}

// ---------- Activities & calls ----------

export type LogCallInput = {
  contactId: number;
  outcome: CallOutcome;
  notes?: string | null;
  durationMin?: number | null;
  followUpAt?: string | null; // yyyy-mm-dd; "" = none; undefined = default for outcome
  listId?: number | null;
};

export async function logCall(input: LogCallInput) {
  const { contactId, outcome } = input;
  if (!CALL_OUTCOMES.includes(outcome)) throw new Error("Invalid outcome");
  const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, contactId) });
  if (!contact) throw new Error("Contact not found");
  const now = new Date();

  const [activity] = await db
    .insert(activities)
    .values({
      type: "call",
      contactId,
      companyId: contact.companyId,
      outcome,
      subject: OUTCOME_LABELS[outcome],
      body: input.notes?.trim() || null,
      durationSec: input.durationMin ? Math.round(input.durationMin * 60) : null,
      occurredAt: now,
    })
    .returning({ id: activities.id });

  // Close any open call tasks for this contact — this call handles them.
  await db
    .update(tasks)
    .set({ completedAt: now })
    .where(and(eq(tasks.contactId, contactId), eq(tasks.type, "call"), isNull(tasks.completedAt)));

  let followUp: Date | null = null;
  if (input.followUpAt === undefined) {
    const days = OUTCOME_FOLLOW_UP_DAYS[outcome];
    if (days != null) {
      followUp = addDays(now, days);
      followUp.setHours(9, 0, 0, 0);
    }
  } else if (input.followUpAt) {
    followUp = parseDateInput(input.followUpAt);
  }

  if (followUp) {
    await db.insert(tasks).values({
      title: `Follow up with ${fullName(contact)} (${OUTCOME_LABELS[outcome].toLowerCase()})`,
      type: "call",
      contactId,
      dueAt: followUp,
    });
  }

  const updates: Partial<typeof contacts.$inferInsert> = {
    lastContactedAt: now,
    nextFollowUpAt: followUp,
    updatedAt: now,
  };
  if (outcome === "wrong_number") updates.notes = [contact.notes, `Wrong number: ${contact.phone ?? ""}`].filter(Boolean).join("\n");
  await db.update(contacts).set(updates).where(eq(contacts.id, contactId));

  if (outcome === "connected" || outcome === "call_back") await bumpStatus(contactId, "lead");
  if (outcome === "meeting_booked") {
    await bumpStatus(contactId, "opportunity");
    const open = await db.query.deals.findFirst({
      where: and(eq(deals.contactId, contactId), sql`${deals.stage} not in ('won','lost')`),
    });
    if (open) {
      if (["new_lead", "contacted"].includes(open.stage))
        await db.update(deals).set({ stage: "discovery", updatedAt: now }).where(eq(deals.id, open.id));
    } else {
      let name = fullName(contact);
      if (contact.companyId) {
        const co = await db.query.companies.findFirst({ where: eq(companies.id, contact.companyId) });
        if (co) name = co.name;
      }
      await db.insert(deals).values({ name, contactId, companyId: contact.companyId, stage: "discovery" });
    }
  }
  if (outcome === "not_interested") {
    const open = await db.query.deals.findFirst({
      where: and(eq(deals.contactId, contactId), sql`${deals.stage} in ('new_lead','contacted')`),
    });
    if (open) await db.update(deals).set({ stage: "lost", updatedAt: now }).where(eq(deals.id, open.id));
  }

  if (input.listId) {
    // Every logged call takes the contact out of the current pass through the list.
    // "Re-queue unreached" on the list page brings back the ones worth another try.
    await db
      .update(listMembers)
      .set({
        lastOutcome: outcome,
        attempts: sql`${listMembers.attempts} + 1`,
        lastAttemptAt: now,
        done: true,
      })
      .where(and(eq(listMembers.listId, input.listId), eq(listMembers.contactId, contactId)));
  }

  refresh();
  return { activityId: activity.id };
}

export async function addActivity(fd: FormData) {
  const contactId = num(fd, "contactId");
  const companyId = num(fd, "companyId");
  const type = (str(fd, "type") ?? "note") as "note" | "email" | "meeting" | "sms" | "linkedin";
  const body = str(fd, "body");
  if (!body) return;
  let coId = companyId;
  if (contactId && !coId) {
    const c = await db.query.contacts.findFirst({ where: eq(contacts.id, contactId) });
    coId = c?.companyId ?? null;
  }
  await db.insert(activities).values({ type, contactId, companyId: coId, body, subject: str(fd, "subject") });
  if (contactId && type !== "note") {
    await db.update(contacts).set({ lastContactedAt: new Date() }).where(eq(contacts.id, contactId));
  }
  refresh();
}

export async function deleteActivity(id: number) {
  await db.delete(activities).where(eq(activities.id, id));
  refresh();
}

// ---------- Tasks ----------

export async function createTask(fd: FormData) {
  const title = str(fd, "title");
  if (!title) return;
  const contactId = num(fd, "contactId");
  const dueAt = parseDateInput(fd.get("dueAt"));
  await db.insert(tasks).values({
    title,
    type: (str(fd, "type") as "call" | "email" | "todo" | "meeting") ?? "todo",
    contactId,
    dueAt,
    notes: str(fd, "notes"),
  });
  if (contactId && dueAt) await db.update(contacts).set({ nextFollowUpAt: dueAt }).where(eq(contacts.id, contactId));
  refresh();
}

export async function toggleTask(id: number) {
  const t = await db.query.tasks.findFirst({ where: eq(tasks.id, id) });
  if (!t) return;
  await db.update(tasks).set({ completedAt: t.completedAt ? null : new Date() }).where(eq(tasks.id, id));
  refresh();
}

export async function snoozeTask(id: number, days: number) {
  const t = await db.query.tasks.findFirst({ where: eq(tasks.id, id) });
  if (!t) return;
  const due = addDays(new Date(), days);
  due.setHours(9, 0, 0, 0);
  await db.update(tasks).set({ dueAt: due }).where(eq(tasks.id, id));
  if (t.contactId) await db.update(contacts).set({ nextFollowUpAt: due }).where(eq(contacts.id, t.contactId));
  refresh();
}

export async function deleteTask(id: number) {
  await db.delete(tasks).where(eq(tasks.id, id));
  refresh();
}

// ---------- Lists ----------

export async function createList(fd: FormData) {
  const [row] = await db
    .insert(lists)
    .values({ name: str(fd, "name") ?? "New list", description: str(fd, "description"), callScript: str(fd, "callScript") })
    .returning({ id: lists.id });
  refresh();
  redirect(`/lists/${row.id}`);
}

export async function updateList(id: number, fd: FormData) {
  await db
    .update(lists)
    .set({ name: str(fd, "name") ?? "List", description: str(fd, "description"), callScript: str(fd, "callScript") })
    .where(eq(lists.id, id));
  refresh();
}

export async function deleteList(id: number) {
  await db.delete(lists).where(eq(lists.id, id));
  refresh();
  redirect("/lists");
}

export async function addContactsToList(listId: number, contactIds: number[]) {
  if (!contactIds.length) return 0;
  const [{ m }] = await db.select({ m: max(listMembers.position) }).from(listMembers).where(eq(listMembers.listId, listId));
  let pos = (m ?? 0) + 1;
  const existing = await db
    .select({ id: listMembers.contactId })
    .from(listMembers)
    .where(and(eq(listMembers.listId, listId), inArray(listMembers.contactId, contactIds)));
  const have = new Set(existing.map((e) => e.id));
  const toAdd = contactIds.filter((id) => !have.has(id));
  if (toAdd.length) {
    await db.insert(listMembers).values(toAdd.map((contactId) => ({ listId, contactId, position: pos++ })));
  }
  refresh();
  return toAdd.length;
}

export async function removeFromList(listId: number, contactId: number) {
  await db.delete(listMembers).where(and(eq(listMembers.listId, listId), eq(listMembers.contactId, contactId)));
  refresh();
}

/** Outcomes where it's worth calling again on the next pass. */
const RETRY_OUTCOMES = ["no_answer", "voicemail", "gatekeeper", "call_back"] as const;

/** Put contacts who weren't reached (or asked for a call back) back in the queue. */
export async function requeueUnreached(listId: number) {
  await db
    .update(listMembers)
    .set({ done: false })
    .where(
      and(
        eq(listMembers.listId, listId),
        or(isNull(listMembers.lastOutcome), inArray(listMembers.lastOutcome, [...RETRY_OUTCOMES])),
      ),
    );
  refresh();
}

/** Put every contact back in the queue. */
export async function resetList(listId: number) {
  await db.update(listMembers).set({ done: false }).where(eq(listMembers.listId, listId));
  refresh();
}

export async function skipListMember(listId: number, contactId: number) {
  const [{ m }] = await db.select({ m: max(listMembers.position) }).from(listMembers).where(eq(listMembers.listId, listId));
  await db
    .update(listMembers)
    .set({ position: (m ?? 0) + 1 })
    .where(and(eq(listMembers.listId, listId), eq(listMembers.contactId, contactId)));
  refresh();
}
