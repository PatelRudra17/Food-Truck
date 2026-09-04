import path from "node:path";
import { defineConfig } from "vitest/config";

// Load the local .env (same file `npm run db:seed` reads via `tsx --env-file=.env`)
// so pure-unit tests that need env-derived config (e.g. src/lib/crypto.ts's
// DOCUMENT_ENCRYPTION_KEY, read through src/lib/env.ts) work under a plain
// `vitest run` without needing a running Next.js server. This never opens a
// database connection — it only populates process.env before test files load.
try {
  process.loadEnvFile(path.resolve(__dirname, ".env"));
} catch {
  // .env is optional (e.g. a CI box without one) — any test that genuinely
  // needs a var it defines will fail explicitly rather than silently skip.
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
