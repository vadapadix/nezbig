export function clientOrigins(): string[] {
  const configured = [process.env.CLIENT_URL, ...(process.env.AUTH_ALLOWED_ORIGINS || "").split(",")].filter(Boolean) as string[];
  if (process.env.NODE_ENV !== "production") configured.push("http://127.0.0.1:5173", "http://localhost:5173", "http://127.0.0.1:8787", "http://127.0.0.1:4173");
  return [
    ...new Set(
      configured.map((value) => {
        const url = new URL(value.trim());
        if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid client origin");
        if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("Production client origins require HTTPS");
        return url.origin;
      })
    )
  ];
}
