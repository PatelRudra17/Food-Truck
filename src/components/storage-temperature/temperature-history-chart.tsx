"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

const gridColor = "var(--color-border)";
const axisColor = "var(--color-muted-foreground)";

export function TemperatureHistoryChart({
  data,
  minTempC,
  maxTempC,
}: {
  data: { date: string; tempC: number }[];
  minTempC: number | null;
  maxTempC: number | null;
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="fillTemp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={{ stroke: gridColor }} />
        <YAxis
          tick={{ fontSize: 11, fill: axisColor }}
          tickLine={false}
          axisLine={false}
          width={40}
          unit="°C"
          domain={["auto", "auto"]}
        />
        <Tooltip
          contentStyle={{
            background: "var(--color-popover)",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value) => [`${value}°C`, "Recorded"]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {minTempC != null && (
          <ReferenceLine
            y={minTempC}
            stroke="var(--color-chart-3)"
            strokeDasharray="4 4"
            label={{ value: `Min ${minTempC}°C`, fontSize: 11, fill: "var(--color-chart-3)", position: "insideBottomLeft" }}
          />
        )}
        {maxTempC != null && (
          <ReferenceLine
            y={maxTempC}
            stroke="var(--color-chart-4)"
            strokeDasharray="4 4"
            label={{ value: `Max ${maxTempC}°C`, fontSize: 11, fill: "var(--color-chart-4)", position: "insideTopLeft" }}
          />
        )}
        <Area
          type="monotone"
          dataKey="tempC"
          name="Recorded temperature"
          stroke="var(--color-chart-1)"
          fill="url(#fillTemp)"
          strokeWidth={2}
          dot={{ r: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
