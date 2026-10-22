export type PreparedDocument = {
  text: string;
  skippedTitleWords: number;
  skippedBibliographyWords?: number;
  notes: string[];
};
