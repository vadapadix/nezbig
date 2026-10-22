export const secureCookies = () => process.env.NODE_ENV === "production";
export const cookieOptions = () => ({ httpOnly: true, secure: secureCookies(), sameSite: "lax" as const, path: "/" });
