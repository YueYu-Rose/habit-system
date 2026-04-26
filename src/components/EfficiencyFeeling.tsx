import { useCallback } from "react";

const BLOCKS = 10;
const STEP = 10;

type Props = {
  valuePercent: number | null;
  onChange: (percent: number) => void;
  rowId: string;
};

export function EfficiencyFeeling({ valuePercent, onChange, rowId }: Props) {
  const active = valuePercent === null ? 0 : Math.round(valuePercent / STEP);

  const pick = useCallback(
    (index: number) => {
      const pct = (index + 1) * STEP;
      onChange(pct);
    },
    [onChange]
  );

  return (
    <div className="efficiency" role="group" aria-label="Efficiency Feeling">
      <div className="efficiency__blocks">
        {Array.from({ length: BLOCKS }, (_, i) => {
          const filled = i < active;
          const stepVar = `var(--eff-${i + 1})`;
          return (
            <button
              key={`${rowId}-eff-${i}`}
              type="button"
              className={`efficiency__block${filled ? " efficiency__block--filled" : ""}`}
              style={
                filled
                  ? {
                      background: stepVar,
                      borderColor: stepVar,
                    }
                  : undefined
              }
              aria-pressed={filled}
              aria-label={`${(i + 1) * STEP}%`}
              onClick={() => pick(i)}
            />
          );
        })}
      </div>
      {valuePercent !== null ? (
        <span className="efficiency__pct">{valuePercent}%</span>
      ) : null}
    </div>
  );
}
