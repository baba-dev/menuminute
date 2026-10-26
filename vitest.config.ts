import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    env: {
      APP_URL: "http://localhost:3000",
      AUTH_SECRET: "isolated-test-key-with-at-least-32-characters",
      DATABASE_URL:
        process.env["DATABASE_URL"] ??
        "postgresql://menuminute_app:local-test@127.0.0.1:5432/menuminute_test",
      REDIS_QUEUE_URL: process.env["REDIS_QUEUE_URL"] ?? "redis://127.0.0.1:6379",
      REDIS_CACHE_URL: process.env["REDIS_CACHE_URL"] ?? "redis://127.0.0.1:6380",
      ORDER_EDGE_SHARED_SECRET:
        process.env["ORDER_EDGE_SHARED_SECRET"] ?? "isolated-ci-signed-edge-secret-32-bytes",
      MEDIA_STORAGE: process.env["MEDIA_STORAGE"] ?? "local",
      MEDIA_ROOT: process.env["MEDIA_ROOT"] ?? "/tmp/menuminute-test-media",
      MEDIA_OUTLET_BUDGET_BYTES: process.env["MEDIA_OUTLET_BUDGET_BYTES"] ?? "104857600",
    },
    testTimeout: 15000,
    fileParallelism: false,
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}", "tests/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/**",
        "tests/**",
        ".next/**",
        "next.config.ts",
        "vitest.config.ts",
        "playwright.config.ts",
        "src/**/*.d.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
