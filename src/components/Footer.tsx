import { Activity, Mail, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { AccessibilityBar } from "./AccessibilityBar";

const YEAR = new Date().getFullYear();

/* ─── Footer link columns ─── */
const COLUMNS: Record<string, { label: string; to?: string; href?: string }[]> = {
  Monitoring: [
    { label: "Live Dashboard",    to: "/dashboard" },
    { label: "Risk Score",        to: "/risk-score" },
    { label: "Structural Health", to: "/structural-health" },
    { label: "Trend Analysis",    to: "/trend-analysis" },
    { label: "Alert History",     to: "/alerts" },
  ],
  Platform: [
    { label: "Home",              to: "/" },
    { label: "How It Works",      href: "/#how-it-works" },
    { label: "FAQ",               href: "/#faq-heading" },
  ],
  Resources: [
    { label: "README",            href: "/README.md" },
    { label: "API Reference",     href: "/API.md" },
    { label: "Schema",            href: "/schema.sql" },
  ],
  Support: [
    { label: "Contact",           href: "mailto:contact@bhoomi-netr.in" },
    { label: "Feedback",          href: "mailto:support@bhoomi-netr.in" },
  ],
};

function FooterLink({
  label,
  to,
  href,
}: {
  label: string;
  to?: string;
  href?: string;
}) {
  const cls =
    "inline-flex items-center gap-1 text-[0.8125rem] text-[var(--footer-links)] transition-colors hover:text-[var(--footer-text-primary)] hover:underline";
  if (to) {
    return (
      <Link to={to} className={cls}>
        {label}
      </Link>
    );
  }
  return (
    <a href={href} className={cls}>
      {label}
      {href && !href.startsWith("/") && !href.startsWith("#") && href !== "/" && (
        <ExternalLink className="h-3 w-3 opacity-70" aria-hidden="true" />
      )}
    </a>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 border-t border-black/20 bg-[var(--footer-bg)] text-[var(--footer-text-secondary)]">
      <div className="dashboard-shell py-12 lg:py-14">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-8">
          {/* Brand column */}
          <div className="sm:col-span-1 lg:col-span-1">
            <Link
              to="/"
              className="mb-4 inline-flex items-center gap-2"
              aria-label="BHOOMI-NETr home"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded border border-[var(--footer-accent)]/30 bg-[var(--footer-accent)]/10 text-[var(--footer-accent)]">
                <Activity className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span className="font-bold tracking-tight text-[var(--footer-text-primary)]">
                BHOOMI<span className="text-[var(--footer-accent)]">-NETr</span>
              </span>
            </Link>
            <p className="mt-3 max-w-xs text-[0.78rem] leading-relaxed text-[var(--footer-text-secondary)]">
              Real-time geospatial ground stability monitoring. Multi-sensor
              detection of subsidence, vibration, and acoustic anomalies.
            </p>
            <div className="mt-5">
              <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--footer-accent)]">
                Display & Theme
              </p>
              <div className="inline-block rounded bg-black/20 px-1 py-0.5 border border-white/10">
                <AccessibilityBar />
              </div>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(COLUMNS).map(([title, links]) => (
            <div key={title}>
              <h3 className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--footer-accent)]">
                {title}
              </h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <FooterLink {...link} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom strip */}
      <div className="border-t border-black/20">
        <div className="dashboard-shell flex flex-wrap items-center justify-between gap-4 py-4">
          <p className="text-[0.73rem] text-[var(--footer-text-secondary)] opacity-90">
            © {YEAR} BHOOMI-NETr — Ground Stability Monitoring System
          </p>
          <div className="flex flex-wrap items-center gap-4 text-[0.73rem] text-[var(--footer-text-secondary)]">
            <a
              href="mailto:support@bhoomi-netr.in"
              className="inline-flex items-center gap-1 text-[var(--footer-links)] hover:text-[var(--footer-text-primary)] transition-colors"
            >
              <Mail className="h-3 w-3" aria-hidden="true" />
              Support
            </a>
            <span aria-hidden="true">·</span>
            <span className="opacity-90">Built with Supabase Realtime</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
