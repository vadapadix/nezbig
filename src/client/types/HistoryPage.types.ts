export interface HistoryItem {
  id: string;
  fileName: string;
  checkedAt: string;
  plagiarismScore: number;
  wordCount?: number;
  aiProbability?: number;
}
