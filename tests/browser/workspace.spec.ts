import { test, expect } from "@playwright/test";
test("real server shows a clear missing-key state", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Read the terms. Find the connections.",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("OpenAI is not configured.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ask question", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Select PDF file", { exact: true })
    .setInputFiles("demo/sample-services-agreement.pdf");
  await expect(page.getByRole("alert")).toContainText("OPENAI_API_KEY");
});
test("chat displays source references and keeps retryable questions (controlled API responses)", async ({
  page,
}) => {
  await page.route("**/api/health", (r) =>
    r.fulfill({ json: { aiConfigured: true } }),
  );
  await page.route("**/api/documents", (r) =>
    r.fulfill({
      json: [
        {
          id: 1,
          filename: "contract.pdf",
          status: "ready",
          total_pages: 100,
          total_chunks: 140,
        },
      ],
    }),
  );
  let attempts = 0;
  await page.route("**/api/chat", (r) => {
    attempts++;
    return attempts === 1
      ? r.fulfill({
          status: 502,
          json: { error: "OpenAI is temporarily unavailable." },
        })
      : r.fulfill({
          json: {
            answer: "Outstanding fees remain due [5].",
            searches: 2,
            sources: [
              {
                id: 5,
                filename: "contract.pdf",
                page: 42,
                heading: "Termination",
                excerpt: "The customer must pay outstanding fees.",
              },
            ],
          },
        });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /PDF contract.pdf/ }).click();
  const input = page.getByLabel("Ask a question");
  await input.fill("What survives termination?");
  await page.getByRole("button", { name: "Ask question", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  await expect(input).toHaveValue("What survives termination?");
  await page.getByRole("button", { name: "Ask question", exact: true }).click();
  await expect(
    page.getByText("Outstanding fees remain due [5].", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Page 42/ }).click();
  await expect(
    page.getByText("The customer must pay outstanding fees.", { exact: true }),
  ).toBeVisible();
});
test("mobile workspace fits without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "Choose PDF", exact: true }),
  ).toBeVisible();
});
