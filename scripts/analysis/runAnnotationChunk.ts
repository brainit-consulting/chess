import { annotateRun } from './annotateStockfish';

type ChunkOptions = {
  runDir: string;
  depth: number;
  depth16: number;
  start: number;
  count: number;
};

const DEFAULT_DEPTH = 12;
const DEFAULT_DEPTH16 = 16;

function parseArgs(argv: string[]): ChunkOptions {
  const runDir = argv[2];
  if (!runDir) {
    throw new Error(
      'Usage: runAnnotationChunk <runDir> --start 1 --count 20 [--depth 12] [--depth16 16]'
    );
  }
  const start = getRequiredInt(argv, '--start');
  const count = getRequiredInt(argv, '--count');
  const depth = getOptionalInt(argv, '--depth') ?? DEFAULT_DEPTH;
  const depth16 = getOptionalInt(argv, '--depth16') ?? DEFAULT_DEPTH16;
  return { runDir, depth, depth16, start, count };
}

function getRequiredInt(argv: string[], name: string): number {
  const value = getOptionalInt(argv, name);
  if (value === null) {
    throw new Error(`Missing required ${name} argument.`);
  }
  return value;
}

function getOptionalInt(argv: string[], name: string): number | null {
  const index = argv.indexOf(name);
  if (index === -1 || index + 1 >= argv.length) {
    return null;
  }
  const value = Number(argv[index + 1]);
  return Number.isFinite(value) ? value : null;
}

async function main() {
  const options = parseArgs(process.argv);
  await annotateRun(options);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
