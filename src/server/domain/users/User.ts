import type { NewUserData, UserRecord } from "./types/User.js";

export class User {
  private constructor(private readonly record: UserRecord) {}
  static create(data: NewUserData, id: string, createdAt: string): User {
    if (data.passwordHash === null && !data.googleId) throw new Error("A user requires password credentials or a Google identity");
    if (data.passwordHash !== null && !data.passwordHash.startsWith("$2")) throw new Error("Expected a password hash, not a plaintext password");
    return new User({ ...data, id, createdAt, email: data.email.toLowerCase() });
  }
  toRecord(): UserRecord {
    return { ...this.record };
  }
}
