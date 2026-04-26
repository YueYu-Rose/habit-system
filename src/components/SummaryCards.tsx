import { formatDurationMinutes, formatTimeBillMinutes } from "../lib/formatDuration";
import type { SummaryTotals } from "../lib/summaryTotals";

type Props = {
  totals: SummaryTotals;
};

export function SummaryCards({ totals }: Props) {
  return (
    <section className="summary-cards" aria-label="Summary">
      <article className="summary-card">
        <h3 className="summary-card__label">Total Planned Time</h3>
        <p className="summary-card__value summary-card__value--accent">
          {formatDurationMinutes(totals.totalPlannedMinutes)}
        </p>
      </article>
      <article className="summary-card">
        <h3 className="summary-card__label">Total Actual Time</h3>
        <p className="summary-card__value summary-card__value--accent">
          {formatDurationMinutes(totals.totalActualMinutes)}
        </p>
      </article>
      <article className="summary-card">
        <h3 className="summary-card__label">Total Time Bill</h3>
        <p className="summary-card__value summary-card__value--accent summary-card__value--bill">
          {formatTimeBillMinutes(totals.totalTimeBillMinutes)}
        </p>
      </article>
    </section>
  );
}
