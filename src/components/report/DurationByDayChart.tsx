import {
  durationYAxisMax,
  formatHoursAsHms,
} from "../../lib/durationChartAxis";

type DayPoint = {
  weekdayShort: string;
  dayMonth: string;
  hours: number;
  hoursLabel: string;
};

type Props = {
  days: DayPoint[];
};

const VB_W = 720;
const VB_H = 540;
const PAD_R = 20;
const PAD_T = 26;
const PAD_B = 56;
const CHART_H = VB_H - PAD_T - PAD_B;
const GAP_TO_BAR_RATIO = 1.12;
/**
 * Right edge of y-axis label column (labels sit left of this x, inside viewBox).
 * Grid starts here so tick text is not clipped.
 */
const Y_LABEL_SLOT_RIGHT = 40;
const gridEndX = VB_W - PAD_R;

export function DurationByDayChart({ days }: Props) {
  const maxH = durationYAxisMax(days.map((d) => d.hours));
  const yTicks = 4;
  const tickVals = Array.from({ length: yTicks + 1 }, (_, i) => (maxH * i) / yTicks);

  const n = days.length || 1;
  const denom = n + (n - 1) * GAP_TO_BAR_RATIO + 1;
  const plotBandRight = gridEndX - Y_LABEL_SLOT_RIGHT;
  const barW = plotBandRight / denom;
  const gap = barW * GAP_TO_BAR_RATIO;
  const plotStartX = Y_LABEL_SLOT_RIGHT + barW;

  return (
    <div className="report-chart report-chart--bar">
      <h3 className="report-chart__title">Duration By Day</h3>
      <div className="report-chart__svg-wrap">
        <svg
          className="report-chart__svg report-chart__svg--duration"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          role="img"
          aria-label="Duration By Day Bar Chart"
        >
          {tickVals.map((tv, i) => {
            const y = PAD_T + CHART_H - (tv / maxH) * CHART_H;
            return (
              <g key={i}>
                <line
                  className="report-chart__grid-line"
                  x1={Y_LABEL_SLOT_RIGHT}
                  x2={gridEndX}
                  y1={y}
                  y2={y}
                />
                <text
                  className="report-chart__y-label"
                  x={Y_LABEL_SLOT_RIGHT - 6}
                  y={y + 5}
                  textAnchor="end"
                >
                  {tv.toFixed(1)}h
                </text>
              </g>
            );
          })}
          {days.map((d, i) => {
            const x = plotStartX + i * (barW + gap);
            const h = (d.hours / maxH) * CHART_H;
            const y = PAD_T + CHART_H - h;
            const cx = x + barW / 2;
            return (
              <g key={`${d.weekdayShort}-${d.dayMonth}`}>
                <rect
                  className="report-chart__bar"
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(h, 0)}
                  rx={8}
                />
                <text
                  className="report-chart__bar-top-hms"
                  x={cx}
                  y={y - 11}
                  textAnchor="middle"
                >
                  {formatHoursAsHms(d.hours)}
                </text>
                <text
                  className="report-chart__x-label"
                  x={cx}
                  y={VB_H - PAD_B + 20}
                  textAnchor="middle"
                >
                  {d.weekdayShort}
                </text>
                <text
                  className="report-chart__x-sublabel"
                  x={cx}
                  y={VB_H - PAD_B + 38}
                  textAnchor="middle"
                >
                  {d.dayMonth}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
