

export interface LoadingPanelProps {
  busy: boolean;
  llmBusy: boolean;
  estimatedSeconds: string;
  progress?: { checked: number; total: number } | null;
  onCancel?: () => void;
}
