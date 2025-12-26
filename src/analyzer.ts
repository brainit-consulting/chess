export type AnalyzerChoice = 'buddy' | 'analysispro' | 'analysisnet';

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
  },
  analysisnet: {
    label: 'Chess Analysis Net',
    url: 'https://chessanalysis.net/'
  }
};

export const DEFAULT_ANALYZER: AnalyzerChoice = 'buddy';
