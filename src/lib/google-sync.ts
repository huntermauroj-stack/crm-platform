import "server-only";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { activities, contacts, tasks } from "@/db/schema";
import { readConfig, writeConfig } from "./config";
import { gfetch, googleAccount, googleClient } from "./google";

type GmailList = { messages?: { id: string }[]; nextPageToken?: string };
type GmailMessage = {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  payload?: { headers?: { name: string; value: string }[] };
};
type CalEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email?: string; self?: boolean }[];
  organizer?: { email?: string };
};

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
const MAX_MESSAGES = 400;

function addresses(v: string | undefined) {
  if (!v) return [];
  return [...v.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map((m) => m[0].toLowerCase());
}

async function contactEmailMap() {
  const rows = await db
    .select({ id: contacts.id, email: contacts.email, companyId: contacts.companyId, last: contacts.lastContactedAt })
    .from(contacts)
    .where(isNotNull(contacts.email));
  const map = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (r.email) map.set(r.email.trim().toLowerCase(), r);
  return map;
}

/** Gmail message ids already on a timeline (external ids look like "gmail:<messageId>:<contactId>"). */
async function syncedGmailIds() {
  const rows = await db.select({ e: activities.externalId }).from(activities).where(sql`${activities.externalId} like 'gmail:%'`);
  return new Set(rows.map((r) => r.e!.split(":")[1]));
}

async function touch(contactId: number, at: Date) {
  await db
    .update(contacts)
    .set({ lastContactedAt: at })
    .where(and(eq(contacts.id, contactId), sql`coalesce(${contacts.lastContactedAt}, 0) < ${Math.floor(at.getTime() / 1000)}`));
}

/** Pulls emails to and from your contacts into their timelines. */
async function syncGmail(sinceDays: number) {
  const map = await contactEmailMap();
  if (!map.size) return 0;
  const me = googleAccount()?.email?.toLowerCase();
  const emails = [...map.keys()];
  let added = 0;
  let fetched = 0;
  const seen = await syncedGmailIds();

  // Gmail search is limited in length, so ask about contacts in chunks.
  for (let i = 0; i < emails.length && fetched < MAX_MESSAGES; i += 20) {
    const chunk = emails.slice(i, i + 20);
    const q = `newer_than:${sinceDays}d {${chunk.map((e) => `from:${e} to:${e} cc:${e}`).join(" ")}}`;
    let pageToken: string | undefined;
    do {
      const p = new URLSearchParams({ q, maxResults: "100" });
      if (pageToken) p.set("pageToken", pageToken);
      const list = await gfetch<GmailList>(`${GMAIL}/messages?${p}`);
      pageToken = list.nextPageToken;
      const ids = (list.messages ?? []).map((m) => m.id);
      for (const id of ids) {
        if (seen.has(id) || fetched >= MAX_MESSAGES) continue;
        seen.add(id);
        fetched++;
        const m = await gfetch<GmailMessage>(
          `${GMAIL}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject`,
        );
        const h = Object.fromEntries((m.payload?.headers ?? []).map((x) => [x.name.toLowerCase(), x.value]));
        const from = addresses(h.from);
        const others = [...from, ...addresses(h.to), ...addresses(h.cc)].filter((a) => a !== me);
        const at = new Date(Number(m.internalDate ?? Date.now()));
        const outgoing = me ? from.includes(me) : false;
        for (const addr of new Set(others)) {
          const c = map.get(addr);
          if (!c) continue;
          const externalId = `gmail:${id}:${c.id}`;
          const res = await db
            .insert(activities)
            .values({
              type: "email",
              contactId: c.id,
              companyId: c.companyId,
              subject: `${outgoing ? "Sent" : "Received"}: ${h.subject || "(no subject)"}`,
              body: m.snippet ? decodeEntities(m.snippet) : null,
              occurredAt: at,
              externalId,
            })
            .onConflictDoNothing()
            .returning({ id: activities.id });
          if (res.length) {
            added++;
            await touch(c.id, at);
          }
        }
      }
    } while (pageToken && fetched < MAX_MESSAGES);
  }
  return added;
}

function decodeEntities(s: string) {
  return s
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Pulls calendar events with your contacts as guests: past ones onto the timeline, upcoming ones into Tasks. */
async function syncCalendar() {
  const map = await contactEmailMap();
  if (!map.size) return 0;
  const now = Date.now();
  const p = new URLSearchParams({
    timeMin: new Date(now - 60 * 86_400_000).toISOString(),
    timeMax: new Date(now + 90 * 86_400_000).toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const { items = [] } = await gfetch<{ items?: CalEvent[] }>(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${p}`);
  let added = 0;
  for (const ev of items) {
    if (ev.status === "cancelled") continue;
    const startStr = ev.start?.dateTime ?? ev.start?.date;
    if (!startStr) continue;
    const start = new Date(startStr);
    const guests = new Set([...(ev.attendees ?? []).filter((a) => !a.self).map((a) => a.email?.toLowerCase()), ev.organizer?.email?.toLowerCase()]);
    for (const g of guests) {
      const c = g ? map.get(g) : undefined;
      if (!c) continue;
      const title = ev.summary || "Meeting";
      const ext = `gcal:${ev.id}:${c.id}`;
      const res = await db
        .insert(activities)
        .values({
          type: "meeting",
          contactId: c.id,
          companyId: c.companyId,
          subject: `Calendar: ${title}`,
          body: [start.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }), ev.description?.slice(0, 1000)]
            .filter(Boolean)
            .join("\n\n"),
          occurredAt: start,
          externalId: ext,
        })
        .onConflictDoNothing()
        .returning({ id: activities.id });
      if (res.length) added++;
      if (start.getTime() > now) {
        await db
          .insert(tasks)
          .values({ title, type: "meeting", contactId: c.id, dueAt: start, notes: ev.htmlLink ?? null, externalId: ext })
          .onConflictDoNothing();
        await db
          .update(contacts)
          .set({ nextFollowUpAt: start })
          .where(and(eq(contacts.id, c.id), sql`(${contacts.nextFollowUpAt} is null or ${contacts.nextFollowUpAt} < ${Math.floor(now / 1000)})`));
      } else if (res.length) {
        await touch(c.id, start);
      }
    }
  }
  return added;
}

let running: Promise<{ emails: number; meetings: number }> | null = null;

export function googleReady() {
  return Boolean(googleClient() && googleAccount());
}

/** Runs one sync. Concurrent callers share the same run. */
export function syncGoogle(): Promise<{ emails: number; meetings: number }> {
  if (running) return running;
  running = (async () => {
    const last = readConfig().googleLastSync;
    // First sync looks back 90 days; later ones overlap the last run by a day.
    const sinceDays = last && !last.error ? Math.max(2, Math.ceil((Date.now() - last.at) / 86_400_000) + 1) : 90;
    try {
      const emails = await syncGmail(Math.min(sinceDays, 365));
      const meetings = await syncCalendar();
      writeConfig({ googleLastSync: { at: Date.now(), emails, meetings } });
      return { emails, meetings };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      writeConfig({ googleLastSync: { at: last?.at ?? 0, emails: 0, meetings: 0, error } });
      throw e;
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Background sync every 15 minutes while the app is open. */
export function startGoogleSyncTimer() {
  const g = globalThis as unknown as { __googleSyncTimer?: NodeJS.Timeout };
  if (g.__googleSyncTimer) return;
  const tick = () => {
    if (googleReady()) syncGoogle().catch(() => {});
  };
  setTimeout(tick, 20_000);
  g.__googleSyncTimer = setInterval(tick, 15 * 60_000);
}
