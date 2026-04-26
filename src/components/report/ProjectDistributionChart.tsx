type Slice = {
  projectId: string;
  name: string;
  hours: number;
  color: string;
  percent: number;
};

type Props = {
  slices: Slice[];
  totalHours: number;
};

const CX = 140;
const CY = 140;
const R_OUT = 112;
const R_IN = 68;

function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

/** Polar from east, clockwise (SVG coords): angleDeg 0 = 3 o'clock */
function point(cx: number, cy: number, r: number, angleDeg: number) {
  const a = degToRad(angleDeg - 90);
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function donutPath(
  startAngle: number,
  sweep: number
): string {
  const endAngle = startAngle + sweep;
  const [x1, y1] = point(CX, CY, R_OUT, startAngle);
  const [x2, y2] = point(CX, CY, R_OUT, endAngle);
  const [x3, y3] = point(CX, CY, R_IN, endAngle);
  const [x4, y4] = point(CX, CY, R_IN, startAngle);
  const large = sweep > 180 ? 1 : 0;
  return [
    `M ${x1} ${y1}`,
    `A ${R_OUT} ${R_OUT} 0 ${large} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${R_IN} ${R_IN} 0 ${large} 0 ${x4} ${y4}`,
    "Z",
  ].join(" ");
}

export function ProjectDistributionChart({ slices, totalHours }: Props) {
  let angle = 0;

  const paths = slices.map((s) => {
    const sweep = (s.percent / 100) * 360;
    const d = donutPath(angle, sweep);
    angle += sweep;
    return { d, color: s.color, id: s.projectId };
  });

  const totalLabel = `${Math.round(totalHours * 100) / 100}h`;

  return (
    <div className="report-chart report-chart--donut">
      <h3 className="report-chart__title">Project Distribution</h3>
      <div className="report-donut-stack">
        <div className="report-donut-stack__chart">
          <svg
            className="report-chart__svg report-chart__svg--donut"
            viewBox="0 0 280 280"
            role="img"
            aria-label="Project Distribution Donut Chart"
          >
            {paths.map((p) => (
              <path key={p.id} className="report-chart__slice" d={p.d} fill={p.color} />
            ))}
            <text className="report-chart__donut-total" x={CX} y={CY - 4} textAnchor="middle">
              {totalLabel}
            </text>
            <text className="report-chart__donut-caption" x={CX} y={CY + 14} textAnchor="middle">
              Total
            </text>
          </svg>
        </div>
        <ul className="report-legend">
          {slices.map((s) => (
            <li key={s.projectId} className="report-legend__item">
              <span
                className="report-legend__swatch"
                style={{ background: s.color }}
                aria-hidden
              />
              <span className="report-legend__name" title={s.name}>
                {s.name}
              </span>
              <span className="report-legend__stats">
                <span className="report-legend__percent">{s.percent}%</span>
                <span className="report-legend__sep" aria-hidden>
                  ·
                </span>
                <span className="report-legend__hours">
                  {Math.round(s.hours * 10) / 10}h
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
