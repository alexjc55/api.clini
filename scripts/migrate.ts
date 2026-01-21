import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error("ERROR: DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  // Safety check: require explicit confirmation for production migrations
  const isProduction = process.env.NODE_ENV === "production";
  const migrateConfirm = process.env.MIGRATE_CONFIRM === "1";
  
  if (isProduction && !migrateConfirm) {
    console.error("ERROR: Production migration requires MIGRATE_CONFIRM=1");
    console.error("Run: MIGRATE_CONFIRM=1 npx tsx scripts/migrate.ts");
    process.exit(1);
  }

  // Parse and display database info for verification
  const dbUrl = new URL(databaseUrl);
  const dbHost = dbUrl.hostname;
  const dbName = dbUrl.pathname.slice(1);
  
  console.log("=".repeat(50));
  console.log("DATABASE MIGRATION");
  console.log("=".repeat(50));
  console.log(`Host: ${dbHost}`);
  console.log(`Database: ${dbName}`);
  console.log(`Environment: ${isProduction ? "PRODUCTION" : "development"}`);
  console.log("=".repeat(50));

  if (isProduction) {
    console.log("\nWARNING: You are migrating a PRODUCTION database!");
    console.log("Make sure you have created a backup before proceeding.\n");
  }

  console.log("Connecting to database...");

  // SSL configuration note: rejectUnauthorized: false is required for many cloud providers
  // (Neon, Supabase, Railway, etc.) that use self-signed certificates
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
  });

  try {
    const client = await pool.connect();
    console.log("Connected to database successfully");
    client.release();

    const db = drizzle(pool);

    console.log("Running migrations from ./migrations folder...");
    await migrate(db, { migrationsFolder: "./migrations" });

    console.log("Migrations completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
