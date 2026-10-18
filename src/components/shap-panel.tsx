import type { Attribution, Locale } from "@/lib/types";
import { shapMessages as copy } from "./shap-panel.messages";

const labelKey = {
  lastDay: "yesterday",
  sameWeekdayLastWeek: "weekday",
  weekMean: "mean",
} as const;

export default function ShapPanel({
  attribution,
  locale,
}: {
  attribution: Attribution;
  locale: Locale;
}) {
  const c = copy[locale];
  const max = Math.max(
    ...attribution.contributions.map((x) => Math.abs(x.shap)),
    0.0001,
  );
  const f = (n: number) => (Math.round(n * 10) / 10).toLocaleString(locale);
  return (
    <div className="shap-panel">
      <h4 className="shap-title">{c.title}</h4>
      <p className="muted shap-note">{c.note}</p>
      <div className="shap-rows">
        <div className="split-row">
          <span>{c.baseline}</span>
          <strong>
            {f(attribution.baseline)} {c.units}
          </strong>
        </div>
        {attribution.contributions.map((x) => (
          <div key={x.feature} className="shap-row">
            <span>
              {c[labelKey[x.feature]]} ({f(x.input)})
            </span>
            <span aria-hidden className="shap-track">
              <span
                className={`shap-bar ${x.shap >= 0 ? "positive" : "negative"}`}
                style={{
                  left:
                    x.shap >= 0
                      ? "50%"
                      : `${50 - (Math.abs(x.shap) / max) * 50}%`,
                  width: `${(Math.abs(x.shap) / max) * 50}%`,
                }}
              />
            </span>
            <strong className="num-right">
              {x.shap >= 0 ? "+" : ""}
              {f(x.shap)}
            </strong>
          </div>
        ))}
        <div className="split-row shap-total">
          <span>{c.forecast}</span>
          <strong>
            {f(attribution.prediction)} {c.units}
          </strong>
        </div>
      </div>
    </div>
  );
}
