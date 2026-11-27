import { DEAL_STAGES, type Deal } from "@/db/schema";
import { createDeal, updateDeal } from "@/lib/actions";
import { STAGE_LABELS } from "@/lib/labels";
import { toDateInput } from "@/lib/format";
import { Button, Field, Input, Select, Textarea } from "./ui";

export function DealForm({ deal, contactId, companyId, defaultName }: { deal?: Deal; contactId?: number; companyId?: number | null; defaultName?: string }) {
  const action = deal ? updateDeal.bind(null, deal.id) : createDeal;
  return (
    <form action={action} className="grid grid-cols-2 gap-2.5">
      {contactId && <input type="hidden" name="contactId" value={contactId} />}
      {companyId && <input type="hidden" name="companyId" value={companyId} />}
      <Field label="Deal name" className="col-span-2">
        <Input name="name" required defaultValue={deal?.name ?? defaultName} />
      </Field>
      <Field label="Stage">
        <Select name="stage" defaultValue={deal?.stage ?? "new_lead"}>
          {DEAL_STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Service">
        <Input name="service" defaultValue={deal?.service ?? ""} placeholder="AI agent, automation…" />
      </Field>
      <Field label="Value ($)">
        <Input name="value" inputMode="decimal" defaultValue={deal?.value ?? ""} />
      </Field>
      <Field label="Billing">
        <Select name="billing" defaultValue={deal?.billing ?? "one_time"}>
          <option value="one_time">One-time</option>
          <option value="monthly">Monthly retainer</option>
          <option value="annual">Annual</option>
        </Select>
      </Field>
      <Field label="Expected close" className="col-span-2">
        <Input name="expectedCloseAt" type="date" defaultValue={toDateInput(deal?.expectedCloseAt)} />
      </Field>
      <Field label="Notes" className="col-span-2">
        <Textarea name="notes" defaultValue={deal?.notes ?? ""} className="!min-h-14" />
      </Field>
      <div className="col-span-2 flex justify-end">
        <Button type="submit" variant="primary" size="sm">
          {deal ? "Save deal" : "Create deal"}
        </Button>
      </div>
    </form>
  );
}
