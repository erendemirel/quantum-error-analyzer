import { test, expect } from '@playwright/test';

test.describe('Error Injection', () => {
  test('can inject X error', async ({ page }) => {
    const logs = [];
    page.on('console', msg => logs.push(msg.text()));
    
    await page.goto('/');
    
    await page.click('.error-btn.error-x');
    
    console.log('Captured console logs:', logs);
    
    const errorDisplay = page.locator('.error-pattern');
    await expect(errorDisplay).toContainText('X');
  });

  test('can inject Y error', async ({ page }) => {
    await page.goto('/');
    
    await page.click('.error-btn.error-y');
    
    const errorDisplay = page.locator('.error-pattern');
    await expect(errorDisplay).toContainText('Y');
  });

  test('can inject Z error', async ({ page }) => {
    await page.goto('/');
    
    await page.click('.error-btn.error-z');
    
    const errorDisplay = page.locator('.error-pattern');
    await expect(errorDisplay).toContainText('Z');
  });

  test('error pattern displays correctly for multiple qubits', async ({ page }) => {
    await page.goto('/');
    
    await page.click('.error-btn.error-x');
    
    const errorDisplay = page.locator('.error-pattern');
    const text = await errorDisplay.textContent();
    
    expect(text).toMatch(/^[XI]{2}$/);
  });
});

