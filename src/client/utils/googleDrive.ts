import type { ScanReport } from "../../shared/types";
import { serializeNezbigReport, parseNezbigReport } from "./nezbigFile";

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
            error_callback?: (error: any) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

export interface DriveReportFile {
  id: string;
  name: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
}

let cachedClientId: string | null = null;
let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

/**
 * Retrieves the Google Client ID from backend config or environment.
 */
export async function getGoogleClientId(): Promise<string> {
  if (cachedClientId) return cachedClientId;
  try {
    const res = await fetch("/api/auth/google/config");
    if (res.ok) {
      const data = await res.json();
      if (data.clientId) {
        cachedClientId = data.clientId;
        return data.clientId;
      }
    }
  } catch {
    // ignore
  }

  const envId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
  if (envId) {
    cachedClientId = envId;
    return envId;
  }
  return "";
}

/**
 * Loads the Google Identity Services (GIS) client script dynamically.
 */
export async function loadGoogleGsiScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return;

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Не вдалося завантажити Google Identity Services")));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Не вдалося завантажити Google Identity Services"));
    document.head.appendChild(script);
  });
}

/**
 * Requests an OAuth access token with drive.file scope using Google Identity Services.
 */
export async function requestDriveAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedAccessToken;
  }

  const clientId = await getGoogleClientId();
  if (!clientId) {
    throw new Error("Google Client ID не налаштовано. Перевірте GOOGLE_CLIENT_ID на сервері.");
  }

  await loadGoogleGsiScript();

  return new Promise((resolve, reject) => {
    try {
      const tokenClient = window.google!.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "https://www.googleapis.com/auth/drive.file",
        callback: (response) => {
          if (response.error) {
            reject(new Error(`Помилка авторизації Google: ${response.error}`));
            return;
          }
          if (!response.access_token) {
            reject(new Error("Не вдалося отримати токен доступу до Google Диску"));
            return;
          }
          cachedAccessToken = response.access_token;
          tokenExpiresAt = Date.now() + 3500 * 1000;
          resolve(response.access_token);
        },
        error_callback: (err) => {
          reject(new Error(err?.message || "Помилка при запиті доступу до Google Диску"));
        },
      });

      tokenClient.requestAccessToken({ prompt: cachedAccessToken ? "" : "consent" });
    } catch (error) {
      reject(error instanceof Error ? error : new Error("Не вдалося ініціалізувати Google авторизацію"));
    }
  });
}

/**
 * Finds or creates the "Незбіг" folder on the user's Google Drive.
 */
async function getOrCreateNezbigFolder(accessToken: string): Promise<string | null> {
  try {
    const query = encodeURIComponent("name = 'Незбіг' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (searchRes.ok) {
      const data = await searchRes.json();
      if (Array.isArray(data.files) && data.files.length > 0) {
        return data.files[0].id;
      }
    }

    // Create the folder
    const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Незбіг",
        mimeType: "application/vnd.google-apps.folder",
        description: "Папка зі збереженими звітами сервісу Незбіг",
      }),
    });

    if (createRes.ok) {
      const folderData = await createRes.json();
      return folderData.id || null;
    }
  } catch {
    // If folder creation fails, fallback to root folder
  }
  return null;
}

/**
 * Saves a ScanReport as a .nezbig file directly onto the user's Google Drive.
 */
export async function saveReportToGoogleDrive(report: ScanReport): Promise<{
  fileId: string;
  fileName: string;
  webViewLink?: string;
}> {
  const accessToken = await requestDriveAccessToken();
  const folderId = await getOrCreateNezbigFolder(accessToken);

  const rawJson = serializeNezbigReport(report);
  const safeName = (report.fileName || "report").replace(/[^a-z0-9а-яіїєґ_.-]/gi, "_");
  const fileName = `nezbig-report-${safeName}.nezbig`;

  const metadata: Record<string, any> = {
    name: fileName,
    mimeType: "application/json",
    description: `Звіт перевірки Nezbig (${report.plagiarismScore}% плагіату, ${report.aiProbability}% AI). Можна відкрити в nezbig.vercel.app`,
  };
  if (folderId) {
    metadata.parents = [folderId];
  }

  const boundary = `nezbig_drive_${Date.now()}`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const multipartBody =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    rawJson +
    closeDelim;

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  if (!uploadRes.ok) {
    const errorData = await uploadRes.json().catch(() => ({}));
    const message = errorData?.error?.message || `HTTP ${uploadRes.status}`;
    throw new Error(`Не вдалося зберегти на Google Диск: ${message}`);
  }

  const result = await uploadRes.json();
  return {
    fileId: result.id,
    fileName: result.name,
    webViewLink: result.webViewLink,
  };
}

/**
 * Lists .nezbig and report files accessible to the app on the user's Google Drive.
 */
export async function listReportsFromGoogleDrive(): Promise<DriveReportFile[]> {
  const accessToken = await requestDriveAccessToken();
  const query = encodeURIComponent("trashed = false and (name contains '.nezbig' or name contains '_report.json')");
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime,size,webViewLink)&orderBy=modifiedTime desc&pageSize=30`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || "Не вдалося отримати список файлів з Google Диску");
  }

  const data = await res.json();
  return (data.files || []) as DriveReportFile[];
}

/**
 * Downloads and parses a .nezbig report from Google Drive by its fileId.
 */
export async function loadReportFromGoogleDrive(fileId: string): Promise<ScanReport> {
  const accessToken = await requestDriveAccessToken();
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Не вдалося прочитати файл з Google Диску (HTTP ${res.status})`);
  }

  const text = await res.text();
  const report = parseNezbigReport(text);
  if (!report) {
    throw new Error("Формат файлу пошкоджено або файл не є валідним звітом Незбіг.");
  }
  return report;
}
