"use client";

import { useTransition } from "react";
import { addContactsToList } from "@/lib/actions";
import { Select } from "./ui";

export function AddToList({ contactId, lists }: { contactId: number; lists: { id: number; name: string }[] }) {
  const [pending, start] = useTransition();
  if (!lists.length) return null;
  return (
    <Select
      defaultValue=""
      disabled={pending}
      onChange={(e) => {
        const id = Number(e.target.value);
        if (id) start(() => addContactsToList(id, [contactId]).then(() => undefined));
      }}
    >
      <option value="">Add to call list…</option>
      {lists.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name}
        </option>
      ))}
    </Select>
  );
}
