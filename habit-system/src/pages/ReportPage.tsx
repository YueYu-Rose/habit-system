import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { habitFetch } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { addDays, todayIsoLocal } from "../lib/dateLocal";
import { useAppConfig } from "../config/appConfig";
import {
  Area,
  AreaChart,
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

type SleepDatum = {
  key: string;
  dateLabel: string;
  weekLabel: string;
  sleepExt: number;
  wakeExt: number;
  range: [number, number];
};

type PointsDatum = {
  key: string;
  dateLabel: string;
  weekLabel: string;
  net: number;
};

type LedgerRow = {
  id: number;
  habit_date: string;
  created_at: string;
  amount: number;
  source_type: string;
  title: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatMMDD(d: Date) {
  return `${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
}

function weekLabelFor(d: Date, lang: Lang) {
  if (lang === "zh") {
    const map = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    return map[d.getDay()] ?? "";
  }
  return d.toLocaleDateString("en-GB", { weekday: "short" });
}

function minutesFromHM(hm: string): number {
  const [h, m] = hm.split(":").map((x) => Number(x));
  return Math.max(0, Math.min(24 * 60 - 1, h * 60 + (m || 0)));
}

function toExtendedMinutes(min: number): number {
  return min < 12 * 60 ? min + 24 * 60 : min;
}

function formatHMFromExtended(minExt: number): string {
  const v = ((Math.round(minExt) % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(v / 60);
  const m = v % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function useMockData(lang: Lang) {
  return useMemo(() => {
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    const days: Date[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      days.push(d);
    }

    const sleepHM = ["23:10", "23:35", "00:05", "23:50", "00:20", "23:25", "00:10"];
    const wakeHM = ["06:40", "07:05", "06:20", "07:30", "06:55", "06:10", "07:15"];
    const points = [12, 5, -10, 8, 0, 15, -5];

    const sleepSeries: SleepDatum[] = days.map((d, i) => {
      const s = toExtendedMinutes(minutesFromHM(sleepHM[i] ?? "23:30"));
      const w = toExtendedMinutes(minutesFromHM(wakeHM[i] ?? "06:45"));
      return {
        key: d.toISOString().slice(0, 10),
        dateLabel: formatMMDD(d),
        weekLabel: weekLabelFor(d, lang),
        sleepExt: s,
        wakeExt: w,
        range: [s, w],
      };
    });

    const pointsSeries: PointsDatum[] = days.map((d, i) => ({
      key: d.toISOString().slice(0, 10),
      dateLabel: formatMMDD(d),
      weekLabel: weekLabelFor(d, lang),
      net: points[i] ?? 0,
    }));

    return { sleepSeries, pointsSeries };
  }, [lang]);
}

type TickDatum = Pick<SleepDatum, "dateLabel" | "weekLabel">;

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
  payload?: { payload: SleepDatum }[];
}) {
  const { t } = useLanguage();
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const sleep = formatHMFromExtended(d.sleepExt);
  const wake = formatHMFromExtended(d.wakeExt);
  const mins = Math.max(0, d.wakeExt - d.sleepExt);
  const hrs = Math.floor(mins / 60);
  const mm = mins % 60;
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
  payload?: { payload: PointsDatum }[];
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
  const { mode, showAI } = useAppConfig();
  const { isLoggedIn } = useAuth();
  const canUseApi = mode === "PROMOTION" && isLoggedIn;
  const { sleepSeries, pointsSeries } = useMockData(lang);
  const chartLabelByKey = useMemo(() => buildDateLabelMap(sleepSeries), [sleepSeries]);
  const end = todayIsoLocal();
  const start = addDays(end, -30);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [ledgerErr, setLedgerErr] = useState<string | null>(null);

  useEffect(() => {
    if (!canUseApi) {
      setLedger([]);
      setLedgerErr(null);
      return;
    }
    setLedgerErr(null);
    habitFetch<{ rows: LedgerRow[] }>(`/api/habit/ledger?from=${start}&to=${end}`)
      .then((x) => setLedger(x.rows))
      .catch((e) => setLedgerErr(String(e)));
  }, [canUseApi, start, end]);

  const yDomain = useMemo(() => {
    let minV = Number.POSITIVE_INFINITY;
    let maxV = Number.NEGATIVE_INFINITY;
    for (const r of sleepSeries) {
      minV = Math.min(minV, r.sleepExt, r.wakeExt);
      maxV = Math.max(maxV, r.sleepExt, r.wakeExt);
    }
    if (!Number.isFinite(minV) || !Number.isFinite(maxV)) return [21 * 60, 34 * 60] as const;
    const pad = 30;
    return [Math.floor((minV - pad) / 15) * 15, Math.ceil((maxV + pad) / 15) * 15] as const;
  }, [sleepSeries]);

  const primary = "var(--color-primary)";
  const fillLight = "color-mix(in srgb, var(--color-efficiency-1) 70%, transparent)";

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
        </h2>

        <div style={{ height: 220, marginTop: 10 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sleepSeries} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <XAxis
                dataKey="key"
                tickLine={false}
                axisLine={false}
                height={50}
                interval={0}
                tick={(p) => CustomXAxisTick(p, chartLabelByKey)}
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

              <Area
                type="monotone"
                dataKey="range"
                stroke="none"
                fill={fillLight}
                fillOpacity={0.55}
                isAnimationActive
              />
              <Line
                type="monotone"
                dataKey="sleepExt"
                stroke={primary}
                strokeWidth={2.5}
                dot={{ r: 3, fill: primary, stroke: "#ffffff", strokeWidth: 2 }}
                activeDot={{ r: 5, fill: primary, stroke: "#ffffff", strokeWidth: 2 }}
                isAnimationActive
              />
              <Line
                type="monotone"
                dataKey="wakeExt"
                stroke={primary}
                strokeWidth={2.5}
                dot={{ r: 3, fill: primary, stroke: "#ffffff", strokeWidth: 2 }}
                activeDot={{ r: 5, fill: primary, stroke: "#ffffff", strokeWidth: 2 }}
                isAnimationActive
              />
              <Tooltip
                content={<ReportSleepTooltip />}
                cursor={{ stroke: "#d1d5db", strokeDasharray: "4 4" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="habit-row-card" style={{ padding: 16, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: "1.02rem", fontWeight: 700, color: "var(--habit-text)" }}>
          {t("report.chart.points")}
        </h2>
        <div style={{ height: 200, marginTop: 10 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pointsSeries} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <XAxis
                dataKey="key"
                tickLine={false}
                axisLine={false}
                height={50}
                interval={0}
                tick={(p) => CustomXAxisTick(p, chartLabelByKey)}
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
      {ledgerErr ? <p className="habit-error" style={{ marginBottom: 8 }}>{ledgerErr}</p> : null}
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
        {ledger.length === 0 && !ledgerErr ? (
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
