import { useEffect, useState } from "react";
import { fetchAlertHistory, subscribeToReadings, type AlertTransition } from "../services/sensorService";
import type { SensorReading } from "../types/sensor";

export function useAlertHistory(nodeId?: string) {
  const [transitions, setTransitions] = useState<AlertTransition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    const nodeStatusMap = new Map<string, SensorReading["status"]>();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const history = await fetchAlertHistory(2000);
        if (cancelled) return;
        
        // Populate initial statuses based on the most recent transition for each node
        for (const t of history) {
          if (!nodeStatusMap.has(t.node_id)) {
            nodeStatusMap.set(t.node_id, t.to_status);
          }
        }

        setTransitions(history);

        unsubscribe = subscribeToReadings((updatedReadings: SensorReading[]) => {
          if (cancelled) return;
          
          let hasNewTransitions = false;
          const newTransitions: AlertTransition[] = [];

          for (const reading of updatedReadings) {
            const lastStatus = nodeStatusMap.get(reading.node_id) || "NORMAL";
            
            if (reading.status !== lastStatus) {
              const transition: AlertTransition = {
                id: `${reading.node_id}-${reading.timestamp}`,
                node_id: reading.node_id,
                timestamp: reading.timestamp,
                from_status: lastStatus,
                to_status: reading.status,
                warnings: reading.warnings,
              };
              newTransitions.push(transition);
              nodeStatusMap.set(reading.node_id, reading.status);
              hasNewTransitions = true;
            }
          }

          if (hasNewTransitions) {
            setTransitions(prev => {
              // Prepend new transitions and sort just in case
              const merged = [...newTransitions, ...prev];
              return merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            });
          }
        });
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Failed to load alert history.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const filteredTransitions = nodeId 
    ? transitions.filter(t => t.node_id === nodeId)
    : transitions;

  return {
    transitions: filteredTransitions,
    loading,
    error,
  };
}
