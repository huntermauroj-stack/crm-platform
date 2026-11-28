import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Per-contact email state, from the timeline: when you last emailed them, when they last emailed you.
 * "Sent" rows come from Rapport sends and Gmail sync; "Received" rows only from Gmail sync.
 */
const LAST = sql`
  select contact_id,
    max(case when subject like 'Sent%' then occurred_at end) as last_sent,
    max(case when subject like 'Received%' then occurred_at end) as last_received
  from activities where type = 'email' and contact_id is not null group by contact_id`;

/** Contacts you emailed at least `days` days ago who haven't written back since. */
export async function followUpIds(days = 3) {
  const cutoff = Math.floor(Date.now() / 1000) - days * 86_400;
  const r = await db.all<{ contact_id: number }>(sql`
    select l.contact_id from (${LAST}) l join contacts c on c.id = l.contact_id
    where l.last_sent is not null and l.last_sent <= ${cutoff}
      and (l.last_received is null or l.last_received < l.last_sent)
      and c.status != 'do_not_contact'
    order by l.last_sent desc limit 500`);
  return r.map((x) => x.contact_id);
}

/** Contacts whose latest email is from them, so the ball is in your court. */
export async function waitingOnYouIds() {
  const r = await db.all<{ contact_id: number }>(sql`
    select contact_id from (${LAST})
    where last_received is not null and (last_sent is null or last_sent < last_received)
    order by last_received desc limit 500`);
  return r.map((x) => x.contact_id);
}

export type CampaignStat = { id: number; name: string; subject: string; createdAt: number; sent: number; replied: number };

/** Each campaign with how many it reached and how many of those wrote back afterwards. */
export async function campaignStats(id?: number): Promise<CampaignStat[]> {
  return db.all<CampaignStat>(sql`
    select c.id, c.name, c.subject, c.created_at as createdAt,
      (select count(distinct a.contact_id) from activities a where a.campaign_id = c.id) as sent,
      (select count(distinct a.contact_id) from activities a
        where a.campaign_id = c.id and exists (
          select 1 from activities r where r.contact_id = a.contact_id and r.type = 'email'
            and r.subject like 'Received%' and r.occurred_at >= a.occurred_at)) as replied
    from email_campaigns c
    ${id ? sql`where c.id = ${id}` : sql``}
    order by c.created_at desc, c.id desc`);
}

export async function emailCounts() {
  const now = Math.floor(Date.now() / 1000);
  const week = now - 7 * 86_400;
  const [r] = await db.all<{ sentWeek: number; receivedWeek: number }>(sql`
    select
      count(distinct case when subject like 'Sent%' then coalesce(substr(external_id, 1, instr(substr(external_id, 7), ':') + 5), id) end) as sentWeek,
      count(distinct case when subject like 'Received%' then coalesce(substr(external_id, 1, instr(substr(external_id, 7), ':') + 5), id) end) as receivedWeek
    from activities where type = 'email' and occurred_at >= ${week}`);
  return r ?? { sentWeek: 0, receivedWeek: 0 };
}
