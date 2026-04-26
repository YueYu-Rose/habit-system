import type { ComparisonChip } from "../../report/buildReportViewModel";

type Props = {
  totalHoursLabel: string;
  totalHoursComparison: ComparisonChip;
  timeBillLabel: string;
  timeBillComparison: ComparisonChip;
  avgDailyLabel: string;
  avgDailyComparison: ComparisonChip;
};

/** Reusable inline comparison: arrow + percentage + vs Last Week. Same line as main value. */
function InlineComparison({ chip }: { chip: ComparisonChip }) {
  const { direction, percentLabel } = chip;
  const same = direction === "same";
  const up = direction === "up";

  if (same) {
    return (
      <>
        {" "}
        <span className="report-compare report-compare--same">
          — 0% <span className="report-compare__vs">vs Last Week</span>
        </span>
      </>
    );
  }

  return (
    <>
      {" "}
      <span className={`report-compare report-compare--${up ? "up" : "down"}`}>
        {up ? "↑" : "↓"} {percentLabel}{" "}
        <span className="report-compare__vs">vs Last Week</span>
      </span>
    </>
  );
}

export function ReportSummaryCards({
  totalHoursLabel,
  totalHoursComparison,
  timeBillLabel,
  timeBillComparison,
  avgDailyLabel,
  avgDailyComparison,
}: Props) {
  return (
    <section className="report-summary" aria-label="Weekly Summary">
      <article className="report-summary__card">
        <h3 className="report-summary__label">Total Hours</h3>
        <p className="report-summary__value report-summary__value--accent">
          <span className="report-summary__value-main">{totalHoursLabel}</span>
          <InlineComparison chip={totalHoursComparison} />
        </p>
      </article>
      <article className="report-summary__card">
        <h3 className="report-summary__label">Total Time Bill</h3>
        <p className="report-summary__value report-summary__value--accent">
          <span className="report-summary__value-main">{timeBillLabel}</span>
          <InlineComparison chip={timeBillComparison} />
        </p>
      </article>
      <article className="report-summary__card">
        <h3 className="report-summary__label">Average Daily Hours</h3>
        <p className="report-summary__value report-summary__value--accent">
          <span className="report-summary__value-main">{avgDailyLabel}</span>
          <InlineComparison chip={avgDailyComparison} />
        </p>
      </article>
    </section>
  );
}
