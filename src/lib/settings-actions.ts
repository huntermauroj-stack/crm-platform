"use server";

import { revalidatePath } from "next/cache";
import { writeConfig } from "./config";

export async function saveApiKey(fd: FormData) {
  const v = fd.get("anthropicApiKey");
  const key = typeof v === "string" ? v.trim() : "";
  if (fd.get("remove")) writeConfig({ anthropicApiKey: undefined });
  else if (key) writeConfig({ anthropicApiKey: key });
  revalidatePath("/", "layout");
}
