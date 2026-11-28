"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Select, Textarea } from "./ui";

export function PasteTranscript({ contacts }: { contacts: { id: number; name: string }[] }) {
  const [text, setText] = useState("");
  const [contactId, setContactId] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="space-y-2">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a call transcript (e.g. from iPhone call recording in Notes)…" className="min-h-28" />
      <Select value={contactId} onChange={(e) => setContactId(e.target.value)}>
        <option value="">Link to contact (optional)</option>
        {contacts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Button
        variant="primary"
        className="w-full"
        disabled={!text.trim() || pending}
        onClick={() =>
          start(async () => {
            const fd = new FormData();
            fd.append("transcript", text);
            if (contactId) fd.append("contactId", contactId);
            const res = await fetch("/api/recordings", { method: "POST", body: fd });
            const j = await res.json();
            if (j.id) router.push(`/recordings/${j.id}`);
          })
        }
      >
        Analyze transcript
      </Button>
    </div>
  );
}
