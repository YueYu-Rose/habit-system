import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { addDays, todayIsoLocal } from "../lib/dateLocal";
import { useAppConfig } from "../config/appConfig";
import { fetchHabitCatalogFromSupabase } from "../lib/fetchHabitCatalogFromSupabase";
import {
  HABIT_CATALOG_SAVED_EVENT,
  loadHabitCatalog,
  mergeHabitCatalogCheckInOverlay,
  type HabitCatalogState,
} from "../lib/habitListStorage";
import { buildHabitLedgerRowsFromCatalog, type CatalogLedgerRow } from "../lib/reportLedgerFromCatalog";
import {
  buildReportChartDisplay,
  type ReportPointsPoint,
  type ReportSleepPoint,
} from "../lib/reportSeriesFromCatalog";
import { isSupabaseConfigured } from "../lib/supabase";
import { REMOTE_DATA_EVENT } from "../lib/userDataRemote";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type XAxisTickContentProps,
} from "recharts";

type Lang = "zh" | "en";

type LedgerRow = CatalogLedgerRow;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatHMFromExtended(minExt: number): string {
  const v = ((Math.round(minExt) % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(v / 60);
  const m = v % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

type TickDatum = Pick<ReportSleepPoint, "dateLabel" | "weekLabel">;

function buildDateLabelMap(rows: { key: string; dateLabel: string; weekLabel: string }[]): Map<string, TickDatum> {
  const m = new Map<string, TickDatum>();
  for (const r of rows) {
    m.set(r.key, { dateLabel: r.dateLabel, weekLabel: r.weekLabel });
  }
  return m;
}

function CustomXAxisTick(
  props: XAxisTickContentProps,
  labelByKey: Map<string, TickDatum>
) {
  const x = Number(props.x);
  const y = Number(props.y);
  const key = String(props.payload?.value ?? "");
  const p = labelByKey.get(key);
  if (!p?.dateLabel) return null;
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} textAnchor="middle" fill="none">
        <tspan x={0} dy={12} fontSize={11} fill="#6b7280" fontWeight={500}>
          {p.dateLabel}
        </tspan>
        <tspan x={0} dy={14} fontSize={10} fill="#9ca3af">
          {p.weekLabel}
        </tspan>
      </text>
    </g>
  );
}

function ReportSleepTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ReportSleepPoint }[];
}) {
  const { t } = useLanguage();
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  if (d.sleepExt == null || d.wakeExt == null) {
    return (
      <div
        style={{
          background: "rgba(255,255,255,0.96)",
          border: "1px solid #f3f4f6",
          borderRadius: 12,
          padding: "10px 12px",
          boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
          color: "#6b7280",
          minWidth: 160,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.dateLabel} {d.weekLabel}</div>
        <div style={{ fontSize: 12 }}>{t("report.sleepTooltip.noData")}</div>
      </div>
    );
  }
  const sleep = formatHMFromExtended(d.sleepExt);
  const wake = formatHMFromExtended(d.wakeExt);
  const mins = Math.max(0, d.wakeExt - d.sleepExt);
  const hrs = Math.floor(mins / 60);
  const mm = Math.round(mins % 60);
  const duration = t("report.sleepTooltip.durationFmt", { h: hrs, m: pad2(mm) });
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.96)",
        border: "1px solid #f3f4f6",
        borderRadius: 12,
        padding: "10px 12px",
        boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
        color: "#111827",
        minWidth: 160,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>
        {d.dateLabel} {d.weekLabel}
      </div>
      <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>
        <div>
          {t("report.sleepTooltip.asleep")}
          <span style={{ color: "#111827", fontWeight: 650 }}>{sleep}</span>
        </div>
        <div>
          {t("report.sleepTooltip.wake")}
          <span style={{ color: "#111827", fontWeight: 650 }}>{wake}</span>
        </div>
        <div>
          {t("report.sleepTooltip.duration")}
          <span style={{ color: "#111827", fontWeight: 650 }}>{duration}</span>
        </div>
      </div>
    </div>
  );
}

function ReportPointsTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ReportPointsPoint }[];
}) {
  const { t } = useLanguage();
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const v = d.net;
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.96)",
        border: "1px solid #f3f4f6",
        borderRadius: 12,
        padding: "10px 12px",
        boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
        color: "#111827",
        minWidth: 140,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>
        {d.dateLabel} {d.weekLabel}
      </div>
      <div style={{ fontSize: 12, color: "#6b7280" }}>
        {t("report.pointsTooltip")}{" "}
        <span style={{ fontWeight: 750, color: v >= 0 ? "var(--habit-emerald)" : "var(--habit-wine)" }}>
          {v > 0 ? "+" : ""}
          {v}
        </span>
      </div>
    </div>
  );
}

