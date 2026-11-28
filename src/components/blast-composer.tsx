"use client";

import { useMemo, useRef, useState } from "react";
import { sendBlastBatch, sendBlastTest, type BlastResult } from "@/lib/blast-actions";
import { fillTemplate, mergeVars } from "@/lib/google-links";
import { Button, Card, Field, Input, Textarea } from "./ui";
import { Icon } from "./icons";

type Recipient = {
  id: number;
  name: string;
  firstName: string;
  lastName: string | null;
  email: string;
  company: string | null;
  notes: string | null;
  hasPreview: boolean;
};

const FOOTER = "\n\n--\nIf you'd rather not hear from me, just reply and let me know.";

const PRESETS = [
  {
    label: "Free preview site",
    subject: "I built a free website preview for {company}",
    body:
      "Hi {first},\n\nMy name is Hunter, and I run Mauro Web & AI here in the Charlotte area. I came across {company} on Google and your reviews are excellent, but I couldn't find a website for you.\n\nSo I went ahead and built you a free preview, using your real services and a few of your customers' own reviews:\n\n{preview}\n\nNo cost and no obligation. Would you be open to a quick 10-minute call this week to take a look together?\n\nThanks,\nHunter\nMauro Web & AI" +
      FOOTER,
  },
  {
    label: "No website intro",
    subject: "Quick question about {company}'s website",
    body:
      "Hi {first},\n\nI help local trades businesses around Charlotte turn their great Google reviews into more booked jobs with a simple, professional website. I noticed {company} doesn't have one yet.\n\nWould you be open to a 10-minute call this week? I can show you a few examples.\n\nThanks,\nHunter\nMauro Web & AI" +
      FOOTER,
  },
];

export function BlastComposer({ listName, recipients, senderEmail }: { listName: string; recipients: Recipient[]; senderEmail: string | null }) {
  const [subject, setSubject] = useState(PRESETS[0].subject);
  const [body, setBody] = useState(PRESETS[0].body);
  const [onlyPreview, setOnlyPreview] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [results, setResults] = useState<Record<number, BlastResult>>({});
  const stop = useRef(false);

  const usesPreview = /\{preview\}/.test(subject + body);
  const targets = useMemo(
    () => recipients.filter((r) => !results[r.id]?.ok && (!onlyPreview && !usesPreview ? true : r.hasPreview)),
    [recipients, results, onlyPreview, usesPreview],
  );
  const sample = targets[0] ?? recipients[0];
  const vars = mergeVars(sample, sample.company);
  const sent = Object.values(results).filter((r) => r.ok).length;
  const failed = Object.values(results).filter((r) => !r.ok);

  const test = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const to = await sendBlastTest({ contactId: sample.id, subject, body });
      setMsg(`Test sent to ${to}. Check your inbox.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };

  const sendAll = async () => {
    setBusy(true);
    setMsg(null);
    stop.current = false;
    const ids = targets.map((t) => t.id);
    for (let i = 0; i < ids.length && !stop.current; i += 5) {
      try {
        const batch = await sendBlastBatch({ contactIds: ids.slice(i, i + 5), subject, body, blastName: listName });
        setResults((prev) => ({ ...prev, ...Object.fromEntries(batch.map((r) => [r.contactId, r])) }));
        const fatal = batch.find((r) => !r.ok && r.error && /Google 4(01|03|29)|expired|isn't connected/i.test(r.error));
        if (fatal) {
          setMsg(`Stopped: ${fatal.error}`);
          break;
        }
      } catch (e) {
        setMsg(`Stopped: ${e instanceof Error ? e.message : String(e)}`);
        break;
      }
    }
    setBusy(false);
    setConfirm(false);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <Card className="space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p.label}
                size="sm"
                onClick={() => {
                  setSubject(p.subject);
                  setBody(p.body);
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <Field label="Subject">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field label="Message">
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-72 font-mono text-[13px]" />
          </Field>
          <p className="text-xs text-zinc-500">
            Merge fields: <code>{"{first}"}</code> first name (&quot;there&quot; if unknown), <code>{"{name}"}</code>, <code>{"{company}"}</code>,{" "}
            <code>{"{preview}"}</code> preview-site link from the contact&apos;s notes. Contacts without a preview link are skipped when the message uses it.
          </p>
        </Card>
      </div>

      <div className="space-y-4 lg:col-span-2">
        <Card title={`Preview: ${sample.name}`}>
          <div className="space-y-2 p-4 text-sm">
            <div className="text-xs text-zinc-500">To {sample.email}</div>
            <div className="font-medium text-zinc-100">{fillTemplate(subject, vars)}</div>
            <p className="whitespace-pre-wrap text-zinc-300">{fillTemplate(body, vars)}</p>
          </div>
        </Card>

        <Card className="space-y-3 p-4 text-sm">
          {!usesPreview && (
            <label className="flex items-center gap-2 text-zinc-300">
              <input type="checkbox" checked={onlyPreview} onChange={(e) => setOnlyPreview(e.target.checked)} />
              Only contacts with a preview site
            </label>
          )}
          <p className="text-zinc-300">
            Sends {targets.length} individual email{targets.length === 1 ? "" : "s"} from {senderEmail ?? "your Gmail"}, about one per second. Each one is logged on
            the contact&apos;s timeline. Gmail allows roughly 500 a day on a personal account.
          </p>
          <Button onClick={test} disabled={busy}>
            Send a test to myself
          </Button>
          <label className="flex items-start gap-2 text-zinc-300">
            <input type="checkbox" className="mt-1" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
            I&apos;ve checked the preview and the test email, and I want to send this to {targets.length} contacts.
          </label>
          <div className="flex gap-2">
            <Button variant="primary" onClick={sendAll} disabled={busy || !confirm || targets.length === 0}>
              <Icon name="mail" /> {busy ? `Sending… ${sent} sent` : `Send to ${targets.length}`}
            </Button>
            {busy && (
              <Button variant="ghost" onClick={() => (stop.current = true)}>
                Stop
              </Button>
            )}
          </div>
          {msg && <p className="text-xs text-zinc-400">{msg}</p>}
          {(sent > 0 || failed.length > 0) && (
            <div className="border-t border-ink-700 pt-3 text-xs">
              <p className="text-emerald-300">{sent} sent</p>
              {failed.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-rose-300">
                  {failed.map((f) => (
                    <li key={f.contactId}>
                      {recipients.find((r) => r.id === f.contactId)?.name}: {f.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
