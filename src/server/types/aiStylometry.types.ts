export type StylometryAnalysis = {
  zipfScore: number;
  hapaxRatio: number;
  punctuationEntropyScore: number;
  paragraphUniformityScore: number;
  rhythmDeltaScore: number;
  triadicScore: number;
  antithesisScore: number;
  evidence: string[];
};
