import { useMemo, useState, useCallback, useEffect } from "react";
import { addDays, formatDayHeader, startOfDay, toIsoDateLocal } from "../lib/dateHelpers";
import { filterUnlinkedTogglEntries } from "../lib/linkedTogglPool";
import { computeSummaryTotals } from "../lib/summaryTotals";
import { TodoDateSelector } from "../components/TodoDateSelector";
import { SummaryCards } from "../components/SummaryCards";
import { TaskTable } from "../components/TaskTable";
import { ThemeSwitcher } from "../components/ThemeSwitcher";
import { AddMatchModal } from "../components/AddMatchModal";
import { apiFetch } from "../api/client";
import type { ComparisonRow } from "../types/comparisonRow";
import type { TogglTimeEntry } from "../types/togglTrack";
import { AddManualTodoModal } from "../components/AddManualTodoModal";
import { EditPlannedTaskModal } from "../components/EditPlannedTaskModal";
import { DevDataTools } from "../components/DevDataTools";
import { LastSyncMeta, type SyncMeta } from "../components/LastSyncMeta";

type RowState = {
  checked: boolean;
  efficiencyPercent: number | null;
};

type TodoDayResponse = {
  date: string;
  rows: ComparisonRow[];
  efficiencyByRowId: Record<string, number>;
  completedByRowId: Record<string, boolean>;
  togglCatalog: TogglTimeEntry[];
  syncMeta?: SyncMeta;
};

