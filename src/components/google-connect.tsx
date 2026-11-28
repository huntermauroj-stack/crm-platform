"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { disconnectGoogleAction, startGoogleConnect, syncGoogleNow } from "@/lib/settings-actions";
import { Button } from "./ui";

export function GoogleConnectButtons({ connected }: { connected: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const connect = () =>
    start(async () => {
      setMsg(null);
      try {
        const url = await startGoogleConnect(window.location.origin);
        window.open(url, "_blank", "noopener");
        setMsg("Finish signing in on the Google page in your browser, then come back and click Refresh.");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : String(e));
      }
    });

  const sync = () =>
    start(async () => {
      setMsg("Syncing…");
      const r = await syncGoogleNow();
      setMsg(r.ok ? `Synced: ${r.emails} new email${r.emails === 1 ? "" : "s"}, ${r.meetings} new meeting${r.meetings === 1 ? "" : "s"}.` : r.error);
      router.refresh();
    });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button variant={connected ? "secondary" : "primary"} onClick={connect} disabled={pending}>
          {connected ? "Reconnect Google" : "Connect Google"}
        </Button>
        {connected && (
          <Button onClick={sync} disabled={pending}>
            Sync now
          </Button>
        )}
        <Button variant="ghost" onClick={() => router.refresh()} disabled={pending}>
          Refresh
        </Button>
        {connected && (
          <Button variant="ghost" onClick={() => start(() => disconnectGoogleAction())} disabled={pending} className="ml-auto text-rose-300">
            Disconnect
          </Button>
        )}
      </div>
      {msg && <p className="text-xs text-zinc-400">{msg}</p>}
    </div>
  );
}
