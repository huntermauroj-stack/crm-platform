"use client";

import { useMemo, useState, useTransition } from "react";
import { calendarEventUrl, fillTemplate, findPreviewLink, gmailComposeUrl } from "@/lib/google-links";
import { logCalendarMeeting, logGmailEmail } from "@/lib/google-actions";
import { addDays, toDateInput } from "@/lib/format";
import { Button, Field, Input, Select, Textarea, cx } from "./ui";
import { Icon } from "./icons";

type Template = { id: string; label: string; subject: string; body: string; needsPreview?: boolean };

const TEMPLATES: Template[] = [
  { id: "blank", label: "Blank", subject: "", body: "Hi {first},\n\n\n\nThanks,\nHunter\nMauro Web & AI" },
  {
    id: "preview",
    label: "Free preview site",
    needsPreview: true,
    subject: "I built a free website preview for {company}",
    body:
      "Hi {first},\n\nMy name is Hunter, and I run Mauro Web & AI here in the Charlotte area. I came across {company} on Google and your reviews are excellent, but I couldn't find a website for you.\n\nSo I went ahead and built you a free preview, using your real services and a few of your customers' own reviews:\n\n{preview}\n\nNo cost and no obligation. If you like it, I can swap in your own job photos, connect a real domain and quote form, and have it live within a couple of weeks. If not, no hard feelings.\n\nWould you be open to a quick 10-minute call this week to take a look together?\n\nThanks,\nHunter\nMauro Web & AI",
  },
  {
    id: "after-call",
    label: "Follow-up after a call",
    subject: "Great talking with you, {first}",
    body:
      "Hi {first},\n\nThanks for taking my call today. As promised, here's a quick recap of how I can help {company} get more calls from people searching online:\n\n- \n\nLet me know a good time to talk next.\n\nThanks,\nHunter\nMauro Web & AI",
  },
  {
    id: "voicemail",
    label: "After a voicemail",
    subject: "Quick question about {company}'s website",
    body:
      "Hi {first},\n\nI just left you a voicemail. I help local trades businesses around Charlotte turn their great Google reviews into more booked jobs with a simple, professional website.\n\nWould you be open to a 10-minute call this week?\n\nThanks,\nHunter\nMauro Web & AI",
  },
];

