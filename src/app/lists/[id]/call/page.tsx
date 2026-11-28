import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import QRCode from "qrcode";
import { GoogleQuickActions } from "@/components/google-quick-actions";
import { googleReady } from "@/lib/google-sync";
import { db } from "@/db";
import { activities, companies, contacts, listMembers, lists, deals } from "@/db/schema";
import { Badge, Card, LinkButton, Empty } from "@/components/ui";
import { CallSession } from "@/components/call-session";
import { fullName, initials, relative, telHref, dateTime } from "@/lib/format";
import { OUTCOME_COLORS, OUTCOME_LABELS, STATUS_COLORS, STATUS_LABELS, STAGE_LABELS } from "@/lib/labels";
import { Avatar } from "@/components/ui";

export const metadata = { title: "Calling" };

export default async function CallPage({ params }: PageProps<"/lists/[id]/call">) {
  const listId = Number((await params).id);
  const list = await db.query.lists.findFirst({ where: eq(lists.id, listId) });
  if (!list) notFound();

  const [counts] = await db
    .select({
      total: sql<number>`count(*)`,
      done: sql<number>`coalesce(sum(case when ${listMembers.done} = 1 then 1 else 0 end),0)`,
    })
    .from(listMembers)
    .where(eq(listMembers.listId, listId));

  const [next] = await db
    .select({ m: listMembers, c: contacts })
    .from(listMembers)
    .innerJoin(contacts, eq(listMembers.contactId, contacts.id))
    .where(and(eq(listMembers.listId, listId), eq(listMembers.done, false)))
    .orderBy(listMembers.position)
    .limit(1);

  if (!next) {
    return (
      <div className="mx-auto max-w-2xl pt-16">
        <Card>
          <Empty title={`You've worked through "${list.name}" 🎉`}>
            <div className="mt-4 flex justify-center gap-2">
              <LinkButton href={`/lists/${listId}`}>Review results and re-queue unreached</LinkButton>
              <LinkButton href="/" variant="primary">
                Back to dashboard
              </LinkButton>
            </div>
          </Empty>
        </Card>
      </div>
    );
  }

  const c = next.c;
  const [company, history, openDeal] = await Promise.all([
    c.companyId ? db.query.companies.findFirst({ where: eq(companies.id, c.companyId) }) : null,
    db.select().from(activities).where(eq(activities.contactId, c.id)).orderBy(desc(activities.occurredAt)).limit(6),
    db.query.deals.findFirst({ where: and(eq(deals.contactId, c.id), sql`${deals.stage} not in ('won','lost')`) }),
  ]);
  const phone = c.mobile ?? c.phone ?? company?.phone ?? null;
  const qr = phone ? await QRCode.toString(telHref(phone), { type: "svg", margin: 1, color: { dark: "#e6e8ee", light: "#0000" } }) : null;
  const pct = counts.total ? Math.round((counts.done / counts.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <Link href={`/lists/${listId}`} className="text-xs text-zinc-500 hover:text-zinc-300">
            ← {list.name}
          </Link>
          <div className="mt-1 flex items-center gap-3">
            <div className="h-1.5 w-56 rounded-full bg-ink-800">
              <div className="h-1.5 rounded-full bg-gradient-to-r from-accent-500 to-fuchsia-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs tabular-nums text-zinc-400">
              {counts.done} / {counts.total} done
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="flex items-start gap-4">
                <Avatar text={initials(c)} className="size-14 text-lg" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/contacts/${c.id}`} className="text-2xl font-semibold tracking-tight text-white hover:text-accent-300">
                      {fullName(c)}
                    </Link>
                    <Badge className={STATUS_COLORS[c.status]}>{STATUS_LABELS[c.status]}</Badge>
                  </div>
                  <p className="text-sm text-zinc-400">
                    {[c.title, company?.name].filter(Boolean).join(" at ")}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {[company?.industry, company?.size && `${company.size} employees`, c.location ?? company?.location].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Attempt #{next.m.attempts + 1} · last contact {relative(c.lastContactedAt)}
                    {openDeal && ` · deal: ${STAGE_LABELS[openDeal.stage]}`}
                  </p>
                </div>
              </div>
              {phone ? (
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <a href={telHref(phone)} className="block text-2xl font-semibold tabular-nums tracking-tight text-emerald-300 hover:text-emerald-200">
                      {phone}
                    </a>
                    <span className="text-xs text-zinc-500">Scan to dial on your phone →</span>
                  </div>
                  {qr && <div className="size-24 rounded-lg bg-ink-850 p-1.5 ring-1 ring-ink-600" dangerouslySetInnerHTML={{ __html: qr }} />}
                </div>
              ) : (
                <div className="text-sm text-rose-300">No phone number on file</div>
              )}
            </div>
            {(c.painPoints || c.notes || company?.techStack) && (
              <div className="mt-4 grid gap-3 border-t border-ink-700 pt-4 text-sm sm:grid-cols-2">
                {c.painPoints && (
                  <div>
                    <div className="text-xs font-medium text-zinc-500">Pain points</div>
                    <p className="mt-0.5 whitespace-pre-wrap text-zinc-300">{c.painPoints}</p>
                  </div>
                )}
                {c.notes && (
                  <div>
                    <div className="text-xs font-medium text-zinc-500">Notes</div>
                    <p className="mt-0.5 whitespace-pre-wrap text-zinc-300">{c.notes}</p>
                  </div>
                )}
                {company?.techStack && (
                  <div>
                    <div className="text-xs font-medium text-zinc-500">Current tools</div>
                    <p className="mt-0.5 text-zinc-300">{company.techStack}</p>
                  </div>
                )}
              </div>
            )}
            <div className="mt-4 border-t border-ink-700 pt-4">
              <GoogleQuickActions
                key={c.id}
                compact
                contactId={c.id}
                firstName={c.firstName}
                fullName={fullName(c)}
                company={company?.name ?? null}
                email={c.email}
                phone={phone}
                notes={c.notes}
                googleConnected={googleReady()}
              />
            </div>
          </Card>

          <Card title="Log this call">
            <div className="p-4">
              <CallSession key={c.id} contactId={c.id} listId={listId} />
            </div>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card title="Call script">
            {list.callScript ? (
              <p className="whitespace-pre-wrap p-4 text-sm leading-relaxed text-zinc-300">
                {list.callScript
                  .replaceAll("{name}", c.firstName)
                  .replaceAll("{company}", company?.name ?? "your company")
                  .replaceAll("{title}", c.title ?? "")}
              </p>
            ) : (
              <Empty title="No script for this list">
                <Link href={`/lists/${listId}`} className="text-accent-300">Add talking points</Link> to keep them in view while you dial.
              </Empty>
            )}
          </Card>
          <Card title="History">
            {history.length ? (
              <ul className="divide-y divide-ink-700/60">
                {history.map((a) => (
                  <li key={a.id} className="px-4 py-2.5">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-zinc-300">{a.type}</span>
                      {a.outcome && <Badge className={OUTCOME_COLORS[a.outcome]}>{OUTCOME_LABELS[a.outcome]}</Badge>}
                      <span className="text-zinc-500">{dateTime(a.occurredAt)}</span>
                    </div>
                    {a.body && <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm text-zinc-400">{a.body}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty title="First touch" />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
