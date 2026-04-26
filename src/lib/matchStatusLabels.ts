import type { MatchStatus } from "../types/comparisonRow";

export function formatMatchStatusLabel(s: MatchStatus | undefined): string {
  switch (s) {
    case "auto_matched":
      return "Auto Matched";
    case "manually_linked":
      return "Manually Linked";
    case "unmatched":
      return "Unmatched";
    default:
      return "—";
  }
}