function nextWeekday10am() {
  const d = addDays(new Date(), 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}

export function GoogleQuickActions({
  contactId,
  firstName,
  fullName,
  company,
  email,
  phone,
  notes,
  compact,
}: {
  contactId: number;
  firstName: string;
  fullName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  compact?: boolean;
}) {
  const [open, setOpen] = useState<"email" | "meeting" | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const toggle = (p: "email" | "meeting") => {
    setSaved(null);
    setOpen((o) => (o === p ? null : p));
  };
  const btnCls = "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-300 ring-1 ring-ink-600 hover:bg-ink-800";

  return (
    <div className={cx("w-full", compact ? "space-y-2" : "")}>
      <div className={cx("flex flex-wrap gap-2", !compact && "justify-end")}>
        <button type="button" className={cx(btnCls, open === "email" && "bg-ink-800 ring-accent-500")} onClick={() => toggle("email")}>
          <Icon name="mail" /> Email in Gmail
        </button>
        <button type="button" className={cx(btnCls, open === "meeting" && "bg-ink-800 ring-accent-500")} onClick={() => toggle("meeting")}>
          <Icon name="calendar" /> Book meeting
        </button>
      </div>
      {saved && <p className="mt-2 text-right text-xs text-emerald-300">{saved}</p>}
      {open === "email" && (
        <EmailPanel
          {...{ contactId, firstName, fullName, company, email, notes }}
          onDone={(msg) => {
            setOpen(null);
            setSaved(msg);
          }}
        />
      )}
      {open === "meeting" && (
        <MeetingPanel
          {...{ contactId, fullName, company, email, phone }}
          onDone={(msg) => {
            setOpen(null);
            setSaved(msg);
          }}
        />
      )}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 w-full space-y-3 rounded-xl bg-ink-900 p-4 text-left ring-1 ring-ink-600 sm:min-w-[28rem]">{children}</div>;
}

function EmailPanel({
  contactId,
  firstName,
  fullName,
  company,
  email,
  notes,
  onDone,
}: {
  contactId: number;
  firstName: string;
  fullName: string;
  company: string | null;
  email: string | null;
  notes: string | null;
  onDone: (msg: string) => void;
}) {
  const preview = useMemo(() => findPreviewLink(notes), [notes]);
  const vars = useMemo(
    () => ({
      first: !firstName || /^(owner|unknown)$/i.test(firstName) ? "there" : firstName,
      name: fullName,
      company: company ?? "your business",
      preview,
    }),
    [firstName, fullName, company, preview],
  );
  const available = TEMPLATES.filter((t) => !t.needsPreview || preview);
  const start = available.find((t) => t.id === "preview") ?? available[0];
  const [tpl, setTpl] = useState(start.id);
  const [to, setTo] = useState(email ?? "");
  const [subject, setSubject] = useState(fillTemplate(start.subject, vars));
  const [body, setBody] = useState(fillTemplate(start.body, vars));
  const [pending, startTx] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const pick = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id)!;
    setTpl(id);
    setSubject(fillTemplate(t.subject, vars));
    setBody(fillTemplate(t.body, vars));
  };

  const send = () => {
    setError(null);
    // Open first, inside the click, so the browser doesn't treat it as a pop-up.
    window.open(gmailComposeUrl({ to, subject, body }), "_blank", "noopener");
    startTx(async () => {
      try {
        await logGmailEmail({ contactId, to, subject, body });
        onDone("Opened in Gmail and logged on the timeline. Hit Send in Gmail.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't log the email.");
      }
    });
  };

  return (
    <Panel>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Template">
          <Select value={tpl} onChange={(e) => pick(e.target.value)}>
            {available.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="To">
          <Input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@business.com" />
        </Field>
      </div>
      <Field label="Subject">
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
      </Field>
      <Field label="Message">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-48" />
      </Field>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-zinc-500">
          {email ? "Opens Gmail with this filled in." : "Opens Gmail with this filled in. A new address is saved to the contact."}
        </span>
        <Button variant="primary" onClick={send} disabled={pending}>
          <Icon name="mail" /> Open in Gmail
        </Button>
      </div>
      {error && <p className="text-xs text-rose-300">{error}</p>}
    </Panel>
  );
}

function MeetingPanel({
  contactId,
  fullName,
  company,
  email,
  phone,
  onDone,
}: {
  contactId: number;
  fullName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  onDone: (msg: string) => void;
}) {
  const who = company ? `${fullName} (${company})` : fullName;
  const [title, setTitle] = useState(`Website call: ${company ?? fullName}`);
  const [day, setDay] = useState(toDateInput(nextWeekday10am()));
  const [time, setTime] = useState("10:00");
  const [minutes, setMinutes] = useState("30");
  const [guest, setGuest] = useState(email ?? "");
  const [details, setDetails] = useState(
    [`Call with ${who}.`, phone ? `Phone: ${phone}` : null, "Agenda: walk through the website preview, answer questions, next steps."]
      .filter(Boolean)
      .join("\n"),
  );
  const [pending, startTx] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const book = () => {
    setError(null);
    const [y, m, d] = day.split("-").map(Number);
    const [hh, mm] = time.split(":").map(Number);
    if (!y || !m || !d || Number.isNaN(hh)) return setError("Pick a date and time.");
    const start = new Date(y, m - 1, d, hh, mm || 0);
    const dur = Math.max(5, Number(minutes) || 30);
    window.open(
      calendarEventUrl({
        title,
        start,
        durationMin: dur,
        details,
        location: phone ? `Phone: ${phone}` : undefined,
        guests: guest ? [guest] : [],
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
      "_blank",
      "noopener",
    );
    startTx(async () => {
      try {
        await logCalendarMeeting({ contactId, title, startIso: start.toISOString(), durationMin: dur, details, guest });
        onDone("Opened in Google Calendar and added to Tasks. Click Save in Calendar.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't log the meeting.");
      }
    });
  };

  return (
    <Panel>
      <Field label="Title">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Date">
          <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </Field>
        <Field label="Time">
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        <Field label="Length">
          <Select value={minutes} onChange={(e) => setMinutes(e.target.value)}>
            {["15", "30", "45", "60", "90"].map((v) => (
              <option key={v} value={v}>
                {v} min
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Invite (optional)">
        <Input type="email" value={guest} onChange={(e) => setGuest(e.target.value)} placeholder="Their email, to send a calendar invite" />
      </Field>
      <Field label="Details">
        <Textarea value={details} onChange={(e) => setDetails(e.target.value)} className="min-h-24" />
      </Field>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-zinc-500">Opens Google Calendar with this filled in.</span>
        <Button variant="primary" onClick={book} disabled={pending}>
          <Icon name="calendar" /> Open in Calendar
        </Button>
      </div>
      {error && <p className="text-xs text-rose-300">{error}</p>}
    </Panel>
  );
}
