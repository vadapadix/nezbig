import { Router } from "express";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import { beginGoogleOAuth, consumeGoogleOAuth } from "./security.js";
import { createUser, findUserByEmail, findUserByGoogleId, findUserById, updateUser, verifyPassword, generateToken, setAuthCookie, clearAuthCookie, getUserReports, } from "./auth.js";
const router = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, message: { error: "Забагато спроб входу. Спробуйте пізніше." } });
const credentials = z.object({ email: z.string().trim().email().max(254).transform(v => v.toLowerCase()), password: z.string().min(6).max(72) });
router.post(["/login", "/register"], authLimiter);
// ─── Register ────────────────────────────────────────────
router.post("/register", async (req, res) => {
    try {
        const parsed = credentials.extend({ name: z.string().trim().min(1).max(100) }).safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: "Перевірте ім’я, email та пароль (6–72 символи)." });
            return;
        }
        const { name, email, password } = parsed.data;
        if (!name || !email || !password) {
            res.status(400).json({ error: "Ім'я, email та пароль обов'язкові." });
            return;
        }
        if (typeof password !== "string" || password.length < 6) {
            res.status(400).json({ error: "Пароль має містити щонайменше 6 символів." });
            return;
        }
        const existing = await findUserByEmail(email);
        if (existing) {
            res.status(409).json({ error: "Користувач з таким email вже існує." });
            return;
        }
        const user = await createUser({ name, email, password });
        const token = generateToken(user);
        setAuthCookie(res, token);
        res.json({
            user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
        });
    }
    catch {
        res.status(500).json({ error: "Помилка при реєстрації." });
    }
});
// ─── Login ───────────────────────────────────────────────
router.post("/login", async (req, res) => {
    try {
        const parsed = credentials.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: "Перевірте email та пароль." });
            return;
        }
        const { email, password } = parsed.data;
        if (!email || !password) {
            res.status(400).json({ error: "Email та пароль обов'язкові." });
            return;
        }
        const user = await findUserByEmail(email);
        if (!user || !user.passwordHash) {
            res.status(401).json({ error: "Невірний email або пароль." });
            return;
        }
        const valid = await verifyPassword(user, password);
        if (!valid) {
            res.status(401).json({ error: "Невірний email або пароль." });
            return;
        }
        const token = generateToken(user);
        setAuthCookie(res, token);
        res.json({
            user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
        });
    }
    catch {
        res.status(500).json({ error: "Помилка при вході." });
    }
});
// ─── Logout ──────────────────────────────────────────────
router.post("/logout", (_req, res) => {
    clearAuthCookie(res);
    res.json({ ok: true });
});
// ─── Current user ────────────────────────────────────────
router.get("/me", async (req, res) => {
    if (!req.user) {
        res.json({ user: null });
        return;
    }
    let user = await findUserById(req.user.id);
    if (!user && req.user.email) {
        // Restore user from validated JWT payload so cold starts / serverless restarts don't lose session
        user = {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email,
            avatarUrl: req.user.avatarUrl,
            createdAt: new Date().toISOString(),
        };
    }
    if (!user) {
        clearAuthCookie(res);
        res.json({ user: null });
        return;
    }
    res.json({
        user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
    });
});
// ─── User history ────────────────────────────────────────
router.get("/history", async (req, res) => {
    if (!req.user) {
        res.json([]);
        return;
    }
    try {
        const reports = await getUserReports(req.user.id);
        res.json(reports);
    }
    catch {
        res.status(500).json({ error: "Помилка при завантаженні історії." });
    }
});
// ─── Google OAuth: Config ─────────────────────────────────
router.get("/google/config", (_req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    res.json({
        clientId,
        configured: Boolean(clientId),
    });
});
// ─── Google OAuth: Get URL ────────────────────────────────
router.get("/google/url", (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
        res.status(400).json({ error: "Google OAuth не налаштовано (відсутній GOOGLE_CLIENT_ID у .env)." });
        return;
    }
    if (!process.env.GOOGLE_REDIRECT_URI) {
        res.status(400).json({ error: "Google redirect URI не налаштовано." });
        return;
    }
    let oauthState;
    try {
        oauthState = beginGoogleOAuth(req, res);
    }
    catch {
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
router.get("/google", (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
        res.status(400).json({ error: "Google OAuth не налаштовано." });
        return;
    }
    if (!process.env.GOOGLE_REDIRECT_URI) {
        res.status(400).json({ error: "Google redirect URI не налаштовано." });
        return;
    }
    let oauthState;
    try {
        oauthState = beginGoogleOAuth(req, res);
    }
    catch {
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
router.get("/google/callback", async (req, res) => {
    const code = req.query.code;
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
        const redirectUri = process.env.GOOGLE_REDIRECT_URI;
        // Exchange code for tokens
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: "authorization_code",
            }),
        });
        const tokenData = (await tokenRes.json());
        if (!tokenData.access_token) {
            console.error("Google token error:", tokenData);
            res.redirect(`${state}/?auth_error=google_token_failed`);
            return;
        }
        // Fetch user info
        const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const googleUser = (await userInfoRes.json());
        if (!userInfoRes.ok || !googleUser.id || !googleUser.email || googleUser.verified_email !== true) {
            res.redirect(`${state}/?auth_error=google_userinfo_failed`);
            return;
        }
        // Find or create user
        let user = await findUserByGoogleId(googleUser.id);
        if (!user) {
            // Check if user with same email exists (link accounts)
            user = await findUserByEmail(googleUser.email);
            if (user) {
                // Link Google ID to existing account
                user = await updateUser(user.id, {
                    googleId: googleUser.id,
                    avatarUrl: googleUser.picture || user.avatarUrl,
                });
            }
            else {
                // Create new user
                user = await createUser({
                    name: googleUser.name,
                    email: googleUser.email,
                    googleId: googleUser.id,
                    avatarUrl: googleUser.picture,
                });
            }
        }
        if (!user) {
            res.redirect(`${state}/?auth_error=user_creation_failed`);
            return;
        }
        const token = generateToken(user);
        setAuthCookie(res, token);
        // Keep credentials out of URLs, browser history, analytics and referrer headers.
        res.redirect(`${state}/?auth_success=1`);
    }
    catch (error) {
        console.error("Google OAuth error:", error);
        res.redirect(`${state}/?auth_error=google_failed`);
    }
});
export const authRouter = router;
