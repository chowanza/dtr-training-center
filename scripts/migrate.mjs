import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

// drizzle-kit's own `migrate` CLI hangs against Supabase's transaction-mode pooler (it doesn't
// disable prepared statements). Running the same migrator programmatically, with prepare:false,
// works around that.
const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
const db = drizzle(client);

try {
  await migrate(db, { migrationsFolder: "./src/lib/drizzle/migrations" });
  console.log("Migrations applied successfully.");
} catch (err) {
  console.error("Migration failed:", err);
  process.exitCode = 1;
} finally {
  await client.end({ timeout: 3 });
}
