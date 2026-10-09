import { useState, useCallback } from "react";
import type { ScanReport, LlmOpinion } from "../../shared/types";
import { summarizeAiError } from "../utils/reportLabels";

export function useAiOpinion(setReport: React.Dispatch<React.SetStateAction<ScanReport | null>>) {
  const [llmBusy, setLlmBusy] = useState(false);

  const loadLlmOpinion = useCallback(async (
    baseReport: ScanReport,
    sourceText: string,
    sourceFile: File | null
  ): Promise<LlmOpinion | void> => {
    setLlmBusy(true);
    setReport((current) => (current?.id === baseReport.id ? { ...current, aiOpinionError: undefined } : current));
    try {
      let response: Response;
      const suspiciousExcerpts = (baseReport.aiSuspiciousSegments ?? []).slice(0, 5).map((segment) => segment.excerpt);
      if (sourceFile) {
        const formData = new FormData();
        formData.append("file", sourceFile);
        formData.append("reportId", baseReport.id);
        formData.append("localProbability", String(baseReport.aiProbability));
        formData.append("localSignals", JSON.stringify(baseReport.aiSignals));
        formData.append("suspiciousExcerpts", JSON.stringify(suspiciousExcerpts));
        response = await fetch("/api/ai-opinion-file", { method: "POST", body: formData });
      } else {
        response = await fetch("/api/ai-opinion", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            text: sourceText,
            reportId: baseReport.id,
            localProbability: baseReport.aiProbability,
            localSignals: baseReport.aiSignals,
            suspiciousExcerpts
          })
        });
      }

      const payload = await response.json();
      if (!response.ok || payload.error) throw new Error(payload.error || "AI-думка недоступна.");

      setReport((current) =>
        current?.id === baseReport.id
          ? {
              ...current,
              aiOpinionError: undefined,
              aiOpinionProbability: payload.aiProbability,
              aiOpinionModel: payload.aiModel,
              aiOpinionNote: payload.aiNote,
              aiOpinionVerdict: payload.aiVerdictText,
              aiOpinionSignals: payload.aiSignals
            }
          : current
      );
      return payload;
    } catch (error) {
      const note = `AI-думка недоступна, залишено локальний звіт: ${summarizeAiError(error)}.`;
      setReport((current) => (current?.id === baseReport.id ? { ...current, aiOpinionError: note } : current));
      throw error;
    } finally {
      setLlmBusy(false);
    }
  }, [setReport]);

  return { loadLlmOpinion, llmBusy };
}
