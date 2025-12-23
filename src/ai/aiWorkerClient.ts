import { GameMode } from '../types';

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
