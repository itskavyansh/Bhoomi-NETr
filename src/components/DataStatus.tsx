import { Loader2 } from "lucide-react";

interface DataStatusProps {
  loading: boolean;
  error: string | null;
  loadingLabel?: string;
}

export function DataStatus({
  loading,
  error,
  loadingLabel = "Loading nodes…",
}: DataStatusProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm font-medium text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin text-teal-600" aria-hidden="true" />
        {loadingLabel}
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-700">
        {error}
      </p>
    );
  }

  return null;
}
