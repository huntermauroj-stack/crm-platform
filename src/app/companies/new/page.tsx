import { createCompany } from "@/lib/actions";
import { CompanyForm } from "@/components/company-form";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "New company" };

export default function NewCompany() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New company" />
      <Card className="p-5">
        <CompanyForm action={createCompany} submitLabel="Create company" />
      </Card>
    </div>
  );
}
