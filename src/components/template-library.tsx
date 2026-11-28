"use client";

import { useState, useTransition } from "react";
import { deleteTemplate, saveTemplate } from "@/lib/email-actions";
import { Button, Card, Field, Input, Textarea } from "./ui";
import { Icon } from "./icons";

type T = { id: number; name: string; subject: string; body: string };

function Editor({ t, onDone }: { t?: T; onDone?: () => void }) {
  const [name, setName] = useState(t?.name ?? "");
  const [subject, setSubject] = useState(t?.subject ?? "");
  const [body, setBody] = useState(t?.body ?? "");
  const [open, setOpen] = useState(!t);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const dirty = !t || name !== t.name || subject !== t.subject || body !== t.body;

  if (!open && t)
    return (
      <button type="button" onClick={() => setOpen(true)} className="block w-full px-4 py-3 text-left hover:bg-ink-850/60">
        <div className="text-sm font-medium text-zinc-100">{t.name}</div>
        <div className="truncate text-xs text-zinc-500">{t.subject}</div>
      </button>
    );

  return (
    <div className="space-y-3 px-4 py-4">
      <Field label="Template name">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Free preview site" />
      </Field>
      <Field label="Subject">
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
      </Field>
      <Field label="Message">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-56 font-mono text-[13px]" />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          disabled={pending || !dirty}
          onClick={() =>
            start(async () => {
              try {
                await saveTemplate({ id: t?.id, name, subject, body });
                setMsg("Saved");
                if (!t) onDone?.();
              } catch (e) {
                setMsg(e instanceof Error ? e.message : String(e));
              }
            })
          }
        >
          {t ? "Save changes" : "Add template"}
        </Button>
        <Button variant="ghost" onClick={() => (t ? setOpen(false) : onDone?.())}>
          {t ? "Close" : "Cancel"}
        </Button>
        {t &&
          (confirmDelete ? (
            <Button variant="danger" disabled={pending} onClick={() => start(() => deleteTemplate(t.id))}>
              Yes, delete it
            </Button>
          ) : (
            <Button variant="ghost" className="ml-auto" onClick={() => setConfirmDelete(true)}>
              <Icon name="trash" /> Delete
            </Button>
          ))}
        {msg && <span className="text-xs text-zinc-400">{msg}</span>}
      </div>
    </div>
  );
}

/** Your saved templates. They show up as buttons whenever you email selected contacts or a call list. */
export function TemplateLibrary({ templates }: { templates: T[] }) {
  const [adding, setAdding] = useState(false);
  return (
    <Card
      title="Templates"
      action={
        !adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Icon name="plus" /> New template
          </Button>
        )
      }
    >
      <p className="border-b border-ink-700 px-4 py-2 text-xs text-zinc-500">
        Merge fields: <code>{"{first}"}</code> first name (&quot;there&quot; if unknown), <code>{"{name}"}</code>, <code>{"{company}"}</code>,{" "}
        <code>{"{preview}"}</code> preview-site link, <code>{"{website}"}</code> their current site, <code>{"{issue}"}</code> what&apos;s wrong with it. Contacts
        missing a field a template uses are skipped when you send it.
      </p>
      <div className="divide-y divide-ink-700/60">
        {adding && <Editor onDone={() => setAdding(false)} />}
        {templates.map((t) => (
          <Editor key={`${t.id}:${t.subject}:${t.body.length}`} t={t} />
        ))}
        {!templates.length && !adding && <p className="px-4 py-6 text-sm text-zinc-500">No templates yet. Click New template to add one.</p>}
      </div>
    </Card>
  );
}
