import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--breadcrumb-normal)]">
        <li>
          <Link
            to="/"
            className="inline-flex items-center gap-1 font-medium text-[var(--breadcrumb-normal)] hover:text-[var(--brand-green)] transition-colors"
          >
            <Home className="h-3.5 w-3.5 text-[var(--breadcrumb-normal)]" aria-hidden="true" />
            Home
          </Link>
        </li>
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={idx} className="flex items-center gap-1.5">
              <ChevronRight className="h-3 w-3 shrink-0 text-[var(--breadcrumb-separator)]" aria-hidden="true" />
              {item.to && !isLast ? (
                <Link
                  to={item.to}
                  className="font-medium text-[var(--breadcrumb-normal)] hover:text-[var(--brand-green)] transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={isLast ? "font-semibold text-[var(--breadcrumb-current)]" : "font-medium text-[var(--breadcrumb-normal)]"}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// Helper hook — returns breadcrumb items based on current path
// eslint-disable-next-line react-refresh/only-export-components
export function useAutoBreadcrumb(): BreadcrumbItem[] {
  const location = useLocation();
  const pathMap: Record<string, BreadcrumbItem[]> = {
    "/dashboard":         [{ label: "Monitoring" }, { label: "Live Dashboard" }],
    "/structural-health": [{ label: "Analysis" },   { label: "Structural Health" }],
    "/risk-score":        [{ label: "Analysis" },   { label: "Risk Score" }],
    "/trend-analysis":    [{ label: "Analysis" },   { label: "Trend Analysis" }],
    "/alerts":            [{ label: "Monitoring" }, { label: "Alert History" }],
  };
  // node detail handled separately
  return pathMap[location.pathname] ?? [];
}
