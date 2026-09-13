import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  ChevronDown,
  LayoutDashboard,
  LineChart,
  Menu,
  Radio,
  Search,
  ShieldCheck,
  TrendingUp,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AccessibilityBar } from "./AccessibilityBar";

/* ─── Dropdown data (all existing routes) ─── */
const MONITORING_LINKS = [
  {
    to: "/dashboard",
    icon: LayoutDashboard,
    label: "Live Dashboard",
    desc: "Real-time node overview",
  },
  {
    to: "/alerts",
    icon: Bell,
    label: "Alert History",
    desc: "Status transitions & events",
  },
  {
    to: "/structural-health",
    icon: ShieldCheck,
    label: "Structural Health",
    desc: "Sensor confidence & hardware",
  },
  {
    to: "/risk-score",
    icon: AlertTriangle,
    label: "Risk Score",
    desc: "Subsidence risk evaluation",
  },
];

const ANALYSIS_LINKS = [
  {
    to: "/trend-analysis",
    icon: LineChart,
    label: "Trend Analysis",
    desc: "Historical patterns & prediction",
  },
  {
    to: "/risk-score",
    icon: TrendingUp,
    label: "Risk Score",
    desc: "Multi-sensor risk index",
  },
  {
    to: "/structural-health",
    icon: BarChart3,
    label: "Structural Health",
    desc: "Node telemetry integrity",
  },
];

type DropdownItem = {
  to: string;
  icon: React.FC<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  label: string;
  desc: string;
};

/* ─── Dropdown panel ─── */
function NavDropdown({
  items,
  onClose,
}: {
  items: DropdownItem[];
  onClose: () => void;
}) {
  return (
    <div className="nav-dropdown" role="menu">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.to + item.label}
            to={item.to}
            role="menuitem"
            onClick={onClose}
            className="group"
          >
            <Icon
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-green)]"
              aria-hidden="true"
            />
            <span className="min-w-0">
              <span className="block text-[0.8125rem] font-semibold text-[var(--text-primary)] group-hover:text-[var(--brand-green)] transition-colors">
                {item.label}
              </span>
              <span className="block text-[0.71rem] leading-tight text-[var(--text-muted)]">
                {item.desc}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/* ─── Nav link / button shared class builder ─── */
function navItemClass(active: boolean) {
  return `inline-flex items-center gap-1.5 rounded px-3 py-2 text-[0.8rem] font-semibold transition-colors ${
    active
      ? "bg-black/20 text-[var(--nav-main-text)] shadow-xs font-bold border-b-2 border-[var(--nav-active-indicator)]"
      : "text-white/80 hover:bg-white/10 hover:text-white"
  }`;
}

