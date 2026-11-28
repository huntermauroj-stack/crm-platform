import "server-only";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

export const DATA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.CRM_DATA_DIR ?? path.join(process.cwd(), "data"));
fs.mkdirSync(DATA_DIR, { recursive: true });

const globalForDb = globalThis as unknown as { __crmClient?: ReturnType<typeof createClient> };

const client =
  globalForDb.__crmClient ??
  createClient({ url: "file:" + path.join(DATA_DIR, "crm.db").replace(/\\/g, "/") });
if (!globalForDb.__crmClient) {
  void client.execute("PRAGMA foreign_keys = ON");
  void client.execute("PRAGMA journal_mode = WAL");
}
globalForDb.__crmClient = client;

export const db = drizzle(client, { schema });
export { schema };
