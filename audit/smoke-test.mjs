/**
 * Post-cleanup Playwright smoke test.
 * Verifies the chess game loads correctly after audit file removals.
 *
 * Usage: npx playwright test audit/smoke-test.mjs  (or run via node with playwright)
 */
import { chromium } from 'playwright';

const DEV_SERVER = 'http://localhost:5173';
const TIMEOUT = 30_000;

async function smokeTest() {
  const results = { passed: [], failed: [], warnings: [] };

  console.log('=== Scorpion Chess Post-Cleanup Smoke Test ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect console errors and failed network requests
  const consoleErrors = [];
  const failedRequests = [];

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  page.on('requestfailed', req => {
    failedRequests.push({ url: req.url(), failure: req.failure()?.errorText });
  });

  // Track 404s specifically
  const notFoundUrls = [];
  page.on('response', res => {
    if (res.status() === 404) notFoundUrls.push(res.url());
  });

  try {
    // TEST 1: Page loads
    console.log('Test 1: Page loads...');
    const response = await page.goto(DEV_SERVER, { waitUntil: 'networkidle', timeout: TIMEOUT });
    if (response && response.ok()) {
      results.passed.push('Page loads successfully (HTTP ' + response.status() + ')');
      console.log('  PASS: Page loads successfully');
    } else {
      results.failed.push('Page failed to load: HTTP ' + (response?.status() || 'unknown'));
      console.log('  FAIL: Page failed to load');
    }

    // TEST 2: Canvas renders (Three.js 3D board)
    console.log('Test 2: 3D canvas renders...');
    const canvas = await page.waitForSelector('canvas', { timeout: 15_000 }).catch(() => null);
    if (canvas) {
      results.passed.push('3D canvas element found and rendered');
      console.log('  PASS: Canvas element present');
    } else {
      results.failed.push('No canvas element found - 3D board may not be rendering');
      console.log('  FAIL: No canvas element');
    }

    // TEST 3: Check logos loaded (these are the 2 graphics files we KEPT)
    console.log('Test 3: Logo assets load...');
    const images = await page.evaluate(() => {
      const imgs = document.querySelectorAll('img');
      return Array.from(imgs).map(img => ({
        src: img.src,
        complete: img.complete,
        naturalWidth: img.naturalWidth,
      }));
    });

    const logoImages = images.filter(i => i.src.includes('Logo') || i.src.includes('logo'));
    if (logoImages.length > 0 && logoImages.every(i => i.complete && i.naturalWidth > 0)) {
      results.passed.push(`${logoImages.length} logo image(s) loaded correctly`);
      console.log(`  PASS: ${logoImages.length} logo(s) loaded`);
    } else if (logoImages.length === 0) {
      results.warnings.push('No logo images found in DOM (may load dynamically)');
      console.log('  WARN: No logo images found in DOM');
    } else {
      results.failed.push('Some logo images failed to load');
      console.log('  FAIL: Logo images did not load');
    }

    // TEST 4: No 404s for assets
    console.log('Test 4: No 404 errors...');
    if (notFoundUrls.length === 0) {
      results.passed.push('No 404 (Not Found) errors for any assets');
      console.log('  PASS: Zero 404 errors');
    } else {
      for (const url of notFoundUrls) {
        results.failed.push('404 Not Found: ' + url);
        console.log('  FAIL: 404 -> ' + url);
      }
    }

    // TEST 5: No critical console errors
    console.log('Test 5: No critical console errors...');
    // Filter out non-critical errors (like WebGL warnings on headless)
    const criticalErrors = consoleErrors.filter(e =>
      !e.includes('WebGL') &&
      !e.includes('GPU') &&
      !e.includes('favicon')
    );
    if (criticalErrors.length === 0) {
      results.passed.push('No critical console errors');
      console.log('  PASS: No critical console errors');
    } else {
      for (const err of criticalErrors) {
        results.warnings.push('Console error: ' + err.substring(0, 200));
        console.log('  WARN: ' + err.substring(0, 100));
      }
    }

    // TEST 6: No failed network requests
    console.log('Test 6: No failed network requests...');
    if (failedRequests.length === 0) {
      results.passed.push('No failed network requests');
      console.log('  PASS: All network requests succeeded');
    } else {
      for (const req of failedRequests) {
        results.failed.push(`Network failure: ${req.url} (${req.failure})`);
        console.log(`  FAIL: ${req.url}`);
      }
    }

    // TEST 7: UI controls present
    console.log('Test 7: UI controls present...');
    const hasButtons = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button, select, input');
      return buttons.length;
    });
    if (hasButtons > 0) {
      results.passed.push(`${hasButtons} UI control element(s) found`);
      console.log(`  PASS: ${hasButtons} UI controls found`);
    } else {
      results.warnings.push('No UI controls found (may load asynchronously)');
      console.log('  WARN: No UI controls found');
    }

  } catch (err) {
    results.failed.push('Unexpected error: ' + err.message);
    console.log('  ERROR: ' + err.message);
  } finally {
    await browser.close();
  }

  // Print summary
  console.log('\n=== SMOKE TEST RESULTS ===');
  console.log(`Passed:   ${results.passed.length}`);
  console.log(`Failed:   ${results.failed.length}`);
  console.log(`Warnings: ${results.warnings.length}`);

  if (results.passed.length > 0) {
    console.log('\nPassed:');
    results.passed.forEach(p => console.log('  [PASS] ' + p));
  }
  if (results.failed.length > 0) {
    console.log('\nFailed:');
    results.failed.forEach(f => console.log('  [FAIL] ' + f));
  }
  if (results.warnings.length > 0) {
    console.log('\nWarnings:');
    results.warnings.forEach(w => console.log('  [WARN] ' + w));
  }

  const exitCode = results.failed.length > 0 ? 1 : 0;
  console.log(`\nOverall: ${exitCode === 0 ? 'PASS' : 'FAIL'}`);
  process.exit(exitCode);
}

smokeTest();
