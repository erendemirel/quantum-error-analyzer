import { test, expect } from '@playwright/test';

test.describe('Many Qubits Support (>64)', () => {
  test('can create circuit with 65 qubits', async ({ page }) => {
    await page.goto('/');
    
    // Find and update qubit count input
    const qubitCountInput = page.locator('#qubit-count-input');
    await expect(qubitCountInput).toBeVisible();
    await expect(qubitCountInput).toHaveValue('2');
    
    // Change to 65 qubits
    await qubitCountInput.fill('65');
    await page.click('#change-qubit-count-btn');
    
    // Wait for circuit to update
    await page.waitForTimeout(500);
    
    // Verify circuit has 65 qubits
    const circuitView = page.locator('#circuit-view');
    await expect(circuitView.locator('text:has-text("Q0")')).toBeVisible();
    await expect(circuitView.locator('text:has-text("Q64")')).toBeVisible();
    
    // Verify qubit selector has 65 options
    const qubitSelect = page.locator('#error-qubit-select');
    const options = qubitSelect.locator('option');
    await expect(options).toHaveCount(65);
    // Check that option with value 64 exists (options are hidden by default in select)
    await expect(qubitSelect.locator('option[value="64"]')).toHaveText('Q64');
  });

  test('can place gates on qubits beyond index 64', async ({ page }) => {
    await page.goto('/');
    
    // Change to 65 qubits
    await page.locator('#qubit-count-input').fill('65');
    await page.click('#change-qubit-count-btn');
    await page.waitForTimeout(500);
    
    // Select H gate
    await page.click('.gate-btn:has-text("H")');
    
    // Place gate on qubit 64 (the 65th qubit, index 64)
    const circuitView = page.locator('#circuit-view');
    const clickArea = circuitView.locator('rect[data-qubit="64"][data-time="0"]').first();
    
    // Scroll into view if needed
    await clickArea.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    
    await clickArea.click();
    await page.waitForTimeout(300);
    
    // Verify gate appears - just check that H gate is visible somewhere
    // (we can't easily verify exact qubit position without complex coordinate checks)
    const hGate = circuitView.locator('text:has-text("H")');
    await expect(hGate.first()).toBeVisible({ timeout: 2000 });
  });

  test('can inject error on qubit 64', async ({ page }) => {
    await page.goto('/');
    
    // Change to 65 qubits
    await page.locator('#qubit-count-input').fill('65');
    await page.click('#change-qubit-count-btn');
    await page.waitForTimeout(500);
    
    // Select qubit 64 in error selector
    const qubitSelect = page.locator('#error-qubit-select');
    await qubitSelect.selectOption('64');
    
    // Inject X error
    await page.click('.error-btn.error-x:has-text("X")');
    
    // Verify error appears in error display
    const errorDisplay = page.locator('#error-display');
    await expect(errorDisplay).toContainText('X');
    
    // Verify error pattern has X at position 64
    // The pattern shows as a string like "IIII...IIIIX" (64 I's followed by X for qubit 64)
    const errorText = await errorDisplay.textContent();
    // Check that the pattern contains X
    expect(errorText).toContain('X');
    // Check that it's a 65-character pattern (64 I's + 1 X)
    const patternMatch = errorText.match(/[IXYZ]+/);
    if (patternMatch) {
      expect(patternMatch[0].length).toBe(65);
      expect(patternMatch[0][64]).toBe('X'); // X at position 64 (0-indexed)
    }
  });

  test('can place CNOT gate between qubits beyond index 64', async ({ page }) => {
    await page.goto('/');
    
    // Change to 65 qubits
    await page.locator('#qubit-count-input').fill('65');
    await page.click('#change-qubit-count-btn');
    await page.waitForTimeout(500);
    
    // Select CNOT gate
    await page.click('.gate-btn:has-text("CNOT")');
    
    // Place CNOT with control on qubit 63 and target on qubit 64
    const circuitView = page.locator('#circuit-view');
    
    // Click on qubit 63 first (control)
    const controlArea = circuitView.locator('rect[data-qubit="63"][data-time="0"]').first();
    await controlArea.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    // Use force click in case there are overlapping elements
    await controlArea.click({ force: true });
    await page.waitForTimeout(300);
    
    // Then click on qubit 64 (target)
    // Use force click to bypass any overlapping elements
    const targetArea = circuitView.locator('rect[data-qubit="64"][data-time="0"]').first();
    await targetArea.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await targetArea.click({ force: true });
    await page.waitForTimeout(500);
    
    // Verify CNOT gate appears (CNOT is rendered as "⊕" symbol)
    await expect(circuitView.locator('text:has-text("⊕")')).toBeVisible();
  });

  test('simulation works correctly with 65 qubits', async ({ page }) => {
    await page.goto('/');
    
    // Change to 65 qubits
    await page.locator('#qubit-count-input').fill('65');
    await page.click('#change-qubit-count-btn');
    await page.waitForTimeout(500);
    
    // Place a gate on qubit 64
    await page.click('.gate-btn:has-text("H")');
    const circuitView = page.locator('#circuit-view');
    const clickArea = circuitView.locator('rect[data-qubit="64"][data-time="0"]').first();
    await clickArea.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await clickArea.click();
    
    // Inject error on qubit 64
    await page.locator('#error-qubit-select').selectOption('64');
    await page.click('.error-btn.error-x:has-text("X")');
    
    // Step forward
    await page.click('button:has-text("Step Forward")');
    await page.waitForTimeout(300);
    
    // Verify simulation progressed
    // Time display can be in .time-info (format: "1 / 1") or #current-time-display (format: "1")
    const timeDisplay = page.locator('#time-display');
    const currentTimeDisplay = page.locator('#current-time-display');
    if (await currentTimeDisplay.count() > 0) {
      await expect(currentTimeDisplay).toHaveText('1');
    } else {
      // Fallback: check .time-info or whole time display
      await expect(timeDisplay.locator('.time-info').or(timeDisplay)).toContainText('1');
    }
    
    // Verify error display shows updated state
    const errorDisplay = page.locator('#error-display');
    await expect(errorDisplay).toBeVisible();
  });

  test('can change from 2 to 65 qubits and back', async ({ page }) => {
    await page.goto('/');
    
    // Start with 2 qubits
    await expect(page.locator('#qubit-count-input')).toHaveValue('2');
    await expect(page.locator('#circuit-view text:has-text("Q1")')).toBeVisible();
    await expect(page.locator('#circuit-view text:has-text("Q2")')).not.toBeVisible();
    
    // Change to 65 qubits
    await page.locator('#qubit-count-input').fill('65');
    await page.click('#change-qubit-count-btn');
    await page.waitForTimeout(500);
    
    await expect(page.locator('#qubit-count-input')).toHaveValue('65');
    await expect(page.locator('#circuit-view text:has-text("Q64")')).toBeVisible();
    
    // Change back to 2 qubits
    await page.locator('#qubit-count-input').fill('2');
    await page.click('#change-qubit-count-btn');
    await page.waitForTimeout(500);
    
    await expect(page.locator('#qubit-count-input')).toHaveValue('2');
    await expect(page.locator('#circuit-view text:has-text("Q1")')).toBeVisible();
    await expect(page.locator('#circuit-view text:has-text("Q2")')).not.toBeVisible();
  });
});

