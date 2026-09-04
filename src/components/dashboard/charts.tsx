"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

const gridColor = "#e5e7eb";
const axisColor = "#6b7280";

export function InwardOutwardTrendChart({
  data,
}: {
  data: { date: string; inward: number; outward: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="fillInward" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2a78d6" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#2a78d6" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="fillOutward" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#eb6834" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#eb6834" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={{ stroke: gridColor }} />
        <YAxis tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={false} width={36} />
        <Tooltip
          contentStyle={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="inward"
          name="Inward"
          stroke="#2a78d6"
          fill="url(#fillInward)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="outward"
          name="Outward"
          stroke="#eb6834"
          fill="url(#fillOutward)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SingleSeriesTrendChart({
  data,
  label,
  color = "#2a78d6",
}: {
  data: { date: string; value: number }[];
  label: string;
  color?: string;
}) {
  const gradientId = `fill-${label.replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.35} />
            <stop offset="95%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={{ stroke: gridColor }} />
        <YAxis tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={false} width={36} />
        <Tooltip
          contentStyle={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Area type="monotone" dataKey="value" name={label} stroke={color} fill={`url(#${gradientId})`} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function StockByDimensionChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={{ stroke: gridColor }} />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={{ fontSize: 12, fill: "#374151" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Bar dataKey="value" fill="#2a78d6" radius={[0, 4, 4, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}
