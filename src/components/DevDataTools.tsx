import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { addDays, toIsoDateLocal } from "../lib/dateHelpers";
import { apiFetch } from "../api/client";

type Props = {
  onSyncComplete: () => Promise<void>;
};

type Phase = "idle" | "syncing" | "success" | "failed";

type SourceState = {
  phase: Phase;
  message: string;
};

const initial: SourceState = { phase: "idle", message: "" };

export function DevDataTools({ onSyncComplete }: Props) {
  const [toggl, setToggl] = useState<SourceState>(initial);
  const [google, setGoogle] = useState<SourceState>(initial);
  const [runAuto, setRunAuto] = useState(true);
  const clearToggl = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearGoogle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const range = useCallback(() => {
    const end = new Date();
    const start = addDays(end, -7);
    return { start: toIsoDateLocal(start), end: toIsoDateLocal(end) };
  }, []);

  useEffect(() => {
    return () => {
      if (clearToggl.current) clearTimeout(clearToggl.current);
      if (clearGoogle.current) clearTimeout(clearGoogle.current);
    };
  }, []);

  const bumpSuccess = (setter: Dispatch<SetStateAction<SourceState>>, msg: string) => {
    setter({ phase: "success", message: msg });
    return setTimeout(() => setter(initial), 4500);
  };

  const busy = toggl.phase === "syncing" || google.phase === "syncing";

  const syncToggl = useCallback(async () => {
    if (clearToggl.current) clearTimeout(clearToggl.current);
    setToggl({ phase: "syncing", message: "Importing Toggl…" });
    setGoogle((g) => (g.phase === "success" || g.phase === "failed" ? initial : g));
    const { start, end } = range();
    try {
      await apiFetch<Record<string, unknown>>("/api/sync/toggl", {
        method: "POST",
        body: JSON.stringify({
          startDate: start,
          endDate: end,
          runAutoMatch: runAuto,
          clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      clearToggl.current = bumpSuccess(setToggl, "Toggl Imported");
      await onSyncComplete();
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      setToggl({ phase: "failed", message: `Import Failed — ${detail}` });
    }
  }, [range, onSyncComplete, runAuto]);

  const syncGoogle = useCallback(async () => {
    if (clearGoogle.current) clearTimeout(clearGoogle.current);
    setGoogle({ phase: "syncing", message: "Importing Google Calendar…" });
    setToggl((t) => (t.phase === "success" || t.phase === "failed" ? initial : t));
    const { start, end } = range();
    try {
      await apiFetch<Record<string, unknown>>("/api/sync/google-calendar", {
        method: "POST",
        body: JSON.stringify({ startDate: start, endDate: end, runAutoMatch: runAuto }),
      });
      clearGoogle.current = bumpSuccess(setGoogle, "Google Calendar Imported");
      await onSyncComplete();
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      setGoogle({ phase: "failed", message: `Import Failed — ${detail}` });
    }
  }, [range, onSyncComplete, runAuto]);

  return (
    <section className="dev-data-tools" aria-label="Developer data sync">
      <h2 className="dev-data-tools__title">Developer</h2>
      <label className="dev-data-tools__check">
        <input
          type="checkbox"
          checked={runAuto}
          onChange={(e) => setRunAuto(e.target.checked)}
        />
        Run conservative auto-match after sync
      </label>
      <div className="dev-data-tools__row">
        <button type="button" className="dev-data-tools__btn" disabled={busy} onClick={syncToggl}>
          Import Toggl (last 8 days)
        </button>
        <button type="button" className="dev-data-tools__btn" disabled={busy} onClick={syncGoogle}>
          Import Google Calendar (last 8 days)
        </button>
      </div>
      <div className="dev-data-tools__feedback" aria-live="polite">
        {toggl.phase !== "idle" ? (
          <p
            className={`dev-data-tools__status dev-data-tools__status--${toggl.phase}`}
            key="toggl-status"
          >
            <span className="dev-data-tools__status-label">Toggl:</span> {toggl.message}
          </p>
        ) : null}
        {google.phase !== "idle" ? (
          <p
            className={`dev-data-tools__status dev-data-tools__status--${google.phase}`}
            key="google-status"
          >
            <span className="dev-data-tools__status-label">Calendar:</span> {google.message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
