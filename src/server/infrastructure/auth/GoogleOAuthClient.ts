import type { GoogleIdentityProvider } from "../../domain/users/ports/GoogleIdentityProvider.js";
import type { GoogleIdentity } from "../../domain/users/types/GoogleIdentity.js";

export class GoogleOAuthClient implements GoogleIdentityProvider {
  async exchangeCode(code: string): Promise<GoogleIdentity> {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: process.env.GOOGLE_REDIRECT_URI || "",
        grant_type: "authorization_code"
      })
    });
    const tokenData = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenResponse.ok || !tokenData.access_token) throw new Error("google_token_failed");
    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const profile = (await profileResponse.json()) as GoogleIdentity & { verified_email?: boolean };
    if (!profileResponse.ok || !profile.id || !profile.email || profile.verified_email !== true) {
      throw new Error("google_userinfo_failed");
    }
    return { id: profile.id, email: profile.email, name: profile.name, picture: profile.picture };
  }
}
