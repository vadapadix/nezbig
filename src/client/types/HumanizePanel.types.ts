import type { HumanizeResult } from "../../shared/types/index";

export interface HumanizePanelProps {
  humanized: HumanizeResult;
  wordDownloadBusy: boolean;
  selectedFile: File | null;
  onMoveToChecker: () => void;
  onCopyFormatted: () => void;
  onDownloadForWord: () => void;
}
