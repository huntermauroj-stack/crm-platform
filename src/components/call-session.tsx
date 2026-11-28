"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { skipListMember } from "@/lib/actions";
import { LogCallPanel } from "./log-call-panel";
import { Button } from "./ui";
import { Icon } from "./icons";

export function CallSession({ contactId, listId }: { contactId: number; listId: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <LogCallPanel contactId={contactId} listId={listId} submitLabel="Save & next" onLogged={() => router.refresh()} autoFocusNotes />
      <div className="flex justify-start border-t border-ink-700 pt-3">
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => start(() => skipListMember(listId, contactId).then(() => router.refresh()))}
        >
          <Icon name="skip" className="size-3.5" /> Skip for now (move to end)
        </Button>
      </div>
    </div>
  );
}
