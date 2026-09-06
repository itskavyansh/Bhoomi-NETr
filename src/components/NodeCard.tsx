import type { SensorReading } from "../types/sensor";
import { MetricTile } from "./MetricTile";
import { StatusBadge } from "./StatusBadge";

interface NodeCardProps {
  reading: SensorReading;
}

// Real severity sorting would rank CRITICAL-associated codes above WARNING-only
// codes once Person 2 publishes per-warning severity. Current codes are equal.
const WARNING_SEVERITY: Record<string, number> = {
  EXCESSIVE_TILT: 1,
  HIGH_VIBRATION: 1,
  ABNORMAL_DISPLACEMENT: 1,
};

function sortWarnings(warnings: string[]): string[] {
  return [...warnings].sort(
    (a, b) => (WARNING_SEVERITY[b] ?? 0) - (WARNING_SEVERITY[a] ?? 0),
  );
}

export function NodeCard({ reading }: NodeCardProps) {
  // Determine background and border colors based on status
  const cardStyleClass = 
    reading.status === "CRITICAL" ? "bg-status-critical-tint border-status-critical shadow-status-critical-bg animate-critical-border" : 
    reading.status === "WARNING" ? "bg-status-watch-tint border-status-watch" : 
    "bg-surface-card border-surface-border";

  const tiltFlags = reading.warnings.filter(w => w === "EXCESSIVE_TILT");
  const vibrationFlags = reading.warnings.filter(w => w === "HIGH_VIBRATION");
  const displacementFlags = reading.warnings.filter(w => w === "ABNORMAL_DISPLACEMENT");
  
  const unmappedWarnings = reading.warnings.filter(w => 
    w !== "EXCESSIVE_TILT" && 
    w !== "HIGH_VIBRATION" && 
    w !== "ABNORMAL_DISPLACEMENT"
  );

  return (
    <article className={`rounded-xl border p-6 shadow-lg shadow-black/40 transition-all duration-300 hover:scale-[1.02] hover:brightness-110 flex flex-col h-full ${cardStyleClass}`}>
      <header className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold tracking-wider text-slate-100">
          NODE {reading.node_id}
        </h2>
        <StatusBadge status={reading.status} />
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 flex-1">
        <MetricTile label="Tilt X" value={reading.tilt_x} unit="°" activeFlags={Math.abs(reading.tilt_x) >= 15 ? tiltFlags : []} />
        <MetricTile label="Tilt Y" value={reading.tilt_y} unit="°" activeFlags={Math.abs(reading.tilt_y) >= 15 ? tiltFlags : []} />
        <MetricTile label="Vibration" value={reading.vibration} unit="g" activeFlags={vibrationFlags} />
        <MetricTile label="Distance" value={reading.distance} unit="cm" />
        <MetricTile
          label="Displacement"
          value={reading.displacement}
          unit="cm"
          activeFlags={displacementFlags}
        />
      </div>

      {unmappedWarnings.length > 0 && (
        <ul className="mt-5 list-disc space-y-1 pl-5 text-sm font-medium text-status-critical">
          {sortWarnings(unmappedWarnings).map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
    </article>
  );
}
