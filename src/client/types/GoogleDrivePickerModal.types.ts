import type { ScanReport } from "../../shared/types/index";

export interface GoogleDrivePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectReport: (report: ScanReport) => void;
}
