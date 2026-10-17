import { afterEach, expect, it, vi } from "vitest";
import { clearDriveAccessToken, getSavedDriveAccessToken, saveDriveAccessToken } from "./googleDrive";

afterEach(() => { clearDriveAccessToken(); localStorage.clear(); sessionStorage.clear(); vi.useRealTimers(); });
it("keeps Drive credentials in the browser storage until expiry and removes legacy local credentials", () => {
  localStorage.setItem("nezbig_gdrive_token", "old-token");
  localStorage.setItem("nezbig_gdrive_expires_at", String(Date.now() + 100000));
  expect(getSavedDriveAccessToken()).toBeNull();
  expect(localStorage.getItem("nezbig_gdrive_token")).toBeNull();
  saveDriveAccessToken("page-token");
  expect(localStorage.getItem("nezbig_drive_session")).toContain("page-token");
  expect(getSavedDriveAccessToken()).toBe("page-token");
  expect(localStorage.getItem("nezbig_gdrive_token")).toBeNull();
  clearDriveAccessToken();
  expect(getSavedDriveAccessToken()).toBeNull();
});
it("restores an unexpired persisted token after a page reload", async () => {
  saveDriveAccessToken("reload-token", 3600);
  vi.resetModules();
  const reloaded = await import("./googleDrive");
  expect(reloaded.getSavedDriveAccessToken()).toBe("reload-token");
  reloaded.clearDriveAccessToken();
  expect(localStorage.getItem("nezbig_drive_session")).toBeNull();
});
it("expires a token before its access window closes", () => {
  vi.useFakeTimers();
  saveDriveAccessToken("page-token", 120);
  vi.advanceTimersByTime(61000);
  expect(getSavedDriveAccessToken()).toBeNull();
});
