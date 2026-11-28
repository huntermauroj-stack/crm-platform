import { defineConfig } from "drizzle-kit";
import path from "node:path";

const dataDir = path.resolve(process.env.CRM_DATA_DIR ?? "data");

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: "file:" + path.join(dataDir, "crm.db").replace(/\\/g, "/") },
});
