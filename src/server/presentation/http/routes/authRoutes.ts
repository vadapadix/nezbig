import { authLimiter } from "../middleware/authRateLimiter.js";
import { credentials, registration } from "../validation/credentials.js";
import { AuthenticationError } from "../../../application/auth/AuthenticationService.js";
import { Router } from "express";
import { beginGoogleOAuth } from "../auth/oauthState.js";
import { consumeGoogleOAuth } from "../auth/oauthState.js";
import type { Request, Response } from "express";
import { authenticationService, googleSignInService, sessionCookie, tokens, users } from "../../../composition/auth.js";
import { reports } from "../../../composition/reports.js";

const router = Router();
router.post(["/login", "/register"], authLimiter);

// ─── Register ────────────────────────────────────────────
router.post("/register", async (req: Request, res: Response) => {
  try {
    const parsed = registration.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Перевірте ім’я, email та пароль (6–72 символи)." });
      return;
    }
    const { name, email, password } = parsed.data;

    const user = await authenticationService.register({ name, email, password });
    const token = tokens.generate(user);
    sessionCookie.set(res, token);

    res.json({
      user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl }
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Помилка при реєстрації." });
  }
});

// ─── Login ───────────────────────────────────────────────
router.post("/login", async (req: Request, res: Response) => {
  try {
    const parsed = credentials.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Перевірте email та пароль." });
      return;
    }
    const { email, password } = parsed.data;

    const user = await authenticationService.login(email, password);
    const token = tokens.generate(user);
    sessionCookie.set(res, token);

    res.json({
      user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl }
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Помилка при вході." });
  }
});

// ─── Logout ──────────────────────────────────────────────
router.post("/logout", (_req: Request, res: Response) => {
  sessionCookie.clear(res);
  res.json({ ok: true });
});

// ─── Current user ────────────────────────────────────────
router.get("/me", async (req: Request, res: Response) => {
  if (!req.user) {
    res.json({ user: null });
    return;
  }

  let user = await users.findById(req.user.id);
  if (!user && req.user.email) {
    // Restore user from validated JWT payload so cold starts / serverless restarts don't lose session
    user = {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      avatarUrl: req.user.avatarUrl,
      passwordHash: null,
      createdAt: new Date().toISOString()
    };
  }

  if (!user) {
    sessionCookie.clear(res);
    res.json({ user: null });
    return;
  }

  // Refresh a validated session with a persistent cookie on same-site startup,
  // including sessions created by an older login/callback flow.
  sessionCookie.set(res, tokens.generate(user));
  res.json({
    user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl }
  });
});

// ─── User history ────────────────────────────────────────
router.get("/history", async (req: Request, res: Response) => {
  if (!req.user) {
    res.json([]);
    return;
  }

  try {
    const history = await reports.getUserReports(req.user.id);
    res.json(history);
  } catch {
    res.status(500).json({ error: "Помилка при завантаженні історії." });
  }
});

// ─── Google OAuth: Config ─────────────────────────────────
router.get("/google/config", (_req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  res.json({
    clientId,
    configured: Boolean(clientId)
  });
});

// ─── Google OAuth: Get URL ────────────────────────────────
router.get("/google/url", (req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(400).json({ error: "Google OAuth не налаштовано (відсутній GOOGLE_CLIENT_ID у .env)." });
    return;
  }

  if (!process.env.GOOGLE_REDIRECT_URI) {
    res.status(400).json({ error: "Google redirect URI не налаштовано." });
    return;
  }
  let oauthState: string;
  try {
    oauthState = beginGoogleOAuth(req, res);
  } catch {
    res.status(400).json({ error: "Недозволена адреса повернення." });
    return;
  }
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const scope = encodeURIComponent("openid email profile");
  const state = encodeURIComponent(oauthState);
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${state}&access_type=offline&prompt=select_account`;

  res.json({ url });
});

// ─── Google OAuth: Direct Redirect ──────────────────────
router.get("/google", (req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    res.status(400).json({ error: "Google OAuth не налаштовано." });
    return;
  }

  if (!process.env.GOOGLE_REDIRECT_URI) {
    res.status(400).json({ error: "Google redirect URI не налаштовано." });
    return;
  }
  let oauthState: string;
  try {
    oauthState = beginGoogleOAuth(req, res);
  } catch {
    res.status(400).json({ error: "Недозволена адреса повернення." });
    return;
  }
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const scope = encodeURIComponent("openid email profile");
  const state = encodeURIComponent(oauthState);
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${state}&access_type=offline&prompt=select_account`;

  res.redirect(url);
});

// ─── Google OAuth: Callback ──────────────────────────────
router.get("/google/callback", async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;
  const state = consumeGoogleOAuth(req, res);
  if (!state) {
    res.status(400).json({ error: "Сесію Google-входу не підтверджено. Почніть вхід повторно." });
    return;
  }
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!code || !clientId || !clientSecret || !process.env.GOOGLE_REDIRECT_URI) {
    res.redirect(`${state}/?auth_error=google_missing_credentials`);
    return;
  }

  try {
    const user = await googleSignInService.signIn(code);

    const token = tokens.generate(user);
    sessionCookie.set(res, token);

    // Keep credentials out of URLs, browser history, analytics and referrer headers.
    res.redirect(`${state}/?auth_success=1`);
  } catch {
    console.error("Google OAuth failed");
    res.redirect(`${state}/?auth_error=google_failed`);
  }
});

export const authRouter = router;
