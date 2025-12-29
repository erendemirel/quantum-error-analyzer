import { test, expect } from '@playwright/test';

test.describe('Error Handling', () => {
  test('displays error message when WASM module fails to load', async ({ page }) => {
    // Intercept WASM module import to simulate failure
    await page.route('**/quantum_error_analyzer_wasm.js', route => {
      route.abort('failed');
    });
    
    // Navigate to page - WASM load should fail
    await page.goto('/');
    await page.waitForTimeout(1000); // Wait for WASM load attempt
    
    // Check for error message - be more specific to avoid multiple matches
    const errorMessage = page.locator('#app > div').filter({ hasText: /WASM Module Not Found/i }).first();
    await expect(errorMessage).toBeVisible();
    
    // Check for specific error content
    await expect(errorMessage).toContainText('Please build the WASM module first');
    await expect(errorMessage).toContainText('bun run build:wasm');
  });
});

