import { describe, expect, it, vi } from "vitest";
import { AuthenticationService } from "../../../src/server/application/auth/AuthenticationService.js";
import { GoogleSignInService } from "../../../src/server/application/auth/GoogleSignInService.js";
import type { UserRepository } from "../../../src/server/domain/users/ports/UserRepository.js";
import type { UserRecord } from "../../../src/server/domain/users/types/User.js";

const user: UserRecord = { id: "u1", name: "Test", email: "test@example.com", passwordHash: "$2b$hash", createdAt: "2026-10-22" };
function repository(): UserRepository {
  return {
    create: vi.fn().mockResolvedValue(user),
    findById: vi.fn(),
    findByEmail: vi.fn().mockResolvedValue(null),
    findByGoogleId: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue(user)
  };
}

describe("Authentication use cases", () => {
  it("passes a hash to persistence without the plaintext password", async () => {
    const users = repository();
    const passwords = { hash: vi.fn().mockResolvedValue("$2b$hash"), verify: vi.fn() };
    await new AuthenticationService(users, passwords).register({ name: "Test", email: user.email, password: "secret123" });
    expect(users.create).toHaveBeenCalledExactlyOnceWith({ name: "Test", email: user.email, passwordHash: "$2b$hash" });
    expect(passwords.hash).toHaveBeenCalledExactlyOnceWith("secret123");
  });

  it("verifies a stored password once", async () => {
    const users = repository();
    vi.mocked(users.findByEmail).mockResolvedValue(user);
    const passwords = { hash: vi.fn(), verify: vi.fn().mockResolvedValue(true) };
    expect(await new AuthenticationService(users, passwords).login(user.email, "secret123")).toEqual(user);
    expect(passwords.verify).toHaveBeenCalledExactlyOnceWith("secret123", user.passwordHash);
  });

  it("rejects password login for a Google-only account without calling bcrypt", async () => {
    const users = repository();
    vi.mocked(users.findByEmail).mockResolvedValue({ ...user, passwordHash: null, googleId: "google-1" });
    const passwords = { hash: vi.fn(), verify: vi.fn() };
    await expect(new AuthenticationService(users, passwords).login(user.email, "secret123")).rejects.toMatchObject({ status: 401 });
    expect(passwords.verify).not.toHaveBeenCalled();
  });

  it("links Google without replacing the existing password hash", async () => {
    const users = repository();
    vi.mocked(users.findByEmail).mockResolvedValue(user);
    const identities = { exchangeCode: vi.fn().mockResolvedValue({ id: "google-1", name: user.name, email: user.email }) };
    await new GoogleSignInService(users, identities).signIn("code");
    expect(users.update).toHaveBeenCalledExactlyOnceWith(user.id, { googleId: "google-1", avatarUrl: undefined });
    expect(users.create).not.toHaveBeenCalled();
  });
});
