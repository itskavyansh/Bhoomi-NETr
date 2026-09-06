export function LiveIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-mono font-bold tracking-wider text-status-normal">
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-normal opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-status-normal" />
      </span>
      LIVE
    </span>
  );
}
