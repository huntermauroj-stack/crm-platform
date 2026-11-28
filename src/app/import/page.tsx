import { db } from "@/db";
import { lists } from "@/db/schema";
import { PageHeader } from "@/components/ui";
import { Importer } from "@/components/importer";

export const metadata = { title: "Import" };

export default async function ImportPage({ searchParams }: PageProps<"/import">) {
  const sp = await searchParams;
  const allLists = await db.select({ id: lists.id, name: lists.name }).from(lists);
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Import contacts"
        subtitle="Bring in a CSV from a spreadsheet, another CRM, or a prospect database export. Duplicates (same email or LinkedIn URL) are detected."
      />
      <Importer lists={allLists} defaultListId={Number(sp.list) || null} />
    </div>
  );
}
