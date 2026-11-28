import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { companies, contacts, problems, type Problem } from "@/db/schema";
import { Badge, Button, Card, Empty, Input, PageHeader, Stat, Textarea } from "@/components/ui";
import { Icon } from "@/components/icons";
import { AiActionButton } from "@/components/ai-action-button";
import { createListFromTheme, deleteProblem, renameTheme, runRecheck, runScanNotes, saveOffers, setProblemStatus } from "@/lib/problem-actions";
import { currentOffers } from "@/lib/config";
import { aiConfigured } from "@/lib/ai";
import { date, fullName } from "@/lib/format";
import { PROBLEM_STATUS_LABELS, SOLVABLE_COLORS, SOLVABLE_LABELS } from "@/lib/labels";

export const metadata = { title: "Opportunities" };

type Row = Problem & { firstName: string | null; lastName: string | null; companyName: string | null };
type Group = { theme: string; items: Row[]; people: number };

function group(rows: Row[]): Group[] {
  const map = new Map<string, Row[]>();
  for (const r of rows) map.set(r.theme, [...(map.get(r.theme) ?? []), r]);
  return [...map.entries()]
    .map(([theme, items]) => ({ theme, items, people: new Set(items.map((i) => i.contactId)).size }))
    .sort((a, b) => b.people - a.people || b.items.length - a.items.length);
}

