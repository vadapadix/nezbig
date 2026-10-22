import type { HumanizeMode } from "../../shared/types/index.js";

export type Rule = {
  label: string;
  detail: string;
  pattern: RegExp;
  category?: "cliche" | "syntax" | "vocabulary" | "style";
  modes?: HumanizeMode[];
  replacement: string | ((match: string, ...groups: string[]) => string);
};
