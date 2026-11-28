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

/** Fills {first}, {name}, {company} and {preview} in a template. */
export function fillTemplate(text: string, vars: { first: string; name: string; company: string; preview: string }) {
  return text
    .replaceAll("{first}", vars.first)
    .replaceAll("{name}", vars.name)
    .replaceAll("{company}", vars.company)
    .replaceAll("{preview}", vars.preview);
}

/** Pulls the first claude.ai or http(s) preview link out of a contact's notes, if any. */
export function findPreviewLink(notes: string | null | undefined) {
  if (!notes) return "";
  const line = notes.split("\n").find((l) => /preview site/i.test(l));
  const m = line?.match(/https?:\/\/\S+/);
  return m ? m[0] : "";
}

/** Merge values for one contact. Unknown names ("Owner") become "there". */
export function mergeVars(c: { firstName: string; lastName: string | null; notes: string | null }, company: string | null) {
  const unknown = !c.firstName || /^(owner|unknown)$/i.test(c.firstName);
  return {
    first: unknown ? "there" : c.firstName,
    name: unknown ? "there" : [c.firstName, c.lastName].filter(Boolean).join(" "),
    company: company ?? "your business",
    preview: findPreviewLink(c.notes),
  };
}