function formatLedgerWhen(r: LedgerRow, lang: Lang): string {
  const datePart = r.habit_date;
  try {
    const dt = new Date(r.created_at);
    if (!Number.isNaN(dt.getTime())) {
      const timePart = dt.toLocaleString(lang === "en" ? "en-GB" : "zh-CN", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      return `${datePart} · ${timePart}`;
    }
  } catch {
    /* ignore */
  }
  return datePart;
}

function formatAmount(r: LedgerRow): string {
  const n = r.amount;
  if (n > 0) return `+${n}`;
  return `−${Math.abs(n)}`;
}

export function ReportPage() {
  const { t, lang } = useLanguage();
  const { showAI } = useAppConfig();
  const { user } = useAuth();
  const [catalog, setCatalog] = useState<HabitCatalogState>(() => loadHabitCatalog());
  const [catalogDataTick, setCatalogDataTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (isSupabaseConfigured() && user?.id) {
        const remote = await fetchHabitCatalogFromSupabase(user.id);
        if (cancelled) return;
        if (remote) setCatalog(remote);
        else setCatalog(loadHabitCatalog());
        return;
      }
      if (cancelled) return;
      setCatalog(loadHabitCatalog());
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    const h = () => setCatalog(loadHabitCatalog());
    window.addEventListener(REMOTE_DATA_EVENT, h);
    return () => window.removeEventListener(REMOTE_DATA_EVENT, h);
  }, []);

  useEffect(() => {
    const bump = () => setCatalogDataTick((n) => n + 1);
    window.addEventListener(HABIT_CATALOG_SAVED_EVENT, bump);
    return () => window.removeEventListener(HABIT_CATALOG_SAVED_EVENT, bump);
  }, []);

  /** 与 localStorage 并集，避免已登录时 Supabase 拉取的 state 比本机少 customDone/recorded，导致流水与图表全空 */
  const catalogForReport = useMemo(
    () => mergeHabitCatalogCheckInOverlay(catalog, loadHabitCatalog()),
    [catalog, catalogDataTick]
  );

  const chartDisplay = useMemo(
    () => buildReportChartDisplay(catalogForReport, lang as Lang),
    [catalogForReport, lang]
  );
  const { sleepSeries, pointsSeries, sleepIsDemo, pointsIsDemo } = chartDisplay;

  const chartLabelByKeyPoints = useMemo(() => buildDateLabelMap(pointsSeries), [pointsSeries]);
  const chartLabelByKeySleep = useMemo(() => buildDateLabelMap(sleepSeries), [sleepSeries]);
  const end = todayIsoLocal();
  const start = addDays(end, -30);
  const ledger = useMemo(
    () => buildHabitLedgerRowsFromCatalog(catalogForReport, start, end, lang as Lang),
    [catalogForReport, start, end, lang]
  );

  const yDomain = useMemo(() => {
    const vals: number[] = [];
    for (const r of sleepSeries) {
      if (r.sleepExt != null) vals.push(r.sleepExt);
      if (r.wakeExt != null) vals.push(r.wakeExt);
    }
    if (vals.length === 0) return [21 * 60, 34 * 60] as const;
    const minV = Math.min(...vals);
    const maxV = Math.max(...vals);
    const pad = 30;
    return [Math.floor((minV - pad) / 15) * 15, Math.ceil((maxV + pad) / 15) * 15] as const;
  }, [sleepSeries]);

  const primary = "var(--color-primary)";

  return (
    <>
      <p className="habit-muted habit-page-lead">{t("report.lead")}</p>

      {showAI ? (
        <div className="habit-ai-insight-card">
          <div className="habit-ai-insight-card__head">
            <span className="habit-ai-insight-card__icon" aria-hidden>
              ✨
            </span>
            <h2 className="habit-ai-insight-card__title">{t("report.ai.title")}</h2>
          </div>
          <p className="habit-ai-insight-card__text">{t("report.ai.body")}</p>
        </div>
      ) : null}

      <div className="habit-row-card" style={{ padding: 16, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: "1.02rem", fontWeight: 700, color: "var(--habit-text)" }}>
          {t("report.chart.sleep")}
          {sleepIsDemo ? (
            <span className="habit-report-demo-badge habit-report-demo-badge--title" role="note">
              {t("report.chart.demoShort")}
            </span>
          ) : null}
        </h2>
        <div className="habit-report-chart-frame" style={{ height: 220, marginTop: 10 }}>
          {sleepIsDemo ? (
            <div className="habit-report-demo-film" role="presentation" aria-hidden>
              <span className="habit-report-demo-film__caption">{t("report.chart.demoBadge")}</span>
            </div>
          ) : null}
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sleepSeries} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <XAxis
                dataKey="key"
                tickLine={false}
                axisLine={false}
                height={50}
                interval={0}
                tick={(p) => CustomXAxisTick(p, chartLabelByKeySleep)}
              />
              <YAxis
                domain={yDomain as [number, number]}
                tickLine={false}
                axisLine={false}
                width={42}
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                tickFormatter={(v: number) => formatHMFromExtended(v)}
              />
              <CartesianGrid vertical={false} stroke="#f3f4f6" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="sleepExt"
                stroke={primary}
                strokeWidth={2.5}
                connectNulls={false}
                dot={{ r: 3, fill: primary, stroke: "#ffffff", strokeWidth: 2 }}
                activeDot={{ r: 5, fill: primary, stroke: "#ffffff", strokeWidth: 2 }}
                isAnimationActive
              />
              <Line
                type="monotone"
                dataKey="wakeExt"
                stroke={primary}
                strokeWidth={2.5}
                connectNulls={false}
                dot={{ r: 3, fill: primary, stroke: "#ffffff", strokeWidth: 2 }}
                activeDot={{ r: 5, fill: primary, stroke: "#ffffff", strokeWidth: 2 }}
                isAnimationActive
              />
              <Tooltip
                content={<ReportSleepTooltip />}
                cursor={{ stroke: "#d1d5db", strokeDasharray: "4 4" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="habit-row-card" style={{ padding: 16, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: "1.02rem", fontWeight: 700, color: "var(--habit-text)" }}>
          {t("report.chart.points")}
          {pointsIsDemo ? (
            <span className="habit-report-demo-badge habit-report-demo-badge--title" role="note">
              {t("report.chart.demoShort")}
            </span>
          ) : null}
        </h2>
        <div className="habit-report-chart-frame" style={{ height: 200, marginTop: 10 }}>
          {pointsIsDemo ? (
            <div className="habit-report-demo-film" role="presentation" aria-hidden>
              <span className="habit-report-demo-film__caption">{t("report.chart.demoBadge")}</span>
            </div>
          ) : null}
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pointsSeries} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <XAxis
                dataKey="key"
                tickLine={false}
                axisLine={false}
                height={50}
                interval={0}
                tick={(p) => CustomXAxisTick(p, chartLabelByKeyPoints)}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={36}
                tick={{ fill: "#9ca3af", fontSize: 11 }}
              />
              <CartesianGrid vertical={false} stroke="#f3f4f6" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="net"
                stroke={primary}
                strokeWidth={3}
                dot={{ r: 3.5, fill: primary, stroke: "#ffffff", strokeWidth: 2 }}
                activeDot={{ r: 5.5, fill: primary, stroke: "#ffffff", strokeWidth: 2 }}
                isAnimationActive
              />
              <Tooltip content={<ReportPointsTooltip />} cursor={{ stroke: "#d1d5db", strokeDasharray: "4 4" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <h2 className="habit-section-title" style={{ marginTop: 4 }}>
        {t("report.ledger")}
      </h2>
      <div className="habit-wallet-sheet" style={{ marginBottom: 12 }}>
        <ul className="habit-wallet-list">
          {ledger.map((r) => (
            <li key={r.id} className="habit-wallet-row">
              <div className="habit-wallet-row__main">
                <span className="habit-wallet-row__title">{r.title}</span>
                <span className="habit-wallet-row__subtitle">
                  {formatLedgerWhen(r, lang)} · {r.source_type}
                </span>
              </div>
              <span
                className={`habit-wallet-row__amt ${
                  r.amount >= 0 ? "habit-wallet-row__amt--pos" : "habit-wallet-row__amt--neg"
                }`}
              >
                {formatAmount(r)}
              </span>
            </li>
          ))}
        </ul>
        {ledger.length === 0 ? (
          <p className="habit-muted" style={{ padding: "0 4px 12px" }}>
            {t("report.ledger.empty")}
          </p>
        ) : null}
      </div>

      <p className="habit-muted" style={{ fontSize: 13, marginBottom: 20 }}>
        {t("report.footer")}{" "}
        <Link
          to="/me/history"
          style={{ color: "var(--color-primary)", fontWeight: 600, textDecoration: "underline" }}
        >
          {t("report.more")}
        </Link>
      </p>
    </>
  );
}
