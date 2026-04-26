const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(init?.headers ?? {}),
  };
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  if (!res.ok) {
    let msg = text || `HTTP ${res.status}`;
    try {
      const j = JSON.parse(text) as { message?: string; error?: string; hint?: string };
      const parts = [j.message || j.error, j.hint].filter(Boolean);
      if (parts.length) msg = parts.join(" — ");
    } catch {
      /* plain text body */
    }
    throw new Error(msg);
  }
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}
