// Prefilled Gmail and Google Calendar links. These open in your browser, signed in as you;
// nothing is sent to Google by Rapport itself.

export function gmailComposeUrl({ to, subject, body }: { to?: string | null; subject?: string; body?: string }) {
  const p = new URLSearchParams({ view: "cm", fs: "1" });
  if (to) p.set("to", to);
  if (subject) p.set("su", subject);
  if (body) p.set("body", body);
  return `https://mail.google.com/mail/?${qs(p)}`;
}

/** Like URLSearchParams, but spaces become %20 (not "+"), which every Google page reads correctly. */
function qs(p: URLSearchParams) {
  return p.toString().replace(/\+/g, "%20");
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Local wall-clock time as Google Calendar's yyyymmddThhmmss (paired with ctz). */
function calStamp(d: Date) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

export function calendarEventUrl({
  title,
  start,
  durationMin,
  details,
  location,
  guests,
  timeZone,
}: {
  title: string;
  start: Date;
  durationMin: number;
  details?: string;
  location?: string;
  guests?: string[];
  timeZone?: string;
}) {
  const end = new Date(start.getTime() + durationMin * 60_000);
  const p = new URLSearchParams({ action: "TEMPLATE", text: title, dates: `${calStamp(start)}/${calStamp(end)}` });
  if (timeZone) p.set("ctz", timeZone);
  if (details) p.set("details", details);
  if (location) p.set("location", location);
  const g = (guests ?? []).map((x) => x.trim()).filter(Boolean);
  if (g.length) p.set("add", g.join(","));
  return `https://calendar.google.com/calendar/render?${qs(p)}`;
}

export type MergeVars = { first: string; name: string; company: string; preview: string; website: string; issue: string };

export const MERGE_FIELDS = ["first", "name", "company", "preview", "website", "issue"] as const;

/** Fills {first}, {name}, {company}, {preview}, {website} and {issue} in a template. */
export function fillTemplate(text: string, vars: Partial<MergeVars> & { first: string; name: string; company: string; preview: string }) {
  let out = text;
  for (const k of MERGE_FIELDS) out = out.replaceAll(`{${k}}`, vars[k] ?? "");
  return out;
}

/** Merge fields a template uses that this contact has no value for (e.g. no preview link in their notes). */
export function missingFields(text: string, vars: MergeVars) {
  return (["preview", "website", "issue"] as const).filter((k) => text.includes(`{${k}}`) && !vars[k]);
}

/** Pulls the first claude.ai or http(s) preview link out of a contact's notes, if any. */
export function findPreviewLink(notes: string | null | undefined) {
  if (!notes) return "";
  const line = notes.split("\n").find((l) => /preview site/i.test(l));
  const m = line?.match(/https?:\/\/\S+/);
  return m ? m[0] : "";
}

/** The site listed in a contact's notes ("Current website: ..."), if any. */
export function findWebsite(notes: string | null | undefined) {
  const m = notes?.match(/^Current website:\s*(\S+)/im);
  return m ? m[1] : "";
}

/** What's wrong with their current site, from "Lead type: Broken website (Website does not load ...)". */
export function findWebsiteIssue(notes: string | null | undefined) {
  const line = notes?.split("\n").find((l) => /^Lead type:\s*(broken|outdated|free\/basic)/i.test(l));
  if (!line) return "";
  const open = line.indexOf("(");
  if (open < 0 || !line.trimEnd().endsWith(")")) return "";
  const issue = line.slice(open + 1, line.trimEnd().length - 1).trim();
  return issue ? issue.charAt(0).toLowerCase() + issue.slice(1) : "";
}

/** Merge values for one contact. Unknown names ("Owner") become "there". */
export function mergeVars(c: { firstName: string; lastName: string | null; notes: string | null }, company: string | null): MergeVars {
  const unknown = !c.firstName || /^(owner|unknown)$/i.test(c.firstName);
  return {
    first: unknown ? "there" : c.firstName,
    name: unknown ? "there" : [c.firstName, c.lastName].filter(Boolean).join(" "),
    company: company ?? "your business",
    preview: findPreviewLink(c.notes),
    website: findWebsite(c.notes),
    issue: findWebsiteIssue(c.notes),
  };
}
