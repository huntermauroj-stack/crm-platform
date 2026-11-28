"use client";

import { useState, useTransition } from "react";
import { syncGoogleNow } from "@/lib/settings-actions";
import { Button } from "./ui";

/** Pulls new emails and meetings from Google right away (it also runs every 15 minutes). */
export function GoogleSyncButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-2">
      {msg && <span className="text-xs text-zinc-400">{msg}</span>}
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await syncGoogleNow();
            setMsg(r.ok ? `${r.emails} new email${r.emails === 1 ? "" : "s"}` : r.error);
          })
        }
      >
        {pending ? "Checking Gmail…" : "Check for replies"}
      </Button>
    </span>
  );
}
