"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { addContactsToList, setContactStatus } from "@/lib/actions";
import { CONTACT_STATUSES, type ContactStatus } from "@/db/schema";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/labels";
import { fullName, initials, isPast, relative, telHref } from "@/lib/format";
import { Avatar, Badge, Button, Empty, Select } from "./ui";
import { Icon } from "./icons";

type Row = {
  id: number;
  firstName: string;
  lastName: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  status: ContactStatus;
  tags: string | null;
  lastContactedAt: Date | null;
  nextFollowUpAt: Date | null;
  companyId: number | null;
  companyName: string | null;
};

export function ContactsTable({ rows, lists }: { rows: Row[]; lists: { id: number; name: string }[] }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allOn = rows.length > 0 && selected.size === rows.length;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const withEmail = rows.filter((r) => selected.has(r.id) && r.email).length;
  const emailSelected = () => {
    const ids = rows.filter((r) => selected.has(r.id)).map((r) => r.id);
    const back = `${pathname}${params.size ? `?${params}` : ""}`;
    router.push(`/email?ids=${ids.join(",")}&back=${encodeURIComponent(back)}`);
  };

  if (!rows.length) return <Empty title="No contacts match">Try a different search, or import a CSV of prospects.</Empty>;

  return (
    <div>
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-700 bg-accent-500/5 px-4 py-2 text-sm">
          <span className="text-zinc-300">
            {selected.size} selected
            {!allOn && rows.length > selected.size && (
              <button type="button" className="ml-2 text-accent-300 hover:text-accent-400" onClick={() => setSelected(new Set(rows.map((r) => r.id)))}>
                Select all {rows.length}
              </button>
            )}
          </span>
          <Button size="sm" variant="primary" onClick={emailSelected} title={`${withEmail} of ${selected.size} have an email address`}>
            <Icon name="mail" /> Email selected ({withEmail})
          </Button>
          <Select
            className="!w-48 !py-1"
            defaultValue=""
            disabled={pending}
            onChange={(e) => {
              const listId = Number(e.target.value);
              e.target.value = "";
              if (!listId) return;
              start(async () => {
                const n = await addContactsToList(listId, [...selected]);
                setMsg(`Added ${n} to ${lists.find((l) => l.id === listId)?.name}`);
                setSelected(new Set());
              });
            }}
          >
            <option value="">Add to call list…</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
          <Select
            className="!w-44 !py-1"
            defaultValue=""
            disabled={pending}
            onChange={(e) => {
              const s = e.target.value as ContactStatus;
              e.target.value = "";
              if (!s) return;
              start(async () => {
                for (const id of selected) await setContactStatus(id, s);
                setMsg(`Updated ${selected.size} contacts`);
                setSelected(new Set());
              });
            }}
          >
            <option value="">Set status…</option>
            {CONTACT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}
      {msg && <div className="border-b border-ink-700 px-4 py-2 text-xs text-emerald-300">{msg}</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-700 text-left text-xs font-medium text-zinc-500">
              <th className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={allOn}
                  onChange={() => setSelected(allOn ? new Set() : new Set(rows.map((r) => r.id)))}
                  className="accent-accent-500"
                />
              </th>
              <th className="px-2 py-2.5">Name</th>
              <th className="px-2 py-2.5">Company</th>
              <th className="px-2 py-2.5">Phone</th>
              <th className="px-2 py-2.5">Status</th>
              <th className="px-2 py-2.5">Last contact</th>
              <th className="px-2 py-2.5">Follow-up</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-700/60">
            {rows.map((r) => {
              const phone = r.mobile ?? r.phone;
              const overdue = isPast(r.nextFollowUpAt);
              return (
                <tr key={r.id} className="hover:bg-ink-850/60">
                  <td className="px-4 py-2">
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="accent-accent-500" />
                  </td>
                  <td className="px-2 py-2">
                    <Link href={`/contacts/${r.id}`} className="flex items-center gap-2.5">
                      <Avatar text={initials(r)} className="size-7 text-[10px]" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-zinc-100 hover:text-accent-300">{fullName(r)}</span>
                        <span className="block truncate text-xs text-zinc-500">{r.title ?? r.email ?? ""}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-zinc-300">
                    {r.companyId ? (
                      <Link href={`/companies/${r.companyId}`} className="hover:text-accent-300">
                        {r.companyName}
                      </Link>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2 tabular-nums">
                    {phone ? (
                      <a href={telHref(phone)} className="text-zinc-300 hover:text-accent-300">
                        {phone}
                      </a>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <Badge className={STATUS_COLORS[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                  </td>
                  <td className="px-2 py-2 text-xs text-zinc-400">{relative(r.lastContactedAt)}</td>
                  <td className={`px-2 py-2 text-xs ${overdue ? "font-medium text-rose-400" : "text-zinc-400"}`}>
                    {r.nextFollowUpAt ? relative(r.nextFollowUpAt) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
