import "server-only";
import { and, asc, desc, eq, gt, isNotNull, isNull, lte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { contacts, tasks } from "@/db/schema";
import { endOfToday } from "./format";
import type { TaskWithContact } from "@/components/task-row";

const sel = {
  id: tasks.id,
  title: tasks.title,
  type: tasks.type,
  dueAt: tasks.dueAt,
  completedAt: tasks.completedAt,
  notes: tasks.notes,
  contactId: tasks.contactId,
  contactFirst: contacts.firstName,
  contactLast: contacts.lastName,
  contactPhone: contacts.phone,
  contactMobile: contacts.mobile,
};

async function run(where: SQL | undefined, order: "asc" | "desc" = "asc", limit = 200): Promise<TaskWithContact[]> {
  const rows = await db
    .select(sel)
    .from(tasks)
    .leftJoin(contacts, eq(tasks.contactId, contacts.id))
    .where(where)
    .orderBy(order === "asc" ? asc(tasks.dueAt) : desc(tasks.completedAt))
    .limit(limit);
  return rows.map((r) => ({
    ...r,
    contactName: r.contactFirst ? [r.contactFirst, r.contactLast].filter(Boolean).join(" ") : null,
    contactPhone: r.contactMobile ?? r.contactPhone,
  }));
}

export const dueTasks = () => run(and(isNull(tasks.completedAt), lte(tasks.dueAt, endOfToday())));
export const upcomingTasks = () => run(and(isNull(tasks.completedAt), gt(tasks.dueAt, endOfToday())));
export const undatedTasks = () => run(and(isNull(tasks.completedAt), isNull(tasks.dueAt)));
export const doneTasks = () => run(isNotNull(tasks.completedAt), "desc", 50);
export const contactTasks = (contactId: number) => run(eq(tasks.contactId, contactId));
