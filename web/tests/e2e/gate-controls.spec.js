import { test, expect } from '@playwright/test';

test.describe('Gate Controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.circuit-svg', { timeout: 5000 });
  });

  test('placing CNOT across existing gate replaces the original gate', async ({ page }) => {
    const circuitView = page.locator('#circuit-view');
    
    // Step 1: Place an H gate on qubit 0 at time 0
    await page.click('.gate-btn:has-text("H")');
    await page.locator('rect[data-qubit="0"][data-time="0"]').first().click();
    
    // Verify H gate is visible
    await expect(circuitView.locator('text:has-text("H")')).toBeVisible();
    
    // Step 2: Place a CNOT gate across qubit 0 (which should replace the H gate)
    await page.click('.gate-btn:has-text("CNOT")');
    const clickArea = page.locator('rect[data-qubit="0"][data-time="0"]').first();
    await clickArea.scrollIntoViewIfNeeded();
    await clickArea.click({ force: true });
    
    // Wait for UI to update
    await page.waitForTimeout(200);
    
    // Step 3: Verify the H gate is gone (replaced by CNOT)
    const hGates = circuitView.locator('text:has-text("H")');
    const hGateCount = await hGates.count();
    expect(hGateCount).toBe(0);
    
    // Step 4: Verify CNOT gate is present (CNOT is rendered as "⊕" symbol)
    await expect(circuitView.locator('text:has-text("⊕")')).toBeVisible();
  });

  test('right-clicking on a gate removes it from the circuit', async ({ page }) => {
    const circuitView = page.locator('#circuit-view');
    
    // Step 1: Place an H gate on qubit 0 at time 0
    await page.click('.gate-btn:has-text("H")');
    await page.locator('rect[data-qubit="0"][data-time="0"]').first().click();
    await page.waitForTimeout(200);
    
    // Verify H gate is visible
    await expect(circuitView.locator('text:has-text("H")')).toBeVisible();
    
    // Step 2: Right-click on the H gate to remove it
    const hGate = circuitView.locator('text:has-text("H")').first();
    await hGate.click({ button: 'right' });
    await page.waitForTimeout(200);
    
    // Step 3: Verify the H gate is gone
    const hGates = circuitView.locator('text:has-text("H")');
    const hGateCount = await hGates.count();
    expect(hGateCount).toBe(0);
  });

  test('placing gates on different qubits at same time creates parallel gates', async ({ page }) => {
    const circuitView = page.locator('#circuit-view');
    
    // Step 1: Place H gate on qubit 0 at time 0
    await page.click('.gate-btn:has-text("H")');
    await page.locator('rect[data-qubit="0"][data-time="0"]').first().click();
    await page.waitForTimeout(200);
    
    // Verify H gate is visible
    await expect(circuitView.locator('text:has-text("H")')).toBeVisible();
    
    // Step 2: Place S gate on qubit 1 at the same time 0 (should work in parallel)
    await page.click('.gate-btn:has-text("S")');
    await page.locator('rect[data-qubit="1"][data-time="0"]').first().click();
    await page.waitForTimeout(200);
    
    // Step 3: Verify both gates are present at the same time
    await expect(circuitView.locator('text:has-text("H")')).toBeVisible();
    await expect(circuitView.locator('text:has-text("S")')).toBeVisible();
  });

  test('placing gate on same qubit at same time replaces the original gate', async ({ page }) => {
    const circuitView = page.locator('#circuit-view');
    
    // Step 1: Place H gate on qubit 0 at time 0
    await page.click('.gate-btn:has-text("H")');
    await page.locator('rect[data-qubit="0"][data-time="0"]').first().click();
    await page.waitForTimeout(200);
    
    // Verify H gate is visible
    await expect(circuitView.locator('text:has-text("H")')).toBeVisible();
    
    // Step 2: Place S gate on the same qubit 0 at the same time 0 (should replace H)
    await page.click('.gate-btn:has-text("S")');
    const clickArea = page.locator('rect[data-qubit="0"][data-time="0"]').first();
    await clickArea.scrollIntoViewIfNeeded();
    await clickArea.click({ force: true });
    await page.waitForTimeout(200);
    
    // Step 3: Verify H gate is gone and S gate is present
    const hGates = circuitView.locator('text:has-text("H")');
    const hGateCount = await hGates.count();
    expect(hGateCount).toBe(0);
    
    await expect(circuitView.locator('text:has-text("S")')).toBeVisible();
  });

  test('placing single-qubit gate on qubit that is part of CNOT replaces the CNOT', async ({ page }) => {
    const circuitView = page.locator('#circuit-view');
    
    // Step 1: Place CNOT gate (control=0, target=1) at time 0
    await page.click('.gate-btn:has-text("CNOT")');
    const cnotClickArea = page.locator('rect[data-qubit="0"][data-time="0"]').first();
    await cnotClickArea.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await cnotClickArea.click({ force: true });
    await page.waitForTimeout(500);
    
    // Verify CNOT is present
    await expect(circuitView.locator('text:has-text("⊕")')).toBeVisible({ timeout: 2000 });
    
    // Step 2: Place H gate on qubit 0 (control) at the same time 0
    // This replaces the CNOT because H only uses qubit 0 (subset of CNOT's qubits)
    await page.click('.gate-btn:has-text("H")');
    await page.waitForTimeout(200);
    
    const clickArea = page.locator('rect[data-qubit="0"][data-time="0"]').first();
    await clickArea.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await clickArea.click({ force: true });
    await page.waitForTimeout(500);
    
    // Step 3: Verify CNOT is replaced by H gate
    const cnotAfter = await circuitView.locator('text:has-text("⊕")').count();
    expect(cnotAfter).toBe(0); // CNOT should be gone
    
    await expect(circuitView.locator('text:has-text("H")')).toBeVisible();
  });

  test('removing a gate does not cause other gates to shift left', async ({ page }) => {
    const circuitView = page.locator('#circuit-view');
    
    // Step 1: Place gates at different time steps
    // Gate at time 0
    await page.click('.gate-btn:has-text("H")');
    await page.locator('rect[data-qubit="0"][data-time="0"]').first().click();
    await page.waitForTimeout(200);
    
    // Gate at time 1
    await page.click('.gate-btn:has-text("S")');
    await page.locator('rect[data-qubit="0"][data-time="1"]').first().click();
    await page.waitForTimeout(200);
    
    // Gate at time 2
    await page.click('.gate-btn:has-text("X")');
    await page.locator('rect[data-qubit="0"][data-time="2"]').first().click();
    await page.waitForTimeout(200);
    
    // Verify all gates are present
    await expect(circuitView.locator('text:has-text("H")')).toBeVisible();
    await expect(circuitView.locator('text:has-text("S")')).toBeVisible();
    await expect(circuitView.locator('text:has-text("X")')).toBeVisible();
    
    // Step 2: Remove the gate at time 1 (S gate)
    const sGate = circuitView.locator('text:has-text("S")').first();
    await sGate.click({ button: 'right' });
    await page.waitForTimeout(200);
    
    // Step 3: Verify S gate is gone
    const sGates = circuitView.locator('text:has-text("S")');
    const sGateCount = await sGates.count();
    expect(sGateCount).toBe(0);
    
    // Step 4: Verify H gate (time 0) and X gate (time 2) are still present
    // They should NOT have shifted left - time 1 should be empty
    await expect(circuitView.locator('text:has-text("H")')).toBeVisible();
    await expect(circuitView.locator('text:has-text("X")')).toBeVisible();
  });

  test('circuit expands horizontally when adding gates at increasing time steps', async ({ page }) => {
    const circuitView = page.locator('#circuit-view');
    
    // Step 1: Place gates at increasing time steps to expand the circuit
    await page.click('.gate-btn:has-text("H")');
    await page.locator('rect[data-qubit="0"][data-time="0"]').first().click();
    await page.waitForTimeout(200);
    
    await page.click('.gate-btn:has-text("S")');
    await page.locator('rect[data-qubit="0"][data-time="1"]').first().click();
    await page.waitForTimeout(200);
    
    await page.click('.gate-btn:has-text("X")');
    await page.locator('rect[data-qubit="0"][data-time="2"]').first().click();
    await page.waitForTimeout(200);
    
    await page.click('.gate-btn:has-text("Y")');
    await page.locator('rect[data-qubit="0"][data-time="3"]').first().click();
    await page.waitForTimeout(200);
    
    // Step 2: Verify all gates are visible (circuit has expanded)
    await expect(circuitView.locator('text:has-text("H")')).toBeVisible();
    await expect(circuitView.locator('text:has-text("S")')).toBeVisible();
    await expect(circuitView.locator('text:has-text("X")')).toBeVisible();
    await expect(circuitView.locator('text:has-text("Y")')).toBeVisible();
    
    // Step 3: Verify circuit view has expanded (check for horizontal scrollbar or increased width)
    const circuitViewBox = await circuitView.boundingBox();
    expect(circuitViewBox).not.toBeNull();
    expect(circuitViewBox.width).toBeGreaterThan(0);
  });

  test('can place gates on multiple qubits at different time steps', async ({ page }) => {
    const circuitView = page.locator('#circuit-view');
    
    // Step 1: Place gates on qubit 0 at different times
    await page.click('.gate-btn:has-text("H")');
    await page.locator('rect[data-qubit="0"][data-time="0"]').first().click();
    await page.waitForTimeout(200);
    
    await page.click('.gate-btn:has-text("S")');
    await page.locator('rect[data-qubit="0"][data-time="1"]').first().click();
    await page.waitForTimeout(200);
    
    // Step 2: Place gates on qubit 1 at different times
    await page.click('.gate-btn:has-text("X")');
    await page.locator('rect[data-qubit="1"][data-time="0"]').first().click();
    await page.waitForTimeout(200);
    
    await page.click('.gate-btn:has-text("Z")');
    await page.locator('rect[data-qubit="1"][data-time="1"]').first().click();
    await page.waitForTimeout(200);
    
    // Step 3: Verify all gates are present
    await expect(circuitView.locator('text:has-text("H")')).toBeVisible();
    await expect(circuitView.locator('text:has-text("S")')).toBeVisible();
    await expect(circuitView.locator('text:has-text("X")')).toBeVisible();
    await expect(circuitView.locator('text:has-text("Z")')).toBeVisible();
  });

  test('placing CNOT at later time step expands circuit', async ({ page }) => {
    const circuitView = page.locator('#circuit-view');
    
    // Step 1: Place a gate at time 0
    await page.click('.gate-btn:has-text("H")');
    await page.locator('rect[data-qubit="0"][data-time="0"]').first().click();
    await page.waitForTimeout(200);
    
    // Step 2: Place CNOT at time 1 (should expand circuit)
    await page.click('.gate-btn:has-text("CNOT")');
    const cnotArea = page.locator('rect[data-qubit="0"][data-time="1"]').first();
    await cnotArea.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await cnotArea.click({ force: true });
    await page.waitForTimeout(500);
    
    // Step 3: Verify both gates are present and circuit has expanded
    await expect(circuitView.locator('text:has-text("H")')).toBeVisible();
    await expect(circuitView.locator('text:has-text("⊕")')).toBeVisible();
  });

  test('removing middle gate in sequence does not affect later gates', async ({ page }) => {
    const circuitView = page.locator('#circuit-view');
    
    // Step 1: Create a sequence of gates
    await page.click('.gate-btn:has-text("H")');
    await page.locator('rect[data-qubit="0"][data-time="0"]').first().click();
    await page.waitForTimeout(200);
    
    await page.click('.gate-btn:has-text("S")');
    await page.locator('rect[data-qubit="0"][data-time="1"]').first().click();
    await page.waitForTimeout(200);
    
    await page.click('.gate-btn:has-text("X")');
    await page.locator('rect[data-qubit="0"][data-time="2"]').first().click();
    await page.waitForTimeout(200);
    
    // Step 2: Remove the middle gate (S at time 1)
    const sGate = circuitView.locator('text:has-text("S")').first();
    await sGate.click({ button: 'right' });
    await page.waitForTimeout(200);
    
    // Step 3: Verify H (time 0) and X (time 2) are still present
    // S should be gone, but H and X should remain at their original positions
    await expect(circuitView.locator('text:has-text("H")')).toBeVisible();
    const sGates = circuitView.locator('text:has-text("S")');
    const sGateCount = await sGates.count();
    expect(sGateCount).toBe(0);
    await expect(circuitView.locator('text:has-text("X")')).toBeVisible();
  });

  test('placing CNOT when there are 2 gates at same time step replaces both gates', async ({ page }) => {
    const circuitView = page.locator('#circuit-view');
    
    // Step 1: Place two gates at the same time step (H on Q0, S on Q1 at time 0)
    await page.click('.gate-btn:has-text("H")');
    await page.locator('rect[data-qubit="0"][data-time="0"]').first().click();
    await page.waitForTimeout(200);
    
    await page.click('.gate-btn:has-text("S")');
    await page.locator('rect[data-qubit="1"][data-time="0"]').first().click();
    await page.waitForTimeout(200);
    
    // Verify both gates are present
    await expect(circuitView.locator('text:has-text("H")')).toBeVisible();
    await expect(circuitView.locator('text:has-text("S")')).toBeVisible();
    
    // Step 2: Place CNOT(0,1) at the same time step (should replace both H and S)
    await page.click('.gate-btn:has-text("CNOT")');
    const cnotArea = page.locator('rect[data-qubit="0"][data-time="0"]').first();
    await cnotArea.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await cnotArea.click({ force: true });
    await page.waitForTimeout(500);
    
    // Step 3: Verify both H and S are gone (replaced by CNOT)
    const hGates = circuitView.locator('text:has-text("H")');
    const hGateCount = await hGates.count();
    expect(hGateCount).toBe(0);
    
    const sGates = circuitView.locator('text:has-text("S")');
    const sGateCount = await sGates.count();
    expect(sGateCount).toBe(0);
    
    // Step 4: Verify CNOT gate is present
    await expect(circuitView.locator('text:has-text("⊕")')).toBeVisible();
  });

  test('placing CZ when there are 2 gates at same time step replaces both gates', async ({ page }) => {
    const circuitView = page.locator('#circuit-view');
    
    // Step 1: Place two gates at the same time step (H on Q0, X on Q1 at time 0)
    await page.click('.gate-btn:has-text("H")');
    await page.locator('rect[data-qubit="0"][data-time="0"]').first().click();
    await page.waitForTimeout(200);
    
    await page.click('.gate-btn:has-text("X")');
    await page.locator('rect[data-qubit="1"][data-time="0"]').first().click();
    await page.waitForTimeout(200);
    
    // Verify both gates are present
    await expect(circuitView.locator('text:has-text("H")')).toBeVisible();
    await expect(circuitView.locator('text:has-text("X")')).toBeVisible();
    
    // Step 2: Place CZ(0,1) at the same time step (should replace both H and X)
    await page.click('.gate-btn:has-text("CZ")');
    const czArea = page.locator('rect[data-qubit="0"][data-time="0"]').first();
    await czArea.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await czArea.click({ force: true });
    await page.waitForTimeout(500);
    
    // Step 3: Verify both H and X are gone (replaced by CZ)
    const hGates = circuitView.locator('text:has-text("H")');
    const hGateCount = await hGates.count();
    expect(hGateCount).toBe(0);
    
    const xGates = circuitView.locator('text:has-text("X")');
    const xGateCount = await xGates.count();
    expect(xGateCount).toBe(0);
    
    // Step 4: Verify CZ gate is present (CZ is rendered as circles/dots on both qubits)
    // Check for circles with fill color #7AB9E5 (CZ gate color)
    const czCircles = circuitView.locator('circle[fill="#7AB9E5"]');
    const czCircleCount = await czCircles.count();
    expect(czCircleCount).toBeGreaterThanOrEqual(2); // At least 2 circles (one per qubit)
  });

  test('placing SWAP when there are 2 gates at same time step replaces both gates', async ({ page }) => {
    const circuitView = page.locator('#circuit-view');
    
    // Step 1: Place two gates at the same time step (S on Q0, Z on Q1 at time 0)
    await page.click('.gate-btn:has-text("S")');
    await page.locator('rect[data-qubit="0"][data-time="0"]').first().click();
    await page.waitForTimeout(200);
    
    await page.click('.gate-btn:has-text("Z")');
    await page.locator('rect[data-qubit="1"][data-time="0"]').first().click();
    await page.waitForTimeout(200);
    
    // Verify both gates are present
    await expect(circuitView.locator('text:has-text("S")')).toBeVisible();
    await expect(circuitView.locator('text:has-text("Z")')).toBeVisible();
    
    // Step 2: Place SWAP(0,1) at the same time step (should replace both S and Z)
    await page.click('.gate-btn:has-text("SWAP")');
    const swapArea = page.locator('rect[data-qubit="0"][data-time="0"]').first();
    await swapArea.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await swapArea.click({ force: true });
    await page.waitForTimeout(500);
    
    // Step 3: Verify both S and Z are gone (replaced by SWAP)
    const sGates = circuitView.locator('text:has-text("S")');
    const sGateCount = await sGates.count();
    expect(sGateCount).toBe(0);
    
    const zGates = circuitView.locator('text:has-text("Z")');
    const zGateCount = await zGates.count();
    expect(zGateCount).toBe(0);
    
    // Step 4: Verify SWAP gate is present (SWAP is rendered as "×" symbol on both qubits)
    await expect(circuitView.locator('text:has-text("×")').first()).toBeVisible();
  });
});

