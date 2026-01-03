import { test, expect } from '@playwright/test';

test('home page loads successfully', async ({ page }) => {
  await page.goto('/');

  // Verify the page loaded by checking it has a title
  // Note: May show login/auth screen if not authenticated
  // The app uses Clerk for auth, so we just verify the page loads
  await expect(page).toHaveTitle(/.+/);
});

test('page has root element', async ({ page }) => {
  await page.goto('/');

  // Verify the React app mounted
  const root = page.locator('#root');
  await expect(root).toBeVisible();
});
