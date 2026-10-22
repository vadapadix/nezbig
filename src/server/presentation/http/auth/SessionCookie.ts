import type { Response } from "express";
import { cookieOptions } from "./cookieOptions.js";
export const AUTH_COOKIE_NAME = "nezbig_token";
export class SessionCookie {
  set(response: Response, token: string): void {
    response.cookie(AUTH_COOKIE_NAME, token, { ...cookieOptions(), maxAge: 30 * 24 * 60 * 60 * 1000 });
  }
  clear(response: Response): void {
    response.clearCookie(AUTH_COOKIE_NAME, cookieOptions());
  }
}
