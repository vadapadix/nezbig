export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string | null;
  googleId?: string;
  avatarUrl?: string;
  createdAt: string;
}
export interface NewUserData {
  name: string;
  email: string;
  passwordHash: string | null;
  googleId?: string;
  avatarUrl?: string;
}
export interface AuthPayload {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}
