import { Color, GameState, Move } from '../rules';
import { AiDifficulty } from './ai';

export type AiMoveRequest = {
  kind: 'move';
  requestId: number;
  state: GameState;
  color: Color;
  difficulty: AiDifficulty;
  seed?: number;
  playForWin?: boolean;
  recentPositions?: string[];
  depthOverride?: number;
  maxTimeMs?: number;
  maxDepth?: number;
};

export type AiHintRequest = {
  kind: 'hint';
  requestId: number;
  positionKey: string;
  state: GameState;
  color: Color;
  depthOverride: number;
  seed?: number;
};

export type AiMoveResponse = {
  kind: 'move';
  requestId: number;
  move: Move | null;
};

export type AiHintResponse = {
  kind: 'hint';
  requestId: number;
  positionKey: string;
  move: Move | null;
};

export type AiExplainOptions = {
  playForWin?: boolean;
  recentPositions?: string[];
};

export type AiExplainResult = {
  title: string;
  moveLabel: string;
  bullets: string[];
  summary?: string;
  tags?: string[];
};

export type AiExplainRequest = {
  kind: 'explain';
  requestId: number;
  positionKey: string;
  moveSignature: string;
  state: GameState;
  move: Move;
  options?: AiExplainOptions;
};

export type AiExplainResponse = {
  kind: 'explain';
  requestId: number;
  positionKey: string;
  moveSignature: string;
  explanation: AiExplainResult;
};

export type AiWorkerResponse = AiMoveResponse | AiHintResponse | AiExplainResponse;
export type AiWorkerRequest = AiMoveRequest | AiHintRequest | AiExplainRequest;
