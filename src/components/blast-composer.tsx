"use client";

import { useMemo, useRef, useState } from "react";
import { sendBlastBatch, sendBlastTest, type BlastResult } from "@/lib/blast-actions";
import { createCampaign, saveTemplate } from "@/lib/email-actions";
import { fillTemplate, mergeVars, missingFields } from "@/lib/google-links";
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
};

export function BlastComposer({
  listName,
  recipients,
  senderEmail,
  templates,
  initialTemplateId,
  dailyLimit,
  sentToday: sentAtOpen,
}: {
  listName: string;
  recipients: Recipient[];
  senderEmail: string | null;
  templates: { id: number; name: string; subject: string; body: string }[];
  initialTemplateId?: number;
  dailyLimit: number;
  sentToday: number;
}) {
  const first = templates.find((x) => x.id === initialTemplateId) ?? templates[0];
  const [tplId, setTplId] = useState<number | null>(first?.id ?? null);
  const [subject, setSubject] = useState(first?.subject ?? "");
  const [body, setBody] = useState(first?.body ?? "");
  const [campaignName, setCampaignName] = useState(
    `${listName}: ${first?.name ?? "Email"} (${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })})`,
  );
  const campaignId = useRef<number | null>(null);
  // Electron has no window.prompt, so "Save as template" asks for the name inline.
  const [saveName, setSaveName] = useState<string | null>(null);
  const [onlyPreview, setOnlyPreview] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [results, setResults] = useState<Record<number, BlastResult>>({});
  const stop = useRef(false);

  const usesPreview = /\{preview\}/.test(subject + body);
  const missingFor = useMemo(() => {
    const text = subject + body;
    return new Map(recipients.map((r) => [r.id, missingFields(text, mergeVars(r, r.company))]));
  }, [recipients, subject, body]);
  const skipped = recipients.filter((r) => missingFor.get(r.id)!.length > 0);
  const targets = useMemo(
    () =>
      recipients.filter(
        (r) => !results[r.id]?.ok && missingFor.get(r.id)!.length === 0 && (!onlyPreview || Boolean(mergeVars(r, r.company).preview)),
      ),
    [recipients, results, onlyPreview, missingFor],
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

  // Count from the figure at page open; the page re-renders with a fresh count after sends, which would double up.
  const [sentToday] = useState(sentAtOpen);
  const leftToday = Math.max(0, dailyLimit - sentToday - sent);

  const pickTemplate = (id: number) => {
    const x = templates.find((y) => y.id === id);
    if (!x) return;
    setTplId(id);
    setSubject(x.subject);
    setBody(x.body);
    setCampaignName((n) => n.replace(/: .*\(/, `: ${x.name} (`));
  };

  const saveAsTemplate = async () => {
    const name = saveName?.trim();
    if (!name) return;
    try {
      const id = await saveTemplate({ name, subject, body });
      setTplId(id);
      setSaveName(null);
      setMsg(`Saved "${name}" to your templates.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const sendAll = async () => {
    setBusy(true);
    setMsg(null);
    stop.current = false;
    const ids = targets.map((t) => t.id);
    try {
      campaignId.current ??= await createCampaign({ name: campaignName, subject, body });
    } catch (e) {
      setMsg(`Couldn't start the campaign: ${e instanceof Error ? e.message : String(e)}`);
      setBusy(false);
      return;
    }
    for (let i = 0; i < ids.length && !stop.current; i += 5) {
      try {
        const batch = await sendBlastBatch({ contactIds: ids.slice(i, i + 5), subject, body, blastName: campaignName, campaignId: campaignId.current ?? undefined });
        setResults((prev) => ({ ...prev, ...Object.fromEntries(batch.map((r) => [r.contactId, r])) }));
        const fatal = batch.find((r) => !r.ok && r.error && /Google 4(01|03|29)|expired|isn't connected|Daily send limit/i.test(r.error));
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
            {templates.map((x) => (
              <Button key={x.id} size="sm" variant={x.id === tplId ? "primary" : "secondary"} onClick={() => pickTemplate(x.id)}>
                {x.name}
              </Button>
            ))}
          </div>
          <Field label="Campaign name">
            <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
          </Field>
          <Field label="Subject">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field label="Message">
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-72 font-mono text-[13px]" />
          </Field>
          <div className="flex items-center justify-end gap-2">
            {saveName === null ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSaveName(`${templates.find((x) => x.id === tplId)?.name ?? "My template"} (edited)`)}
              >
                Save as template
              </Button>
            ) : (
              <>
                <Input value={saveName} onChange={(e) => setSaveName(e.target.value)} className="!w-64 !py-1" aria-label="Template name" />
                <Button size="sm" variant="primary" onClick={saveAsTemplate}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSaveName(null)}>
                  Cancel
                </Button>
              </>
            )}
          </div>
          <p className="text-xs text-zinc-500">
            Merge fields: <code>{"{first}"}</code> first name (&quot;there&quot; if unknown), <code>{"{name}"}</code>, <code>{"{company}"}</code>,{" "}
            <code>{"{preview}"}</code> preview-site link, <code>{"{website}"}</code> their current site, <code>{"{issue}"}</code> what&apos;s wrong with it (the last three come from the contact&apos;s notes). Contacts missing a field the message uses are skipped.
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
          {skipped.length > 0 && (
            <p className="text-xs text-amber-300">
              Skipping {skipped.length} who {skipped.length === 1 ? "is" : "are"} missing a merge field this message uses (for example no preview link, or no
              website issue in their notes). Pick a different template to reach them.
            </p>
          )}
          <p className="text-zinc-300">
            Sends {targets.length} individual email{targets.length === 1 ? "" : "s"} from {senderEmail ?? "your Gmail"}, about one per second. Each one is logged on
            the contact&apos;s timeline. Google Workspace allows about 2,000 a day (500 on personal Gmail); a new domain does best with small batches at first.
          </p>
          <p className={`text-xs ${leftToday < targets.length ? "text-amber-300" : "text-zinc-500"}`}>
            Daily limit: {sentToday + sent} of {dailyLimit} sent today.
            {leftToday < targets.length && ` Only ${leftToday} more will go out today; send the rest tomorrow or raise the limit under Emails.`}
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
