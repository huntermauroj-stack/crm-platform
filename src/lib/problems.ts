import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { activities, contacts, problems, SOLVABILITY } from "@/db/schema";
import { ProblemSchema, type ExtractedProblem } from "./analysis-schema";
import { currentOffers } from "./config";
import { ANALYSIS_MODEL, anthropic } from "./ai";
import { fullName } from "./format";

export async function existingThemes(limit = 80): Promise<string[]> {
  const rows = await db
    .select({ theme: problems.theme, n: sql<number>`count(*)` })
    .from(problems)
    .groupBy(problems.theme)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
  return rows.map((r) => r.theme);
}

/** Text block describing the user's offers and known themes, shared by every prompt that classifies problems. */
export async function problemContext(): Promise<string> {
  const offers = currentOffers();
  const themes = await existingThemes();
  return [
    `<current_offers>\n${offers || "(Not listed yet. Judge solvability against typical AI automation and AI agent services: chat/voice agents, workflow automation, lead follow-up, data entry, reporting.)"}\n</current_offers>`,
    themes.length ? `<existing_themes>\n${themes.join("\n")}\n</existing_themes>` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function saveProblems(
  list: ExtractedProblem[],
  ctx: { contactId: number | null; activityId?: number | null; recordingId?: number | null; source: "recording" | "notes" | "manual" },
) {
  if (!list.length) return 0;
  let companyId: number | null = null;
  if (ctx.contactId) {
    const c = await db.query.contacts.findFirst({ where: eq(contacts.id, ctx.contactId), columns: { companyId: true } });
    companyId = c?.companyId ?? null;
  }
  // Skip problems this contact already has under the same theme.
  const have = ctx.contactId
    ? new Set(
        (await db.select({ theme: problems.theme }).from(problems).where(eq(problems.contactId, ctx.contactId))).map((r) => r.theme.toLowerCase()),
      )
    : new Set<string>();
  const fresh = list.filter((p) => !have.has(p.theme.trim().toLowerCase()));
  if (!fresh.length) return 0;
  const now = new Date();
  await db.insert(problems).values(
    fresh.map((p) => ({
      contactId: ctx.contactId,
      companyId,
      activityId: ctx.activityId ?? null,
      recordingId: ctx.recordingId ?? null,
      theme: p.theme.trim(),
      title: p.title.trim(),
      detail: p.detail,
      solvable: p.solvable,
      solvableNote: p.solvableNote,
      status: p.solvable === "yes" ? ("can_solve_now" as const) : ("open" as const),
      source: ctx.source,
      checkedAt: now,
    })),
  );
  return fresh.length;
}

const NotesExtraction = z.object({ problems: z.array(ProblemSchema) });

const EXTRACT_SYSTEM = `You read a salesperson's call notes and list the business problems the prospect has. The salesperson runs an AI services business.
Include problems they can't solve today; those are the most valuable to track. Only include problems actually indicated by the notes. Return an empty list if the notes contain none (for example "no answer" or "left voicemail").
Reuse a theme from <existing_themes> whenever one fits, so the same problem groups together across prospects.`;

/** Scan typed call notes that haven't been scanned yet. Returns how many problems were found. */
export async function scanCallNotes(limit = 25): Promise<{ scanned: number; found: number }> {
  const rows = await db
    .select({ id: activities.id, body: activities.body, contactId: activities.contactId, recordingId: activities.recordingId })
    .from(activities)
    .where(and(isNull(activities.problemsScannedAt), inArray(activities.type, ["call", "meeting", "note"]), sql`length(coalesce(${activities.body}, '')) >= 40`))
    .orderBy(desc(activities.occurredAt))
    .limit(limit);
  let found = 0;
  const ctx = await problemContext();
  for (const a of rows) {
    // Calls with a recording are covered by the recording analysis.
    if (!a.recordingId) {
      let who = "";
      if (a.contactId) {
        const c = await db.query.contacts.findFirst({ where: eq(contacts.id, a.contactId) });
        if (c) who = `${fullName(c)}${c.title ? `, ${c.title}` : ""}`;
      }
      const res = await anthropic().beta.messages.parse({
        model: ANALYSIS_MODEL,
        max_tokens: 8000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: EXTRACT_SYSTEM,
        output_config: { effort: "low", format: betaZodOutputFormat(NotesExtraction) },
        messages: [{ role: "user", content: `${ctx}\n\n<prospect>${who || "Unknown"}</prospect>\n\n<call_notes>\n${a.body}\n</call_notes>` }],
      });
      if (res.parsed_output) found += await saveProblems(res.parsed_output.problems, { contactId: a.contactId, activityId: a.id, source: "notes" });
    }
    await db.update(activities).set({ problemsScannedAt: new Date() }).where(eq(activities.id, a.id));
  }
  return { scanned: rows.length, found };
}

const Recheck = z.object({
  results: z.array(
    z.object({
      id: z.number().int(),
      solvable: z.enum(SOLVABILITY),
      solvableNote: z.string(),
    }),
  ),
});

/** Re-judge open problems against the current offers. Returns how many became solvable. */
export async function recheckOpenProblems(): Promise<{ checked: number; nowSolvable: number }> {
  const open = await db
    .select({ id: problems.id, theme: problems.theme, title: problems.title, detail: problems.detail, solvable: problems.solvable })
    .from(problems)
    .where(eq(problems.status, "open"))
    .limit(300);
  if (!open.length) return { checked: 0, nowSolvable: 0 };
  const offers = currentOffers();
  let nowSolvable = 0;
  for (let i = 0; i < open.length; i += 60) {
    const batch = open.slice(i, i + 60);
    const res = await anthropic().beta.messages.parse({
      model: ANALYSIS_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system:
        "For each prospect problem, decide whether the salesperson can solve it with the offers they sell today (yes, partially, or no). Return one result per problem id, with a one-sentence note naming the offer that covers it or what is missing.",
      output_config: { effort: "medium", format: betaZodOutputFormat(Recheck) },
      messages: [
        {
          role: "user",
          content: `<current_offers>\n${offers || "(none listed)"}\n</current_offers>\n\n<problems>\n${batch
            .map((p) => `id ${p.id}: [${p.theme}] ${p.title}${p.detail ? ` (${p.detail})` : ""}`)
            .join("\n")}\n</problems>`,
        },
      ],
    });
    const now = new Date();
    for (const r of res.parsed_output?.results ?? []) {
      const before = batch.find((b) => b.id === r.id);
      if (!before) continue;
      const becomes = r.solvable === "yes";
      if (becomes) nowSolvable++;
      await db
        .update(problems)
        .set({ solvable: r.solvable, solvableNote: r.solvableNote, checkedAt: now, ...(becomes ? { status: "can_solve_now" as const } : {}) })
        .where(eq(problems.id, r.id));
    }
  }
  return { checked: open.length, nowSolvable };
}
