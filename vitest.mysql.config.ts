import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["tests/mysql.test.ts"], testTimeout: 30000 },
});
