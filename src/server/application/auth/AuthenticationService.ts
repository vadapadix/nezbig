import type { UserRepository, PasswordHasher } from "../../domain/users/ports/UserRepository.js";
import type { UserRecord } from "../../domain/users/types/User.js";

export class AuthenticationError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}
export class AuthenticationService {
  constructor(private readonly users: UserRepository, private readonly passwords: PasswordHasher) {}
  async register(data: { name: string; email: string; password: string }): Promise<UserRecord> {
    if (await this.users.findByEmail(data.email)) throw new AuthenticationError("Користувач з таким email вже існує.", 409);
    const passwordHash = await this.passwords.hash(data.password);
    return this.users.create({ name: data.name, email: data.email, passwordHash });
  }
  async login(email: string, password: string): Promise<UserRecord> {
    const user = await this.users.findByEmail(email);
    if (!user || user.passwordHash === null || !await this.passwords.verify(password, user.passwordHash)) throw new AuthenticationError("Невірний email або пароль.", 401);
    return user;
  }
}
