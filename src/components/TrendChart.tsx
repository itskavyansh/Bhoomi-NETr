import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TimePoint } from "../types/sensor";

interface TrendChartProps {
  data: TimePoint[];
  dataKey: "tilt_x" | "vibration" | "displacement";
  label: string;
  unit: string;
  color: string;
}

function formatClock(iso: string): string {
  const date = new Date(iso);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function formatTooltipValue(value: unknown, unit: string): string {
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric)) {
    return `— ${unit}`;
  }
  return `${numeric} ${unit}`;
}

export function TrendChart({
  data,
  dataKey,
  label,
  unit,
  color,
}: TrendChartProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-bold text-slate-800">{label}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatClock}
              tick={{ fontSize: 11, fill: "#64748b" }}
              minTickGap={24}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#64748b" }}
              label={{
                value: unit,
                angle: -90,
                position: "insideLeft",
                style: { fill: "#64748b", fontSize: 12, textAnchor: "middle" },
              }}
            />
            <Tooltip
              labelFormatter={(value) => formatClock(String(value))}
              formatter={(value) => [formatTooltipValue(value, unit), label]}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
