import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useLanguage } from "../context/LanguageContext";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const { login, register, loginWithGoogle } = useAuth();
  const { lang } = useLanguage();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const result = tab === "login"
      ? await login(email, password)
      : await register(name, email, password);

    setSubmitting(false);
    if (result.error) {
      setError(result.error);
    } else {
      // Success — close modal and reset
      setName("");
      setEmail("");
      setPassword("");
      onClose();
    }
  }

  function handleGoogleLogin() {
    loginWithGoogle();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#141b1a] border border-white/10 rounded-2xl p-7 w-full max-w-md shadow-[0_24px_64px_rgba(0,0,0,0.6)] relative fade-in">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 p-1.5 rounded-lg text-on-surface-variant hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          title={lang === "uk" ? "Закрити" : "Close"}
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>

        {/* Tab switcher */}
        <div className="flex gap-6 mb-6 border-b border-white/10 pb-2">
          <button
            type="button"
            onClick={() => { setTab("login"); setError(""); }}
            className={`font-headline-sm text-headline-sm transition-all pb-2 bg-transparent !border-0 cursor-pointer ${tab === "login" ? "!text-emerald-glow !border-b-2 !border-emerald-glow font-bold -mb-[9px]" : "!text-on-surface-variant hover:!text-white"}`}
          >
            {lang === "uk" ? "Вхід" : "Sign In"}
          </button>
          <button
            type="button"
            onClick={() => { setTab("register"); setError(""); }}
            className={`font-headline-sm text-headline-sm transition-all pb-2 bg-transparent !border-0 cursor-pointer ${tab === "register" ? "!text-emerald-glow !border-b-2 !border-emerald-glow font-bold -mb-[9px]" : "!text-on-surface-variant hover:!text-white"}`}
          >
            {lang === "uk" ? "Реєстрація" : "Register"}
          </button>
        </div>

        {/* Google login */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] !text-white transition-all mb-5 font-medium group cursor-pointer"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span>{lang === "uk" ? "Продовжити з Google" : "Continue with Google"}</span>
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex-grow border-t border-white/10"></div>
          <span className="text-label-sm text-on-surface-variant font-medium">
            {lang === "uk" ? "або через email" : "or with email"}
          </span>
          <div className="flex-grow border-t border-white/10"></div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {tab === "register" && (
            <input
              type="text"
              placeholder={lang === "uk" ? "Ваше ім'я" : "Full Name"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-[#1b2524] border border-white/15 rounded-xl px-4 py-3 text-white placeholder:text-on-surface-variant/50 focus:border-emerald-glow focus:ring-1 focus:ring-emerald-glow transition-all outline-none text-body-md"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-[#1b2524] border border-white/15 rounded-xl px-4 py-3 text-white placeholder:text-on-surface-variant/50 focus:border-emerald-glow focus:ring-1 focus:ring-emerald-glow transition-all outline-none text-body-md"
          />
          <div className="relative w-full">
            <input
              type={showPassword ? "text" : "password"}
              placeholder={lang === "uk" ? "Пароль" : "Password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-[#1b2524] border border-white/15 rounded-xl px-4 py-3 pr-12 text-white placeholder:text-on-surface-variant/50 focus:border-emerald-glow focus:ring-1 focus:ring-emerald-glow transition-all outline-none text-body-md"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-on-surface-variant hover:text-white transition-colors cursor-pointer"
              title={showPassword ? (lang === "uk" ? "Сховати пароль" : "Hide password") : (lang === "uk" ? "Показати пароль" : "Show password")}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              <span className="material-symbols-outlined text-lg">
                {showPassword ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>

          {error && (
            <div className="text-error text-label-sm bg-error/10 border border-error/20 px-3.5 py-2.5 rounded-xl font-medium">{error}</div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 mt-1 bg-emerald-glow text-[#0e1514] font-bold rounded-xl hover:bg-[#3bf5e4] active:scale-[0.99] disabled:opacity-50 transition-all shadow-[0_8px_20px_rgba(46,196,182,0.25)] text-body-md flex items-center justify-center cursor-pointer"
          >
            {submitting
              ? (lang === "uk" ? "Зачекайте..." : "Please wait...")
              : tab === "login" ? (lang === "uk" ? "Увійти" : "Sign In") : (lang === "uk" ? "Зареєструватися" : "Create Account")
            }
          </button>
        </form>
      </div>
    </div>
  );
}
