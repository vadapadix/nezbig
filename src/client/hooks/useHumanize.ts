import { apiFetch } from "../utils/apiClient";
import { useState, useCallback } from "react";
import type { HumanizeMode, HumanizeResult } from "../../shared/types/index";

export function useHumanize() {
  const [humanizerBusy, setHumanizerBusy] = useState(false);
  const [humanized, setHumanized] = useState<HumanizeResult | null>(null);

  const handleHumanize = useCallback(async (text: string, sourceHtml: string, selectedFile: File | null, mode: HumanizeMode = "academic"): Promise<HumanizeResult> => {
    setHumanizerBusy(true);
    setHumanized(null);
    try {
      let response: Response;
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("mode", mode);
        response = await apiFetch("/api/humanize-file", { method: "POST", body: formData });
      } else {
        response = await apiFetch("/api/humanize", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text, html: sourceHtml, mode })
        });
      }

      const payload = await response.json();
      if (!response.ok || payload.error) {
        throw new Error(payload.error || "Редагування не вдалося.");
      }

      setHumanized(payload);
      return payload;
    } finally {
      setHumanizerBusy(false);
    }
  }, []);

  return { humanized, setHumanized, humanizerBusy, handleHumanize };
}
