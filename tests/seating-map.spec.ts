import { test, expect } from '@playwright/test';

test.describe('Interactive Event Seating Map', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForSelector('h1', { timeout: 10000 });
    await page.waitForSelector('canvas', { timeout: 10000 });
  });

  test('should load the venue and display correct information', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Metropolis Arena');
    await expect(page.locator('text=/\\d+ total seats/')).toBeVisible();
  });

  test('should select and deselect seats', async ({ page }) => {
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    await canvas.click({ position: { x: 200, y: 200 } });
    await expect(page.locator('text=/Selected Seats \\(\\d+\\/8\\)/')).toBeVisible();
  });

  test('should toggle heat-map view', async ({ page }) => {
    await page.click('button:has-text("Heat-Map")');
    const heatMapButton = page.locator('button:has-text("Heat-Map")');
    await expect(heatMapButton).toHaveClass(/bg-purple-600/);
  });

  test('should find adjacent seats', async ({ page }) => {
    await page.fill('input[aria-label="Number of adjacent seats"]', '3');
    await page.click('text=Find 3 Seats');
    await expect(page.locator('text=/Found \\d+ adjacent seats/')).toBeVisible();
  });

  test('should toggle dark mode', async ({ page }) => {
    const darkModeButton = page.locator('button[aria-label="Toggle dark mode"]');
    await darkModeButton.click();
    const html = page.locator('html');
    await expect(html).toHaveClass(/dark/);
    await darkModeButton.click();
    await expect(html).not.toHaveClass(/dark/);
  });

  test('should load large venue (15k seats)', async ({ page }) => {
    await page.click('text=15K Seats');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=/15,000 total seats/')).toBeVisible();
  });

  test('should be keyboard accessible', async ({ page }) => {
    const canvas = page.locator('canvas');
    await canvas.click();
    await expect(canvas).toBeFocused();
  });
});

