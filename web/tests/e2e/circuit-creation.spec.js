import { test, expect } from '@playwright/test';

test.describe('Circuit Creation', () => {
  test('can place Hadamard gate on qubit', async ({ page }) => {
    await page.goto('/');
    
    await page.click('.gate-btn:has-text("H")');
    
    const circuitView = page.locator('#circuit-view');
    const clickArea = circuitView.locator('rect[data-qubit="0"][data-time="0"]').first();
    await clickArea.click();
    
    await expect(circuitView.locator('text:has-text("H")')).toBeVisible();
  });

  test('can place multiple gates', async ({ page }) => {
    await page.goto('/');
    
    await page.click('.gate-btn:has-text("H")');
    await page.locator('rect[data-qubit="0"][data-time="0"]').first().click();
    
    await page.click('.gate-btn:has-text("S")');
    await page.locator('rect[data-qubit="0"][data-time="1"]').first().click();
    
    const circuitView = page.locator('#circuit-view');
    await expect(circuitView.locator('text:has-text("H")')).toBeVisible();
    await expect(circuitView.locator('text:has-text("S")')).toBeVisible();
  });

  test('gate selection highlights button', async ({ page }) => {
    await page.goto('/');
    
    const hButton = page.locator('.gate-btn:has-text("H")');
    await hButton.click();
    
    await expect(hButton).toHaveClass(/active/);
  });
});

