"use client";

import { useRef } from "react";
import { createTask } from "@/lib/actions";
import { addDays, toDateInput } from "@/lib/format";
import { Button, Input, Select } from "./ui";

export function TaskForm({ contactId }: { contactId?: number }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={async (fd) => {
        await createTask(fd);
        ref.current?.reset();
      }}
      className="flex flex-wrap gap-2"
    >
      {contactId && <input type="hidden" name="contactId" value={contactId} />}
      <Input name="title" placeholder="New task…" required className="min-w-40 flex-1" />
      <Select name="type" defaultValue="call" className="!w-24">
        <option value="call">Call</option>
        <option value="email">Email</option>
        <option value="meeting">Meeting</option>
        <option value="todo">To-do</option>
      </Select>
      <Input name="dueAt" type="date" defaultValue={toDateInput(addDays(new Date(), 1))} className="!w-40" />
      <Button type="submit">Add</Button>
    </form>
  );
}
