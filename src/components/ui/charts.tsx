"use client";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Forecast, Locale } from "@/lib/types";
import type { MessageKey } from "@/messages";

export function forecastMethod(
  f: Forecast | undefined,
  tr: (key: MessageKey) => string,
) {
  return tr(
    f?.method === "seasonal-naive"
      ? "seasonalNaive"
      : f?.method === "moving-average"
        ? "movingAverage"
        : f?.method === "exponential-smoothing"
          ? "exponentialSmoothing"
          : f?.method === "ridge-regression"
            ? "ridgeRegression"
            : "insufficientData",
  );
}

export function DemandChart({
  history,
  forecast,
  locale,
  actualLabel,
  forecastLabel,
  rangeLabel,
}: {
  history: { date: string; value: number }[];
  forecast: Forecast | undefined;
  locale: Locale;
  actualLabel: string;
  forecastLabel: string;
  rangeLabel: string;
}) {
  const points = history.slice(-14).map((p) => ({
    date: p.date,
    actual: p.value,
    forecast: undefined as number | undefined,
    band: undefined as [number, number] | undefined,
  }));
  if (points.length && forecast?.points.length)
    points[points.length - 1].forecast = points[points.length - 1].actual;
  const rows = [
    ...points,
    ...(forecast?.points ?? []).map((p) => ({
      date: p.date,
      actual: undefined as number | undefined,
      forecast: p.value,
      band:
        p.lower === null || p.upper === null
          ? undefined
          : ([p.lower, p.upper] as [number, number]),
    })),
  ];
  return (
    <div className="demand-chart">
      <ResponsiveContainer width="100%" height={230}>
        <ComposedChart
          data={rows}
          margin={{ left: -24, right: 12, top: 10, bottom: 0 }}
        >
          <defs>
            <linearGradient id="forecastBand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6c91c4" stopOpacity={0.16} />
              <stop offset="100%" stopColor="#6c91c4" stopOpacity={0.04} />
            </linearGradient>
            <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#168f79" stopOpacity={0.12} />
              <stop offset="100%" stopColor="#168f79" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="#edf0f0"
            strokeDasharray="3 4"
          />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            minTickGap={28}
            tick={{ fill: "#8a939c", fontSize: 10 }}
            tickFormatter={(v) =>
              new Intl.DateTimeFormat(locale, {
                month: "short",
                day: "numeric",
              }).format(new Date(v))
            }
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#8a939c", fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{
              border: "1px solid #e7ebea",
              borderRadius: 9,
              fontSize: 12,
            }}
            labelFormatter={(v) => String(v)}
            formatter={(value, name) =>
              name === "band"
                ? [
                    Array.isArray(value) ? `${value[0]}–${value[1]}` : value,
                    rangeLabel,
                  ]
                : [value, name === "actual" ? actualLabel : forecastLabel]
            }
          />
          <Area
            type="monotone"
            dataKey="band"
            fill="url(#forecastBand)"
            stroke="none"
          />
          <Area
            type="monotone"
            dataKey="actual"
            fill="url(#actualFill)"
            stroke="#168f79"
            strokeWidth={2.5}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="forecast"
            stroke="#7699c4"
            strokeWidth={2.5}
            strokeDasharray="5 4"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
