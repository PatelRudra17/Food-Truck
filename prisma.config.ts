import path from "node:path";
import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// prisma.config.ts opts out of Prisma's legacy auto .env loading, so load it ourselves.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "tsx --env-file=.env prisma/seed.ts",
  },
});
