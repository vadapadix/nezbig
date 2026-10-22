import type { ScanSettings } from "../../shared/types/index";

export interface ScanSettingsPanelProps {
  settings: ScanSettings;
  wordCount: number;
  estimatedScanSeconds: number;
  canScan: boolean;
  busy: boolean;
  canHumanize: boolean;
  humanizerBusy: boolean;
  message: string;
  onSettingsChange: (settings: ScanSettings) => void;
  onHumanize: () => void;
}
