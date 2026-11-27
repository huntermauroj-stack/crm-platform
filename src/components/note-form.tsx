"use client";

import { useRef } from "react";
import { addActivity } from "@/lib/actions";
import { Button, Select, Textarea } from "./ui";

export function NoteForm({ contactId, companyId }: { contactId?: number; companyId?: number | null }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={async (fd) => {
        await addActivity(fd);
        ref.current?.reset();
      }}
      className="space-y-2"
    >
      {contactId && <input type="hidden" name="contactId" value={contactId} />}
      {companyId && <input type="hidden" name="companyId" value={companyId} />}
      <Textarea name="body" placeholder="Add a note, or log an email, meeting, text, or LinkedIn message…" required />
      <div className="flex items-center justify-end gap-2">
        <Select name="type" className="!w-36 !py-1.5" defaultValue="note">
          <option value="note">Note</option>
          <option value="email">Email</option>
          <option value="meeting">Meeting</option>
          <option value="sms">Text</option>
          <option value="linkedin">LinkedIn</option>
        </Select>
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}
