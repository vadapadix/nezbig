import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { AuthProvider, useAuth } from "../../../../src/client/hooks/useAuth";

function Probe() {
  const { user, loading } = useAuth();
  return <span>{loading ? "loading" : user?.name || "guest"}</span>;
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  window.history.replaceState({}, "", "/");
});

describe("cookie authentication", () => {
  it("does not clear a restored account when startup receives a temporary server error", async () => {
    localStorage.setItem("nezbig_auth_user", JSON.stringify({ id: "alice", name: "Alice", email: "alice@example.com" }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({ user: null, error: "unavailable" }) }))
    );
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    expect(localStorage.getItem("nezbig_auth_user")).toContain("Alice");
  });
  it("restores a signed-in user without a localStorage token", async () => {
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => (url === "/api/auth/me" ? { user: { id: "alice", name: "Alice", email: "alice@example.com" } } : [])
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/me", expect.objectContaining({ credentials: "include" }));
    expect(localStorage.getItem("nezbig_auth_token")).toBeNull();
  });

  it("does not accept an injected URL token as a session", async () => {
    window.history.replaceState({}, "", "/?token=injected-token");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ user: null }) }))
    );
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText("guest")).toBeInTheDocument());
    expect(window.location.search).toBe("");
    expect(localStorage.getItem("nezbig_auth_token")).toBeNull();
  });
});
