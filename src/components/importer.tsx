"use client";

import Link from "next/link";
import Papa from "papaparse";
import { useMemo, useState, useTransition } from "react";
import { importContacts, type ImportResult } from "@/lib/import-action";
import { IMPORT_FIELDS, type ImportField, type ImportRow } from "@/lib/import-fields";
import { CONTACT_STATUSES, type ContactStatus } from "@/db/schema";
import { STATUS_LABELS } from "@/lib/labels";
import { Button, Card, Field, Input, Select } from "./ui";
import { Icon } from "./icons";

const GUESSES: Record<ImportField, RegExp> = {
  firstName: /^(first|given|fname|first.?name)$/i,
  lastName: /^(last|surname|family|lname|last.?name)$/i,
  fullName: /^(name|full.?name|contact.?name|person)$/i,
  title: /(title|position|role|job)/i,
  email: /e-?mail/i,
  phone: /^(phone|work.?phone|direct|office|telephone|corporate.?phone|phone.?number)/i,
  mobile: /(mobile|cell)/i,
  linkedinUrl: /linkedin/i,
  location: /^(location|city|address|state|region)/i,
  companyName: /^(company|organization|organisation|account|business|company.?name)/i,
  companyDomain: /(website|domain|url)/i,
  companyIndustry: /industry/i,
  companySize: /(employees|size|headcount)/i,
  status: /^(status|stage|lifecycle)/i,
  tags: /(tags?|labels?|segment)/i,
  notes: /(notes?|comments?|description)/i,
};

function guess(header: string, taken: Set<string>): ImportField | "" {
  const h = header.trim();
  for (const [field] of IMPORT_FIELDS) {
    if (taken.has(field)) continue;
    if (field === "linkedinUrl" && /linkedin/i.test(h)) return field;
    if (field === "companyDomain" && /linkedin/i.test(h)) continue;
    if (GUESSES[field].test(h)) return field;
  }
  return "";
}

export function Importer({ lists, defaultListId }: { lists: { id: number; name: string }[]; defaultListId: number | null }) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, ImportField | "">>({});
  const [fileName, setFileName] = useState("");
  const [listId, setListId] = useState<string>(defaultListId ? String(defaultListId) : "");
  const [status, setStatus] = useState<ContactStatus>("prospect");
  const [source, setSource] = useState("");
  const [updateExisting, setUpdateExisting] = useState(false);
  const [pending, start] = useTransition();
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFile = (file: File) => {
    setResult(null);
    setError(null);
    setFileName(file.name);
    setSource(file.name.replace(/\.csv$/i, ""));
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const hs = res.meta.fields ?? [];
        setHeaders(hs);
        setRows(res.data);
        const taken = new Set<string>();
        const m: Record<string, ImportField | ""> = {};
        for (const h of hs) {
          const g = guess(h, taken);
          m[h] = g;
          if (g) taken.add(g);
        }
        setMapping(m);
      },
      error: (e) => setError(e.message),
    });
  };

  const mapped = useMemo(
    () =>
      rows.map((r) => {
        const out: ImportRow = {};
        for (const h of headers) {
          const f = mapping[h];
          if (f && r[h]) out[f] = out[f] ? `${out[f]} ${r[h]}` : r[h];
        }
        return out;
      }),
    [rows, headers, mapping],
  );

  const run = () =>
    start(async () => {
      setError(null);
      const total: ImportResult = { created: 0, updated: 0, skipped: 0, addedToList: 0 };
      const size = 250;
      try {
        for (let i = 0; i < mapped.length; i += size) {
          setProgress(`Importing ${Math.min(i + size, mapped.length)} of ${mapped.length}…`);
          const r = await importContacts(mapped.slice(i, i + size), {
            source: source || "CSV import",
            listId: listId ? Number(listId) : null,
            defaultStatus: status,
            updateExisting,
          });
          total.created += r.created;
          total.updated += r.updated;
          total.skipped += r.skipped;
          total.addedToList += r.addedToList;
        }
        setResult(total);
        setRows([]);
        setHeaders([]);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setProgress(null);
      }
    });

  return (
    <div className="space-y-6">
      {result && (
        <Card className="border-l-4 border-emerald-500 p-4">
          <p className="text-sm text-zinc-200">
            Imported <b>{result.created}</b> new contacts, updated {result.updated}, skipped {result.skipped}
            {listId ? `, added ${result.addedToList} to the list` : ""}.
          </p>
          <div className="mt-2 flex gap-3 text-sm">
            <Link href="/contacts" className="text-accent-300">View contacts →</Link>
            {listId && <Link href={`/lists/${listId}/call`} className="text-accent-300">Start calling this list →</Link>}
          </div>
        </Card>
      )}

      <Card className="p-5">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-ink-600 px-4 py-10 text-center hover:border-accent-500 hover:bg-ink-850">
          <Icon name="upload" className="size-6 text-accent-400" />
          <span className="text-sm text-zinc-200">{fileName || "Choose a CSV file"}</span>
          <span className="text-xs text-zinc-500">Export from Google Sheets, Excel, or any CRM as .csv</span>
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      </Card>

      {headers.length > 0 && (
        <>
          <Card title={`Map columns (${rows.length} rows)`}>
            <div className="divide-y divide-ink-700/60">
              {headers.map((h) => (
                <div key={h} className="grid grid-cols-3 items-center gap-3 px-4 py-2">
                  <div className="truncate text-sm text-zinc-200">{h}</div>
                  <div className="truncate text-xs text-zinc-500">{rows.find((r) => r[h])?.[h] ?? ""}</div>
                  <Select value={mapping[h] ?? ""} onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value as ImportField | "" }))}>
                    <option value="">Don&apos;t import</option>
                    {IMPORT_FIELDS.map(([f, label]) => (
                      <option key={f} value={f}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Options">
            <div className="grid gap-3 p-4 sm:grid-cols-3">
              <Field label="Add to call list">
                <Select value={listId} onChange={(e) => setListId(e.target.value)}>
                  <option value="">None</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Status for new contacts">
                <Select value={status} onChange={(e) => setStatus(e.target.value as ContactStatus)}>
                  {CONTACT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Source label">
                <Input value={source} onChange={(e) => setSource(e.target.value)} />
              </Field>
              <label className="flex items-center gap-2 text-sm text-zinc-300 sm:col-span-3">
                <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} className="accent-accent-500" />
                Update existing contacts when a duplicate is found (otherwise they&apos;re skipped)
              </label>
            </div>
          </Card>

          <div className="flex items-center justify-end gap-3">
            {progress && <span className="text-sm text-zinc-400">{progress}</span>}
            <Button variant="primary" onClick={run} disabled={pending || !Object.values(mapping).some(Boolean)}>
              Import {rows.length} rows
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
