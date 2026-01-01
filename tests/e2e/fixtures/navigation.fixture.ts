import { Page, expect } from '@playwright/test';

export async function openWorkerBottomNav(
  page: Page,
  label: string,
  urlPattern: string | RegExp
): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  const navLink = page.getByRole('link', { name: label, exact: true }).first();
  await expect(navLink).toBeVisible();
  await navLink.click();
  await page.waitForURL(urlPattern, { waitUntil: 'domcontentloaded' });
}

export async function openMyPageMenu(
  page: Page,
  label: string,
  urlPattern: string | RegExp
): Promise<void> {
  await openWorkerBottomNav(page, 'マイページ', /\/mypage/);
  const menuButton = page.locator('button', { hasText: label }).first();
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  await page.waitForURL(urlPattern, { waitUntil: 'domcontentloaded' });
}

export async function openAdminNav(
  page: Page,
  label: string,
  urlPattern: string | RegExp
): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  const navLink = page.getByRole('navigation').getByRole('link', { name: label, exact: true }).first();
  await expect(navLink).toBeVisible();
  await navLink.click();
  await page.waitForURL(urlPattern, { waitUntil: 'domcontentloaded' });
}

export async function openSystemAdminNav(
  page: Page,
  label: string,
  urlPattern: string | RegExp
): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  const navLink = page.getByRole('navigation').getByRole('link', { name: label, exact: true }).first();
  await expect(navLink).toBeVisible();
  await navLink.click();
  await page.waitForURL(urlPattern, { waitUntil: 'domcontentloaded' });
}
