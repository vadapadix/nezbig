import { beforeEach, describe, expect, it } from "vitest";
import { localHistoryKey, GUEST_HISTORY_KEY } from "../../../../src/client/utils/localHistory";

beforeEach(() => localStorage.clear());
describe("browser history isolation", () => {
  it("separates account and guest caches", () => {
    expect(localHistoryKey()).toBe(GUEST_HISTORY_KEY);
    localStorage.setItem("nezbig_auth_user", JSON.stringify({ id: "alice" }));
    const alice = localHistoryKey();
    localStorage.setItem(alice, "private report");
    localStorage.setItem("nezbig_auth_user", JSON.stringify({ id: "bob" }));
    expect(localStorage.getItem(localHistoryKey())).toBeNull();
    localStorage.removeItem("nezbig_auth_user");
    expect(localStorage.getItem(localHistoryKey())).toBeNull();
  });
  it("moves legacy history to the current account only once", () => {
    localStorage.setItem("nezbig_local_history", "legacy report");
    localStorage.setItem("nezbig_auth_user", JSON.stringify({ id: "alice" }));
    expect(localStorage.getItem(localHistoryKey())).toBe("legacy report");
    localStorage.removeItem("nezbig_auth_user");
    expect(localStorage.getItem(localHistoryKey())).toBeNull();
  });
});
