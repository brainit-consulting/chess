export type AnalyzerChoice = 'buddy' | 'analysispro';

export const ANALYZER_OPTIONS: Record<
  AnalyzerChoice,
  { label: string; url: string }
> = {
  buddy: {
    label: 'BrainIT Chess Buddy Analyzer',
    url: 'https://chessgamebuddy.base44.app/'
  },
  analysispro: {
    label: 'Chess Analysis Pro',
    url: 'https://chessanalysis.pro/'
  }
};

export const DEFAULT_ANALYZER: AnalyzerChoice = 'buddy';
