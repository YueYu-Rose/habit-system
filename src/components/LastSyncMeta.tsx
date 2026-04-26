import { formatShortSyncInstant } from "../lib/formatLastSync";

export type SyncMeta = {
  lastTogglSyncAt: string | null;
  lastGoogleCalendarSyncAt: string | null;
};

type Props = {
  syncMeta: SyncMeta | null;
};

/**
 * Single compact line: last successful Toggl import vs Calendar import.
 */
export function LastSyncMeta({ syncMeta }: Props) {
  if (!syncMeta) return null;
  return (
    <p className="last-sync-meta" aria-live="polite">
      <span className="last-sync-meta__lead">Last Updated</span>
      <span className="last-sync-meta__sep" aria-hidden>
        {" "}
        ·{" "}
      </span>
      <span>Toggl {formatShortSyncInstant(syncMeta.lastTogglSyncAt)}</span>
      <span className="last-sync-meta__sep" aria-hidden>
        {" "}
        ·{" "}
      </span>
      <span>Calendar {formatShortSyncInstant(syncMeta.lastGoogleCalendarSyncAt)}</span>
    </p>
  );
}
