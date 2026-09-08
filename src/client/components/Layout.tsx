import { useState, useEffect } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { BrandLogo } from "./BrandLogo";
import { useAuth } from "../hooks/useAuth";
import { useLanguage } from "../context/LanguageContext";
import { AuthModal } from "./AuthModal";

export function Layout() {
  const { user, isLoggedIn, logout } = useAuth();
  const { lang, setLang, t } = useLanguage();
  
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  const navigate = useNavigate();

  // Close user menu when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (showUserMenu && !(e.target as HTMLElement).closest("[data-user-menu]")) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [showUserMenu]);

  async function handleFeedbackSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!feedbackText.trim()) return;
    setSubmittingFeedback(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: feedbackText, page: window.location.pathname }),
      });
      setFeedbackSent(true);
      setTimeout(() => {
        setShowFeedback(false);
        setFeedbackSent(false);
        setFeedbackText("");
      }, 2000);
    } catch {
      // ignore
    } finally {
      setSubmittingFeedback(false);
    }
  }

  const avatarUrl = user?.avatarUrl || (user ? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=1a2e2b&color=2EC4B6&size=80` : undefined);

  return (
    <div className="min-h-screen flex flex-col relative font-body-md text-body-md antialiased selection:bg-emerald-glow/30 dark bg-surface text-on-background">
      {/* Atmosphere: aurora glows + blueprint grid + grain */}
      <div className="bg-atmosphere" aria-hidden="true" />
      <div className="bg-grain" aria-hidden="true" />

      {/* Top Navigation */}
      <nav className="docked full-width top-0 bg-surface/80 backdrop-blur-xl border-b border-white/10 shadow-sm z-50 sticky nav-hairline">
        <div className="flex justify-between items-center w-full px-gutter py-4 max-w-container-max mx-auto">
          {/* Brand */}
          <div className="flex items-center gap-4">
            <Link to="/" className="brand-link flex items-center gap-2 group">
              <BrandLogo className="w-10 h-10 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500" />
              <div className="flex flex-col">
                <span className="text-headline-md font-headline-md font-bold tracking-tight text-white">
                  {lang === "uk" ? "НЕЗБІГ" : "NEZBIG"} <span className="brand-version text-emerald-glow">2.0</span>
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">{t("brandTagline")}</span>
              </div>
            </Link>
          </div>
          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-8">
            <NavLink to="/" end className={({ isActive }) => isActive ? "nav-link nav-link--active text-emerald-glow font-bold text-body-md transition-colors duration-300 hover:bg-white/5 rounded px-1" : "nav-link text-on-surface-variant hover:text-white transition-colors duration-300 text-body-md hover:bg-white/5 rounded px-1"}>
              {t("navHome")}
            </NavLink>
            <NavLink to="/humanize" className={({ isActive }) => isActive ? "nav-link nav-link--active text-emerald-glow font-bold text-body-md transition-colors duration-300 hover:bg-white/5 rounded px-1" : "nav-link text-on-surface-variant hover:text-white transition-colors duration-300 text-body-md hover:bg-white/5 rounded px-1"}>
              {t("navHumanize")}
            </NavLink>
          </div>
          {/* User Actions & Language */}
          <div className="flex items-center gap-3 relative" data-user-menu>
            {/* Language Switcher */}
            <button
              type="button"
              onClick={() => setLang(lang === "uk" ? "en" : "uk")}
              className="px-2.5 py-1.5 rounded-lg border border-white/10 hover:border-emerald-glow/40 bg-surface-container/60 text-xs font-semibold text-white/90 hover:text-emerald-glow transition-all flex items-center gap-1.5 cursor-pointer shadow-sm group"
              title={lang === "uk" ? "Switch to English" : "Перемкнути на українську"}
              aria-label={lang === "uk" ? "Switch to English" : "Перемкнути на українську"}
            >
              <span className="material-symbols-outlined text-[17px] text-emerald-glow group-hover:rotate-12 transition-transform">language</span>
              <span className="tracking-wider uppercase font-mono font-bold">{lang === "uk" ? "UA" : "EN"}</span>
            </button>

            {isLoggedIn ? (
              <span className="text-body-md text-emerald-glow hidden sm:block truncate max-w-[120px] font-medium">{user?.name}</span>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="signin-btn px-4 py-1.5 rounded-full border border-emerald-glow/40 text-emerald-glow hover:bg-emerald-glow/10 font-medium text-body-md transition-all hidden sm:block"
              >
                {t("signIn")}
              </button>
            )}
            <button 
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="relative rounded-full overflow-hidden w-10 h-10 border border-white/20 hover:border-emerald-glow transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-glow/50 bg-surface-container flex items-center justify-center"
            >
              {isLoggedIn && avatarUrl ? (
                <img alt="User avatar" className="w-full h-full object-cover" src={avatarUrl} />
              ) : (
                <span className="material-symbols-outlined text-on-surface-variant text-2xl">person</span>
              )}
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute top-14 right-0 w-60 bg-surface-container-high/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden fade-in z-[100] py-1.5">
                {isLoggedIn ? (
                  <div className="flex flex-col">
                    <div className="px-4 py-2.5 border-b border-white/5 mb-1 bg-white/[0.02]">
                      <p className="text-body-md text-white font-medium truncate">{user?.name}</p>
                      <p className="text-label-sm text-on-surface-variant truncate">{user?.email}</p>
                    </div>
                    <button onClick={() => { setShowUserMenu(false); navigate("/history"); }} className="w-full text-left px-4 py-2.5 text-body-md text-on-surface-variant hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[20px] text-emerald-glow">history</span>
                      {t("navHistory")}
                    </button>
                    <div className="border-t border-white/5 mt-1 pt-1">
                      <button onClick={async () => { setShowUserMenu(false); await logout(); }} className="w-full text-left px-4 py-2.5 text-body-md text-error hover:bg-error/10 transition-colors flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                        {t("signOut")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <button onClick={() => { setShowUserMenu(false); setShowAuthModal(true); }} className="w-full text-left px-4 py-2.5 text-body-md text-emerald-glow hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2.5 font-medium">
                      <span className="material-symbols-outlined text-[20px]">login</span>
                      {t("signIn")}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content Canvas */}
      <main className="flex-grow w-full">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="w-full py-8 mt-auto border-t border-white/10 relative z-10 bg-surface/80 backdrop-blur-md">
        <div className="max-w-container-max mx-auto flex flex-col md:flex-row justify-between items-center px-gutter">
          <div className="flex flex-col items-center md:items-start mb-4 md:mb-0">
            <span className="font-headline-md text-white mb-2 font-bold">{lang === "uk" ? "НЕЗБІГ" : "NEZBIG"} <span className="text-emerald-glow">2.0</span></span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">{t("copyright")}</span>
          </div>
          <div className="flex flex-wrap gap-6 font-label-sm text-label-sm text-on-surface-variant">
            <Link className="hover:text-emerald-glow transition-colors" to="/about">{t("aboutUs")}</Link>
            <Link className="hover:text-emerald-glow transition-colors" to="/privacy">{t("privacy")}</Link>
            <Link className="hover:text-emerald-glow transition-colors" to="/terms">{t("terms")}</Link>
            <button onClick={() => setShowFeedback(true)} className="hover:text-emerald-glow transition-colors cursor-pointer text-left">{t("reportBug")}</button>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />

      {/* Feedback Modal */}
      {showFeedback && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-container-high border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl relative fade-in">
            <button onClick={() => setShowFeedback(false)} className="absolute top-4 right-4 text-on-surface-variant hover:text-white transition-colors">
              <span className="material-symbols-outlined">close</span>
            </button>
            <h3 className="text-headline-sm font-headline-sm text-white mb-4">
              {lang === "uk" ? "Повідомити про помилку" : "Report an Issue"}
            </h3>
            {feedbackSent ? (
              <div className="text-emerald-glow text-center py-8 font-medium">
                {lang === "uk" ? "Дякуємо! Ваш відгук надіслано." : "Thank you! Your feedback has been sent."}
              </div>
            ) : (
              <form onSubmit={handleFeedbackSubmit} className="flex flex-col gap-4">
                <textarea
                  className="w-full h-32 bg-surface-container/50 border border-white/20 rounded-lg p-3 text-white placeholder:text-on-surface-variant/50 focus:border-emerald-glow focus:ring-1 focus:ring-emerald-glow transition-all resize-none custom-scrollbar"
                  placeholder={lang === "uk" ? "Опишіть проблему детально..." : "Describe the issue in detail..."}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  autoFocus
                />
                <div className="flex justify-end gap-3 mt-2">
                  <button type="button" onClick={() => setShowFeedback(false)} className="px-4 py-2 text-on-surface-variant hover:text-white transition-colors">
                    {lang === "uk" ? "Скасувати" : "Cancel"}
                  </button>
                  <button type="submit" disabled={submittingFeedback || !feedbackText.trim()} className="px-6 py-2 bg-emerald-glow text-on-primary rounded-lg font-medium hover:bg-emerald-glow/90 disabled:opacity-50 transition-colors">
                    {submittingFeedback ? (lang === "uk" ? "Надсилання..." : "Sending...") : (lang === "uk" ? "Надіслати" : "Submit")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
