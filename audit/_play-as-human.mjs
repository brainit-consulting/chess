import { chromium } from 'playwright';

const DEV_SERVER = process.argv[2] || 'http://localhost:4190';

console.log('=== Freddy Plays Chess ===');
console.log('Server: ' + DEV_SERVER);
console.log('');

const browser = await chromium.launch({
  headless: false,
  args: ['--start-maximized'],
  slowMo: 100
});

const context = await browser.newContext({ viewport: null });
const page = await context.newPage();

await page.goto(DEV_SERVER, { waitUntil: 'networkidle', timeout: 30000 });
console.log('Page loaded.');

await page.waitForSelector('canvas', { timeout: 15000 });
await page.waitForTimeout(2000);

// Verify game object is exposed
const hasGame = await page.evaluate(() => typeof window.__game !== 'undefined');
if (!hasGame) {
  console.log('ERROR: window.__game not found. Rebuild with instrumented main.ts.');
  await browser.close();
  process.exit(1);
}
console.log('Game object accessible via window.__game');

// Use Standard piece set (default — no change needed)
console.log('Setting up...');
console.log('Piece set: Standard (default)');

// Set Max difficulty
try {
  const diffSelect = page.locator('select').filter({ has: page.locator('option[value="max"]') }).first();
  if (await diffSelect.count() > 0) {
    await diffSelect.selectOption('max', { force: true });
    console.log('Difficulty: Max Thinking');
  }
} catch (e) { /* ok */ }
await page.waitForTimeout(500);

// Restart
console.log('Restarting...');
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('button')) {
    if (btn.textContent.trim() === 'Restart') { btn.click(); break; }
  }
});
await page.waitForTimeout(3000);

// Make a move using the game's internal API (TypeScript private = JS accessible)
async function makeMove(fromFile, fromRank, toFile, toRank, name) {
  console.log('>> Freddy plays ' + name);

  const result = await page.evaluate(({ ff, fr, tf, tr }) => {
    const game = window.__game;
    if (!game) return { error: 'no game object' };

    // Select the source square
    game.selectSquare({ file: ff, rank: fr });

    if (!game.legalMoves || game.legalMoves.length === 0) {
      return { error: 'no legal moves from file=' + ff + ' rank=' + fr };
    }

    // Move to target
    game.tryMoveTo({ file: tf, rank: tr });
    return { ok: true, moves: game.legalMoves?.length || 0 };
  }, { ff: fromFile, fr: fromRank, tf: toFile, tr: toRank });

  if (result.error) {
    console.log('  FAILED: ' + result.error);
    return false;
  }

  console.log('  Moved!');
  return true;
}

// Wait for AI to finish its turn
async function waitForAi(maxSec = 45) {
  process.stdout.write('  AI thinking');
  const start = Date.now();
  while (Date.now() - start < maxSec * 1000) {
    const humanTurn = await page.evaluate(() => {
      const g = window.__game;
      return g && g.state ? g.state.activeColor === 0 : true;
    });
    if (humanTurn) {
      console.log(' done! (' + Math.round((Date.now() - start) / 1000) + 's)');
      return true;
    }
    process.stdout.write('.');
    await page.waitForTimeout(1000);
  }
  console.log(' (timeout)');
  return false;
}

console.log('');
console.log('Freddy is playing the Italian Game as White!');
console.log('Watch the 3D board in the browser...');
console.log('');

// Italian Game opening
const opening = [
  [4, 1, 4, 3, '1. e4'],
  [6, 0, 5, 2, '2. Nf3'],
  [5, 0, 2, 3, '3. Bc4'],
  [3, 1, 3, 2, '4. d3'],
  [4, 0, 6, 0, '5. O-O'],
  [1, 0, 2, 2, '6. Nc3'],
];

for (const [ff, fr, tf, tr, name] of opening) {
  await page.waitForTimeout(2500); // Dramatic pause

  const ok = await makeMove(ff, fr, tf, tr, name);
  if (!ok) {
    console.log('Move failed — board state may have diverged from expected opening.');
    console.log('Stopping. You can continue playing manually in the browser.');
    break;
  }

  await page.waitForTimeout(1500); // Let animation play

  const aiDone = await waitForAi(45);
  if (!aiDone) {
    console.log('AI still thinking... continuing anyway.');
  }
}

// Take a final screenshot
await page.screenshot({ path: 'audit/freddy-game.png' });
console.log('');
console.log('Screenshot saved: audit/freddy-game.png');
console.log('');
console.log('Freddy finished the opening! Browser stays open for you.');
console.log('Press Ctrl+C when done.');

await new Promise(() => {});
