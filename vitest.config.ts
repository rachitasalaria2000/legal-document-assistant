import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/*.test.ts"],
    exclude: ["tests/mysql.test.ts"],
    testTimeout: 30000,
  },
});
