import type { GoogleIdentityProvider } from "../../domain/users/ports/GoogleIdentityProvider.js";
import type { UserRepository } from "../../domain/users/ports/UserRepository.js";
import type { UserRecord } from "../../domain/users/types/User.js";

export class GoogleSignInService {
  constructor(
    private readonly users: UserRepository,
    private readonly identities: GoogleIdentityProvider
  ) {}

  async signIn(code: string): Promise<UserRecord> {
    const identity = await this.identities.exchangeCode(code);
    const linked = await this.users.findByGoogleId(identity.id);
    if (linked) return linked;
    const existing = await this.users.findByEmail(identity.email);
    if (existing) {
      const updated = await this.users.update(existing.id, {
        googleId: identity.id,
        avatarUrl: identity.picture || existing.avatarUrl
      });
      if (!updated) throw new Error("user_creation_failed");
      return updated;
    }
    return this.users.create({
      name: identity.name,
      email: identity.email,
      googleId: identity.id,
      passwordHash: null,
      avatarUrl: identity.picture
    });
  }
}
