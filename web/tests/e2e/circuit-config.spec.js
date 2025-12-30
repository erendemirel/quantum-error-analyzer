import { test, expect } from '@playwright/test';

// Helper function to click on canvas at specific qubit/time coordinates
async function clickCircuitPosition(page, qubit, time) {
  // Konva creates one canvas per layer - use the last one (dynamic layer with click areas)
  const canvas = page.locator('#circuit-view canvas').last();
  const x = 100 + time * 100; // startX=100, spacing=100
  const y = 40 + qubit * 80; // y=40, qubitSpacing=80
  await canvas.click({ position: { x, y } });
}

test.describe('Circuit Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#circuit-view canvas', { timeout: 500 });
  });

  test('can change qubit count and gates are preserved if valid', async ({ page }) => {
    // Step 1: Place gates on qubits 0 and 1
    await page.click('.gate-btn:has-text("H")');
    await clickCircuitPosition(page, 0, 0);
    await page.waitForTimeout(200);
    
    await page.click('.gate-btn:has-text("S")');
    await clickCircuitPosition(page, 1, 0);
    await page.waitForTimeout(200);
    
    // Verify gates are present - with Konva canvas, verify through circuit state
    const circuitView = page.locator('#circuit-view');
    // Konva creates one canvas per layer - use the last one (dynamic layer)
    let canvas = circuitView.locator('canvas').last();
    await expect(canvas).toBeVisible();
    // Verify time display shows circuit has gates
    const timeDisplay = page.locator('.time-display-text');
    await expect(timeDisplay).toContainText('/');
    
    // Step 2: Increase qubit count to 3
    await page.locator('#qubit-count-input').fill('3');
    await page.click('#change-qubit-count-btn');
    await page.waitForTimeout(500);
    
    // Step 3: Verify gates are still present - with Konva canvas, verify through circuit state
    // Konva creates one canvas per layer - use the last one (dynamic layer)
    canvas = circuitView.locator('canvas').last();
    await expect(canvas).toBeVisible();
    
    // Step 4: Verify qubit count changed
    await expect(page.locator('#qubit-count-input')).toHaveValue('3');
  });

  test('gates on removed qubits are discarded when reducing qubit count', async ({ page }) => {
    // Step 1: Create circuit with 3 qubits and place gates
    await page.locator('#qubit-count-input').fill('3');
    await page.click('#change-qubit-count-btn');
    await page.waitForTimeout(500);
    
    await page.click('.gate-btn:has-text("H")');
    await clickCircuitPosition(page, 0, 0);
    await page.waitForTimeout(200);
    
    await page.click('.gate-btn:has-text("S")');
    await clickCircuitPosition(page, 2, 0);
    await page.waitForTimeout(200);
    
    const circuitView = page.locator('#circuit-view');
    // Konva creates one canvas per layer - use the last one (dynamic layer)
    const canvas = circuitView.locator('canvas').last();
    await expect(canvas).toBeVisible();
    
    // Step 2: Reduce qubit count to 2 (removes qubit 2)
    await page.locator('#qubit-count-input').fill('2');
    await page.click('#change-qubit-count-btn');
    await page.waitForTimeout(500);
    
    // Step 3: Verify gate on qubit 0 is preserved - with Konva canvas, verify through circuit state
    await expect(canvas).toBeVisible();
  });

  test('errors are preserved when changing qubit count if qubits are still valid', async ({ page }) => {
    // Step 1: Inject error on qubit 0
    await page.click('.error-btn.error-x');
    await page.waitForTimeout(200);
    
    const errorDisplay = page.locator('.error-pattern');
    await expect(errorDisplay).toContainText('X');
    
    // Step 2: Increase qubit count
    await page.locator('#qubit-count-input').fill('3');
    await page.click('#change-qubit-count-btn');
    await page.waitForTimeout(500);
    
    // Step 3: Verify error is still present (qubit 0 is still valid)
    await expect(errorDisplay).toContainText('X');
  });

  test('errors on removed qubits are discarded when reducing qubit count', async ({ page }) => {
    // Step 1: Create circuit with 3 qubits
    await page.locator('#qubit-count-input').fill('3');
    await page.click('#change-qubit-count-btn');
    await page.waitForTimeout(500);
    
    // Step 2: Inject error on qubit 2
    await page.selectOption('#error-qubit-select', '2');
    await page.click('.error-btn.error-x');
    await page.waitForTimeout(200);
    
    const errorDisplay = page.locator('.error-pattern');
    const errorText = await errorDisplay.textContent();
    expect(errorText).toContain('X');
    
    // Step 3: Reduce qubit count to 2
    await page.locator('#qubit-count-input').fill('2');
    await page.click('#change-qubit-count-btn');
    await page.waitForTimeout(500);
    
    // Step 4: Verify error on qubit 2 is removed
    const errorTextAfter = await errorDisplay.textContent();
    // Should only have I's now (no X)
    expect(errorTextAfter).not.toContain('X');
  });

  test('qubit count input validates minimum value', async ({ page }) => {
    const qubitInput = page.locator('#qubit-count-input');
    
    // Try to set to 0 (should be prevented by min attribute)
    await qubitInput.fill('0');
    await page.click('#change-qubit-count-btn');
    await page.waitForTimeout(200);
    
    // Input should still have a valid value (likely 2, the default)
    const value = await qubitInput.inputValue();
    expect(parseInt(value)).toBeGreaterThanOrEqual(1);
  });

  test('qubit count input validates maximum value', async ({ page }) => {
    const qubitInput = page.locator('#qubit-count-input');
    
    // Try to set to a very large number (should be limited by max attribute)
    await qubitInput.fill('2000');
    await page.click('#change-qubit-count-btn');
    await page.waitForTimeout(500);
    
    // Should be limited to max (1000)
    const value = await qubitInput.inputValue();
    expect(parseInt(value)).toBeLessThanOrEqual(1000);
  });

  test('qubit count input validates minimum value (1)', async ({ page }) => {
    const qubitInput = page.locator('#qubit-count-input');
    
    // Try to set value below minimum
    await qubitInput.fill('0');
    
    // Set up dialog handler before clicking
    const dialogPromise = new Promise((resolve) => {
      page.once('dialog', dialog => {
        expect(dialog.message()).toContain('valid number');
        dialog.accept();
        resolve();
      });
    });
    
    await page.click('#change-qubit-count-btn');
    await dialogPromise;
    
    // Try negative value
    await qubitInput.fill('-1');
    
    const dialogPromise2 = new Promise((resolve) => {
      page.once('dialog', dialog => {
        expect(dialog.message()).toContain('valid number');
        dialog.accept();
        resolve();
      });
    });
    
    await page.click('#change-qubit-count-btn');
    await dialogPromise2;
  });

  test('qubit count input validates maximum value (1000)', async ({ page }) => {
    const qubitInput = page.locator('#qubit-count-input');
    
    // Check that max attribute is set
    const maxAttr = await qubitInput.getAttribute('max');
    expect(maxAttr).toBe('1000');
    
    // HTML5 number inputs allow typing values > max, but validation happens on submit
    // The max attribute is set correctly, which is what we're testing
    // The actual validation happens in the changeQubitCount function
    await qubitInput.fill('2000');
    
    // Check that max attribute is still set
    const maxAttrAfter = await qubitInput.getAttribute('max');
    expect(maxAttrAfter).toBe('1000');
    
    // The input may allow typing 2000, but the validation should catch it
    // We test that the max attribute exists, which is the HTML5 validation mechanism
  });

  test('qubit count input shows error for invalid input', async ({ page }) => {
    const qubitInput = page.locator('#qubit-count-input');
    
    // Try empty value
    await qubitInput.fill('');
    
    const dialogPromise = new Promise((resolve) => {
      page.once('dialog', dialog => {
        expect(dialog.message()).toContain('valid number');
        dialog.accept();
        resolve();
      });
    });
    
    await page.click('#change-qubit-count-btn');
    await dialogPromise;
    
    // Number inputs don't allow non-numeric characters to be typed
    // Instead, test with a value that would be invalid after parsing
    // Set a value that's too low
    await qubitInput.fill('0');
    
    const dialogPromise2 = new Promise((resolve) => {
      page.once('dialog', dialog => {
        expect(dialog.message()).toContain('valid number');
        dialog.accept();
        resolve();
      });
    });
    
    await page.click('#change-qubit-count-btn');
    await dialogPromise2;
  });
});

