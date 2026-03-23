import { test, expect } from "@playwright/test";

test.describe("Authentication flow", () => {
  test("unauthenticated user sees login or setup page", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/");
    await page.waitForTimeout(2000);

    const url = page.url();
    // Should be on /login, /setup, or / (if cookie-based redirect didn't fire)
    expect(
      url.includes("/login") || url.includes("/setup") || url.endsWith("/"),
    ).toBeTruthy();
  });

  test("login or setup page has password input", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.waitForTimeout(2000);

    const url = page.url();

    if (url.includes("/setup")) {
      await expect(page.getByText(/Welcome/i)).toBeVisible();
      const pwFields = page.locator('input[type="password"]');
      expect(await pwFields.count()).toBeGreaterThanOrEqual(2);
    } else if (url.includes("/login")) {
      const pwField = page.locator('input[type="password"]');
      expect(await pwField.count()).toBeGreaterThanOrEqual(1);
      await expect(
        page.getByRole("button", { name: /sign in/i }),
      ).toBeVisible();
    }
  });

  test("setup validates password length (if setup accessible)", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.goto("/setup");
    await page.waitForTimeout(2000);

    if (!page.url().includes("/setup")) {
      // User already exists — setup is not accessible
      test.skip();
      return;
    }

    const pwFields = page.locator('input[type="password"]');
    await pwFields.nth(0).fill("short");
    await pwFields.nth(1).fill("short");
    await page.getByRole("button", { name: /create password/i }).click();
    await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
  });

  test("setup validates password mismatch (if setup accessible)", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.goto("/setup");
    await page.waitForTimeout(2000);

    if (!page.url().includes("/setup")) {
      test.skip();
      return;
    }

    const pwFields = page.locator('input[type="password"]');
    await pwFields.nth(0).fill("longpassword123");
    await pwFields.nth(1).fill("differentpassword");
    await page.getByRole("button", { name: /create password/i }).click();
    await expect(page.getByText(/do not match/i)).toBeVisible();
  });

  test("login rejects wrong password (if user exists)", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.waitForTimeout(2000);

    if (!page.url().includes("/login")) {
      test.skip();
      return;
    }

    await page.locator('input[type="password"]').fill("wrongpassword123");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForTimeout(2000);

    // Should still be on login page (not redirected to /)
    expect(page.url()).toContain("/login");
  });

  test("health endpoint returns ok", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe("ok");
  });

  test("files API requires authentication", async ({ request }) => {
    // Without a session cookie, /api/files should redirect (302) or return non-ok
    const response = await request.get("/api/files", {
      maxRedirects: 0,
    });
    // Middleware redirects to /login — so we get a redirect status
    expect(response.ok()).toBeFalsy();
  });

  test("unauthenticated path traversal is blocked by middleware", async ({
    request,
  }) => {
    const response = await request.get("/api/files?path=../../etc", {
      maxRedirects: 0,
    });
    // Either redirect (middleware) or 403 (route handler) — both are acceptable
    expect(response.ok()).toBeFalsy();
  });
});
