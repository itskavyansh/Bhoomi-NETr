import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  LineChart,
  Radio,
  ShieldCheck,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DataStatus } from "../components/DataStatus";
import { LiveIndicator } from "../components/LiveIndicator";
import { StatusBadge } from "../components/StatusBadge";
import {
  fetchLatestReadings,
  subscribeToReadings,
} from "../services/sensorService";
import type { SensorReading } from "../types/sensor";

/* ─── Count helper (preserves existing logic) ─── */
function countByStatus(
  readings: SensorReading[],
  status: SensorReading["status"],
): number {
  return readings.filter((r) => r.status === status).length;
}



/* ═══════════════════════════════════════════════════════════════
   Quick Access — service cards (UIDAI-style service discovery)
   ═══════════════════════════════════════════════════════════════ */
function ServiceCard({
  icon,
  label,
  desc,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-xs transition-all hover:border-[var(--brand-green)] hover:bg-[var(--card-bg-hover)] min-w-0"
      aria-label={`${label} — ${desc}`}
    >
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--icon-primary)] group-hover:bg-[var(--brand-green)] group-hover:text-white transition-colors">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[0.875rem] font-bold text-[var(--text-primary)] group-hover:text-[var(--brand-green)] transition-colors break-words">
          {label}
        </span>
        <span className="mt-0.5 block text-[0.78rem] leading-snug text-[var(--text-secondary)] break-words">
          {desc}
        </span>
      </span>
    </Link>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Technology pipeline step
   ═══════════════════════════════════════════════════════════════ */
function PipelineStep({
  num,
  title,
  body,
  last = false,
}: {
  num: string;
  title: string;
  body: string;
  last?: boolean;
}) {
  return (
    <div className="flex gap-4 min-w-0">
      {/* Spine */}
      <div className="flex flex-col items-center">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--brand-green)] bg-[var(--brand-green)] text-white font-mono text-[0.7rem] font-bold shadow-xs">
          {num}
        </span>
        {!last && (
          <span className="mt-1 flex-1 border-l-2 border-dashed border-[var(--border)]" />
        )}
      </div>
      {/* Content */}
      <div className={`${last ? "pb-0" : "pb-6"} min-w-0`}>
        <p className="text-[0.875rem] font-bold text-[var(--text-primary)] break-words">{title}</p>
        <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--text-secondary)] break-words">
          {body}
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Status indicator row item
   ═══════════════════════════════════════════════════════════════ */
