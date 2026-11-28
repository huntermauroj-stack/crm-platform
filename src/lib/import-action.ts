"use server";

import { or, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { companies, contacts, CONTACT_STATUSES, type ContactStatus } from "@/db/schema";
import { addContactsToList } from "./actions";
import type { ImportField, ImportRow } from "./import-fields";

export type ImportResult = { created: number; updated: number; skipped: number; addedToList: number };

export async function importContacts(
  rows: ImportRow[],
  opts: { source?: string; listId?: number | null; defaultStatus?: ContactStatus; updateExisting?: boolean },
): Promise<ImportResult> {
  const companyCache = new Map<string, number>();
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, addedToList: 0 };
  const ids: number[] = [];

  for (const raw of rows) {
    const r: ImportRow = {};
    for (const [k, v] of Object.entries(raw)) if (typeof v === "string" && v.trim()) r[k as ImportField] = v.trim();

    let first = r.firstName ?? null;
    let last = r.lastName ?? null;
    if (!first && r.fullName) {
      const parts = r.fullName.split(/\s+/);
      first = parts.shift() ?? null;
      last = parts.join(" ") || null;
    }
    if (!first && !r.email && !r.phone) {
      result.skipped++;
      continue;
    }

    let companyId: number | null = null;
    if (r.companyName) {
      const key = r.companyName.toLowerCase();
      companyId = companyCache.get(key) ?? null;
      if (!companyId) {
        const found = await db
          .select({ id: companies.id })
          .from(companies)
          .where(sql`lower(${companies.name}) = ${key}`)
          .limit(1);
        if (found[0]) companyId = found[0].id;
        else {
          const [c] = await db
            .insert(companies)
            .values({
              name: r.companyName,
              domain: r.companyDomain ?? null,
              industry: r.companyIndustry ?? null,
              size: r.companySize ?? null,
            })
            .returning({ id: companies.id });
          companyId = c.id;
        }
        companyCache.set(key, companyId);
      }
    }

    const statusRaw = r.status?.toLowerCase().replace(/\s+/g, "_") as ContactStatus | undefined;
    const status = statusRaw && CONTACT_STATUSES.includes(statusRaw) ? statusRaw : (opts.defaultStatus ?? "prospect");

    const values = {
      firstName: first ?? r.email?.split("@")[0] ?? "Unknown",
      lastName: last,
      title: r.title ?? null,
      email: r.email ?? null,
      phone: r.phone ?? null,
      mobile: r.mobile ?? null,
      linkedinUrl: r.linkedinUrl ?? null,
      location: r.location ?? null,
      tags: r.tags ?? null,
      notes: r.notes ?? null,
      companyId,
      status,
      source: opts.source ?? "CSV import",
    };

    const dupeConds = [];
    if (values.email) dupeConds.push(eq(contacts.email, values.email));
    if (values.linkedinUrl) dupeConds.push(eq(contacts.linkedinUrl, values.linkedinUrl));
    const existing = dupeConds.length
      ? await db.select({ id: contacts.id }).from(contacts).where(or(...dupeConds)).limit(1)
      : [];

    if (existing[0]) {
      if (opts.updateExisting) {
        const patch = Object.fromEntries(Object.entries(values).filter(([k, v]) => v != null && k !== "status" && k !== "source"));
        await db.update(contacts).set({ ...patch, updatedAt: new Date() }).where(eq(contacts.id, existing[0].id));
        result.updated++;
      } else result.skipped++;
      ids.push(existing[0].id);
      continue;
    }

    const [c] = await db.insert(contacts).values(values).returning({ id: contacts.id });
    ids.push(c.id);
    result.created++;
  }

  if (opts.listId && ids.length) result.addedToList = await addContactsToList(opts.listId, ids);
  revalidatePath("/", "layout");
  return result;
}
