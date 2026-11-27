"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-ink-800 hover:text-white"
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}
