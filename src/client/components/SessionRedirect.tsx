import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SESSION_INVALID_EVENT } from "../utils/apiClient";

export function SessionRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    const redirect = () => {
      if (location.pathname === "/login") return;
      navigate(`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`, { replace: true });
    };
    window.addEventListener(SESSION_INVALID_EVENT, redirect);
    return () => window.removeEventListener(SESSION_INVALID_EVENT, redirect);
  }, [navigate, location.pathname, location.search]);
  return null;
}
