"use client";

import { useState, useTransition } from "react";
import { Button } from "./ui";
import { Icon, type IconName } from "./icons";

export function AiActionButton({
  action,
  label,
  icon,
  primary,
}: {
  action: () => Promise<string>;
  label: string;
  icon: IconName;
  primary?: boolean;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end">
      <Button
        variant={primary ? "primary" : "secondary"}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMsg(null);
            try {
              setMsg(await action());
            } catch (e) {
              setMsg(e instanceof Error ? e.message : "Something went wrong");
            }
          })
        }
      >
        <Icon name={icon} className="size-4" /> {pending ? "Working…" : label}
      </Button>
      {msg && <span className="mt-1 max-w-72 text-right text-xs text-zinc-400">{msg}</span>}
    </div>
  );
}
