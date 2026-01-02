import fs from 'node:fs/promises';
import path from 'node:path';
import { createReadStream, createWriteStream } from 'node:fs';
import readline from 'node:readline';

type Bucket = 'danger_onset' | 'pre_collapse' | 'collapse' | 'control';

type DatasetRow = {
  bucket: Bucket;
  mateIn: number | null;
};

type AnalysisSummary = {
  runId: string;
  gameCount: number;
  earliestMatePly: number[];
  firstEvalBelow300: number[];
  firstEvalBelow500: number[];
  swingTotals: Record<string, number>;
  motifs: {
    counts: Record<string, number>;
  };
};

type MergeConfig = {
  analysisRoot: string;
  prefix: string;
  outDir: string;
};

type MergeSummary = {
  runs: string[];
  totalGames: number;
  totalRecords: number;
  bucketCounts: Record<Bucket, number>;
  mateLabelCount: number;
  mateLabelPct: number;
  earliestMatePly: number[];
  firstEvalBelow300: number[];
  firstEvalBelow500: number[];
  swingTotals: Record<string, number>;
  motifs: Record<string, number>;
};

const CSV_HEADER = [
  'gameId',
  'ply',
  'bucket',
  'labelCpD12',
  'labelCpD16',
  'mateIn',
  'bestMoveUci',
  'bestMoveUci16'
].join(',');

function parseArgs(argv: string[]): MergeConfig {
  const analysisRoot = argv[2];
  if (!analysisRoot) {
    throw new Error('Usage: mergeTrainingDatasets <analysisRoot> --prefix <prefix> --outDir <outDir>');
  }
  const prefix = getFlag(argv, '--prefix') ?? '';
  const outDir = getFlag(argv, '--outDir') ?? path.join(analysisRoot, 'merged');
  return { analysisRoot, prefix, outDir };
}

function getFlag(argv: string[], name: string): string | null {
  const index = argv.indexOf(name);
  if (index === -1 || index + 1 >= argv.length) {
    return null;
  }
  return argv[index + 1];
}

async function listRunDirs(root: string, prefix: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
    .map((entry) => entry.name)
    .sort();
}

async function mergeDatasets(config: MergeConfig): Promise<MergeSummary> {
  const runDirs = await listRunDirs(config.analysisRoot, config.prefix);
  if (runDirs.length === 0) {
    throw new Error(`No run directories found for prefix "${config.prefix}".`);
  }

  await fs.mkdir(config.outDir, { recursive: true });
  const datasetOut = path.join(config.outDir, 'dataset.jsonl');
  const indexOut = path.join(config.outDir, 'dataset_index.csv');
  const summaryOut = path.join(config.outDir, 'summary.json');

  const datasetStream = createWriteStream(datasetOut, { flags: 'w' });
  const indexStream = createWriteStream(indexOut, { flags: 'w' });
  indexStream.write(`${CSV_HEADER}\n`);

  const bucketCounts: Record<Bucket, number> = {
    danger_onset: 0,
    pre_collapse: 0,
    collapse: 0,
    control: 0
  };
  let totalRecords = 0;
  let mateLabelCount = 0;
  let totalGames = 0;
  const earliestMatePly: number[] = [];
  const firstEvalBelow300: number[] = [];
  const firstEvalBelow500: number[] = [];
  const swingTotals: Record<string, number> = { '150': 0, '300': 0, '500': 0 };
  const motifs: Record<string, number> = { king_safety: 0, hanging_piece: 0, missed_defense: 0 };

  for (const runDir of runDirs) {
    const analysisDir = path.join(config.analysisRoot, runDir);
    const datasetPath = path.join(analysisDir, 'dataset.jsonl');
    const indexPath = path.join(analysisDir, 'dataset_index.csv');
    const summaryPath = path.join(analysisDir, 'summary.json');

    const summaryRaw = await fs.readFile(summaryPath, 'utf8');
    const summary = JSON.parse(summaryRaw) as AnalysisSummary;
    totalGames += summary.gameCount ?? 0;
    earliestMatePly.push(...(summary.earliestMatePly ?? []));
    firstEvalBelow300.push(...(summary.firstEvalBelow300 ?? []));
    firstEvalBelow500.push(...(summary.firstEvalBelow500 ?? []));
    for (const key of Object.keys(swingTotals)) {
      swingTotals[key] += summary.swingTotals?.[key] ?? 0;
    }
    for (const key of Object.keys(motifs)) {
      motifs[key] += summary.motifs?.counts?.[key] ?? 0;
    }

    await appendDataset(datasetPath, datasetStream, bucketCounts, (row) => {
      totalRecords += 1;
      if (row.mateIn !== null && row.mateIn !== undefined) {
        mateLabelCount += 1;
      }
    });
    await appendCsv(indexPath, indexStream);
  }

  datasetStream.end();
  indexStream.end();

  const mergeSummary: MergeSummary = {
    runs: runDirs,
    totalGames,
    totalRecords,
    bucketCounts,
    mateLabelCount,
    mateLabelPct: totalRecords > 0 ? mateLabelCount / totalRecords : 0,
    earliestMatePly,
    firstEvalBelow300,
    firstEvalBelow500,
    swingTotals,
    motifs
  };

  await fs.writeFile(summaryOut, JSON.stringify(mergeSummary, null, 2), 'utf8');
  return mergeSummary;
}

async function appendDataset(
  datasetPath: string,
  stream: ReturnType<typeof createWriteStream>,
  bucketCounts: Record<Bucket, number>,
  onRow: (row: DatasetRow) => void
): Promise<void> {
  const input = createReadStream(datasetPath);
  const rl = readline.createInterface({ input });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    stream.write(`${trimmed}\n`);
    const row = JSON.parse(trimmed) as DatasetRow;
    bucketCounts[row.bucket] += 1;
    onRow(row);
  }
}

async function appendCsv(indexPath: string, stream: ReturnType<typeof createWriteStream>): Promise<void> {
  const raw = await fs.readFile(indexPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) {
      continue;
    }
    stream.write(`${line}\n`);
  }
}

async function main() {
  const config = parseArgs(process.argv);
  const summary = await mergeDatasets(config);
  console.log('Merged runs:', summary.runs.length);
  console.log('Total records:', summary.totalRecords);
  console.log('Bucket counts:', summary.bucketCounts);
  console.log('Mate label %:', summary.mateLabelPct.toFixed(4));
  console.log('Output:', config.outDir);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
