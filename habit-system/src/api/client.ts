export async function habitFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const url = path;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(init?.headers ?? {}),
  };
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  if (!res.ok) {
    let msg = text || `HTTP ${res.status}`;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* */
    }
    throw new Error(msg);
  }
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}