function StatusRow({
  label,
  value,
  ok,
  detail,
}: {
  label: string;
  value: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-[var(--border)] last:border-b-0 min-w-0">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            ok ? "bg-[var(--status-success)]" : "bg-[var(--status-danger)] animate-pulse"
          }`}
          aria-hidden="true"
        />
        <span className="text-[0.8125rem] font-semibold text-[var(--text-primary)] truncate">
          {label}
        </span>
      </div>
      <div className="shrink-0 text-right">
        <span
          className={`block text-[0.8125rem] font-bold ${
            ok ? "text-[var(--status-success)]" : "text-[var(--status-danger)] font-bold"
          }`}
        >
          {value}
        </span>
        <span className="block text-[0.7rem] text-[var(--text-muted)]">{detail}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FAQ accordion item
   ═══════════════════════════════════════════════════════════════ */
const FAQ_ITEMS = [
  {
    q: "What is BHOOMI-NETr?",
    a: "BHOOMI-NETr is a real-time ground stability monitoring network. It uses a distributed sensor array — including tilt sensors (MPU6050), ultrasonic distance sensors (HC-SR04), and piezo-electric acoustic sensors (ADS1115) — to detect subsidence, vibration anomalies, and potential structural instabilities in underground or ground-level sites.",
  },
  {
    q: "What does the system monitor?",
    a: "The system monitors: ground tilt (X and Y axes), surface displacement, structural vibration, piezo-electric acoustic emissions (peak, RMS, peak-to-peak voltage), and real-time sensor health. All readings are correlated by the multi-sensor analysis engine to compute a Subsidence Risk Index (0–100).",
  },
  {
    q: "How are sensor nodes deployed?",
    a: "Each sensor node is an embedded hardware unit combining the MPU6050 (tilt & gyroscope), HC-SR04 (ultrasonic distance), and ADS1115 ADC (piezo-electric interface). Nodes transmit readings to the cloud database via network connectivity, where readings are stored and processed in near-real-time.",
  },
  {
    q: "What does the piezo-electric sensor contribute?",
    a: "The ADS1115-connected piezo-electric transducer captures high-frequency acoustic shock signals from the ground. The detection engine analyses peak, RMS, and peak-to-peak voltage relative to a calibrated baseline to identify crack initiation events, structural vibrations, and critical failure propagation — distinct from bulk ground oscillation.",
  },
  {
    q: "What happens when abnormal movement is detected?",
    a: "When sensor readings exceed configured thresholds (tilt > 15°, displacement > baseline, vibration > 1.0 g, or piezo index > 1.50× baseline), the node is escalated to WARNING or CRITICAL status. The notification panel activates, alert history is logged, and the Risk Score is updated with contributing factor analysis.",
  },
  {
    q: "Who uses the monitoring platform?",
    a: "The BHOOMI-NETr dashboard is accessible to site operators, structural engineers, and safety monitoring personnel who need to track real-time ground conditions. The platform provides both current readings and historical trend analysis to support evidence-based decisions.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const id = `faq-${q.slice(0, 20).replace(/\W/g, "-")}`;
  return (
    <div className="border-b border-[var(--border)] last:border-b-0 min-w-0">
      <button
        type="button"
        id={id}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 py-4 text-left"
      >
        <span className="text-[0.875rem] font-bold text-[var(--text-primary)] break-words">
          {q}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-[var(--icon-muted)]" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-[var(--icon-muted)]" aria-hidden="true" />
        )}
      </button>
      <div
        id={`${id}-panel`}
        role="region"
        aria-labelledby={id}
        className={`overflow-hidden transition-all duration-200 ${
          open ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <p className="pb-5 text-[0.8125rem] leading-relaxed text-[var(--text-secondary)] break-words">
          {a}
        </p>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   HOME PAGE — main component
   All data fetching logic is PRESERVED EXACTLY from original
   ════════════════════════════════════════════════════════════════ */
export function Home() {
  /* ── Existing data fetching — untouched ── */
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const latest = await fetchLatestReadings();
        if (cancelled) return;
        setReadings(latest);
        unsubscribe = subscribeToReadings((updated) => {
          if (!cancelled) setReadings(updated);
        });
      } catch (caught) {
        if (!cancelled)
          setError(
            caught instanceof Error ? caught.message : "Failed to load nodes.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  /* ── Derived stats (same calculations as before) ── */
  const totalNodes    = readings.length;
  const normalCount   = countByStatus(readings, "NORMAL");
  const warningCount  = countByStatus(readings, "WARNING");
  const criticalCount = countByStatus(readings, "CRITICAL");
  const networkOk     = totalNodes > 0 && criticalCount === 0;
  const dataOk        = !loading && !error;

  const avgConfidence =
    totalNodes > 0
      ? Math.round(
          readings.reduce((acc, r) => acc + r.sensor_confidence, 0) / totalNodes,
        )
      : null;

  return (
    <main id="main-content" tabIndex={-1} style={{ outline: "none" }}>

      {/* ════════════════════════════════════════════════════════
          SECTION 1 — HERO
          Authoritative, restrained, light institutional backdrop.
          ════════════════════════════════════════════════════════ */}
      <section
        className="relative overflow-hidden border-b border-[var(--border)] bg-[var(--surface-alt)] bg-grid-subtle transition-colors"
        aria-labelledby="hero-heading"
      >
        {/* Dim radial gradient */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(11,93,59,0.08), transparent)",
          }}
          aria-hidden="true"
        />

        <div className="dashboard-shell relative py-12 sm:py-16 lg:py-20">
          <div className="max-w-2xl">
            <p className="section-eyebrow mb-2.5">
              Ground Stability Monitoring Network
            </p>
            <h1
              id="hero-heading"
              className="page-title mb-3"
              style={{ fontSize: "clamp(2rem, 4.5vw, 3.2rem)" }}
            >
              BHOOMI<span className="text-[var(--brand-green)]">-NETr</span>
            </h1>
            <p className="max-w-lg text-[0.9375rem] leading-7 text-[var(--text-secondary)]">
              A distributed sensor network for real-time detection of ground
              subsidence, structural vibration, and acoustic emissions across
              monitored sites.
            </p>

            {/* Live status inline */}
            <div className="mt-5">
              <LiveIndicator />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link to="/dashboard" className="btn-primary">
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                Open Live Dashboard
              </Link>
              <a href="#how-it-works" className="btn-secondary">
                How It Works
              </a>
            </div>
          </div>

          {/* Stat pills — inline in hero, balanced 2x2 on mobile, flex on desktop */}
          {!loading && !error && totalNodes > 0 && (
            <div className="mt-8 grid grid-cols-2 sm:flex sm:flex-wrap gap-2.5 max-w-xl">
              {[
                { label: "Nodes", value: totalNodes, ok: true },
                { label: "Normal", value: normalCount, ok: true },
                { label: "Warning", value: warningCount, ok: warningCount === 0 },
                { label: "Critical", value: criticalCount, ok: criticalCount === 0 },
              ].map((s) => (
                <div
                  key={s.label}
                  className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 shadow-xs min-w-0"
                  role="status"
                  aria-label={`${s.label}: ${s.value}`}
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      s.ok ? "bg-[var(--status-success)]" : s.value > 0 ? "bg-[var(--status-danger)] animate-pulse" : "bg-[var(--status-success)]"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="font-mono text-sm font-bold text-[var(--text-primary)]">
                    {s.value}
                  </span>
                  <span className="text-[0.72rem] font-semibold uppercase tracking-wider text-[var(--text-muted)] truncate">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          SECTION 2 — QUICK ACCESS SERVICES
          UIDAI pattern: scannable list, institutional cards
          ════════════════════════════════════════════════════════ */}
      <section
        className="border-b border-[var(--border)] bg-[var(--surface)] transition-colors"
        aria-labelledby="services-heading"
      >
        <div className="dashboard-shell py-10">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="section-eyebrow mb-1">Platform Services</p>
              <h2 id="services-heading" className="section-title">
                Access BHOOMI-NETr Services
              </h2>
            </div>
            <Link
              to="/dashboard"
              className="hidden shrink-0 items-center gap-1.5 text-[0.85rem] font-bold text-[var(--brand-green)] hover:text-[var(--brand-green-dark)] transition-colors sm:flex"
              aria-label="Go to all monitoring views"
            >
              All views <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ServiceCard
              icon={<LayoutDashboard className="h-4 w-4" aria-hidden="true" />}
              label="Live Dashboard"
              desc="Real-time sensor node readings & status overview"
              to="/dashboard"
            />
            <ServiceCard
              icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
              label="Subsidence Risk Score"
              desc="Multi-sensor correlated ground risk index (0–100)"
              to="/risk-score"
            />
            <ServiceCard
              icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
              label="Structural Health"
              desc="Sensor confidence, hardware integrity & telemetry quality"
              to="/structural-health"
            />
            <ServiceCard
              icon={<LineChart className="h-4 w-4" aria-hidden="true" />}
              label="Trend Analysis"
              desc="Historical patterns, trajectory & early-warning projections"
              to="/trend-analysis"
            />
            <ServiceCard
              icon={<Bell className="h-4 w-4" aria-hidden="true" />}
              label="Alert History"
              desc="Status transition events across the monitoring network"
              to="/alerts"
            />
            <ServiceCard
              icon={<BarChart3 className="h-4 w-4" aria-hidden="true" />}
              label="Node Detail"
              desc="Per-node sensor telemetry, detection results & risk factors"
              to="/dashboard"
            />
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          SECTION 3 — LIVE NODE NETWORK
          Show real nodes prominently (the core purpose)
          ════════════════════════════════════════════════════════ */}
      <section className="bg-[var(--bg)] border-b border-[var(--border)] transition-colors" aria-labelledby="network-heading">
        <div className="dashboard-shell py-10">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="section-eyebrow mb-1">Live Sensor Network</p>
              <h2 id="network-heading" className="section-title">
                Ground Monitoring Nodes
              </h2>
              <p className="mt-1 text-[0.85rem] text-[var(--text-secondary)]">
                Select any node for detailed telemetry, trend charts, piezo readings, and risk analysis.
              </p>
            </div>
            {!loading && !error && (
              <Link
                to="/dashboard"
                className="inline-flex shrink-0 items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[0.8rem] font-bold text-[var(--text-primary)] shadow-xs transition hover:border-[var(--brand-green)] hover:text-[var(--brand-green)]"
              >
                Full Dashboard
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            )}
          </div>

          <DataStatus loading={loading} error={error} />

          {!loading && !error && readings.length > 0 && (
            <>
              {/* Network summary stats */}
              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  {
                    icon: <Radio className="h-4 w-4 text-[var(--icon-primary)]" aria-hidden="true" />,
                    value: totalNodes,
                    label: "Monitored Nodes",
                    sub: "Active sensor points",
                  },
                  {
                    icon: <CheckCircle className="h-4 w-4 text-[var(--status-success)]" aria-hidden="true" />,
                    value: normalCount,
                    label: "Normal",
                    sub: "Within baseline",
                  },
                  {
                    icon: <AlertTriangle className="h-4 w-4 text-[var(--status-warning)]" aria-hidden="true" />,
                    value: warningCount,
                    label: "Warning",
                    sub: "Elevated monitoring",
                  },
                  {
                    icon: <AlertOctagon className="h-4 w-4 text-[var(--status-danger)]" aria-hidden="true" />,
                    value: criticalCount,
                    label: "Critical",
                    sub: "Immediate attention",
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-xs min-w-0"
                    role="status"
                    aria-label={`${stat.label}: ${stat.value}`}
                  >
                    {stat.icon}
                    <div className="min-w-0">
                      <p className="font-mono text-xl font-bold leading-none text-[var(--text-primary)]">
                        {stat.value}
                      </p>
                      <p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--text-muted)] truncate">
                        {stat.label}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Node list — clean table with mobile-visible risk score */}
              <div
                className="overflow-hidden rounded-lg border border-[var(--table-border)] bg-[var(--table-row-bg)] shadow-xs"
                role="list"
                aria-label="Monitoring nodes"
              >
                {readings.map((reading, idx) => {
                  const isLast = idx === readings.length - 1;
                  const rowBg = idx % 2 === 1 ? "bg-[var(--table-row-alt)]" : "bg-[var(--table-row-bg)]";
                  const statusBorder =
                    reading.status === "CRITICAL"
                      ? "border-l-[var(--status-danger)]"
                      : reading.status === "WARNING"
                      ? "border-l-[var(--status-warning)]"
                      : "border-l-[var(--brand-green)]";

                  return (
                    <Link
                      key={reading.node_id}
                      to={`/node/${reading.node_id}`}
                      role="listitem"
                      className={`flex items-center justify-between gap-4 border-b border-l-4 border-[var(--table-border)] px-4 sm:px-5 py-3.5 transition hover:bg-[var(--surface-elevated)] ${statusBorder} ${rowBg} ${
                        isLast ? "border-b-0" : ""
                      }`}
                      aria-label={`${reading.node_id} — ${reading.status} — Risk score: ${reading.risk_score}`}
                    >
                      <div className="flex flex-wrap items-center gap-4 sm:gap-8 min-w-0">
                        <div className="min-w-0">
                          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                            Sensor Node
                          </p>
                          <p className="font-mono text-sm font-bold text-[var(--text-primary)]">
                            {reading.node_id}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                            Risk Score
                          </p>
                          <p className="font-mono text-sm font-bold text-[var(--text-primary)]">
                            {reading.risk_score}
                            <span className="ml-0.5 text-[0.7rem] font-normal text-[var(--text-muted)]">
                              / 100
                            </span>
                          </p>
                        </div>
                        <div className="hidden xs:block min-w-0">
                          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                            Risk Level
                          </p>
                          <p className="text-xs font-semibold text-[var(--text-secondary)]">
                            {reading.risk_level}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <StatusBadge status={reading.status} />
                        <ArrowRight
                          className="h-3.5 w-3.5 text-[var(--icon-muted)] group-hover:text-[var(--text-primary)]"
                          aria-hidden="true"
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          SECTION 4 — SYSTEM STATUS
          Infrastructure-style status panel
          ════════════════════════════════════════════════════════ */}
      {!loading && !error && (
        <section
          className="border-b border-[var(--border)] bg-[var(--surface)] transition-colors"
          aria-labelledby="status-heading"
        >
          <div className="dashboard-shell py-10">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
              {/* Status panel */}
              <div>
                <p className="section-eyebrow mb-1">Operational Status</p>
                <h2 id="status-heading" className="section-title mb-5">
                  Live Network Status
                </h2>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] shadow-xs">
                  <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
                    <span className="text-[0.7rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      System Component
                    </span>
                    <span className="text-[0.7rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Status
                    </span>
                  </div>
                  <div className="px-5">
                    <StatusRow
                      label="Sensor Network"
                      value={
                        networkOk
                          ? "Operational"
                          : criticalCount > 0
                          ? "Critical"
                          : "Elevated"
                      }
                      ok={networkOk}
                      detail={`${totalNodes} node${totalNodes !== 1 ? "s" : ""} connected`}
                    />
                    <StatusRow
                      label="Sensor Confidence"
                      value={
                        avgConfidence != null
                          ? avgConfidence >= 85
                            ? "High"
                            : avgConfidence >= 60
                            ? "Moderate"
                            : "Degraded"
                          : "Checking…"
                      }
                      ok={avgConfidence != null && avgConfidence >= 85}
                      detail={
                        avgConfidence != null
                          ? `Fleet average: ${avgConfidence}%`
                          : "—"
                      }
                    />
                    <StatusRow
                      label="Alert Status"
                      value={
                        criticalCount > 0
                          ? "Critical Active"
                          : warningCount > 0
                          ? "Warnings Active"
                          : "All Clear"
                      }
                      ok={criticalCount === 0 && warningCount === 0}
                      detail={`${criticalCount} critical · ${warningCount} warning`}
                    />
                    <StatusRow
                      label="Data Pipeline"
                      value={dataOk ? "Live" : "Disrupted"}
                      ok={dataOk}
                      detail="Supabase Realtime"
                    />
                  </div>
                </div>
              </div>

              {/* What's new — list */}
              <div>
                <p className="section-eyebrow mb-1">What's New</p>
                <h2 className="section-title mb-5">Latest Updates</h2>
                <ul className="space-y-0 divide-y divide-[var(--border)]">
                  {[
                    {
                      date: "Sep 2026",
                      tag: "Platform",
                      title: "Piezo-Electric Detection Engine",
                      body: "High-frequency acoustic crack detection using the ADS1115 ADC channel with per-node adaptive baseline calibration.",
                    },
                    {
                      date: "Aug 2026",
                      tag: "Analysis",
                      title: "Multi-Sensor Risk Correlation",
                      body: "Deterministic Subsidence Risk Index engine — correlated tilt, displacement, vibration, and acoustic signals into a 0–100 composite score.",
                    },
                    {
                      date: "Jul 2026",
                      tag: "Infrastructure",
                      title: "Supabase Realtime Integration",
                      body: "Sensor readings streamed in real-time via Supabase postgres_changes, enabling live dashboard updates without polling.",
                    },
                  ].map((item) => (
                    <li key={item.title} className="py-4 first:pt-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="rounded bg-[var(--brand-green)]/10 px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-wider text-[var(--brand-green)] border border-[var(--brand-green)]/20">
                          {item.tag}
                        </span>
                        <span className="text-[0.75rem] font-medium text-[var(--text-muted)]">
                          {item.date}
                        </span>
                      </div>
                      <p className="text-[0.875rem] font-bold text-[var(--text-primary)]">
                        {item.title}
                      </p>
                      <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--text-secondary)]">
                        {item.body}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════
          SECTION 5 — HOW IT WORKS
          Engineering-grade sequential pipeline
          ════════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="bg-[var(--bg)] border-b border-[var(--border)] transition-colors" aria-labelledby="tech-heading">
        <div className="dashboard-shell py-12">
          <div className="mb-8 max-w-xl">
            <p className="section-eyebrow mb-1">Detection Architecture</p>
            <h2 id="tech-heading" className="section-title">
              How BHOOMI-NETr Works
            </h2>
            <p className="mt-2 text-[0.85rem] leading-relaxed text-[var(--text-secondary)]">
              A six-stage sensing-to-alert pipeline built on embedded hardware
              and cloud-native data processing.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-x-16 gap-y-0 lg:grid-cols-2">
            <div>
              <PipelineStep
                num="01"
                title="Sensor Node Hardware"
                body="Embedded nodes combine MPU6050 (tilt & gyroscope), HC-SR04 (ultrasonic distance/displacement), and ADS1115 ADC (piezo-electric interface) to capture multi-channel ground readings."
              />
              <PipelineStep
                num="02"
                title="Real-Time Data Transmission"
                body="Each node transmits raw readings over network to a cloud time-series database. Supabase Realtime delivers row inserts to the dashboard within seconds of capture."
              />
              <PipelineStep
                num="03"
                title="Piezo-Electric Acoustic Channel"
                body="The ADS1115 channel captures high-frequency acoustic signals. Composite peak, RMS, and peak-to-peak voltage ratios are compared against a per-node calibrated baseline."
              />
            </div>
            <div>
              <PipelineStep
                num="04"
                title="Multi-Sensor Correlation Engine"
                body="Tilt, displacement, vibration, and acoustic readings are correlated by a deterministic analysis engine to compute a Subsidence Risk Index (0–100) and classify risk level: LOW → MODERATE → HIGH → CRITICAL."
              />
              <PipelineStep
                num="05"
                title="Ground Stability Classification"
                body="The detection engine combines a macro vibration index and a high-frequency crack index to classify each event: Normal / Structural Vibration / Possible Crack Initiation / Critical Structural Event."
              />
              <PipelineStep
                num="06"
                title="Alert & Response"
                body="When thresholds are exceeded, node status escalates (WARNING / CRITICAL), the notification panel activates, alert history is logged, and contributing risk factors are surfaced for decision support."
                last
              />
            </div>
          </div>

          {/* Hardware component reference */}
          <div className="mt-8 border-t border-[var(--border)] pt-6">
            <p className="mb-3 text-[0.7rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Hardware Components
            </p>
            <div className="flex flex-wrap gap-3">
              {[
                {
                  name: "MPU6050",
                  desc: "6-axis tilt & gyroscope",
                  icon: <Activity className="h-4 w-4" aria-hidden="true" />,
                },
                {
                  name: "HC-SR04",
                  desc: "Ultrasonic distance",
                  icon: <Radio className="h-4 w-4" aria-hidden="true" />,
                },
                {
                  name: "ADS1115",
                  desc: "Piezo-electric ADC",
                  icon: <Zap className="h-4 w-4" aria-hidden="true" />,
                },
              ].map((hw) => (
                <div
                  key={hw.name}
                  className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 shadow-xs min-w-0"
                >
                  <span className="text-[var(--icon-primary)] shrink-0">{hw.icon}</span>
                  <span className="font-mono text-[0.75rem] font-bold text-[var(--text-primary)]">
                    {hw.name}
                  </span>
                  <span className="text-[0.72rem] text-[var(--text-muted)]">{hw.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          SECTION 6 — FAQ
          ════════════════════════════════════════════════════════ */}
      <section
        className="bg-[var(--surface)] transition-colors"
        aria-labelledby="faq-heading"
      >
        <div className="dashboard-shell py-12">
          <div className="mx-auto max-w-2xl">
            <p className="section-eyebrow mb-1 text-center">
              Frequently Asked Questions
            </p>
            <h2 id="faq-heading" className="section-title mb-8 text-center">
              About BHOOMI-NETr
            </h2>

            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-6 shadow-xs">
              {FAQ_ITEMS.map((item) => (
                <FaqItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>

            <p className="mt-6 text-center text-[0.85rem] text-[var(--text-secondary)]">
              Have a technical question?{" "}
              <a
                href="mailto:support@bhoomi-netr.in"
                className="text-[var(--brand-green)] hover:underline font-semibold transition-colors"
              >
                Contact support
              </a>
              .
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
