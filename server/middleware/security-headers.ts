/**
 * Browser security headers for the self-hosted site (bluejaguarskarate.com).
 *
 * Set here rather than in Nginx Proxy Manager: NPM's own `location /` block
 * adds HSTS, and nginx drops server-level `add_header` lines whenever a
 * location adds its own, so headers placed in NPM's Advanced tab never reach
 * the browser.
 *
 * Only applied on our own domain, so the Grok preview (which embeds the app in
 * an iframe on grok.com) keeps working.
 */
interface SecurityHeadersEvent {
  req: { headers: Headers };
}

const OWN_HOSTS = ["bluejaguarskarate.com", "www.bluejaguarskarate.com"];

const HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
};

export default async function securityHeadersMiddleware(
  event: SecurityHeadersEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const host = (event.req.headers.get("host") ?? "").split(":")[0]?.trim().toLowerCase() ?? "";
  const result = await next();
  if (!OWN_HOSTS.includes(host) || !(result instanceof Response)) return result;
  const headers = new Headers(result.headers);
  for (const [name, value] of Object.entries(HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }
  return new Response(result.body, { status: result.status, statusText: result.statusText, headers });
}
