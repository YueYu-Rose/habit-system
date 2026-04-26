export function normalizeMatchKey(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function resolveMatchKey(explicit: string | undefined, fallback: string): string {
  return normalizeMatchKey(explicit ?? fallback);
}
