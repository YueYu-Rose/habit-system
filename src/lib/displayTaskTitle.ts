/** Normalize legacy empty descriptions from DB or APIs for display. */
export function displayTaskTitle(raw: string): string {
  const t = raw.trim();
  if (t === "(no description)" || t === "(no title)") return "Unnamed Task";
  return raw;
}
