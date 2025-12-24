import { GameMode } from '../types';
import { Color } from '../rules';

export type AiResponseGate = {
  requestId: number;
  currentRequestId: number;
  gameOver: boolean;
  mode: GameMode;
  aiVsAiStarted: boolean;
  aiVsAiRunning: boolean;
  aiVsAiPaused: boolean;
  isAiControlled: boolean;
};

export type HintRequestGate = {
  mode: GameMode;
  hintMode: boolean;
  activeColor: Color;
  gameOver: boolean;
  pendingPromotion: boolean;
};

export type HintResponseGate = {
  requestId: number;
  currentRequestId: number;
  positionKey: string;
  currentPositionKey: string;
  mode: GameMode;
  hintMode: boolean;
  activeColor: Color;
  gameOver: boolean;
};

export function shouldApplyAiResponse(state: AiResponseGate): boolean {
  if (state.requestId !== state.currentRequestId) {
    return false;
  }
  if (state.gameOver || !state.isAiControlled) {
    return false;
  }
  if (
    state.mode === 'aivai' &&
    (!state.aiVsAiStarted || !state.aiVsAiRunning || state.aiVsAiPaused)
  ) {
    return false;
  }
  return true;
}

export function shouldRequestHint(state: HintRequestGate): boolean {
  if (state.mode !== 'hvai' || !state.hintMode) {
    return false;
  }
  if (state.gameOver || state.pendingPromotion) {
    return false;
  }
  if (state.activeColor !== 'w') {
    return false;
  }
  return true;
}

export function shouldApplyHintResponse(state: HintResponseGate): boolean {
  if (state.requestId !== state.currentRequestId) {
    return false;
  }
  if (state.mode !== 'hvai' || !state.hintMode) {
    return false;
  }
  if (state.gameOver || state.activeColor !== 'w') {
    return false;
  }
  if (state.positionKey !== state.currentPositionKey) {
    return false;
  }
  return true;
}
