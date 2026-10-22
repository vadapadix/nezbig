import jwt from "jsonwebtoken";
import type { AuthPayload } from "../../domain/users/types/User.js";
import { jwtSecret } from "./jwtConfig.js";
export class TokenService {
  constructor(private readonly secret = jwtSecret) {}
  generate(user: AuthPayload): string {
    const payload: AuthPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl
    };
    return jwt.sign(payload, this.secret, { expiresIn: "30d", audience: "nezbig-auth", algorithm: "HS256" });
  }

  verify(token: string): AuthPayload | null {
    try {
      const payload = jwt.verify(token, this.secret, { algorithms: ["HS256"], audience: "nezbig-auth" });
      if (
        typeof payload === "string" ||
        typeof payload.id !== "string" ||
        !/^[a-zA-Z0-9_-]{1,128}$/.test(payload.id) ||
        typeof payload.email !== "string" ||
        typeof payload.name !== "string"
      )
        return null;
      return payload as AuthPayload;
    } catch {
      return null;
    }
  }
}
