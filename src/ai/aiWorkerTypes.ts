import { Color, GameState, Move } from '../rules';
import { AiDifficulty } from './ai';

export type AiWorkerRequest = {
  requestId: number;
  state: GameState;
  color: Color;
  difficulty: AiDifficulty;
  seed?: number;
  playForWin?: boolean;
  recentPositions?: string[];
};

export type AiWorkerResponse = {
  requestId: number;
  move: Move | null;
};
