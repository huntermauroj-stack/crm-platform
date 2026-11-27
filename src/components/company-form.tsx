import type { Company } from "@/db/schema";
import { Button, Field, Input, Textarea } from "./ui";

export function CompanyForm({ action, company, submitLabel = "Save" }: { action: (fd: FormData) => Promise<void>; company?: Company; submitLabel?: string }) {
  return (
    <form action={action} className="grid grid-cols-2 gap-3">
      <Field label="Name *" className="col-span-2">
        <Input name="name" required defaultValue={company?.name} />
      </Field>
      <Field label="Website / domain">
        <Input name="domain" defaultValue={company?.domain ?? ""} />
      </Field>
      <Field label="Industry">
        <Input name="industry" defaultValue={company?.industry ?? ""} />
      </Field>
      <Field label="Size">
        <Input name="size" defaultValue={company?.size ?? ""} placeholder="e.g. 11-50" />
      </Field>
      <Field label="Location">
        <Input name="location" defaultValue={company?.location ?? ""} />
      </Field>
      <Field label="Main phone">
        <Input name="phone" defaultValue={company?.phone ?? ""} />
      </Field>
      <Field label="LinkedIn URL">
        <Input name="linkedinUrl" defaultValue={company?.linkedinUrl ?? ""} />
      </Field>
      <Field label="Tech stack / current tools" className="col-span-2">
        <Input name="techStack" defaultValue={company?.techStack ?? ""} placeholder="HubSpot, Zapier, ChatGPT…" />
      </Field>
      <Field label="Description" className="col-span-2">
        <Textarea name="description" defaultValue={company?.description ?? ""} />
      </Field>
      <Field label="Notes" className="col-span-2">
        <Textarea name="notes" defaultValue={company?.notes ?? ""} />
      </Field>
      <div className="col-span-2 flex justify-end">
        <Button type="submit" variant="primary">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
