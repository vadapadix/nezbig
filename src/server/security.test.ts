import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "./app.js";
import { resolveJwtSecret } from "./security.js";
import { setAuthCookie, verifyToken } from "./auth.js";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("authentication hardening", () => {
  it("fails closed for missing, short and placeholder production secrets", () => {
    for (const secret of [undefined, "short", "nezbig-dev-secret-change-me-in-prod", "your-secret-key-change-in-production"]) {
      expect(() => resolveJwtSecret({ NODE_ENV: "production", JWT_SECRET: secret })).toThrow(/JWT_SECRET/);
    }
    expect(resolveJwtSecret({ NODE_ENV: "production", JWT_SECRET: "a3e88d2c916a461a8f2b484b4be5ac51" })).toHaveLength(32);
    expect(resolveJwtSecret({ NODE_ENV: "development" })).not.toBe(resolveJwtSecret({ NODE_ENV: "development" }));
  });

  it("supports cookie-only password login and rejects wrong passwords", async () => {
    const email = `auth-${crypto.randomUUID()}@example.com`;
    const register = await request(app).post("/api/auth/register").send({ name: "Test", email, password: "password123" });
    expect(register.status).toBe(200);
    expect(register.body.token).toBeUndefined();
    const agent = request.agent(app);
    expect((await agent.post("/api/auth/login").send({ email, password: "wrong-password" })).status).toBe(401);
    expect((await agent.post("/api/auth/login").send({ email, password: "password123" })).status).toBe(200);
    expect((await agent.get("/api/auth/me")).body.user.email).toBe(email);
  });

  it("rejects malformed credentials", async () => {
    const response = await request(app).post("/api/auth/login").send({ email: {}, password: [] });
    expect(response.status).toBe(400);
  });

  it("uses secure cookies in all production deployments, including Docker", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "");
    const response = { cookie: vi.fn() };
    setAuthCookie(response as unknown as import("express").Response, "example");
    expect(response.cookie.mock.calls[0]![2]).toMatchObject({ secure: true, httpOnly: true, sameSite: "lax" });
  });

  it("rejects untrusted OAuth origins and callbacks without matching state", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "test-client");
    vi.stubEnv("GOOGLE_REDIRECT_URI", "http://127.0.0.1:8787/api/auth/google/callback");
    expect((await request(app).get("/api/auth/google/url?origin=https://attacker.example")).status).toBe(400);
    expect((await request(app).get("/api/auth/google/callback?state=https://attacker.example&code=fake")).status).toBe(400);
    const start = await request(app).get("/api/auth/google/url?origin=http://127.0.0.1:5173");
    const state = new URL(start.body.url).searchParams.get("state");
    expect(verifyToken(state!)).toBeNull();
    expect((await request(app).get(`/api/auth/google/callback?state=${state}&code=fake`)).status).toBe(400);
  });

  it("returns from Google via cookie without a token in the URL and consumes browser state", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "test-client");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-secret");
    vi.stubEnv("GOOGLE_REDIRECT_URI", "http://127.0.0.1:8787/api/auth/google/callback");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "provider-token" }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ id: crypto.randomUUID(), email: `oauth-${crypto.randomUUID()}@example.com`, name: "Google User", verified_email: true }) }));
    const agent = request.agent(app);
    const start = await agent.get("/api/auth/google/url?origin=http://127.0.0.1:5173");
    const state = new URL(start.body.url).searchParams.get("state");
    const callback = `/api/auth/google/callback?state=${state}&code=fake`;
    const result = await agent.get(callback);
    expect(result.status).toBe(302);
    expect(result.headers.location).toBe("http://127.0.0.1:5173/?auth_success=1");
    expect(String(result.headers["set-cookie"])).toMatch(/nezbig_token=.*HttpOnly/);
    expect((await agent.get("/api/auth/me")).body.user.name).toBe("Google User");
    expect((await agent.get(callback)).status).toBe(400);
  });
});
