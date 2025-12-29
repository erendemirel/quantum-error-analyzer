import { test, expect } from '@playwright/test';

test.describe('UI Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.circuit-svg', { timeout: 5000 });
  });

  test('click areas highlight on hover', async ({ page }) => {
    // Select a gate first
    await page.click('.gate-btn:has-text("H")');
    
    // Hover over a click area
    const clickArea = page.locator('rect.gate-placement-area[data-qubit="0"][data-time="0"]').first();
    
    // Get initial fill/stroke
    const initialFill = await clickArea.getAttribute('fill');
    const initialStroke = await clickArea.getAttribute('stroke');
    
    // Hover over the click area
    await clickArea.hover();
    await page.waitForTimeout(100);
    
    // Check that highlight is applied (fill or stroke changed)
    const hoveredFill = await clickArea.getAttribute('fill');
    const hoveredStroke = await clickArea.getAttribute('stroke');
    
    // Either fill or stroke should change to indicate highlight
    const isHighlighted = hoveredFill !== initialFill || hoveredStroke !== initialStroke;
    expect(isHighlighted).toBe(true);
  });

  test('click area highlight persists when moving to gate', async ({ page }) => {
    // Place a gate first
    await page.click('.gate-btn:has-text("H")');
    await page.locator('rect[data-qubit="0"][data-time="0"]').first().click();
    await page.waitForTimeout(200);
    
    // Select another gate for placement
    await page.click('.gate-btn:has-text("S")');
    
    // Hover over click area
    const clickArea = page.locator('rect.gate-placement-area[data-qubit="0"][data-time="1"]').first();
    await clickArea.hover();
    await page.waitForTimeout(100);
    
    // Move to the gate element (if it exists at that position)
    // The highlight should persist due to _isGateHovered flag
    const gate = page.locator('g[data-qubit="0"][data-time="0"]').first();
    if (await gate.count() > 0) {
      await gate.hover();
      await page.waitForTimeout(100);
      
      // Click area should still be highlighted
      const stroke = await clickArea.getAttribute('stroke');
      expect(stroke).toBeTruthy();
    }
  });

  test('gates show opacity change on hover', async ({ page }) => {
    // Place a gate
    await page.click('.gate-btn:has-text("H")');
    await page.locator('rect[data-qubit="0"][data-time="0"]').first().click();
    await page.waitForTimeout(200);
    
    // Find the gate element - use gate-symbol class to target the actual gate text/element
    // This avoids matching the click area which is a rect
    const gate = page.locator('.gate-symbol[data-qubit="0"][data-time="0"]').first();
    await expect(gate).toBeVisible();
    
    // Get initial opacity (should be 1 or not set)
    const initialOpacity = await gate.evaluate(el => window.getComputedStyle(el).opacity);
    
    // Hover over the gate using force to bypass pointer interception
    await gate.hover({ force: true });
    await page.waitForTimeout(100);
    
    // Check that opacity changed to 0.8
    const hoveredOpacity = await gate.evaluate(el => window.getComputedStyle(el).opacity);
    expect(parseFloat(hoveredOpacity)).toBeCloseTo(0.8, 1);
    
    // Move away
    await page.mouse.move(0, 0);
    await page.waitForTimeout(100);
    
    // Opacity should return to 1
    const finalOpacity = await gate.evaluate(el => window.getComputedStyle(el).opacity);
    expect(parseFloat(finalOpacity)).toBeCloseTo(1, 1);
  });

  test('gate hover highlights corresponding click area', async ({ page }) => {
    // Place a gate
    await page.click('.gate-btn:has-text("H")');
    await page.locator('rect[data-qubit="0"][data-time="0"]').first().click();
    await page.waitForTimeout(200);
    
    // Select another gate for placement
    await page.click('.gate-btn:has-text("S")');
    
    // Find the gate element - use gate-symbol class to target the actual gate
    const gate = page.locator('.gate-symbol[data-qubit="0"][data-time="0"]').first();
    const clickArea = page.locator('rect.gate-placement-area[data-qubit="0"][data-time="0"]').first();
    
    // Get initial click area state
    const initialStroke = await clickArea.getAttribute('stroke');
    
    // Hover over the gate using force to bypass pointer interception
    await gate.hover({ force: true });
    await page.waitForTimeout(100);
    
    // Click area should be highlighted (stroke should be set)
    const hoveredStroke = await clickArea.getAttribute('stroke');
    // Stroke should change to indicate highlight
    expect(hoveredStroke).toBeTruthy();
    expect(hoveredStroke).not.toBe(initialStroke);
  });

  test('empty circuit hint displays when circuit has no gates', async ({ page }) => {
    // Fresh page should show empty hint
    const emptyHint = page.locator('.circuit-empty-hint');
    await expect(emptyHint).toBeVisible();
    
    // Check that hint contains instructions
    await expect(emptyHint).toContainText('Select the gates from the left panel');
    await expect(emptyHint).toContainText('Click on the circuit above');
    await expect(emptyHint).toContainText('Right click on gates');
    await expect(emptyHint).toContainText('Inject errors');
    await expect(emptyHint).toContainText('Use step buttons');
  });

  test('empty circuit hint disappears when gates are added', async ({ page }) => {
    // Initially, hint should be visible
    const emptyHint = page.locator('.circuit-empty-hint');
    await expect(emptyHint).toBeVisible();
    
    // Add a gate
    await page.click('.gate-btn:has-text("H")');
    await page.locator('rect[data-qubit="0"][data-time="0"]').first().click();
    await page.waitForTimeout(200);
    
    // Hint should no longer be visible
    await expect(emptyHint).not.toBeVisible();
  });

  test('empty circuit hint reappears when all gates are removed', async ({ page }) => {
    // Add a gate
    await page.click('.gate-btn:has-text("H")');
    await page.locator('rect[data-qubit="0"][data-time="0"]').first().click();
    await page.waitForTimeout(200);
    
    // Hint should be hidden
    const emptyHint = page.locator('.circuit-empty-hint');
    await expect(emptyHint).not.toBeVisible();
    
    // Remove the gate - use gate-symbol class to target the actual gate, not the click area
    const gate = page.locator('.gate-symbol[data-qubit="0"][data-time="0"]').first();
    await gate.click({ button: 'right', force: true });
    await page.waitForTimeout(200);
    
    // Hint should reappear
    await expect(emptyHint).toBeVisible();
  });

  test('Gates tooltip appears on hover', async ({ page }) => {
    // Find the tooltip trigger (question mark icon)
    const tooltipTrigger = page.locator('#gate-palette .info-tooltip');
    await expect(tooltipTrigger).toBeVisible();
    
    // Hover over the trigger
    await tooltipTrigger.hover();
    await page.waitForTimeout(100);
    
    // Tooltip text should be visible
    const tooltipText = page.locator('#gate-palette .tooltip-text');
    await expect(tooltipText).toBeVisible();
    
    // Check tooltip content
    const text = await tooltipText.textContent();
    expect(text).toContain('Gate Operations');
    expect(text).toContain('Click to place/replace gates');
    expect(text).toContain('Right-click to remove gates');
  });

  test('Gates tooltip disappears on mouse leave', async ({ page }) => {
    const tooltipTrigger = page.locator('#gate-palette .info-tooltip');
    const tooltipText = page.locator('#gate-palette .tooltip-text');
    
    // Hover to show tooltip
    await tooltipTrigger.hover();
    await page.waitForTimeout(100);
    await expect(tooltipText).toBeVisible();
    
    // Move mouse away
    await page.mouse.move(0, 0);
    await page.waitForTimeout(100);
    
    // Tooltip should be hidden
    const visibility = await tooltipText.evaluate(el => window.getComputedStyle(el).visibility);
    expect(visibility).toBe('hidden');
  });

  test('Error Pattern tooltip appears on hover', async ({ page }) => {
    // Inject an error and step through a gate to generate explanation
    await page.click('.error-btn.error-x');
    await page.waitForTimeout(200);
    
    // Add a gate and step through it to generate explanation
    await page.click('.gate-btn:has-text("H")');
    await page.locator('rect[data-qubit="0"][data-time="0"]').first().click();
    await page.waitForTimeout(200);
    
    await page.click('#step-forward-btn');
    await page.waitForTimeout(200);
    
    // Find the tooltip trigger (only appears if explanation exists)
    const tooltipTrigger = page.locator('#error-display .info-tooltip');
    await expect(tooltipTrigger).toBeVisible();
    
    // Hover over the trigger
    await tooltipTrigger.hover();
    await page.waitForTimeout(100);
    
    // Tooltip text should be visible
    const tooltipText = page.locator('#error-display .tooltip-text');
    await expect(tooltipText).toBeVisible();
    
    // Check tooltip content (should contain explanation)
    const text = await tooltipText.textContent();
    expect(text).toBeTruthy();
    expect(text.length).toBeGreaterThan(0);
  });

  test('Error Pattern tooltip disappears on mouse leave', async ({ page }) => {
    // Inject an error and step through a gate to generate explanation
    await page.click('.error-btn.error-x');
    await page.waitForTimeout(200);
    
    // Add a gate and step through it to generate explanation
    await page.click('.gate-btn:has-text("H")');
    await page.locator('rect[data-qubit="0"][data-time="0"]').first().click();
    await page.waitForTimeout(200);
    
    await page.click('#step-forward-btn');
    await page.waitForTimeout(200);
    
    const tooltipTrigger = page.locator('#error-display .info-tooltip');
    const tooltipText = page.locator('#error-display .tooltip-text');
    
    // Hover to show tooltip
    await tooltipTrigger.hover();
    await page.waitForTimeout(100);
    await expect(tooltipText).toBeVisible();
    
    // Move mouse away
    await page.mouse.move(0, 0);
    await page.waitForTimeout(100);
    
    // Tooltip should be hidden
    const visibility = await tooltipText.evaluate(el => window.getComputedStyle(el).visibility);
    expect(visibility).toBe('hidden');
  });
});

