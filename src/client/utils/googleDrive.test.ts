import { afterEach, expect, it, vi } from "vitest";
import { clearDriveAccessToken, getSavedDriveAccessToken, saveDriveAccessToken } from "./googleDrive";

afterEach(() => { clearDriveAccessToken(); localStorage.clear(); vi.useRealTimers(); });
it("keeps Drive credentials in memory and removes legacy persisted credentials", () => {
  localStorage.setItem("nezbig_gdrive_token", "old-token");
  localStorage.setItem("nezbig_gdrive_expires_at", String(Date.now() + 100000));
  expect(getSavedDriveAccessToken()).toBeNull();
  expect(localStorage.getItem("nezbig_gdrive_token")).toBeNull();
  saveDriveAccessToken("page-token");
  expect(getSavedDriveAccessToken()).toBe("page-token");
  expect(localStorage.getItem("nezbig_gdrive_token")).toBeNull();
  clearDriveAccessToken();
  expect(getSavedDriveAccessToken()).toBeNull();
});
it("expires a token before its access window closes", () => {
  vi.useFakeTimers();
  saveDriveAccessToken("page-token", 120);
  vi.advanceTimersByTime(61000);
  expect(getSavedDriveAccessToken()).toBeNull();
});
