import type { AiContentExclusions } from "../../shared/types/index.js";

export type PreparedAiText = {
  text: string;
  exclusions: AiContentExclusions;
};
