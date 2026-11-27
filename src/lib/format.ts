export function fullName(c: { firstName: string; lastName: string | null }) {
  return [c.firstName, c.lastName].filter(Boolean).join(" ");
}

export function initials(c: { firstName: string; lastName: string | null }) {
  return ((c.firstName?.[0] ?? "") + (c.lastName?.[0] ?? "")).toUpperCase() || "?";
}

export function money(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function date(d: Date | null | undefined) {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function dateTime(d: Date | null | undefined) {
  if (!d) return "—";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function relative(d: Date | null | undefined) {
  if (!d) return "never";
  const diff = d.getTime() - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  const s = mins < 60 ? `${mins}m` : hours < 24 ? `${hours}h` : `${days}d`;
  if (mins < 1) return "just now";
  return diff < 0 ? `${s} ago` : `in ${s}`;
}

export function duration(sec: number | null | undefined) {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Digits-only phone for tel: links, keeping a leading +. */
export function telHref(phone: string) {
  const cleaned = phone.replace(/[^\d+]/g, "");
  return `tel:${cleaned}`;
}

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export function addDays(d: Date, days: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

/** Parse an <input type="date"> or datetime-local value into a Date (local time). */
export function parseDateInput(v: FormDataEntryValue | null): Date | null {
  if (!v || typeof v !== "string" || !v.trim()) return null;
  const s = v.length === 10 ? v + "T09:00" : v;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function toDateInput(d: Date | null | undefined) {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isPast(d: Date | null | undefined) {
  return !!d && d.getTime() < Date.now();
}

export function daysSince(d: Date | null | undefined) {
  return d ? (Date.now() - d.getTime()) / 86400000 : Infinity;
}
