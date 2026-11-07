import "server-only";

export class PlatformError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** True when reconnecting the account would fix it (expired/revoked token, missing permission). */
    readonly authProblem = false,
  ) {
    super(message);
  }
}

/** fetch + JSON with the platform's own error message surfaced. */
export async function fetchJson<T = Record<string, unknown>>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(30_000) });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const b = body as Record<string, any> | null;
    const msg =
      b?.error?.message ??
      b?.error?.error_user_msg ??
      b?.error_description ??
      b?.detail ??
      b?.message ??
      (Array.isArray(b?.errors) ? b.errors.map((e: any) => e.message ?? e.detail).join("; ") : null) ??
      (typeof b?.error === "string" ? b.error : null) ??
      `HTTP ${res.status}`;
    throw new PlatformError(String(msg).slice(0, 500), res.status, res.status === 401 || res.status === 403);
  }
  return body as T;
}

export function form(data: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(data)) if (v !== undefined) p.set(k, v);
  return p;
}
