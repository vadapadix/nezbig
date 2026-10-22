import type { GoogleIdentity } from "../types/GoogleIdentity.js";

export interface GoogleIdentityProvider {
  exchangeCode(code: string): Promise<GoogleIdentity>;
}
