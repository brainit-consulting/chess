export type AnalyzerChoice = 'buddy' | 'analysispro' | 'chessengine';

export const ANALYZER_OPTIONS: Record<
  AnalyzerChoice,
  { label: string; url: string }
> = {
  buddy: {
    label: 'Scorpion Chess Game Analyzer',
    url: 'https://scorpionchessanalyzer.base44.app/'
  },
  analysispro: {
    label: 'Chess Analysis Pro',
    url: 'https://chessanalysis.pro/'
  },
  chessengine: {
    label: 'Chess Engine AI',
    url: 'https://chessengine.ai/'
  }
};

export const DEFAULT_ANALYZER: AnalyzerChoice = 'buddy';
