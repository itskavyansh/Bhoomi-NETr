import { Bell } from "lucide-react";
import { AlertHistoryPanel } from "../components/AlertHistoryPanel";

export function Alerts() {
  return (
    <main className="dashboard-shell py-10 lg:py-12">
      <header className="mb-8">
        <p className="eyebrow mb-2">Event stream</p>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-300/10 text-amber-200">
            <Bell className="h-5 w-5" aria-hidden="true" />
          </span>
          <h1 className="page-title">Alert history</h1>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Review status transitions and warning events across the monitored network.</p>
      </header>
      <div className="mx-auto max-w-5xl">
        <AlertHistoryPanel showFilters />
      </div>
    </main>
  );
}
