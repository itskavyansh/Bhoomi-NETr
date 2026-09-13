import { Activity, Bell, LineChart, Menu, ShieldCheck, TrendingUp, X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { to: "/dashboard", label: "Live dashboard", icon: Activity },
    { to: "/structural-health", label: "Structural health", icon: ShieldCheck },
    { to: "/risk-score", label: "Risk score", icon: TrendingUp },
    { to: "/trend-analysis", label: "Trend analysis", icon: LineChart },
    { to: "/alerts", label: "Alert history", icon: Bell },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-surface-border/80 bg-[#091827]/90 shadow-[0_8px_30px_rgba(0,0,0,0.16)] backdrop-blur-xl">
      <div className="dashboard-shell">
        <div className="flex min-h-[4.5rem] items-center justify-between gap-6">
          <Link to="/" className="group flex shrink-0 items-center gap-3" onClick={() => setMobileMenuOpen(false)} aria-label="BHOOMI-NETr home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-teal-400/25 bg-teal-400/10 text-teal-300 transition group-hover:bg-teal-400/15">
              <Activity className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <span className="text-[1.05rem] font-bold tracking-tight text-slate-100">BHOOMI<span className="text-teal-300">-NETr</span></span>
          </Link>

          <div className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.to;
              return (
                <Link key={link.to} to={link.to} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[0.76rem] font-semibold transition ${isActive ? "border-teal-300/20 bg-teal-300/10 text-teal-200" : "border-transparent text-slate-400 hover:border-surface-border hover:bg-white/[0.03] hover:text-slate-100"}`}>
                  <Icon className={`h-4 w-4 ${isActive ? "text-teal-300" : "text-slate-500"}`} aria-hidden="true" />
                  {link.label}
                </Link>
              );
            })}
          </div>

          <button type="button" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="rounded-lg border border-surface-border p-2 text-slate-400 transition hover:bg-white/[0.04] hover:text-slate-100 lg:hidden" aria-label="Toggle navigation menu">
            {mobileMenuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-surface-border/70 bg-[#0b1b2c] px-5 pb-4 pt-3 lg:hidden">
          <div className="grid gap-1 sm:grid-cols-2">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.to;
              return <Link key={link.to} to={link.to} onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold ${isActive ? "bg-teal-300/10 text-teal-200" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"}`}><Icon className="h-4 w-4" aria-hidden="true" />{link.label}</Link>;
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
