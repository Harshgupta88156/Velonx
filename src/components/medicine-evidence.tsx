"use client";
import { Activity } from "lucide-react";
import type { Inventory, InventoryInsight, Locale } from "@/lib/types";
import type { MessageKey } from "@/messages";
import ShapPanel from "./shap-panel";
import { forecastMethod, DemandChart } from "./ui/charts";

export function MedicineEvidence({
  record,
  insight,
  locale,
  tr,
  date,
  fmt,
}: {
  record: Inventory;
  insight: InventoryInsight | undefined;
  locale: Locale;
  tr: (key: MessageKey) => string;
  date: (value: string) => string;
  fmt: (n: number) => string;
}) {
  const forecast = insight?.forecast;
  return (
    <section className="medicine-evidence">
      <h3>
        <Activity size={17} />
        {tr("medicineEvidence")}
      </h3>
      <p className="evidence-subtitle">
        {tr("actual")} / {tr("forecast")} · {tr("units")}
      </p>
      <DemandChart
        history={record.history}
        forecast={forecast}
        locale={locale}
        actualLabel={tr("actual")}
        forecastLabel={tr("forecast")}
        rangeLabel={tr("range")}
      />
      <div className="evidence-grid">
        <div>
          <span>{tr("method")}</span>
          <strong>{forecastMethod(forecast, tr)}</strong>
        </div>
        <div>
          <span>{tr("mae")}</span>
          <strong>
            {forecast?.mae === null || forecast?.mae === undefined
              ? "—"
              : fmt(forecast.mae)}
          </strong>
        </div>
        <div>
          <span>{tr("observations")}</span>
          <strong>{forecast?.trainingPoints ?? 0}</strong>
        </div>
        <div>
          <span>{tr("validation")}</span>
          <strong>{forecast?.validationPoints ?? 0}</strong>
        </div>
        <div>
          <span>{tr("shortageDate")}</span>
          <strong>
            {insight?.shortageDate
              ? date(insight.shortageDate)
              : tr("noEstimate")}
          </strong>
        </div>
        <div>
          <span>{tr("replenishment")}</span>
          <strong>
            {insight ? fmt(insight.replenishment) : "—"} {tr("units")}
          </strong>
        </div>
      </div>
      {forecast?.attribution && (
        <ShapPanel attribution={forecast.attribution} locale={locale} />
      )}
      <p>
        {forecast?.method === "insufficient-data"
          ? tr("noHistory")
          : tr("predictionHelp")}
      </p>
      <p>{tr("maeHelp")}</p>
      <p>{tr("empiricalNote")}</p>
    </section>
  );
}
