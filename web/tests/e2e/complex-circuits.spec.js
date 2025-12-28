import { test, expect } from '@playwright/test';

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

test.describe('Complex Circuits', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.circuit-svg', { timeout: 5000 });
  });

  test('multi-gate circuit propagates errors correctly', async ({ page }) => {
    await page.click('.error-btn.error-x');
    
    await page.click('.gate-btn:has-text("H")');
    await page.locator('rect[data-qubit="0"][data-time="0"]').first().click();
    
    await page.click('.gate-btn:has-text("S")');
    await page.locator('rect[data-qubit="0"][data-time="1"]').first().click();
    
    await stepToTime(page, 1);
    let errorPattern = await page.locator('.error-pattern').textContent();
    expect(errorPattern).toMatch(/^ZI$/);
    
    await stepToTime(page, 2);
    errorPattern = await page.locator('.error-pattern').textContent();
    // S gate: Z stays Z (doesn't transform to iY)
    // Physics: S Z S† = Z (Z is unchanged by S gate)
    expect(errorPattern).toMatch(/^ZI$/);
  });

  test('circuit with multiple qubits handles errors correctly', async ({ page }) => {
    await page.click('.error-btn.error-x');
    
    await page.click('.gate-btn:has-text("H")');
    await page.locator('rect[data-qubit="0"][data-time="0"]').first().click();
    
    await page.click('.gate-btn:has-text("CNOT")');
    await page.locator('rect[data-qubit="0"][data-time="1"]').first().click();
    
    await stepToTime(page, 1);
    await expect(page.locator('.error-pattern')).toContainText('ZI');
    
    await stepToTime(page, 2);
    const errorPattern = await page.locator('.error-pattern').textContent();
    // CNOT: Z on control stays on control (doesn't spread to target)
    // Physics: Z on control with CNOT stays ZI, not ZZ
    expect(errorPattern).toMatch(/^ZI$/);
  });

  test('parallel gates at same time step', async ({ page }) => {
    const logs = [];
    page.on('console', msg => {
      if (msg.text().includes('[DEBUG]')) {
        logs.push(msg.text());
      }
    });
    
    await page.click('.error-btn.error-x');  // X on Q0 (default)
    await page.selectOption('#error-qubit-select', '1');  // Select Q1
    await page.click('.error-btn.error-z');  // Z on Q1
    
    await page.click('.gate-btn:has-text("H")');
    await page.locator('rect[data-qubit="0"][data-time="0"]').first().click();
    await page.waitForTimeout(50);  // Wait for gate placement to complete
    
    // Re-select H gate for placing second gate (it may have been deselected)
    await page.click('.gate-btn:has-text("H")');
    await page.waitForTimeout(50);  // Wait for gate selection
    await page.locator('rect[data-qubit="1"][data-time="0"]').first().click();
    
    await stepToTime(page, 1);
    const errorPattern = await page.locator('.error-pattern').textContent();
    
    console.log('Captured console logs:', logs);
    expect(errorPattern).toMatch(/^ZX$/);
  });

  test('circuit depth calculation for parallel gates', async ({ page }) => {
    await page.click('.gate-btn:has-text("H")');
    await page.locator('rect[data-qubit="0"][data-time="0"]').first().click();
    
    await page.click('.gate-btn:has-text("H")');
    await page.locator('rect[data-qubit="1"][data-time="0"]').first().click();
    
    const timeDisplay = page.locator('.time-display-text');
    await expect(timeDisplay).toContainText('/ 1');
  });

  test('multi-step circuit with different gates', async ({ page }) => {
    const logs = [];
    page.on('console', msg => {
      if (msg.text().includes('[DEBUG]')) {
        logs.push(msg.text());
      }
    });
    
    await page.click('.error-btn.error-x');
    
    await page.click('.gate-btn:has-text("H")');
    await page.locator('rect[data-qubit="0"][data-time="0"]').first().click();
    
    await page.click('.gate-btn:has-text("S")');
    await page.locator('rect[data-qubit="0"][data-time="1"]').first().click();
    
    await page.click('.gate-btn:has-text("CNOT")');
    await page.locator('rect[data-qubit="0"][data-time="2"]').first().click();
    
    await stepToTime(page, 1);
    let errorPattern = await page.locator('.error-pattern').textContent();
    expect(errorPattern).toMatch(/^ZI$/);
    
    await stepToTime(page, 2);
    errorPattern = await page.locator('.error-pattern').textContent();
    // S gate: Z stays Z (doesn't transform to iY)
    // Physics: S Z S† = Z (Z is unchanged by S gate)
    expect(errorPattern).toMatch(/^ZI$/);
    
    await stepToTime(page, 3);
    errorPattern = await page.locator('.error-pattern').textContent();
    
    console.log('Captured console logs:', logs);
    // CNOT with Z on control: Z commutes with CNOT, so Z stays on control
    // Physics: CNOT with Z on control -> Z stays on control, I on target
    expect(errorPattern).toMatch(/^ZI$/);
  });
});
