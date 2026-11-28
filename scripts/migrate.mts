import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const dataDir = path.resolve(process.env.CRM_DATA_DIR ?? "data");
fs.mkdirSync(path.join(dataDir, "recordings"), { recursive: true });
const client = createClient({ url: "file:" + path.join(dataDir, "crm.db").replace(/\\/g, "/") });
await client.execute("PRAGMA foreign_keys = ON");
await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
console.log("Database ready at", path.join(dataDir, "crm.db"));
client.close();
