interface MetricTileProps {
  label: string;
  value: number;
  unit: string;
  size?: "md" | "lg";
}

export function MetricTile({
  label,
  value,
  unit,
  size = "md",
}: MetricTileProps) {
  const isLarge = size === "lg";

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-slate-50 ${
        isLarge ? "px-6 py-5" : "px-4 py-3"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p
        className={`mt-1 font-bold text-slate-900 ${
          isLarge ? "text-3xl" : "text-xl"
        }`}
      >
        {value}
        <span
          className={`ml-1 font-semibold text-slate-700 ${
            isLarge ? "text-lg" : "text-base"
          }`}
        >
          {unit}
        </span>
      </p>
    </div>
  );
}
