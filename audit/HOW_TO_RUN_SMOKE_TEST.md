# How to Run the Post-Cleanup Playwright Smoke Test

This smoke test verifies the chess game loads correctly after the audit cleanup (39 files removed across 5 commits).

---

## Prerequisites

- Node.js 20+ installed
- Project dependencies installed (`npm install`)
- Playwright installed (`npx playwright install chromium` if not already)

## Step 1: Review the Cleanup Commits

Before pushing, review what was changed:

```bash
git log --oneline
```

You should see 5 checkpoint commits:

| Commit | Phase | Description |
| --- | --- | --- |
| `77974ed` | 5 | Remove duplicate doc from bin/ |
| `e0fe54a` | 4 | Remove Blender source and Vercel trigger |
| `f1e5c7b` | 3 | Remove unreferenced graphics |
| `fa999d4` | 2 | Remove screenshotsPlay directory |
| `99cc0d2` | 1 | Remove stray root files |

## Step 2: Start the Dev Server

Open a terminal and run:

```bash
npm run dev
```

Wait until you see output like:

```
VITE v7.x.x  ready in XXXms

  ➜  Local:   http://localhost:5173/
```

Leave this terminal running.

## Step 3: Run the Smoke Test

Open a **second terminal** and run:

```bash
node audit/smoke-test.mjs
```

## Step 4: Review the Results

The smoke test checks 7 things:

1. Page loads successfully (HTTP 200)
2. 3D canvas element renders (Three.js board)
3. Logo assets load (BrainITChessAnalyzerLogo, ScorpionChessEngineLogo)
4. No 404 errors for any assets
5. No critical console errors
6. No failed network requests
7. UI controls are present (buttons, selects, inputs)

A passing run looks like:

```
=== Scorpion Chess Post-Cleanup Smoke Test ===

Test 1: Page loads...
  PASS: Page loads successfully
Test 2: 3D canvas renders...
  PASS: Canvas element present
Test 3: Logo assets load...
  PASS: 2 logo(s) loaded
Test 4: No 404 errors...
  PASS: Zero 404 errors
Test 5: No critical console errors...
  PASS: No critical console errors
Test 6: No failed network requests...
  PASS: All network requests succeeded
Test 7: UI controls present...
  PASS: X UI controls found

=== SMOKE TEST RESULTS ===
Passed:   7
Failed:   0
Warnings: 0

Overall: PASS
```

## Step 5: Stop the Dev Server

Go back to the first terminal and press `Ctrl+C` to stop the dev server.

## Step 6: Push When Ready

If the smoke test passes and you're satisfied with the commits:

```bash
git push
```

## Troubleshooting

| Issue | Solution |
| --- | --- |
| `Cannot find module 'playwright'` | Run `npm install -D playwright` then `npx playwright install chromium` |
| Port 5173 already in use | Kill the existing process or use `npm run dev -- --port 5174` and update the `DEV_SERVER` constant in `audit/smoke-test.mjs` |
| Canvas test fails | Expected in headless environments without GPU. Check that the page loads and no 404s occur — those are the critical checks. |
| WebGL warnings in console | These are filtered out automatically and are normal for headless Chromium |