export default function TodoListPage() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [rows, setRows] = useState<ComparisonRow[]>([]);
  const [togglCatalog, setTogglCatalog] = useState<TogglTimeEntry[]>([]);
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [addMatchRowId, setAddMatchRowId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncMeta, setSyncMeta] = useState<SyncMeta | null>(null);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [editRowId, setEditRowId] = useState<string | null>(null);

  const dateStr = useMemo(() => toIsoDateLocal(startOfDay(selectedDate)), [selectedDate]);

  const loadDay = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const data = await apiFetch<TodoDayResponse>(
        `/api/todo/day?date=${encodeURIComponent(dateStr)}`,
        { headers: { "X-Client-Timezone": clientTz } }
      );
      setRows(data.rows);
      setTogglCatalog(data.togglCatalog);
      setSyncMeta(data.syncMeta ?? null);
      if (import.meta.env.DEV) {
        console.log("[todo/day] completedByRowId from API", data.completedByRowId ?? "(missing field)");
      }
      setRowState((prev) => {
        const next: Record<string, RowState> = {};
        for (const r of data.rows) {
          const eff = data.efficiencyByRowId[r.rowId];
          const prevRow = prev[r.rowId];
          next[r.rowId] = {
            checked: data.completedByRowId?.[r.rowId] ?? false,
            efficiencyPercent: eff ?? prevRow?.efficiencyPercent ?? null,
          };
        }
        return next;
      });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
      setRows([]);
      setTogglCatalog([]);
      setSyncMeta(null);
    } finally {
      setLoading(false);
    }
  }, [dateStr]);

  useEffect(() => {
    void loadDay();
  }, [loadDay]);

  useEffect(() => {
    setExpandedRowId(null);
    setAddMatchRowId(null);
    setEditRowId(null);
  }, [dateStr]);

  const totals = useMemo(() => computeSummaryTotals(rows), [rows]);

  const onToggleCheck = useCallback(
    async (rowId: string, checked: boolean) => {
      const row = rows.find((r) => r.rowId === rowId);
      if (!row) return;

      setRowState((prev) => ({
        ...prev,
        [rowId]: {
          checked,
          efficiencyPercent: prev[rowId]?.efficiencyPercent ?? null,
        },
      }));

      try {
        if (row.matchGroupId != null) {
          const payload = { matchGroupId: row.matchGroupId, completed: checked };
          if (import.meta.env.DEV) console.log("[todo] PUT /api/todo/completion", payload);
          await apiFetch("/api/todo/completion", {
            method: "PUT",
            body: JSON.stringify(payload),
          });
        } else if (row.kind === "toggl_unplanned" && row.togglEntryId) {
          const payload = { togglExternalId: row.togglEntryId, completed: checked };
          if (import.meta.env.DEV) console.log("[todo] PUT /api/todo/completion", payload);
          await apiFetch("/api/todo/completion", {
            method: "PUT",
            body: JSON.stringify(payload),
          });
        }
      } catch {
        void loadDay();
      }
    },
    [rows, loadDay]
  );

  const onEfficiencyChange = useCallback(
    async (rowId: string, percent: number) => {
      const row = rows.find((r) => r.rowId === rowId);
      if (row?.kind === "toggl_unplanned") {
        if (!row.togglEntryId) return;
        setRowState((prev) => ({
          ...prev,
          [rowId]: {
            checked: prev[rowId]?.checked ?? false,
            efficiencyPercent: percent,
          },
        }));
        try {
          await apiFetch("/api/todo/efficiency", {
            method: "PUT",
            body: JSON.stringify({ togglExternalId: row.togglEntryId, ratingPercent: percent }),
          });
        } catch {
          void loadDay();
        }
        return;
      }
      if (row?.matchGroupId == null) return;
      setRowState((prev) => ({
        ...prev,
        [rowId]: {
          checked: prev[rowId]?.checked ?? false,
          efficiencyPercent: percent,
        },
      }));
      try {
        await apiFetch("/api/todo/efficiency", {
          method: "PUT",
          body: JSON.stringify({ matchGroupId: row.matchGroupId, ratingPercent: percent }),
        });
      } catch {
        void loadDay();
      }
    },
    [rows, loadDay]
  );

  const onToggleExpand = useCallback((rowId: string) => {
    setExpandedRowId((prev) => (prev === rowId ? null : rowId));
  }, []);

  const onOpenAddMatch = useCallback((rowId: string) => {
    setAddMatchRowId(rowId);
  }, []);

  const onUnlinkLinkedEntry = useCallback(
    async (rowId: string, togglEntryId: string) => {
      const row = rows.find((r) => r.rowId === rowId);
      if (row?.matchGroupId == null) return;
      try {
        await apiFetch("/api/todo/unlink", {
          method: "POST",
          body: JSON.stringify({ matchGroupId: row.matchGroupId, togglExternalId: togglEntryId }),
        });
        await loadDay();
      } catch {
        void loadDay();
      }
    },
    [rows, loadDay]
  );

  const addMatchCandidates = useMemo(
    () => filterUnlinkedTogglEntries(togglCatalog, rows),
    [togglCatalog, rows]
  );

  const addMatchRow = addMatchRowId
    ? rows.find((r) => r.rowId === addMatchRowId)
    : undefined;

  const editRow = editRowId ? rows.find((r) => r.rowId === editRowId) : undefined;
  const editGoogleExcludeExternalId =
    editRow?.plannedSource === "google_calendar" && editRow.googleEventId
      ? editRow.googleEventId
      : undefined;

  const onConfirmAddMatch = useCallback(
    async (selectedIds: string[]) => {
      if (!addMatchRowId || selectedIds.length === 0) return;
      const row = rows.find((r) => r.rowId === addMatchRowId);
      if (row?.matchGroupId == null) return;
      try {
        await apiFetch("/api/todo/link", {
          method: "POST",
          body: JSON.stringify({ matchGroupId: row.matchGroupId, togglExternalIds: selectedIds }),
        });
        setAddMatchRowId(null);
        await loadDay();
      } catch {
        void loadDay();
      }
    },
    [addMatchRowId, rows, loadDay]
  );

  return (
    <>
      <header className="page__header">
        <div className="page__header-row page__header-row--report">
          <div className="page__header-left">
            <h1 className="page__title">To Do List</h1>
            <TodoDateSelector
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
            />
          </div>
          <ThemeSwitcher />
        </div>
        <p className="page__subtitle">
          Compare Planned Calendar Time With Toggl Track Actuals
        </p>
        {!loadError && !loading ? <LastSyncMeta syncMeta={syncMeta} /> : null}
      </header>

      {loadError ? (
        <p className="page__subtitle" role="alert">
          Could not load data: {loadError}. Ensure the API server is running (`npm run dev`) and
          imported Toggl + Calendar data for this day.
        </p>
      ) : null}
      {loading ? <p className="page__subtitle">Loading…</p> : null}

      <SummaryCards totals={totals} />

      <TaskTable
        rows={rows}
        rowState={rowState}
        expandedRowId={expandedRowId}
        onToggleExpand={onToggleExpand}
        onToggleCheck={onToggleCheck}
        onEfficiencyChange={onEfficiencyChange}
        onOpenAddMatch={onOpenAddMatch}
        onUnlinkLinkedEntry={onUnlinkLinkedEntry}
        showContextEmptyHints={!loading}
        onOpenAddManual={() => setManualModalOpen(true)}
        onEditPlannedTask={(row) => setEditRowId(row.rowId)}
      />

      <AddManualTodoModal
        open={manualModalOpen}
        selectedDateLabel={formatDayHeader(startOfDay(selectedDate))}
        onClose={() => setManualModalOpen(false)}
        onConfirm={async (payload) => {
          await apiFetch("/api/todo/manual-planned", {
            method: "POST",
            body: JSON.stringify({
              date: dateStr,
              title: payload.title,
              plannedMinutes: payload.plannedMinutes,
            }),
          });
          await loadDay();
        }}
      />

      <EditPlannedTaskModal
        open={editRow != null && editRow.matchGroupId != null}
        initialTitle={editRow?.displayTitle ?? ""}
        initialPlannedMinutes={editRow?.plannedMinutes ?? 60}
        plannedSource={editRow?.plannedSource}
        onClose={() => setEditRowId(null)}
        onSave={async (payload) => {
          if (editRow?.matchGroupId == null) return;
          await apiFetch("/api/todo/planned-task", {
            method: "PUT",
            body: JSON.stringify({
              matchGroupId: editRow.matchGroupId,
              title: payload.title,
              plannedMinutes: payload.plannedMinutes,
            }),
          });
          await loadDay();
        }}
        onMoveToNextDay={async (payload) => {
          const mgId = editRow?.matchGroupId;
          if (mgId == null) return;
          await apiFetch("/api/todo/planned-task/move-next-day", {
            method: "POST",
            body: JSON.stringify({
              matchGroupId: mgId,
              title: payload.title,
              plannedMinutes: payload.plannedMinutes,
            }),
          });
          setSelectedDate(addDays(startOfDay(selectedDate), 1));
        }}
        onRemoveFromTodoList={
          editGoogleExcludeExternalId
            ? async () => {
                await apiFetch("/api/todo/google-calendar-exclude", {
                  method: "POST",
                  body: JSON.stringify({ externalId: editGoogleExcludeExternalId }),
                });
              }
            : undefined
        }
      />

      <AddMatchModal
        open={addMatchRowId !== null}
        title={addMatchRow ? `Link Entries To “${addMatchRow.displayTitle}”` : "Add Match"}
        candidates={addMatchCandidates}
        onClose={() => setAddMatchRowId(null)}
        onConfirm={onConfirmAddMatch}
      />

      {import.meta.env.DEV ? <DevDataTools onSyncComplete={loadDay} /> : null}
    </>
  );
}
