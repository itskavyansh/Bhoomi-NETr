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

export type MetricKey =
  | "tilt_x"
  | "tilt_y"
  | "vibration"
  | "distance"
  | "displacement"
  | "risk_score"
  | "piezo_peak"
  | "piezo_rms"
  | "piezo_peak_to_peak";

interface TrendChartProps {
  data: TimePoint[];
  dataKey: MetricKey;
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
    return `— ${unit}`.trim();
  }
  return unit ? `${numeric} ${unit}` : `${numeric}`;
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

  if (dataKey === "tilt_x" || dataKey === "tilt_y") {
    warnThreshold = TILT_WARNING;
    critThreshold = TILT_CRITICAL;
  } else if (dataKey === "vibration") {
    warnThreshold = VIBRATION_WARNING;
    critThreshold = VIBRATION_CRITICAL;
  } else if (dataKey === "displacement") {
    warnThreshold = DISPLACEMENT_WARNING;
    critThreshold = DISPLACEMENT_CRITICAL;
  } else if (dataKey === "risk_score") {
    warnThreshold = 40;
    critThreshold = 80;
  }

  return (
    <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4 sm:p-5 shadow-xs min-w-0 transition-colors">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold tracking-tight text-[var(--text-primary)] truncate">{label}</h3>
        <span className="h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-[var(--card-border)]" style={{ backgroundColor: color }} />
      </div>
      <div className="h-64 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 28, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatClock}
              tick={{ fontSize: 11, fill: "var(--chart-labels)", fontFamily: '"JetBrains Mono", monospace' }}
              tickLine={{ stroke: "var(--chart-axis)" }}
              axisLine={{ stroke: "var(--chart-axis)" }}
              minTickGap={32}
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fontSize: 11, fill: "var(--chart-labels)", fontFamily: '"JetBrains Mono", monospace' }}
              tickLine={{ stroke: "var(--chart-axis)" }}
              axisLine={{ stroke: "var(--chart-axis)" }}
              label={{
                value: unit,
                angle: -90,
                position: "insideLeft",
                style: { fill: "var(--chart-labels)", fontSize: 11, textAnchor: "middle" },
              }}
            />
            {warnThreshold !== undefined && (
              <ReferenceLine 
                y={warnThreshold} 
                stroke="var(--status-warning)" 
                strokeDasharray="3 3" 
                strokeOpacity={0.8}
                label={{ position: 'insideTopLeft', value: `Warn (${warnThreshold})`, fill: 'var(--status-warning)', fontSize: 10, fontFamily: '"JetBrains Mono", monospace' }}
              />
            )}
            {critThreshold !== undefined && (
              <ReferenceLine 
                y={critThreshold} 
                stroke="var(--status-danger)" 
                strokeDasharray="3 3" 
                strokeOpacity={0.8}
                label={{ position: 'insideTopLeft', value: `Crit (${critThreshold})`, fill: 'var(--status-danger)', fontSize: 10, fontFamily: '"JetBrains Mono", monospace' }}
              />
            )}
            <Tooltip
              contentStyle={{ backgroundColor: "var(--chart-tooltip-bg)", borderColor: "var(--chart-tooltip-border)", color: "var(--chart-tooltip-text)", borderRadius: "0.375rem", boxShadow: "0 4px 14px rgba(0,0,0,0.2)" }}
              itemStyle={{ color: "var(--chart-tooltip-text)", fontFamily: '"JetBrains Mono", monospace', fontWeight: "bold" }}
              labelStyle={{ color: "var(--chart-labels)", marginBottom: "4px" }}
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
                if (index === data.length - 1 && cx != null && cy != null) {
                  return <circle key="latest" cx={cx} cy={cy} r={4} fill={color} stroke="none" />;
                }
                return null;
              }}
              activeDot={{ r: 6, fill: color, stroke: "var(--card-bg)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
