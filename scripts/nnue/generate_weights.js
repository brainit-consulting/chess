import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_INPUT = 768;
const DEFAULT_HIDDEN = 64;
const MAGIC = 'SNN1';
const VERSION = 1;
const FLAGS = 0;

function getArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) {
    return fallback;
  }
  const value = Number(process.argv[index + 1]);
  return Number.isFinite(value) ? value : fallback;
}

function getFlag(name) {
  return process.argv.includes(name);
}

function createRng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0xffffffff;
  };
}

function writeHeader(buffer, inputSize, hiddenSize) {
  buffer.write(MAGIC, 0, 'ascii');
  buffer.writeUInt16LE(inputSize, 4);
  buffer.writeUInt16LE(hiddenSize, 6);
  buffer.writeUInt16LE(VERSION, 8);
  buffer.writeUInt16LE(FLAGS, 10);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function main() {
  const inputSize = getArg('--inputSize', DEFAULT_INPUT);
  const hiddenSize = getArg('--hiddenSize', DEFAULT_HIDDEN);
  const seed = getArg('--seed', 12345);
  const useRandom = getFlag('--random');

  const floatCount = inputSize * hiddenSize + hiddenSize + hiddenSize + 1;
  const byteLength = 12 + floatCount * 4;
  const buffer = Buffer.alloc(byteLength);
  writeHeader(buffer, inputSize, hiddenSize);

  if (useRandom) {
    const rng = createRng(seed);
    for (let i = 0; i < floatCount; i += 1) {
      buffer.writeFloatLE((rng() * 2 - 1) * 0.01, 12 + i * 4);
    }
  }

  const outArgIndex = process.argv.indexOf('--out');
  const output =
    outArgIndex !== -1 && process.argv[outArgIndex + 1]
      ? process.argv[outArgIndex + 1]
      : path.join(
          __dirname,
          '..',
          '..',
          'src',
          'ai',
          'nnue',
          'weights',
          'Scorpion-NNUE-Weight.snnue'
        );

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, buffer);
  console.log(`Wrote NNUE weights to ${output}`);
}

main();
