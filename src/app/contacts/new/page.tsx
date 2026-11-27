import { db } from "@/db";
import { lists } from "@/db/schema";
import { createContact } from "@/lib/actions";
import { ContactForm } from "@/components/contact-form";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "New contact" };

export default async function NewContact() {
  const allLists = await db.select({ id: lists.id, name: lists.name }).from(lists);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New contact" />
      <Card className="p-5">
        <ContactForm action={createContact} lists={allLists} submitLabel="Create contact" />
      </Card>
    </div>
  );
}
