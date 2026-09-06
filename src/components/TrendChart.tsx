import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import type { TimePoint } from "../types/sensor";
import {
  TILT_WARNING,
  TILT_CRITICAL,
  VIBRATION_WARNING,
  VIBRATION_CRITICAL,
  DISPLACEMENT_WARNING,
  DISPLACEMENT_CRITICAL,
} from "../services/analysisAdapter";

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
  let warnThreshold: number | undefined = undefined;
  let critThreshold: number | undefined = undefined;

  if (dataKey === "tilt_x") {
    warnThreshold = TILT_WARNING;
    critThreshold = TILT_CRITICAL;
  } else if (dataKey === "vibration") {
    warnThreshold = VIBRATION_WARNING;
    critThreshold = VIBRATION_CRITICAL;
  } else if (dataKey === "displacement") {
    warnThreshold = DISPLACEMENT_WARNING;
    critThreshold = DISPLACEMENT_CRITICAL;
  }

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-6 shadow-lg shadow-black/40">
      <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">{label}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatClock}
              tick={{ fontSize: 11, fill: "#94a3b8", fontFamily: '"JetBrains Mono", monospace' }}
              tickLine={{ stroke: "#475569" }}
              axisLine={{ stroke: "#475569" }}
              minTickGap={24}
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fontSize: 11, fill: "#94a3b8", fontFamily: '"JetBrains Mono", monospace' }}
              tickLine={{ stroke: "#475569" }}
              axisLine={{ stroke: "#475569" }}
              label={{
                value: unit,
                angle: -90,
                position: "insideLeft",
                style: { fill: "#94a3b8", fontSize: 12, textAnchor: "middle" },
              }}
            />
            {warnThreshold !== undefined && (
              <ReferenceLine 
                y={warnThreshold} 
                stroke="#f59e0b" 
                strokeDasharray="3 3" 
                strokeOpacity={0.5}
                label={{ position: 'insideTopLeft', value: `Warn (${warnThreshold})`, fill: '#f59e0b', fontSize: 10, fontFamily: '"JetBrains Mono", monospace' }}
              />
            )}
            {critThreshold !== undefined && (
              <ReferenceLine 
                y={critThreshold} 
                stroke="#ef4444" 
                strokeDasharray="3 3" 
                strokeOpacity={0.5}
                label={{ position: 'insideTopLeft', value: `Crit (${critThreshold})`, fill: '#ef4444', fontSize: 10, fontFamily: '"JetBrains Mono", monospace' }}
              />
            )}
            <Tooltip
              contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#f8fafc", borderRadius: "0.5rem" }}
              itemStyle={{ color: "#f8fafc", fontFamily: '"JetBrains Mono", monospace', fontWeight: "bold" }}
              labelStyle={{ color: "#94a3b8", marginBottom: "4px" }}
              labelFormatter={(value) => formatClock(String(value))}
              formatter={(value) => [formatTooltipValue(value, unit), label]}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              fillOpacity={1}
              fill={`url(#gradient-${dataKey})`}
              dot={(props: { cx?: number; cy?: number; index?: number }) => {
                const { cx, cy, index } = props;
                if (index === data.length - 1) {
                  return <circle key="latest" cx={cx} cy={cy} r={4} fill={color} stroke="none" />;
                }
                return <span key={index} />;
              }}
              activeDot={{ r: 6, fill: color, stroke: "#0f172a", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
