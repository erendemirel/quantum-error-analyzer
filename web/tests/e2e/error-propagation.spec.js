import { test, expect } from '@playwright/test';

// Helper function to click on canvas at specific qubit/time coordinates
async function clickCircuitPosition(page, qubit, time) {
  // Konva creates one canvas per layer - use the last one (dynamic layer with click areas)
  const canvas = page.locator('#circuit-view canvas').last();
  const x = 100 + time * 100; // startX=100, spacing=100
  const y = 40 + qubit * 80; // y=40, qubitSpacing=80
  await canvas.click({ position: { x, y } });
}

// Helper function to step to a specific time using step buttons
async function stepToTime(page, targetTime) {
  const currentTimeDisplay = await page.locator('#current-time-display').textContent();
  const currentTime = parseInt(currentTimeDisplay || '0');
  
  if (targetTime > currentTime) {
    // Step forward
    for (let i = currentTime; i < targetTime; i++) {
      await page.click('#step-forward-btn');
      await page.waitForTimeout(50);
    }
  } else if (targetTime < currentTime) {
    // Step backward
    for (let i = currentTime; i > targetTime; i--) {
      await page.click('#step-back-btn');
      await page.waitForTimeout(50);
    }
  }
  await page.waitForTimeout(100); // Wait for UI to update
}

test.describe('Error Propagation - UI Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#circuit-view canvas', { timeout: 500 });
  });

  test('X error propagates through H gate to Z', async ({ page }) => {
    await page.click('.error-btn.error-x');
    let errorDisplay = page.locator('.error-pattern');
    await expect(errorDisplay).toContainText('XI');
    
    await page.click('.gate-btn:has-text("H")');
    await clickCircuitPosition(page, 0, 0);
    
    await stepToTime(page, 1);
    
    errorDisplay = page.locator('.error-pattern');
    await expect(errorDisplay).toContainText('ZI');
  });

  test('X error propagates through S gate to Y with phase', async ({ page }) => {
    await page.click('.error-btn.error-x');
    await expect(page.locator('.error-pattern')).toContainText('XI');
    
    await page.click('.gate-btn:has-text("S")');
    await clickCircuitPosition(page, 0, 0);
    
    await stepToTime(page, 1);
    
    const errorDisplay = page.locator('.error-pattern');
    const text = await errorDisplay.textContent();
    expect(text).toMatch(/iYI/);
  });

  test('time display updates after stepping', async ({ page }) => {
    await page.click('.gate-btn:has-text("H")');
    await clickCircuitPosition(page, 0, 0);
    
    const timeDisplay = page.locator('.time-display-text');
    await expect(timeDisplay).toContainText('0 / 1');
    
    await stepToTime(page, 1);
    await expect(timeDisplay).toContainText('1 / 1');
  });

  test('can step backward using step buttons', async ({ page }) => {
    await page.click('.error-btn.error-x');
    await page.click('.gate-btn:has-text("H")');
    await clickCircuitPosition(page, 0, 0);
    
    await stepToTime(page, 1);
    await expect(page.locator('.error-pattern')).toContainText('ZI');
    
    await stepToTime(page, 0);
    await expect(page.locator('.error-pattern')).toContainText('XI');
  });

  test('reset clears all errors and resets circuit', async ({ page }) => {
    await page.click('.error-btn.error-x');
    await page.click('.gate-btn:has-text("H")');
    await clickCircuitPosition(page, 0, 0);
    
    await stepToTime(page, 1);
    await expect(page.locator('.error-pattern')).toContainText('ZI');
    
    await page.click('button:has-text("Reset")');
    await page.waitForTimeout(100);
    // Reset clears all errors, so pattern should be II
    await expect(page.locator('.error-pattern')).toContainText('II');
    
    const timeDisplay = page.locator('.time-display-text');
    await expect(timeDisplay).toContainText('0 /');
  });

  test('error pattern persists when navigating time', async ({ page }) => {
    await page.click('.error-btn.error-x');
    
    await page.click('.gate-btn:has-text("H")');
    await clickCircuitPosition(page, 0, 0);
    
    await page.click('.gate-btn:has-text("S")');
    await clickCircuitPosition(page, 0, 1);
    
    await stepToTime(page, 1);
    await expect(page.locator('.error-pattern')).toContainText('ZI');
    
    await stepToTime(page, 2);
    // S gate: Z stays Z (doesn't transform to iY)
    // Physics: S Z S† = Z (Z is unchanged by S gate)
    await expect(page.locator('.error-pattern')).toContainText('ZI');
    
    await stepToTime(page, 0);
    await expect(page.locator('.error-pattern')).toContainText('XI');
  });
});
