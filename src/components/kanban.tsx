"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { moveDeal } from "@/lib/actions";
import { DEAL_STAGES, type DealStage } from "@/db/schema";
import { STAGE_ACCENTS, STAGE_LABELS } from "@/lib/labels";
import { money, relative } from "@/lib/format";
import { cx } from "./ui";

type D = {
  id: number;
  name: string;
  stage: DealStage;
  value: number | null;
  billing: string | null;
  service: string | null;
  expectedCloseAt: Date | null;
  updatedAt: Date;
  contactId: number | null;
  contactFirst: string | null;
  contactLast: string | null;
  companyName: string | null;
};

export function Kanban({ deals }: { deals: D[] }) {
  const [, start] = useTransition();
  const [optimistic, apply] = useOptimistic(deals, (state, m: { id: number; stage: DealStage; beforeId: number | null }) => {
    const card = state.find((d) => d.id === m.id);
    if (!card) return state;
    const rest = state.filter((d) => d.id !== m.id);
    const moved = { ...card, stage: m.stage };
    const idx = m.beforeId ? rest.findIndex((d) => d.id === m.beforeId) : -1;
    if (idx === -1) rest.push(moved);
    else rest.splice(idx, 0, moved);
    return rest;
  });
  const [dragId, setDragId] = useState<number | null>(null);
  const [over, setOver] = useState<{ stage: DealStage; beforeId: number | null } | null>(null);

  const drop = (stage: DealStage, beforeId: number | null) => {
    if (dragId == null) return;
    const id = dragId;
    setDragId(null);
    setOver(null);
    start(async () => {
      apply({ id, stage, beforeId });
      await moveDeal(id, stage, beforeId);
    });
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {DEAL_STAGES.map((stage) => {
        const cards = optimistic.filter((d) => d.stage === stage);
        const total = cards.reduce((s, d) => s + (d.value ?? 0), 0);
        return (
          <div
            key={stage}
            onDragOver={(e) => {
              e.preventDefault();
              if (over?.stage !== stage || over.beforeId !== null) setOver({ stage, beforeId: null });
            }}
            onDrop={(e) => {
              e.preventDefault();
              drop(stage, over?.stage === stage ? over.beforeId : null);
            }}
            className={cx(
              "flex w-56 shrink-0 flex-col rounded-xl border-t-2 bg-ink-900 ring-1 ring-ink-700",
              STAGE_ACCENTS[stage],
              over?.stage === stage && "ring-accent-500/60",
            )}
          >
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="text-sm font-medium text-zinc-200">{STAGE_LABELS[stage]}</span>
              <span className="text-xs tabular-nums text-zinc-500">
                {cards.length} · {money(total)}
              </span>
            </div>
            <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
              {cards.map((d) => (
                <div
                  key={d.id}
                  draggable
                  onDragStart={() => setDragId(d.id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setOver(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (over?.beforeId !== d.id) setOver({ stage, beforeId: d.id });
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    drop(stage, d.id === dragId ? null : d.id);
                  }}
                  className={cx(
                    "cursor-grab rounded-lg bg-ink-850 p-3 ring-1 ring-ink-700 transition hover:ring-ink-600 active:cursor-grabbing",
                    dragId === d.id && "opacity-40",
                    over?.beforeId === d.id && dragId !== d.id && "shadow-[0_-2px_0_0_var(--color-accent-400)]",
                  )}
                >
                  <div className="text-sm font-medium text-zinc-100">{d.name}</div>
                  {d.contactId && (
                    <Link href={`/contacts/${d.contactId}`} className="mt-0.5 block text-xs text-zinc-400 hover:text-accent-300">
                      {[d.contactFirst, d.contactLast].filter(Boolean).join(" ")}
                      {d.companyName && d.companyName !== d.name ? ` · ${d.companyName}` : ""}
                    </Link>
                  )}
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="font-medium tabular-nums text-zinc-200">
                      {money(d.value)}
                      {d.billing === "monthly" && d.value ? "/mo" : d.billing === "annual" && d.value ? "/yr" : ""}
                    </span>
                    <span className="text-zinc-500">{d.service ?? relative(d.updatedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
