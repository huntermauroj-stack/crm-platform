import "server-only";
import { asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { activities, emailTemplates } from "@/db/schema";
import { readConfig, writeConfig } from "./config";
import { DEFAULT_TEMPLATES } from "./email-presets";
import { mergeVars, missingFields } from "./google-links";

export type Template = { id: number; name: string; subject: string; body: string };

/** Your saved templates. The built-in ones are added once, the first time; after that the library is yours to edit. */
export async function listTemplates(): Promise<Template[]> {
  if (!readConfig().emailTemplatesSeeded) {
    const n = await db.select({ n: sql<number>`count(*)` }).from(emailTemplates);
    if (!n[0].n) await db.insert(emailTemplates).values(DEFAULT_TEMPLATES);
    writeConfig({ emailTemplatesSeeded: true });
  }
  return db
    .select({ id: emailTemplates.id, name: emailTemplates.name, subject: emailTemplates.subject, body: emailTemplates.body })
    .from(emailTemplates)
    .orderBy(asc(emailTemplates.id));
}

type R = { firstName: string; lastName: string | null; notes: string | null; company: string | null };

/** Picks the template that fits these recipients best: a preview-site or broken-website one if it works for most, else a plain one. */
export function bestTemplate(recipients: R[], templates: Template[]) {
  if (!templates.length) return undefined;
  const fits = (t: Template) => recipients.filter((r) => missingFields(t.subject + t.body, mergeVars(r, r.company)).length === 0).length;
  const specific = templates.filter((t) => /\{(preview|issue|website)\}/.test(t.subject + t.body));
  const scored = specific.map((t) => ({ t, n: fits(t) })).sort((a, b) => b.n - a.n);
  if (scored[0] && scored[0].n > 0 && scored[0].n * 2 >= recipients.length) return scored[0].t.id;
  const plain = templates.find((t) => !specific.includes(t) && !/follow/i.test(t.name)) ?? templates[0];
  return plain.id;
}

export const DEFAULT_DAILY_LIMIT = 150;

export function dailyLimit() {
  return readConfig().emailDailyLimit ?? DEFAULT_DAILY_LIMIT;
}

/** Emails Rapport sent through Gmail since local midnight (synced copies of the same message count once). */
export async function sentToday() {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const r = await db
    .select({ n: sql<number>`count(distinct substr(${activities.externalId}, 1, instr(substr(${activities.externalId}, 7), ':') + 5))` })
    .from(activities)
    .where(
      sql`${activities.type} = 'email' and ${activities.externalId} like 'gmail:%' and ${activities.subject} like 'Sent%' and ${activities.occurredAt} >= ${Math.floor(midnight.getTime() / 1000)}`,
    );
  return r[0].n;
}
