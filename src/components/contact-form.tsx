import { CONTACT_STATUSES, type Contact } from "@/db/schema";
import { STATUS_LABELS } from "@/lib/labels";
import { toDateInput } from "@/lib/format";
import { Button, Field, Input, Select, Textarea } from "./ui";

export function ContactForm({
  action,
  contact,
  companyName,
  lists,
  submitLabel = "Save",
}: {
  action: (fd: FormData) => Promise<void>;
  contact?: Contact;
  companyName?: string | null;
  lists?: { id: number; name: string }[];
  submitLabel?: string;
}) {
  return (
    <form action={action} className="grid grid-cols-2 gap-3">
      <Field label="First name *">
        <Input name="firstName" required defaultValue={contact?.firstName} />
      </Field>
      <Field label="Last name">
        <Input name="lastName" defaultValue={contact?.lastName ?? ""} />
      </Field>
      <Field label="Job title">
        <Input name="title" defaultValue={contact?.title ?? ""} />
      </Field>
      <Field label="Company">
        <Input name="companyName" defaultValue={companyName ?? ""} placeholder="Created if new" />
      </Field>
      <Field label="Phone">
        <Input name="phone" type="tel" defaultValue={contact?.phone ?? ""} />
      </Field>
      <Field label="Mobile">
        <Input name="mobile" type="tel" defaultValue={contact?.mobile ?? ""} />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" defaultValue={contact?.email ?? ""} />
      </Field>
      <Field label="LinkedIn URL">
        <Input name="linkedinUrl" defaultValue={contact?.linkedinUrl ?? ""} />
      </Field>
      <Field label="Location">
        <Input name="location" defaultValue={contact?.location ?? ""} />
      </Field>
      <Field label="Status">
        <Select name="status" defaultValue={contact?.status ?? "prospect"}>
          {CONTACT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Source">
        <Input name="source" defaultValue={contact?.source ?? ""} placeholder="Referral, LinkedIn, cold list…" />
      </Field>
      <Field label="Tags (comma separated)">
        <Input name="tags" defaultValue={contact?.tags ?? ""} />
      </Field>
      {contact && (
        <Field label="Next follow-up">
          <Input name="nextFollowUpAt" type="date" defaultValue={toDateInput(contact.nextFollowUpAt)} />
        </Field>
      )}
      {lists && lists.length > 0 && (
        <Field label="Add to call list">
          <Select name="listId" defaultValue="">
            <option value="">None</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Pain points" className="col-span-2">
        <Textarea name="painPoints" defaultValue={contact?.painPoints ?? ""} />
      </Field>
      <Field label="Notes" className="col-span-2">
        <Textarea name="notes" defaultValue={contact?.notes ?? ""} />
      </Field>
      <div className="col-span-2 flex justify-end">
        <Button type="submit" variant="primary">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
