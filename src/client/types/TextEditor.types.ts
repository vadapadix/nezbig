import type { ClipboardEvent } from "react";

export interface TextEditorProps {
  editorRef: React.RefObject<HTMLDivElement | null>;
  selectedFile: File | null;
  fileName: string;
  sourceHtml: string;
  formattedPreviewBusy: boolean;
  onInput: () => void;
  onPaste: (e: ClipboardEvent<HTMLDivElement>) => void;
  onFileChange: (file: File | null) => void;
  onClearFile: () => void;
  onCopyFormatted: () => void;
  onDownloadFormatted: () => void;
  draftSaved: boolean;
  wordCount: number;
}
