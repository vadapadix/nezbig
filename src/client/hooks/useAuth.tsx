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
        // Only clear if confirmed not authenticated
        if (!getStoredToken()) {
          setUser(null);
          localStorage.removeItem("nezbig_auth_user");
        }
      }
    } catch {
      // Keep cached user on offline/temporary network blip
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  // Check for auth_success/auth_error in URL (from Google OAuth redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("token")) {
      const token = params.get("token");
      if (token) localStorage.setItem("nezbig_auth_token", token);
    }
    if (params.has("auth_success")) {
      void refresh();
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.has("auth_error")) {
      console.error("Auth error:", params.get("auth_error"));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
      }
      return {};
    } catch {
      return { error: "Помилка мережі." };
    }
  }, []);

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
      }
      return {};
    } catch {
      return { error: "Помилка мережі." };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      await fetch("/api/auth/logout", { method: "POST", headers, credentials: "include" });
    } catch { /* ignore */ }
    localStorage.removeItem("nezbig_auth_token");
    localStorage.removeItem("nezbig_auth_user");
    setUser(null);
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
    <AuthContext.Provider value={{ user, loading, isLoggedIn: !!user, login, register, logout, loginWithGoogle, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
