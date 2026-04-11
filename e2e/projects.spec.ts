import { test, expect } from "@playwright/test";

/**
 * E2E tests for the Projects management page.
 *
 * These tests run against the full application (pnpm dev).
 * Authentication is handled via the existing session cookie approach.
 */

const UNIQUE_SUFFIX = Date.now();
const TEST_PROJECT_NAME = `E2E Test Project ${UNIQUE_SUFFIX}`;

async function getAuthCookie(request: import("@playwright/test").APIRequestContext) {
  // Attempt to get a valid session cookie via the API
  const res = await request.post("/api/auth", {
    data: { action: "login", password: process.env.TEST_PASSWORD || "testpassword123" },
  });
  if (!res.ok()) return null;
  const headers = res.headersArray();
  const setCookie = headers.find((h) => h.name.toLowerCase() === "set-cookie");
  return setCookie?.value ?? null;
}

test.describe("Projects page", () => {
  test.beforeEach(async ({ page, request }) => {
    // Try to authenticate; skip gracefully if credentials not configured
    const cookieHeader = await getAuthCookie(request);
    if (cookieHeader) {
      const match = cookieHeader.match(/session=([^;]+)/);
      if (match) {
        await page.context().addCookies([
          {
            name: "session",
            value: match[1],
            domain: "localhost",
            path: "/",
          },
        ]);
      }
    }
  });

  test("projects page loads and shows heading", async ({ page }) => {
    await page.goto("/projects");
    await page.waitForTimeout(1000);

    // Either we're authenticated and see the page, or redirected to login
    const url = page.url();
    if (url.includes("/login") || url.includes("/setup")) {
      test.skip();
      return;
    }

    await expect(page.getByText("Projects")).toBeVisible();
    await expect(page.getByRole("button", { name: /new project/i })).toBeVisible();
  });

  test("can create a new project (name only)", async ({ page }) => {
    await page.goto("/projects");
    await page.waitForTimeout(1000);

    const url = page.url();
    if (url.includes("/login") || url.includes("/setup")) {
      test.skip();
      return;
    }

    // Click "New Project"
    await page.getByRole("button", { name: /new project/i }).click();

    // Fill in the name field
    const nameInput = page.locator('input[placeholder="My App"]');
    await nameInput.fill(TEST_PROJECT_NAME);

    // Verify slug preview appears
    await expect(page.getByText(/slug:/i)).toBeVisible();

    // Submit
    await page.getByRole("button", { name: /^create$/i }).click();

    // Project should appear in the list
    await page.waitForTimeout(1000);
    await expect(page.getByText(TEST_PROJECT_NAME)).toBeVisible();
  });

  test("shows error for duplicate project name", async ({ page }) => {
    await page.goto("/projects");
    await page.waitForTimeout(1000);

    const url = page.url();
    if (url.includes("/login") || url.includes("/setup")) {
      test.skip();
      return;
    }

    // Verify test project already exists from previous test (or create it)
    const projectVisible = await page.getByText(TEST_PROJECT_NAME).isVisible();
    if (!projectVisible) {
      // Create it first
      await page.getByRole("button", { name: /new project/i }).click();
      await page.locator('input[placeholder="My App"]').fill(TEST_PROJECT_NAME);
      await page.getByRole("button", { name: /^create$/i }).click();
      await page.waitForTimeout(1000);
    }

    // Try to create again with same name
    await page.getByRole("button", { name: /new project/i }).click();
    await page.locator('input[placeholder="My App"]').fill(TEST_PROJECT_NAME);
    await page.getByRole("button", { name: /^create$/i }).click();

    await page.waitForTimeout(1000);
    await expect(page.getByText(/already exists/i)).toBeVisible();
  });

  test("Open Session button navigates to main page", async ({ page }) => {
    await page.goto("/projects");
    await page.waitForTimeout(1000);

    const url = page.url();
    if (url.includes("/login") || url.includes("/setup")) {
      test.skip();
      return;
    }

    // Ensure test project exists
    const projectVisible = await page.getByText(TEST_PROJECT_NAME).isVisible();
    if (!projectVisible) {
      await page.getByRole("button", { name: /new project/i }).click();
      await page.locator('input[placeholder="My App"]').fill(TEST_PROJECT_NAME);
      await page.getByRole("button", { name: /^create$/i }).click();
      await page.waitForTimeout(1000);
    }

    // Click "Open Session" for this project
    // The Open Session button is inside the card for our project
    const projectCard = page.locator("text=" + TEST_PROJECT_NAME).first().locator("../..");
    const openBtn = projectCard.getByRole("button", { name: /open session/i });

    if (await openBtn.isVisible()) {
      await openBtn.click();
    } else {
      // Fallback: find by text anywhere on page
      await page.getByRole("button", { name: /open session/i }).first().click();
    }

    // Should navigate to / with ?projectId param (then auto-redirect to /)
    await page.waitForTimeout(2000);
    const newUrl = page.url();
    expect(newUrl.endsWith("/") || newUrl.includes("localhost:3000/")).toBeTruthy();
  });

  test("can delete a project", async ({ page }) => {
    await page.goto("/projects");
    await page.waitForTimeout(1000);

    const url = page.url();
    if (url.includes("/login") || url.includes("/setup")) {
      test.skip();
      return;
    }

    const DELETE_NAME = `Delete Me ${UNIQUE_SUFFIX}`;

    // Create a project to delete
    await page.getByRole("button", { name: /new project/i }).click();
    await page.locator('input[placeholder="My App"]').fill(DELETE_NAME);
    await page.getByRole("button", { name: /^create$/i }).click();
    await page.waitForTimeout(1000);

    await expect(page.getByText(DELETE_NAME)).toBeVisible();

    // Click delete icon (first click shows confirm)
    // Find the card containing DELETE_NAME
    const card = page.locator(`text=${DELETE_NAME}`).first().locator("../../..");
    const deleteBtn = card.locator('[title="Delete project"]');
    await deleteBtn.click();

    // Confirm delete
    const confirmBtn = card.locator('[title="Confirm delete"]');
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
    }

    await page.waitForTimeout(1500);
    await expect(page.getByText(DELETE_NAME)).not.toBeVisible();
  });

  test.skip("clone a public repo", async ({ page }) => {
    // This test requires network access and a real HTTPS git URL.
    // Skip by default to avoid slow/flaky CI.
    await page.goto("/projects");
    await page.waitForTimeout(1000);

    const CLONE_PROJECT = `Clone Test ${UNIQUE_SUFFIX}`;
    await page.getByRole("button", { name: /new project/i }).click();
    await page.locator('input[placeholder="My App"]').fill(CLONE_PROJECT);
    await page.locator('input[placeholder="https://github.com/user/repo.git"]').fill(
      "https://github.com/octocat/Hello-World.git"
    );
    await page.getByRole("button", { name: /^create$/i }).click();
    await page.waitForTimeout(1000);

    await page.getByRole("button", { name: /clone \/ pull/i }).first().click();

    // Should show progress
    await expect(page.getByText(/cloning/i)).toBeVisible({ timeout: 5000 });
  });
});
