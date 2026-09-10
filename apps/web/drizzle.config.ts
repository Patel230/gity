import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./functions/lib/schema.ts",
  out: "./migrations",
  strict: true,
  verbose: true,
});
