import { test, expect } from '@playwright/test';

test.describe('Quantum Error Analyzer - Basic UI', () => {
  test('page loads and displays initial state', async ({ page }) => {
    await page.goto('/');
    
    await expect(page.locator('h1')).toHaveText('Quantum Error Analyzer');
    await expect(page.locator('#circuit-view')).toBeVisible();
    await expect(page.locator('.gate-palette')).toBeVisible();
    await expect(page.locator('.error-controls')).toBeVisible();
    await expect(page.locator('.simulation-controls')).toBeVisible();
  });

  test('gate palette contains all gate types', async ({ page }) => {
    await page.goto('/');
    
    const gateButtons = page.locator('.gate-btn');
    await expect(gateButtons).toHaveCount(9);
    
    const gateData = [
      { label: 'H', data: 'H' },
      { label: 'S', data: 'S' },
      { label: 'S†', data: 'Sdg' },
      { label: 'X', data: 'X' },
      { label: 'Y', data: 'Y' },
      { label: 'Z', data: 'Z' },
      { label: 'CNOT', data: 'CNOT' },
      { label: 'CZ', data: 'CZ' },
      { label: 'SWAP', data: 'SWAP' },
    ];
    for (const gate of gateData) {
      await expect(page.locator(`.gate-btn[data-gate="${gate.data}"]`)).toBeVisible();
      await expect(page.locator(`.gate-btn[data-gate="${gate.data}"]`)).toHaveText(gate.label);
    }
  });

  test('error controls contain all error types', async ({ page }) => {
    await page.goto('/');
    
    const errorButtons = page.locator('.error-btn');
    await expect(errorButtons).toHaveCount(4);
    
    const errorTypes = ['X', 'Y', 'Z', 'I'];
    for (const type of errorTypes) {
      await expect(page.locator(`.error-btn.error-${type.toLowerCase()}:has-text("${type}")`)).toBeVisible();
    }
  });

  test('circuit displays qubit lines', async ({ page }) => {
    await page.goto('/');
    
    const canvas = page.locator('#circuit-view canvas').last();
    await expect(canvas).toBeVisible();
    
    // Konva renders text as canvas, so we check for the canvas instead
    // The qubit labels are rendered on the canvas
    await expect(canvas).toBeVisible();
  });
});

