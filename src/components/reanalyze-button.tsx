"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "./ui";
import { Icon } from "./icons";

export function ReanalyzeButton({ id }: { id: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await fetch(`/api/recordings/${id}`, { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } });
          router.refresh();
        })
      }
    >
      <Icon name="sparkles" className="size-3.5" /> Re-analyze
    </Button>
  );
}
