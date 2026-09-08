import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString && process.env.NODE_ENV !== "test") {
  // Thrown lazily (only when the DB is actually touched) would be nicer, but failing loudly at
  // import time is more useful here: every server action goes through this file, so a missing
  // env var should surface immediately in the dev server log, not as a mysterious runtime error
  // three layers down.
  throw new Error(
    "DATABASE_URL is not set. Copy the Postgres connection string from your Supabase project " +
      "(Project Settings -> Database -> Connection string -> Transaction pooler) into .env.local."
  );
}

// A small pool is enough for a Next.js server-action workload; Supabase's pooled connection
// string (port 6543, pgbouncer) is what DATABASE_URL should point at in serverless/edge-ish
// deployments so we don't exhaust Postgres's own connection limit.
// `prepare: false` is required against that pooler: it runs in pgbouncer "transaction mode",
// which doesn't support prepared statements (the postgres driver's default) — without this,
// queries don't error, they just hang.
const client = postgres(connectionString!, { max: 5, prepare: false });

export const db = drizzle(client, { schema });

/**
 * Every data-touching function in the app must go through this wrapper — it's the primary
 * tenant-isolation boundary. It runs `fn` inside a transaction with the Postgres session
 * variable `app.current_org_id` set to the caller's own organization, which every table's RLS
 * policy checks. `orgId` must come from the authenticated session (src/lib/session.ts), never
 * from client-supplied input — see the plan doc for why this is "required, primary" and RLS is
 * "defense in depth" rather than the only line of defense.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function withTenantContext<T>(orgId: string, fn: (tx: typeof db) => Promise<T>): Promise<T> {
  // Postgres's SET LOCAL doesn't accept bound parameters ($1-style placeholders don't work on
  // SET), so there's no parameterized alternative here — validate the shape strictly instead of
  // interpolating an unchecked string into SQL.
  if (!UUID_RE.test(orgId)) {
    throw new Error(`withTenantContext: orgId is not a valid UUID (got ${JSON.stringify(orgId)})`);
  }
  return db.transaction(async (tx) => {
    await tx.execute(`SET LOCAL app.current_org_id = '${orgId}'`);
    return fn(tx as unknown as typeof db);
  });
}
