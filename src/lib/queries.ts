import "server-only";
import { and, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { endOfToday } from "./format";

export async function dueTaskCount() {
  const [r] = await db
    .select({ n: sql<number>`count(*)` })
    .from(tasks)
    .where(and(isNull(tasks.completedAt), lte(tasks.dueAt, endOfToday())));
  return r?.n ?? 0;
}

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Rapport";