function ThemeCard({ g, ready }: { g: Group; ready: boolean }) {
  const mix = { yes: 0, partially: 0, no: 0 };
  for (const i of g.items) mix[i.solvable]++;
  return (
    <Card className="overflow-hidden">
      <details open={ready}>
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-ink-850/60">
          <div className="min-w-0">
            <div className="text-sm font-medium text-white">{g.theme}</div>
            <div className="mt-0.5 text-xs text-zinc-500">
              {g.people} {g.people === 1 ? "person" : "people"}
              {" · "}
              {g.items
                .slice(0, 4)
                .map((i) => fullName({ firstName: i.firstName ?? "?", lastName: i.lastName }))
                .join(", ")}
              {g.items.length > 4 ? ` +${g.items.length - 4}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {(["yes", "partially", "no"] as const).map((k) =>
              mix[k] ? (
                <Badge key={k} className={SOLVABLE_COLORS[k]}>
                  {mix[k]} {SOLVABLE_LABELS[k].toLowerCase()}
                </Badge>
              ) : null,
            )}
            <span className="ml-2 text-2xl font-semibold tabular-nums text-white">{g.people}</span>
          </div>
        </summary>
        <div className="border-t border-ink-700">
          <ul className="divide-y divide-ink-700/60">
            {g.items.map((p) => (
              <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-zinc-200">
                    {p.contactId ? (
                      <Link href={`/contacts/${p.contactId}`} className="font-medium hover:text-accent-300">
                        {fullName({ firstName: p.firstName ?? "?", lastName: p.lastName })}
                      </Link>
                    ) : (
                      "Unlinked"
                    )}
                    {p.companyName && <span className="text-zinc-500"> · {p.companyName}</span>}
                    <span className="text-zinc-400">: {p.title}</span>
                  </div>
                  {p.detail && <p className="mt-0.5 text-xs text-zinc-400">{p.detail}</p>}
                  <p className="mt-0.5 text-xs text-zinc-500">
                    <Badge className={SOLVABLE_COLORS[p.solvable]}>{SOLVABLE_LABELS[p.solvable]}</Badge> {p.solvableNote}
                    {" · "}
                    {PROBLEM_STATUS_LABELS[p.status]} · from {p.source} · {date(p.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {p.status !== "pitched" && (
                    <form action={setProblemStatus.bind(null, p.id, "pitched")}>
                      <button className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-ink-700 hover:text-white">Pitched</button>
                    </form>
                  )}
                  <form action={setProblemStatus.bind(null, p.id, "solved")}>
                    <button className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-ink-700 hover:text-emerald-300">Solved</button>
                  </form>
                  <form action={setProblemStatus.bind(null, p.id, "not_a_fit")}>
                    <button className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-ink-700 hover:text-white">Not a fit</button>
                  </form>
                  <form action={deleteProblem.bind(null, p.id)}>
                    <button className="rounded-md p-1 text-zinc-600 hover:bg-ink-700 hover:text-rose-300" aria-label="Delete">
                      <Icon name="trash" className="size-3.5" />
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-700 bg-ink-850/40 px-4 py-3">
            <form action={renameTheme.bind(null, g.theme)} className="flex items-center gap-2">
              <Input name="theme" defaultValue={g.theme} className="!w-64 !py-1.5 text-xs" aria-label="Theme name" />
              <Button size="sm" variant="ghost">
                Rename / merge
              </Button>
            </form>
            <form action={createListFromTheme.bind(null, g.theme, ready)}>
              <Button size="sm" variant="primary">
                <Icon name="phone" className="size-3.5" /> Make call list ({g.people})
              </Button>
            </form>
          </div>
        </div>
      </details>
    </Card>
  );
}

export default async function OpportunitiesPage() {
  const rows: Row[] = await db
    .select({
      p: problems,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      companyName: companies.name,
    })
    .from(problems)
    .leftJoin(contacts, eq(problems.contactId, contacts.id))
    .leftJoin(companies, eq(problems.companyId, companies.id))
    .where(inArray(problems.status, ["open", "can_solve_now", "pitched"]))
    .orderBy(desc(problems.createdAt))
    .then((r) => r.map(({ p, ...rest }) => ({ ...p, ...rest })));

  const ready = group(rows.filter((r) => r.status === "can_solve_now"));
  const open = group(rows.filter((r) => r.status === "open"));
  const pitched = group(rows.filter((r) => r.status === "pitched"));
  const distinct = (list: Row[]) => new Set(list.filter((r) => r.contactId).map((r) => r.contactId)).size;
  const readyPeople = distinct(rows.filter((r) => r.status === "can_solve_now"));
  const people = distinct(rows.filter((r) => r.status !== "pitched"));
  const offers = currentOffers();
  const ai = aiConfigured();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Opportunities"
        subtitle="Problems your prospects told you about, grouped across everyone, so you can see what to build or offer next and who to call back."
        actions={
          ai ? (
            <>
              <AiActionButton action={runScanNotes} label="Scan call notes" icon="note" />
              <AiActionButton action={runRecheck} label="Re-check against my offers" icon="sparkles" primary />
            </>
          ) : (
            <Link href="/settings" className="text-sm text-accent-300">
              Add an API key to find problems automatically →
            </Link>
          )
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Ready to pitch" value={readyPeople} hint="People you can help now" />
        <Stat label="Unsolved themes" value={open.length} hint="Problems you can't solve yet" />
        <Stat label="Unsolved problems" value={rows.filter((r) => r.status === "open").length} hint="Across all prospects" />
        <Stat label="People tracked" value={people} hint="With a problem you could follow up on" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-300">
              <Icon name="target" className="size-4" /> Ready to pitch
            </h2>
            {ready.length ? (
              <div className="space-y-2">
                {ready.map((g) => (
                  <ThemeCard key={g.theme} g={g} ready />
                ))}
              </div>
            ) : (
              <Card>
                <Empty title="Nothing ready to pitch yet">
                  When you add a new offer, click <b>Re-check against my offers</b>. Problems you can now solve land here.
                </Empty>
              </Card>
            )}
          </section>

          <section>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-fuchsia-300">
              <Icon name="sparkles" className="size-4" /> Not solvable yet: future offers
            </h2>
            {open.length ? (
              <div className="space-y-2">
                {open.map((g) => (
                  <ThemeCard key={g.theme} g={g} ready={false} />
                ))}
              </div>
            ) : (
              <Card>
                <Empty title="No unsolved problems yet">
                  They&apos;re added when you apply a call recording&apos;s AI summary, scan your call notes, or add one on a contact&apos;s page.
                </Empty>
              </Card>
            )}
          </section>

          {pitched.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-zinc-400">Pitched</h2>
              <div className="space-y-2">
                {pitched.map((g) => (
                  <ThemeCard key={g.theme} g={g} ready={false} />
                ))}
              </div>
            </section>
          )}
        </div>

        <Card title="What you sell today" className="h-fit">
          <form action={saveOffers} className="space-y-3 p-4">
            <p className="text-xs text-zinc-400">
              One offer per line. Claude uses this list to decide which problems you can solve now. Update it whenever you add or drop a service, then
              re-check.
            </p>
            <Textarea
              name="offers"
              defaultValue={offers}
              className="min-h-48"
              placeholder={"AI receptionist (answers calls 24/7, books appointments)\nLead follow-up SMS/email automation\nCustom GPT for internal knowledge\nZapier/n8n workflow automation"}
            />
            <Button type="submit" variant="primary" className="w-full">
              Save offers
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
