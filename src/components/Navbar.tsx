import { Activity, LineChart, Menu, ShieldCheck, TrendingUp, X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    {
      to: "/dashboard",
      label: "Live Dashboard",
      icon: Activity,
    },
    {
      to: "/structural-health",
      label: "Structural Health",
      icon: ShieldCheck,
    },
    {
      to: "/risk-score",
      label: "Risk Score",
      icon: TrendingUp,
    },
    {
      to: "/trend-analysis",
      label: "Trend Analysis",
      icon: LineChart,
    },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-surface-border bg-surface-panel/95 backdrop-blur-md shadow-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link
              to="/"
              className="flex items-center gap-2 transition hover:opacity-80"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Activity className="h-6 w-6 text-teal-500" aria-hidden="true" />
              <span className="text-lg font-bold tracking-tight text-slate-100">
                BHOOMI<span className="text-teal-500">-NETr</span>
              </span>
            </Link>
          </div>

          {/* Desktop Navigation Buttons */}
          <div className="hidden md:flex md:items-center md:gap-1.5">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.to;

              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
                    isActive
                      ? "bg-teal-600/20 text-teal-400 border border-teal-500/30"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-teal-400" : "text-slate-400"}`} />
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="flex md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center rounded-md p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white focus:outline-hidden"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="border-b border-surface-border bg-surface-panel px-4 pb-4 pt-2 md:hidden">
          <div className="flex flex-col gap-1.5">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.to;

              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? "bg-teal-600/20 text-teal-400 border border-teal-500/30"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-teal-400" : "text-slate-400"}`} />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}

