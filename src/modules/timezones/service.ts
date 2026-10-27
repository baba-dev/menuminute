import { sql } from "drizzle-orm";
import type { Transaction } from "@/db";
import { getPool } from "@/db";
import { ValidationError } from "@/lib/errors";
import { ordersSqlState } from "@/modules/orders/diagnostics";
import {
  canonicalOutletTimezone,
  canonicalTimezoneOptions,
  isRuntimeTimezone,
} from "@/lib/outlet-timezones";

/**
 * Use the running PostgreSQL's timezone catalog to populate the browser selector.
 * The server-side write check uses AT TIME ZONE too, so a stale catalog cannot
 * cause an invalid identifier to enter the financial/order domain.
 */
let known: { values: string[]; until: number } | undefined;

export async function availableOutletTimezones(): Promise<string[]> {
  if (known && known.until > Date.now()) return known.values;
  const result = await getPool().query<{ name: string }>(
    "select name from pg_catalog.pg_timezone_names"
  );
  const supportedByPostgres = new Set(result.rows.map((row) => row.name));
  const values = canonicalTimezoneOptions().filter((name) => supportedByPostgres.has(name));
  if (values.length === 0) throw new Error("PostgreSQL timezone catalog unavailable");
  known = { values, until: Date.now() + 60 * 60 * 1000 };
  return values;
}

export async function verifyOutletTimezone(tx: Transaction, timezone: string): Promise<string> {
  const canonical = canonicalOutletTimezone(timezone);
  if (!isRuntimeTimezone(canonical) || !(await availableOutletTimezones()).includes(canonical)) {
    throw new ValidationError("Select a timezone supported by this restaurant server.");
  }
  try {
    // This tests actual conversion, not just the browser's or ICU's list.
    await tx.execute(sql`select (clock_timestamp() at time zone ${canonical}) as outlet_local_time`);
  } catch (cause) {
    // Do not misclassify a database outage as bad operator input.
    if (ordersSqlState(cause) === "22023") {
      throw new ValidationError("This timezone is not supported by the database. Select another city/region.");
    }
    throw cause;
  }
  return canonical;
}
