import { HistoryMove } from './gameHistory';
import { PieceType, Square } from '../rules';

export type PlainEnglishSummary = {
  lines: string[];
  text: string;
};

export function buildPlainEnglishLines(moves: HistoryMove[]): string[] {
  const lines: string[] = [];
  let currentNumber = 0;
  let whiteText = '';

  for (const move of moves) {
    if (move.color === 'w') {
      if (whiteText) {
        lines.push(whiteText);
      }
      currentNumber = move.moveNumber;
      whiteText = `${currentNumber}. ${describeMove(move)}`;
      continue;
    }
    const blackText = describeMove(move);
    if (whiteText && move.moveNumber === currentNumber) {
      lines.push(`${whiteText}; ${blackText}`);
      whiteText = '';
    } else {
      lines.push(`${move.moveNumber}. ${blackText}`);
    }
  }

  if (whiteText) {
    lines.push(whiteText);
  }

  return lines;
}

export function buildPlainEnglishText(options: {
  moves: HistoryMove[];
  title?: string;
  dateLabel?: string;
  durationLabel?: string;
  sanLine?: string;
}): string {
  const title = options.title ?? '3D Chess — Game History (Plain English)';
  const lines = buildPlainEnglishLines(options.moves);
  const sections: string[] = [title];

  if (options.dateLabel) {
    sections.push(`Date: ${options.dateLabel}`);
  }
  if (options.durationLabel) {
    sections.push(`Game Time: ${options.durationLabel}`);
  }

  sections.push('');
  sections.push(...lines);

  if (options.sanLine) {
    sections.push('');
    sections.push(`SAN: ${options.sanLine}`);
  }

  return sections.join('\n');
}

export function buildPlainEnglishHtml(options: {
  moves: HistoryMove[];
  title?: string;
  dateLabel?: string;
  durationLabel?: string;
  sanLine?: string;
}): string {
  const title = options.title ?? '3D Chess - Game History (Plain English)';
  const lines = buildPlainEnglishLines(options.moves);
  const parts: string[] = [];

  if (options.dateLabel) {
    parts.push(
      `<div class="meta"><strong>Date:</strong> ${escapeHtml(options.dateLabel)}</div>`
    );
  }
  if (options.durationLabel) {
    parts.push(
      `<div class="meta"><strong>Game Time:</strong> ${escapeHtml(
        options.durationLabel
      )}</div>`
    );
  }

  const sanBlock = options.sanLine
    ? `<div class="san"><strong>SAN:</strong> ${escapeHtml(options.sanLine)}</div>`
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: dark;
      }
      body {
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
        background: #0b0d12;
        color: #f4efe5;
        margin: 24px;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 20px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #e0c36d;
      }
      .meta {
        color: #c6b9a2;
        font-size: 13px;
        margin-bottom: 4px;
      }
      pre {
        margin: 12px 0;
        padding: 12px;
        background: #10151f;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        white-space: pre-wrap;
        font-size: 13px;
        line-height: 1.5;
      }
      .san {
        margin-top: 12px;
        font-size: 12px;
        color: #c6b9a2;
      }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    ${parts.join('\n    ')}
    <pre>${escapeHtml(lines.join('\n'))}</pre>
    ${sanBlock}
  </body>
</html>`;
}

function describeMove(move: HistoryMove): string {
  const side = move.color === 'w' ? 'White' : 'Black';
  const pieceName = pieceLabel(move.piece);
  const from = squareToLabel(move.from);
  const to = squareToLabel(move.to);

  if (move.isCastle) {
    const sideLabel = move.to.file === 6 ? 'kingside' : 'queenside';
    return `${side} king castles ${sideLabel}${formatNotes(move, [castleNote(sideLabel)])}`;
  }

  const action = move.isCapture ? 'x' : '->';
  const base = `${side} ${pieceName} ${from}${action}${to}`;
  return `${base}${formatNotes(move, captureNote(move))}`;
}

function captureNote(move: HistoryMove): string[] {
  if (!move.isCapture) {
    return [];
  }
  const captured = move.captured ? pieceLabel(move.captured).toLowerCase() : 'piece';
  const note = `captures ${captured}`;
  return [note];
}

function formatNotes(move: HistoryMove, extra: string[] = []): string {
  const notes = [...extra];
  if (move.isEnPassant) {
    notes.push('en passant');
  }
  if (move.promotion) {
    notes.push(`promotion to ${pieceLabel(move.promotion)}`);
  }
  if (move.givesCheckmate) {
    notes.push('checkmate');
  } else if (move.givesCheck) {
    notes.push('check');
  }
  if (notes.length === 0) {
    return '';
  }
  return ` (${notes.join(', ')})`;
}

function castleNote(side: string): string {
  return `castle ${side}`;
}

function pieceLabel(type: PieceType): string {
  switch (type) {
    case 'pawn':
      return 'pawn';
    case 'knight':
      return 'knight';
    case 'bishop':
      return 'bishop';
    case 'rook':
      return 'rook';
    case 'queen':
      return 'queen';
    case 'king':
      return 'king';
  }
}

function squareToLabel(square: Square): string {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  return `${files[square.file]}${square.rank + 1}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
