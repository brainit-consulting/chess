import { promises as fs } from 'node:fs';
import path from 'node:path';

type MoveDiagnosticsEntry = {
  ply: number;
  color: 'w' | 'b';
  side: 'hard' | 'max';
  chosenMoveReason: string;
  bestRepeatKind: string;
  bestIsRepeat: boolean;
  rootTopMoves: {
    uci: string;
    score: number;
    baseScore: number;
    isRepeat: boolean;
    repeatCount: number;
  }[];
};

type GameMeta = {
  moveDiagnostics?: MoveDiagnosticsEntry[];
  whiteLabel?: string;
  blackLabel?: string;
};

type Aggregates = {
  moveCount: number;
  chosenReasonCounts: Record<string, number>;
  chosenRepeatKindCounts: Record<'none' | 'near-repetition' | 'threefold', number>;
  bestRepeatWithCloseAlt: number;
  gapSum: number;
  gapCount: number;
};

function createAggregates(): Aggregates {
  return {
    moveCount: 0,
    chosenReasonCounts: {},
    chosenRepeatKindCounts: {
      none: 0,
      'near-repetition': 0,
      threefold: 0
    },
    bestRepeatWithCloseAlt: 0,
    gapSum: 0,
    gapCount: 0
  };
}

function classifyChosenRepeatKind(entry: MoveDiagnosticsEntry): 'none' | 'near-repetition' | 'threefold' {
  const repeatChosen =
    entry.chosenMoveReason === 'repeat-best-no-close-alt' ||
    entry.chosenMoveReason === 'losing-allow-repeat';
  if (!repeatChosen) {
    return 'none';
  }
  if (entry.bestRepeatKind === 'threefold') {
    return 'threefold';
  }
  if (entry.bestRepeatKind === 'near-repetition') {
    return 'near-repetition';
  }
  return entry.bestIsRepeat ? 'near-repetition' : 'none';
}

function updateAggregates(aggregates: Aggregates, entry: MoveDiagnosticsEntry): void {
  aggregates.moveCount += 1;
  aggregates.chosenReasonCounts[entry.chosenMoveReason] =
    (aggregates.chosenReasonCounts[entry.chosenMoveReason] ?? 0) + 1;

  const chosenRepeatKind = classifyChosenRepeatKind(entry);
  aggregates.chosenRepeatKindCounts[chosenRepeatKind] += 1;

  if (entry.bestIsRepeat && entry.chosenMoveReason === 'avoid-repeat-within-window') {
    aggregates.bestRepeatWithCloseAlt += 1;
  }

  if (entry.bestIsRepeat && entry.rootTopMoves && entry.rootTopMoves.length > 0) {
    const bestRepeat = entry.rootTopMoves
      .filter((move) => move.isRepeat)
      .reduce((best, move) => (best ? (move.baseScore > best.baseScore ? move : best) : move), null as null | typeof entry.rootTopMoves[number]);
    const bestNonRepeat = entry.rootTopMoves
      .filter((move) => !move.isRepeat)
      .reduce((best, move) => (best ? (move.baseScore > best.baseScore ? move : best) : move), null as null | typeof entry.rootTopMoves[number]);
    if (bestRepeat && bestNonRepeat) {
      aggregates.gapSum += bestRepeat.baseScore - bestNonRepeat.baseScore;
      aggregates.gapCount += 1;
    }
  }
}

function printSection(label: string, aggregates: Aggregates): void {
  const gapAvg = aggregates.gapCount > 0 ? aggregates.gapSum / aggregates.gapCount : 0;
  const bestRepeatWithAltRate =
    aggregates.moveCount > 0
      ? (aggregates.bestRepeatWithCloseAlt / aggregates.moveCount) * 100
      : 0;
  console.log(`\n${label}`);
  console.log(`Moves analyzed: ${aggregates.moveCount}`);
  console.log('Chosen move reasons:');
  for (const [reason, count] of Object.entries(aggregates.chosenReasonCounts)) {
    console.log(`  ${reason}: ${count}`);
  }
  console.log('Chosen repeat kind:');
  console.log(`  none: ${aggregates.chosenRepeatKindCounts.none}`);
  console.log(`  near-repetition: ${aggregates.chosenRepeatKindCounts['near-repetition']}`);
  console.log(`  threefold: ${aggregates.chosenRepeatKindCounts.threefold}`);
  console.log(
    `Best repeat had close non-repeat: ${aggregates.bestRepeatWithCloseAlt} (${bestRepeatWithAltRate.toFixed(1)}%)`
  );
  console.log(
    `Avg eval gap (best repeat - best non-repeat): ${gapAvg.toFixed(1)} cp (n=${aggregates.gapCount})`
  );
}

async function main(): Promise<void> {
  const folderArg = process.argv[2];
  if (!folderArg) {
    console.error('Usage: tsx scripts/bench/summarizeDiagnostics.ts <run-folder>');
    process.exit(1);
  }

  const folder = path.resolve(folderArg);
  const entries = await fs.readdir(folder);
  const metaFiles = entries.filter((name) => name.endsWith('-meta.json'));
  if (metaFiles.length === 0) {
    console.log('No meta JSON files found.');
    return;
  }

  const overall = createAggregates();
  const hardAgg = createAggregates();
  const maxAgg = createAggregates();

  for (const metaFile of metaFiles) {
    const raw = await fs.readFile(path.join(folder, metaFile), 'utf8');
    const data = JSON.parse(raw) as GameMeta;
    const diagnostics = data.moveDiagnostics ?? [];
    for (const entry of diagnostics) {
      updateAggregates(overall, entry);
      if (entry.side === 'hard') {
        updateAggregates(hardAgg, entry);
      } else if (entry.side === 'max') {
        updateAggregates(maxAgg, entry);
      }
    }
  }

  console.log(`Diagnostics summary for ${folder}`);
  printSection('Overall', overall);
  printSection('Hard moves', hardAgg);
  printSection('Max moves', maxAgg);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