/* ══════════════════════════════════════════════════════════════ */
/* Navbar                                                          */
/* ══════════════════════════════════════════════════════════════ */
export function Navbar() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen]     = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [searchOpen, setSearchOpen]     = useState(false);
  const [searchQuery, setSearchQuery]   = useState("");
  const headerRef = useRef<HTMLElement>(null);

  /* Close dropdown on outside click */
  useEffect(() => {
    function onPointer(e: PointerEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, []);

  /* Close everything on navigation */
  useEffect(() => {
    setMobileOpen(false);
    setOpenDropdown(null);
    setSearchOpen(false);
    setSearchQuery("");
  }, [location.pathname]);

  /* Close dropdown with Escape */
  useEffect(() => {
    if (!openDropdown) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenDropdown(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openDropdown]);

  const toggle = (name: string) =>
    setOpenDropdown((prev) => (prev === name ? null : name));

  const monitoringActive = [
    "/dashboard", "/alerts", "/structural-health", "/risk-score",
  ].includes(location.pathname);

  const analysisActive = [
    "/trend-analysis", "/risk-score", "/structural-health",
  ].includes(location.pathname);

  return (
    <header ref={headerRef} className="sticky top-0 z-50" role="banner">
      {/* Skip link */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* ── Tier 1: Institutional strip ── */}
      <div
        className="border-b border-[var(--nav-top-border)] bg-[var(--nav-top-bg)] text-[var(--nav-top-text)] transition-colors duration-200"
        aria-hidden="false"
      >
        <div className="dashboard-shell flex min-h-[34px] items-center justify-between gap-2 sm:gap-4 py-1">
          <div className="flex items-center gap-2 min-w-0">
            <Radio
              className="h-2.5 w-2.5 shrink-0 text-[var(--brand-green)]"
              aria-hidden="true"
            />
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--nav-top-text)] truncate">
              <span className="hidden sm:inline">National Ground Stability Monitoring Network</span>
              <span className="sm:hidden">NGSMN · BHOOMI-NETr</span>
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <AccessibilityBar compact />
          </div>
        </div>
      </div>

      {/* ── Tier 2: Main nav ── */}
      <nav
        className="border-b border-[var(--border)] bg-[var(--nav-main-bg)] text-[var(--nav-main-text)] shadow-md transition-colors duration-200"
        aria-label="Main navigation"
      >
        <div className="dashboard-shell">
          <div className="flex min-h-[54px] items-center justify-between gap-4">

            {/* Brand */}
            <Link
              to="/"
              className="group flex shrink-0 items-center gap-2.5 py-1"
              aria-label="BHOOMI-NETr — Go to homepage"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded border border-white/20 bg-white/10 text-white transition-colors group-hover:bg-white/20">
                <Activity className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="leading-none">
                <span className="block text-[0.9375rem] font-extrabold tracking-tight text-white">
                  BHOOMI
                  <span className="text-emerald-300">-NETr</span>
                </span>
                <span className="mt-0.5 hidden text-[0.58rem] font-semibold uppercase tracking-[0.13em] text-emerald-200/90 sm:block">
                  Ground Monitoring System
                </span>
              </div>
            </Link>

            {/* Desktop links */}
            <div
              className="hidden items-center gap-1 lg:flex"
              role="menubar"
              aria-label="Primary navigation"
            >
              <Link
                to="/"
                role="menuitem"
                className={navItemClass(location.pathname === "/")}
              >
                Home
              </Link>

              {/* Monitoring dropdown */}
              <div className="relative" role="none">
                <button
                  type="button"
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded={openDropdown === "monitoring"}
                  onClick={() => toggle("monitoring")}
                  className={navItemClass(monitoringActive)}
                >
                  Monitoring
                  <ChevronDown
                    className={`h-3 w-3 transition-transform duration-150 ${
                      openDropdown === "monitoring" ? "rotate-180" : ""
                    }`}
                    aria-hidden="true"
                  />
                </button>
                {openDropdown === "monitoring" && (
                  <NavDropdown
                    items={MONITORING_LINKS}
                    onClose={() => setOpenDropdown(null)}
                  />
                )}
              </div>

              {/* Analysis dropdown */}
              <div className="relative" role="none">
                <button
                  type="button"
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded={openDropdown === "analysis"}
                  onClick={() => toggle("analysis")}
                  className={navItemClass(analysisActive)}
                >
                  Analysis
                  <ChevronDown
                    className={`h-3 w-3 transition-transform duration-150 ${
                      openDropdown === "analysis" ? "rotate-180" : ""
                    }`}
                    aria-hidden="true"
                  />
                </button>
                {openDropdown === "analysis" && (
                  <NavDropdown
                    items={ANALYSIS_LINKS}
                    onClose={() => setOpenDropdown(null)}
                  />
                )}
              </div>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-1.5">
              {/* Search */}
              <button
                type="button"
                onClick={() => setSearchOpen((v) => !v)}
                className="rounded p-2 text-emerald-100 hover:bg-white/10 hover:text-white transition-colors"
                aria-label={searchOpen ? "Close search" : "Open search"}
                aria-expanded={searchOpen}
              >
                {searchOpen ? (
                  <X className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Search className="h-4 w-4" aria-hidden="true" />
                )}
              </button>

              {/* Live badge */}
              <Link
                to="/dashboard"
                className="hidden items-center gap-1.5 rounded border border-white/25 bg-white/10 px-2.5 py-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-white transition hover:bg-white/20 lg:inline-flex"
                aria-label="Live monitoring dashboard"
              >
                <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-80" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
                </span>
                Live
              </Link>

              {/* Mobile toggle */}
              <button
                type="button"
                onClick={() => setMobileOpen(!mobileOpen)}
                className="rounded border border-emerald-700/60 p-2 text-emerald-100 transition hover:bg-white/10 hover:text-white lg:hidden"
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileOpen}
                aria-controls="mobile-nav"
              >
                {mobileOpen ? (
                  <X className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Menu className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {/* Inline search bar */}
          {searchOpen && (
            <div className="border-t border-white/20 py-3 animate-slide-down">
              <div className="relative max-w-md">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--input-placeholder)]"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  placeholder="Find monitoring views, nodes, analysis…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] py-2 pl-9 pr-4 text-sm text-[var(--input-text)] placeholder-[var(--input-placeholder)] focus:border-[var(--brand-teal)] focus:ring-1 focus:ring-[var(--brand-teal)] focus:outline-none"
                  aria-label="Search the platform"
                />
              </div>
              {searchQuery.trim().length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    { label: "Live Dashboard", to: "/dashboard" },
                    { label: "Alert History", to: "/alerts" },
                    { label: "Risk Score", to: "/risk-score" },
                    { label: "Trend Analysis", to: "/trend-analysis" },
                    { label: "Structural Health", to: "/structural-health" },
                  ].map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => {
                        setSearchOpen(false);
                        setSearchQuery("");
                      }}
                      className="rounded border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[0.75rem] font-medium text-[var(--text-secondary)] hover:border-[var(--brand-green)] hover:text-[var(--brand-green)] shadow-xs transition-colors"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <nav
          id="mobile-nav"
          className="border-b border-black/20 bg-[var(--nav-main-bg)] px-5 pb-6 pt-4 text-[var(--nav-main-text)] lg:hidden animate-slide-down"
          aria-label="Mobile navigation"
        >
          {/* Home */}
          <Link
            to="/"
            onClick={() => setMobileOpen(false)}
            className={`mb-3 flex items-center gap-2 rounded px-3 py-2 text-sm font-semibold ${
              location.pathname === "/"
                ? "bg-white/15 text-white font-bold"
                : "text-white/80 hover:text-white hover:bg-white/10"
            }`}
          >
            Home
          </Link>

          <div className="mb-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[var(--nav-active)]">
            Monitoring
          </div>
          <div className="mb-4 grid gap-0.5">
            {MONITORING_LINKS.map((link) => {
              const Icon = link.icon;
              const active = location.pathname === link.to;
              return (
                <Link
                  key={link.to + link.label}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2.5 rounded px-3 py-2.5 text-sm font-semibold ${
                    active
                      ? "bg-white/15 text-white font-bold"
                      : "text-white/85 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0 text-[var(--nav-active)]" aria-hidden="true" />
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="mb-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[var(--nav-active)]">
            Analysis
          </div>
          <div className="grid gap-0.5">
            {ANALYSIS_LINKS.slice(0, 1).map((link) => {
              const Icon = link.icon;
              const active = location.pathname === link.to;
              return (
                <Link
                  key={link.to + link.label}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2.5 rounded px-3 py-2.5 text-sm font-semibold ${
                    active
                      ? "bg-white/15 text-white font-bold"
                      : "text-white/85 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0 text-[var(--nav-active)]" aria-hidden="true" />
                  Trend Analysis
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
