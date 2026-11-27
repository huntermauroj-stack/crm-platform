"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { uploadRecording } from "@/lib/audio-client";
import { Icon } from "./icons";
import { cx } from "./ui";

type Status = { status: string; progress: string | null; error: string | null; pending: boolean };

export function useRecordingStatus(id: number | null) {
  const [s, setS] = useState<Status | null>(null);
  const router = useRouter();
  useEffect(() => {
    if (!id) return;
    let alive = true;
    let last = "";
    const tick = async () => {
      const res = await fetch(`/api/recordings/${id}`);
      if (!res.ok || !alive) return;
      const j = (await res.json()) as Status;
      setS(j);
      if (j.status !== last) {
        last = j.status;
        router.refresh();
      }
      if (j.pending) setTimeout(tick, 2000);
    };
    void tick();
    return () => {
      alive = false;
    };
  }, [id, router]);
  return s;
}

export function RecordingProgress({ id }: { id: number }) {
  const s = useRecordingStatus(id);
  if (!s) return <span className="text-xs text-zinc-500">Starting…</span>;
  if (s.status === "error") return <span className="text-xs text-rose-300">{s.error}</span>;
  if (!s.pending)
    return (
      <Link href={`/recordings/${id}`} className="inline-flex items-center gap-1 text-xs font-medium text-accent-300 hover:text-accent-400">
        <Icon name="sparkles" className="size-3" /> {s.status === "done" ? "AI summary ready, review it" : "Transcript ready"}
      </Link>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
      <span className="size-2 animate-pulse rounded-full bg-accent-400" />
      {s.progress ?? s.status}
    </span>
  );
}

export function RecordingUploader({
  contactId,
  activityId,
  compact,
}: {
  contactId?: number | null;
  activityId?: number | null;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recId, setRecId] = useState<number | null>(null);
  const [drag, setDrag] = useState(false);

  async function handle(file: File) {
    setError(null);
    setRecId(null);
    const r = await uploadRecording({ file, contactId, activityId, onStage: setStage });
    setStage(null);
    if ("error" in r) setError(r.error);
    else setRecId(r.id);
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          if (f) void handle(f);
        }}
        onClick={() => input.current?.click()}
        className={cx(
          "flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-3 text-sm transition-colors",
          compact ? "py-2" : "py-4",
          drag ? "border-accent-400 bg-accent-500/10" : "border-ink-600 hover:border-ink-500 hover:bg-ink-850",
        )}
      >
        <Icon name="mic" className="size-4 text-accent-400" />
        <span className="text-zinc-300">
          {stage ?? (compact ? "Attach call recording" : "Drop a call recording here, or click to choose")}
        </span>
        <input
          ref={input}
          type="file"
          accept="audio/*,.m4a,.mp3,.wav,.aac,.ogg,.opus,.webm,.mp4"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handle(f);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
      {recId && (
        <div className="mt-2">
          <RecordingProgress id={recId} />
        </div>
      )}
    </div>
  );
}
