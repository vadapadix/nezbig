import type { NewUserData, UserRecord } from "../types/User.js";
export interface UserRepository {
  create(data: NewUserData): Promise<UserRecord>;
  findById(id: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  findByGoogleId(googleId: string): Promise<UserRecord | null>;
  update(id: string, updates: Partial<UserRecord>): Promise<UserRecord | null>;
}
