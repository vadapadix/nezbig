import bcrypt from "bcryptjs";
import type { PasswordHasher } from "../../domain/users/ports/PasswordHasher.js";
export class BcryptPasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }
  verify(password: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }
}
