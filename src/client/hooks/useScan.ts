import { useState, useCallback, useRef } from "react";
import type { ScanReport, ScanSettings } from "../../shared/types";

export function useScan() {
  const [report, setReport] = useState<ScanReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ checked: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setBusy(false);
    setError("Перевірку скасовано користувачем.");
  }, []);

  const scan = useCallback(async (
    text: string,
    fileName: string,
    selectedFile: File | null,
    settings: ScanSettings
  ): Promise<ScanReport> => {
    setBusy(true);
    setError(null);
    setReport(null);
    setProgress(null);

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      const token = localStorage.getItem("nezbig_auth_token");
      const authHeaders: Record<string, string> = {};
      if (token) authHeaders["Authorization"] = `Bearer ${token}`;

      let response: Response;
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("settings", JSON.stringify(settings));
        response = await fetch("/api/scan-file/jobs", {
          method: "POST",
          headers: authHeaders,
          body: formData,
          signal,
          credentials: "include"
        });
      } else {
        response = await fetch("/api/scan/jobs", {
          method: "POST",
          headers: { "content-type": "application/json", ...authHeaders },
          body: JSON.stringify({ text, fileName, settings }),
          signal,
          credentials: "include"
        });
      }

      const payload = await response.json();
      if (!response.ok || payload.error) {
        throw new Error(payload.error || "Failed to start scan job.");
      }

      if (payload.status === "completed" && payload.result) {
        setReport(payload.result);
        setBusy(false);
        return payload.result;
      }

      const jobId = payload.jobId;

      return await new Promise<ScanReport>((resolve, reject) => {
        const poll = async () => {
          try {
            if (signal.aborted) throw new Error("Перевірку скасовано користувачем.");
            const statusRes = await fetch(`/api/scan-status/${jobId}`, {
              headers: authHeaders,
              signal,
              credentials: "include"
            });
            const statusPayload = await statusRes.json();
            
            if (!statusRes.ok || statusPayload.error) {
              throw new Error(statusPayload.error || "Job failed.");
            }

            if (statusPayload.status === "completed") {
              timeoutRef.current = null;
              setReport(statusPayload.result);
              setBusy(false);
              resolve(statusPayload.result);
            } else if (statusPayload.status === "error") {
              throw new Error(statusPayload.error || "Job error.");
            } else {
              if (statusPayload.progress) {
                setProgress({ checked: statusPayload.progress.chunksChecked, total: statusPayload.progress.totalChunks });
              }
              timeoutRef.current = setTimeout(poll, 2000);
            }
          } catch (err) {
            setBusy(false);
            if (err instanceof Error && err.name === "AbortError") {
              reject(err);
              return;
            }
            const errMsg = err instanceof Error ? err.message : String(err);
            setError(errMsg);
            reject(new Error(errMsg));
          }
        };
        timeoutRef.current = setTimeout(poll, 2000);
      });
    } catch (err) {
      setBusy(false);
      if (err instanceof Error && err.name === "AbortError") {
        throw err;
      }
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg);
      throw new Error(errMsg);
    }
  }, []);

  return { report, setReport, busy, progress, error, scan, cancel };
}
