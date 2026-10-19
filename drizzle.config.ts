import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env["MIGRATION_DATABASE_URL"] ?? "postgresql://localhost/menuminute",
  },
  strict: true,
});
