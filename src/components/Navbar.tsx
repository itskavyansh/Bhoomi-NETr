import { Activity, Menu } from "lucide-react";
import { Link } from "react-router-dom";

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-surface-border bg-surface-panel/95 backdrop-blur-md shadow-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link
              to="/"
              className="flex items-center gap-2 transition hover:opacity-80"
            >
              <Activity className="h-6 w-6 text-teal-500" aria-hidden="true" />
              <span className="text-lg font-bold tracking-tight text-slate-100">
                BHOOMI<span className="text-teal-500">-NETr</span>
              </span>
            </Link>
          </div>
          <div className="hidden sm:flex sm:gap-2">
            <Link
              to="/dashboard"
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition-all hover:bg-white/5 hover:text-white"
            >
              Live Dashboard
            </Link>
          </div>
          <div className="sm:hidden">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white focus:outline-hidden"
            >
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
