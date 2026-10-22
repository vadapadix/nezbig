export const SESSION_INVALID_EVENT = "nezbig:session-invalid";

/** API transport reports session failure; UI navigation is a separate concern. */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, { ...init, credentials: "include" });
  const url = typeof input === "string" || input instanceof URL ? String(input) : input.url;
  const isCredentialSubmission = /\/api\/auth\/(?:login|register)(?:\?|$)/.test(url);
  if (response.status === 401 && !isCredentialSubmission) window.dispatchEvent(new Event(SESSION_INVALID_EVENT));
  return response;
}
