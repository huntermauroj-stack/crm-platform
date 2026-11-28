import fs from "node:fs";
import path from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db, DATA_DIR } from "./db";

/** Apply any pending database migrations at startup so `npm run dev` is all that's needed. */
export async function runMigrations() {
  fs.mkdirSync(path.join(DATA_DIR, "recordings"), { recursive: true });
  const folder = process.env.CRM_MIGRATIONS_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "drizzle");
  await migrate(db, { migrationsFolder: folder });
}
