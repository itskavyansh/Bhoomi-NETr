import { useState } from "react";
import { Link } from "react-router-dom";
import { useAlertHistory } from "../hooks/useAlertHistory";

interface AlertHistoryPanelProps {
  nodeId?: string;
  showFilters?: boolean;
}

export function AlertHistoryPanel({ nodeId, showFilters = false }: AlertHistoryPanelProps) {
  const { transitions, loading, error } = useAlertHistory(nodeId);
  const [filter, setFilter] = useState<"ALL" | "WARNING" | "CRITICAL">("ALL");

  const counts = {
    ALL: transitions.length,
    WARNING: transitions.filter((t) => t.to_status === "WARNING" || t.from_status === "WARNING").length,
    CRITICAL: transitions.filter((t) => t.to_status === "CRITICAL" || t.from_status === "CRITICAL").length,
  };

  const filteredTransitions = transitions.filter((t) => {
    if (filter === "ALL") return true;
    if (filter === "WARNING") return t.to_status === "WARNING" || t.from_status === "WARNING";
    if (filter === "CRITICAL") return t.to_status === "CRITICAL" || t.from_status === "CRITICAL";
    return true;
  });

  return (
    <div className="flex h-full flex-col rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] shadow-xs min-w-0 transition-colors">
      <div className="border-b border-[var(--border)] p-5 min-w-0">
        <p className="eyebrow mb-1">Event stream</p>
        <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
          Alert History
        </h2>
        {showFilters && !loading && !error && (
          <div className="mt-4 flex flex-wrap gap-2">
            {(["ALL", "WARNING", "CRITICAL"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  filter === f
                    ? "border border-[var(--brand-green)] bg-[var(--brand-green)]/15 text-[var(--brand-green)]"
                    : "border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text-secondary)] hover:border-[var(--brand-green)] hover:text-[var(--brand-green)]"
                }`}
              >
                {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()} 
                <span className="ml-1 opacity-75 font-normal">({counts[f]})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar p-5 min-w-0">
        {loading && <p className="text-sm text-[var(--text-muted)]">Loading history...</p>}
        {error && <p className="text-sm text-[var(--status-danger)]">{error}</p>}

        {!loading && !error && filteredTransitions.length === 0 && (
          <p className="text-sm text-[var(--text-muted)]">No alert transitions found.</p>
        )}

        {!loading && !error && filteredTransitions.length > 0 && (
          <div className="flex flex-col gap-3.5 min-w-0">
            {filteredTransitions.map((t) => {
              const isEscalation = (t.from_status === "NORMAL" && (t.to_status === "WARNING" || t.to_status === "CRITICAL")) || 
                                   (t.from_status === "WARNING" && t.to_status === "CRITICAL");
              const isResolution = t.to_status === "NORMAL";

              let borderColor = "border-[var(--border)] border-l-4 border-l-[var(--brand-teal)] bg-[var(--surface-alt)]";
              let textColor = "text-[var(--text-primary)]";
              let iconBg = "bg-[var(--surface-muted)] text-[var(--text-muted)]";
              let icon = "•";

              if (t.to_status === "CRITICAL" || t.from_status === "CRITICAL") {
                borderColor = "border-[var(--alert-critical-border)] border-l-4 border-l-[var(--alert-critical-accent)] bg-[var(--alert-critical-bg)]";
                textColor = "text-[var(--alert-critical-text)]";
                iconBg = "bg-[var(--alert-critical-text)]/15 text-[var(--alert-critical-text)]";
                icon = "!";
              } else if (t.to_status === "WARNING" || t.from_status === "WARNING") {
                borderColor = "border-[var(--alert-warning-border)] border-l-4 border-l-[var(--alert-warning-accent)] bg-[var(--alert-warning-bg)]";
                textColor = "text-[var(--alert-warning-text)]";
                iconBg = "bg-[var(--alert-warning-text)]/15 text-[var(--alert-warning-text)]";
                icon = "⚠";
              }

              if (isResolution) {
                borderColor = "border-[var(--alert-success-border)] border-l-4 border-l-[var(--alert-success-accent)] bg-[var(--alert-success-bg)]";
                textColor = "text-[var(--alert-success-text)]";
                iconBg = "bg-[var(--alert-success-text)]/15 text-[var(--alert-success-text)]";
                icon = "✓";
              }

              return (
                <div 
                  key={t.id} 
                  className={`flex items-start gap-3 rounded-lg border ${borderColor} p-3.5 transition hover:shadow-xs min-w-0`}
                >
                  <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${iconBg}`}>
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      {!nodeId && (
                        <h3 className="text-sm font-bold text-[var(--text-primary)]">
                          <Link to={`/node/${t.node_id}`} className="hover:text-[var(--brand-green)] hover:underline focus:outline-none">
                            Node {t.node_id}
                          </Link>
                        </h3>
                      )}
                      <span className={`font-mono text-xs text-[var(--text-muted)] ${nodeId ? "w-full" : ""}`}>
                        {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        {' '}
                        {new Date(t.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    
                    <div className="mt-1 text-xs">
                      {isEscalation && (
                        <span className={textColor}>
                          Escalated from {t.from_status} to <span className="font-bold">{t.to_status}</span>
                        </span>
                      )}
                      {isResolution && (
                        <span className={textColor}>
                          Resolved to <span className="font-bold">NORMAL</span> (was {t.from_status})
                        </span>
                      )}
                      {!isEscalation && !isResolution && (
                        <span className={textColor}>
                          Transitioned from {t.from_status} to <span className="font-bold">{t.to_status}</span>
                        </span>
                      )}
                    </div>

                    {t.warnings.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5 min-w-0">
                        {t.warnings.map(w => (
                          <span key={w} className="rounded bg-[var(--surface)] border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)] shadow-xs">
                            {w.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
