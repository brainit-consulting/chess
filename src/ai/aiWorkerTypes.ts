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

export type AiWorkerRequest = AiMoveRequest | AiHintRequest;

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

export type AiWorkerResponse = AiMoveResponse | AiHintResponse;
