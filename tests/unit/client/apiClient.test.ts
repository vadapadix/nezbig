import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, SESSION_INVALID_EVENT } from "../../../src/client/utils/apiClient";

afterEach(() => vi.unstubAllGlobals());

describe("API session failures", () => {
  it("reports an expired session and includes cookies", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 401 });
    vi.stubGlobal("fetch", fetchMock);
    const listener = vi.fn();
    window.addEventListener(SESSION_INVALID_EVENT, listener);
    try {
      await apiFetch("/api/auth/me");
      expect(listener).toHaveBeenCalledOnce();
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/me", { credentials: "include" });
    } finally {
      window.removeEventListener(SESSION_INVALID_EVENT, listener);
    }
  });

  it("leaves wrong-password handling to the login form", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 401 }));
    const listener = vi.fn();
    window.addEventListener(SESSION_INVALID_EVENT, listener);
    try {
      await apiFetch("/api/auth/login", { method: "POST" });
      expect(listener).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(SESSION_INVALID_EVENT, listener);
    }
  });
});
