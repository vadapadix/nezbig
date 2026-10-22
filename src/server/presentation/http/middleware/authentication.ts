import type { Request, Response, NextFunction } from "express";
import type { TokenService } from "../../../infrastructure/auth/TokenService.js";
import { AUTH_COOKIE_NAME, SessionCookie } from "../auth/SessionCookie.js";
export function authentication(tokens: TokenService, cookies: SessionCookie) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const bearer = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7).trim() : undefined;
    const credential = bearer ?? req.cookies?.[AUTH_COOKIE_NAME];
    if (credential === undefined) {
      next();
      return;
    }
    const payload = tokens.verify(credential);
    if (!payload) {
      cookies.clear(res);
      res.status(401).json({ error: "Сесія недійсна. Увійдіть знову.", code: "SESSION_INVALID" });
      return;
    }
    req.user = payload;
    next();
  };
}
