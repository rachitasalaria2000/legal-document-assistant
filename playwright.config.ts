import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  use: { baseURL: "http://localhost:3003", channel: "msedge" },
  webServer: {
    command: "npm start",
    url: "http://localhost:3003/api/health",
    reuseExistingServer: true,
  },
  reporter: "list",
});
