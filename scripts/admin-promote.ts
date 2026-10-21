import { Pool } from "pg";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const operation = process.argv[3];
  const flag = operation === "promote";
  const url = process.env["MIGRATION_DATABASE_URL"];
  if (!["promote", "revoke"].includes(operation ?? "") || process.argv.length !== 4) {
    throw new Error("Specify an explicit promote or revoke operation using the migration-owner environment.");
  }
  if (!flag && email === "admin@bababuilds.com") {
    throw new Error("Cannot revoke the canonical root account through this CLI.");
  }

  if (!email || !url) {
    console.error("Usage: tsx scripts/admin-promote.ts <user-email> [promote|revoke]");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: url,
    max: 1,
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await pool.connect();
    try {
      const res = await client.query(
        "UPDATE users SET is_super_admin = $1 WHERE email = $2 RETURNING id, name, email, is_super_admin",
        [flag, email]
      );

      if (res.rowCount === 0) {
        console.error(`User with email "${email}" not found.`);
        process.exit(1);
      }

      const updated = res.rows[0];
      console.log(
        `Success: User ${updated.name} (${updated.email}) superadmin status set to: ${updated.is_super_admin}`
      );
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Failed to promote/demote user:", err);
  process.exit(1);
});
