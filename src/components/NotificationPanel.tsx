import { useEffect, useState } from "react";
import { subscribeToReadings, fetchLatestReadings } from "../services/sensorService";
import type { SensorReading } from "../types/sensor";

interface AcknowledgedState {
  [node_id: string]: {
    lastCriticalTimestamp: string;
  };
}

export function NotificationPanel() {
  const [criticalNodes, setCriticalNodes] = useState<SensorReading[]>([]);
  const [acknowledged, setAcknowledged] = useState<AcknowledgedState>(() => {
    try {
      const stored = localStorage.getItem("bhoomi_ack");
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("bhoomi_ack", JSON.stringify(acknowledged));
    } catch (e) {
      console.error("Failed to save ack state", e);
    }
  }, [acknowledged]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    function handleUpdate(readings: SensorReading[]) {
      if (cancelled) return;
      
      const newCriticals = readings.filter(r => r.status === "CRITICAL");
      setCriticalNodes(newCriticals);

      // Clean up acknowledged state for nodes that are no longer critical
      setAcknowledged(prev => {
        let hasChanges = false;
        const next = { ...prev };
        
        for (const nodeId of Object.keys(next)) {
          const reading = readings.find(r => r.node_id === nodeId);
          // If the node is no longer critical, or we have a newer critical timestamp, we drop it from acknowledged
          if (!reading || reading.status !== "CRITICAL" || reading.timestamp !== next[nodeId].lastCriticalTimestamp) {
            delete next[nodeId];
            hasChanges = true;
          }
        }
        return hasChanges ? next : prev;
      });
    }

    async function init() {
      try {
        const latest = await fetchLatestReadings();
        handleUpdate(latest);
        unsubscribe = subscribeToReadings(handleUpdate);
      } catch (e) {
        console.error("Failed to init notification panel", e);
      }
    }
    
    init();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleDismiss = (nodeId: string, timestamp: string) => {
    setAcknowledged(prev => ({
      ...prev,
      [nodeId]: { lastCriticalTimestamp: timestamp }
    }));
  };

  const visibleCriticals = criticalNodes.filter(
    r => !acknowledged[r.node_id] || acknowledged[r.node_id].lastCriticalTimestamp !== r.timestamp
  );

  if (visibleCriticals.length === 0) return null;

  // Sort descending by timestamp (newest first)
  const sortedByTimeDesc = [...visibleCriticals].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const cappedCriticals = sortedByTimeDesc.slice(0, 3);
  const hiddenCount = visibleCriticals.length - cappedCriticals.length;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-3">
      {cappedCriticals.map(node => (
        <div 
          key={node.node_id} 
          className="flex flex-col gap-2 rounded-xl border border-red-500/50 bg-surface-card p-4 shadow-lg shadow-black/40 animate-critical-border"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="font-bold text-red-500">NODE {node.node_id} CRITICAL</h4>
              <p className="text-xs text-slate-400 font-mono mt-1">
                {new Date(node.timestamp).toLocaleTimeString()}
              </p>
            </div>
            <button 
              onClick={() => handleDismiss(node.node_id, node.timestamp)}
              className="text-slate-400 hover:text-white transition-colors"
              aria-label="Dismiss"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <div className="text-sm text-slate-200">
            {node.warnings.map(w => (
              <div key={w} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                {w.replace(/_/g, " ")}
              </div>
            ))}
          </div>
        </div>
      ))}
      {hiddenCount > 0 && (
        <div className="flex items-center justify-center rounded-xl border border-surface-border bg-surface-card p-3 shadow-lg shadow-black/40">
          <span className="text-xs font-bold text-slate-400">
            +{hiddenCount} more critical node{hiddenCount > 1 ? 's' : ''} active
          </span>
        </div>
      )}
    </div>
  );
}
