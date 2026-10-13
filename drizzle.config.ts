import { defineConfig } from "drizzle-kit";
import path from "path";

const dbPath = process.env["DATABASE_URL"] ?? path.join(process.cwd(), "data", "menuminute.sqlite");

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: dbPath,
  },
  verbose: true,
  strict: true,
});
