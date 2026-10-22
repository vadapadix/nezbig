import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthModal } from "../components/AuthModal";
import { useAuth } from "../hooks/useAuth";

export default function LoginPage() {
  const { isLoggedIn, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requested = params.get("returnTo") ?? "/";
  const returnTo = requested.startsWith("/") && !requested.startsWith("//") && !/[\\\r\n]/.test(requested) ? requested : "/";
  useEffect(() => {
    if (!loading && isLoggedIn) navigate(returnTo, { replace: true });
  }, [loading, isLoggedIn, navigate, returnTo]);
  return <AuthModal open onClose={() => navigate("/", { replace: true })} />;
}
