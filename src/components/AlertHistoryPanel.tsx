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
    <div className="flex h-full flex-col rounded-xl border border-surface-border bg-surface-card shadow-lg shadow-black/40">
      <div className="border-b border-surface-border p-5">
        <h2 className="text-xl font-bold tracking-tight text-slate-100">
          Alert History
        </h2>
        {showFilters && !loading && !error && (
          <div className="mt-4 flex flex-wrap gap-2">
            {(["ALL", "WARNING", "CRITICAL"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filter === f
                    ? "bg-slate-700 text-white"
                    : "bg-surface-tile text-slate-400 hover:bg-white/5 hover:text-slate-300"
                }`}
              >
                {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()} 
                <span className="ml-1 opacity-60">({counts[f]})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar p-5">
        {loading && <p className="text-sm text-slate-400">Loading history...</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {!loading && !error && filteredTransitions.length === 0 && (
          <p className="text-sm text-slate-400">No alert transitions found.</p>
        )}

        {!loading && !error && filteredTransitions.length > 0 && (
          <div className="flex flex-col gap-4">
            {filteredTransitions.map((t) => {
              const isEscalation = (t.from_status === "NORMAL" && (t.to_status === "WARNING" || t.to_status === "CRITICAL")) || 
                                   (t.from_status === "WARNING" && t.to_status === "CRITICAL");
              const isResolution = t.to_status === "NORMAL";

              let borderColor = "border-surface-border";
              let textColor = "text-slate-200";
              let icon = "•";

              if (t.to_status === "CRITICAL" || t.from_status === "CRITICAL") {
                borderColor = "border-red-500/30";
                textColor = "text-red-400";
                icon = "!";
              } else if (t.to_status === "WARNING" || t.from_status === "WARNING") {
                borderColor = "border-amber-500/30";
                textColor = "text-amber-400";
                icon = "⚠";
              }

              if (isResolution) {
                borderColor = "border-teal-500/30";
                textColor = "text-teal-400";
                icon = "✓";
              }

              return (
                <div 
                  key={t.id} 
                  className={`flex items-start gap-3 rounded-lg border ${borderColor} bg-surface-tile p-3`}
                >
                  <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-card text-xs font-bold ${textColor}`}>
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      {!nodeId && (
                        <h3 className="text-sm font-bold text-slate-200">
                          <Link to={`/node/${t.node_id}`} className="hover:underline focus:outline-none">
                            Node {t.node_id}
                          </Link>
                        </h3>
                      )}
                      <span className={`font-mono text-xs text-slate-400 ${nodeId ? "w-full" : ""}`}>
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
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {t.warnings.map(w => (
                          <span key={w} className="rounded bg-surface-card px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
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
