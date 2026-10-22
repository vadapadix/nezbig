import crypto from "node:crypto";
export function resolveJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.JWT_SECRET?.trim();
  const placeholder = !secret || /change|your-secret|dev-secret/i.test(secret);
  if (env.NODE_ENV === "production" && (placeholder || secret.length < 32)) {
    throw new Error("Set JWT_SECRET to a random secret of at least 32 characters before production startup.");
  }
  return placeholder ? crypto.randomBytes(48).toString("hex") : secret;
}

export const jwtSecret = resolveJwtSecret();
