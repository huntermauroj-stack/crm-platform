"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { lists, problems, PROBLEM_STATUSES, SOLVABILITY, type ProblemStatus, type Solvability } from "@/db/schema";
import { addContactsToList } from "./actions";
import { writeConfig } from "./config";
import { aiConfigured } from "./ai";
import { recheckOpenProblems, saveProblems, scanCallNotes } from "./problems";

const refresh = () => revalidatePath("/", "layout");

export async function createProblem(fd: FormData) {
  const title = String(fd.get("title") ?? "").trim();
  if (!title) return;
  const theme = String(fd.get("theme") ?? "").trim() || title;
  const solvable = String(fd.get("solvable") ?? "no") as Solvability;
  await saveProblems(
    [
      {
        theme,
        title,
        detail: String(fd.get("detail") ?? "").trim() || null,
        solvable: SOLVABILITY.includes(solvable) ? solvable : "no",
        solvableNote: "",
      },
    ],
    { contactId: Number(fd.get("contactId")) || null, source: "manual" },
  );
  refresh();
}

export async function setProblemStatus(id: number, status: ProblemStatus) {
  if (!PROBLEM_STATUSES.includes(status)) return;
  await db.update(problems).set({ status }).where(eq(problems.id, id));
  refresh();
}

export async function deleteProblem(id: number) {
  await db.delete(problems).where(eq(problems.id, id));
  refresh();
}

export async function renameTheme(oldTheme: string, fd: FormData) {
  const next = String(fd.get("theme") ?? "").trim();
  if (!next || next === oldTheme) return;
  await db.update(problems).set({ theme: next }).where(eq(problems.theme, oldTheme));
  refresh();
}

export async function saveOffers(fd: FormData) {
  writeConfig({ offers: String(fd.get("offers") ?? "").trim() || undefined });
  refresh();
}

export async function runScanNotes(): Promise<string> {
  if (!aiConfigured()) return "Add your Anthropic API key in Settings first.";
  let scanned = 0;
  let found = 0;
  // Work through the backlog in batches.
  for (let i = 0; i < 8; i++) {
    const r = await scanCallNotes(25);
    scanned += r.scanned;
    found += r.found;
    if (r.scanned < 25) break;
  }
  refresh();
  return scanned ? `Scanned ${scanned} call note${scanned === 1 ? "" : "s"} and found ${found} new problem${found === 1 ? "" : "s"}.` : "No new call notes to scan.";
}

export async function runRecheck(): Promise<string> {
  if (!aiConfigured()) return "Add your Anthropic API key in Settings first.";
  const r = await recheckOpenProblems();
  refresh();
  if (!r.checked) return "There are no open problems to re-check.";
  return `Re-checked ${r.checked} open problem${r.checked === 1 ? "" : "s"}. ${r.nowSolvable} can be solved with your current offers.`;
}

/** Make a call list of everyone who has this problem (optionally only those ready to pitch). */
export async function createListFromTheme(theme: string, readyOnly: boolean) {
  const rows = await db
    .select({ contactId: problems.contactId })
    .from(problems)
    .where(
      and(
        eq(problems.theme, theme),
        readyOnly ? eq(problems.status, "can_solve_now") : inArray(problems.status, ["open", "can_solve_now"]),
      ),
    );
  const ids = [...new Set(rows.map((r) => r.contactId).filter((x): x is number => x != null))];
  const [list] = await db
    .insert(lists)
    .values({
      name: `${readyOnly ? "Pitch" : "Revisit"}: ${theme}`,
      description: `Prospects who mentioned "${theme}".`,
      callScript: `Hi {name}, it's Hunter. When we spoke before, you mentioned ${lowerFirst(theme)}. I now have a way to help with that and wanted to show you. Do you have a few minutes this week?`,
    })
    .returning({ id: lists.id });
  await addContactsToList(list.id, ids);
  refresh();
  redirect(`/lists/${list.id}`);
}

/** "Missed calls" -> "missed calls", but keeps names like "ServiceTitan" or "CRM" as typed. */
function lowerFirst(s: string) {
  const first = s.split(" ")[0] ?? "";
  return first.length > 1 && first.slice(1) !== first.slice(1).toLowerCase() ? s : s.charAt(0).toLowerCase() + s.slice(1);
}
