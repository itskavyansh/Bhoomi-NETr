export function LiveIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700">
      <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-green-400" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
      </span>
      Live
    </span>
  );
}
