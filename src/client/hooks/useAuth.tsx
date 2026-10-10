import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from "react";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  loginWithGoogle: () => void;
  refresh: () => Promise<void>;
  syncHistory: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem("nezbig_auth_user");
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function getStoredToken(): string | null {
  try {
    return localStorage.getItem("nezbig_auth_token");
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [loading, setLoading] = useState(true);

  const getAuthHeaders = useCallback((): HeadersInit => {
    const token = getStoredToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const token = getStoredToken();
      if (!token) {
        setUser(null);
        localStorage.removeItem("nezbig_auth_user");
        setLoading(false);
        return;
      }

      const headers = getAuthHeaders();
      const res = await fetch("/api/auth/me", {
        headers,
        credentials: "include",
      });
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        localStorage.setItem("nezbig_auth_user", JSON.stringify(data.user));
      } else if (res.status === 401 || data.user === null) {
        // Token is confirmed invalid or expired on server
        setUser(null);
        localStorage.removeItem("nezbig_auth_token");
        localStorage.removeItem("nezbig_auth_user");
      }
    } catch {
      // Keep cached user on offline/temporary network blip
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  const syncHistory = useCallback(async () => {
    try {
      const raw = localStorage.getItem("nezbig_local_history");
      const localItems: any[] = raw ? JSON.parse(raw) : [];
      const authToken = localStorage.getItem("nezbig_auth_token");
      if (!authToken) {
        // Not authenticated: do not sync, preserve local history intact
        return;
      }
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      };

      if (Array.isArray(localItems) && localItems.length > 0) {
        const res = await fetch("/api/history/sync", {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ items: localItems }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.items && Array.isArray(data.items)) {
            const reportMap = new Map<string, any>();
            for (const it of localItems) {
              if (it?.id && it?.fullReport) reportMap.set(it.id, it.fullReport);
            }
            const updatedLocal = data.items.map((it: any) => ({
              ...it,
              fullReport: it.fullReport || reportMap.get(it.id) || undefined,
            }));
            localStorage.setItem("nezbig_local_history", JSON.stringify(updatedLocal));
            window.dispatchEvent(new Event("nezbig_history_updated"));
            return;
          }
        }
        // If sync failed (401, 500, network error): NEVER touch local items!
        return;
      }

      // ONLY if localItems is completely empty, fetch from account to populate local cache
      const fetchRes = await fetch("/api/history", { headers, credentials: "include" });
      if (fetchRes.ok) {
        const serverItems = await fetchRes.json();
        if (Array.isArray(serverItems) && serverItems.length > 0) {
          localStorage.setItem("nezbig_local_history", JSON.stringify(serverItems));
          window.dispatchEvent(new Event("nezbig_history_updated"));
        }
      }
    } catch {
      // Never wipe or damage local history on network error
    }
  }, []);

  // Check for auth_success/auth_error in URL (from Google OAuth redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("token")) {
      const token = params.get("token");
      if (token) localStorage.setItem("nezbig_auth_token", token);
    }
    if (params.has("auth_success")) {
      void refresh().then(() => {
        void syncHistory();
      });
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.has("auth_error")) {
      console.error("Auth error:", params.get("auth_error"));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [refresh, syncHistory]);

  useEffect(() => {
    void refresh().then(() => {
      const token = localStorage.getItem("nezbig_auth_token");
      if (token) void syncHistory();
    });
  }, [refresh, syncHistory]);

  const login = useCallback(async (email: string, password: string): Promise<{ error?: string }> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || "Помилка при вході." };
      if (data.token) {
        localStorage.setItem("nezbig_auth_token", data.token);
      }
      if (data.user) {
        setUser(data.user);
        localStorage.setItem("nezbig_auth_user", JSON.stringify(data.user));
        void syncHistory();
      }
      return {};
    } catch {
      return { error: "Помилка мережі." };
    }
  }, [syncHistory]);

  const register = useCallback(async (name: string, email: string, password: string): Promise<{ error?: string }> => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || "Помилка при реєстрації." };
      if (data.token) {
        localStorage.setItem("nezbig_auth_token", data.token);
      }
      if (data.user) {
        setUser(data.user);
        localStorage.setItem("nezbig_auth_user", JSON.stringify(data.user));
        void syncHistory();
      }
      return {};
    } catch {
      return { error: "Помилка мережі." };
    }
  }, [syncHistory]);

  const logout = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      await fetch("/api/auth/logout", { method: "POST", headers, credentials: "include" });
    } catch { /* ignore */ }
    localStorage.removeItem("nezbig_auth_token");
    localStorage.removeItem("nezbig_auth_user");
    setUser(null);
    window.dispatchEvent(new Event("nezbig_history_updated"));
  }, [getAuthHeaders]);

  const loginWithGoogle = useCallback(async () => {
    try {
      const res = await fetch(`/api/auth/google/url?origin=${encodeURIComponent(window.location.origin)}`);
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Google OAuth не налаштовано");
      }
    } catch {
      window.location.href = `/api/auth/google?origin=${encodeURIComponent(window.location.origin)}`;
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isLoggedIn: !!user, login, register, logout, loginWithGoogle, refresh, syncHistory }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
