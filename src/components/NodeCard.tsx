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
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 group-hover:scale-[1.01] group-hover:shadow-lg">
      <header className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-wide text-slate-800">
          NODE {reading.node_id}
        </h2>
        <StatusBadge status={reading.status} />
      </header>

      <div className="grid grid-cols-2 gap-3">
        <MetricTile label="Tilt" value={reading.tilt_x} unit="°" />
        <MetricTile label="Vibration" value={reading.vibration} unit="g" />
        <MetricTile label="Distance" value={reading.distance} unit="cm" />
        <MetricTile
          label="Displacement"
          value={reading.displacement}
          unit="cm"
        />
      </div>

      {reading.warnings.length > 0 && (
        <ul className="mt-5 list-disc space-y-1 pl-5 text-sm text-red-600">
          {sortWarnings(reading.warnings).map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
    </article>
  );
}
