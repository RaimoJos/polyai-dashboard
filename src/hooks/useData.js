import { useEffect, useRef, useState } from 'react';
import { api, unwrap } from '../services/api';

/**
 * Generic auto-refresh hook for polling endpoints.
 * Works with PolyAI's envelope responses ({ status, data }) via unwrap().
 */
export const useAutoRefresh = (fetchFn, interval = 5000) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const fetchData = async (isFirst = false) => {
      if (isFirst) setLoading(true);
      try {
        const res = await fetchFn();
        const payload = unwrap(res); // safe even if res is already a plain object
        if (!mountedRef.current) return;
        setData(payload);
        setError(null);
      } catch (err) {
        if (!mountedRef.current) return;
        setError(err?.message || String(err));
      } finally {
        if (!mountedRef.current) return;
        setLoading(false);
      }
    };

    fetchData(true);
    const intervalId = setInterval(() => fetchData(false), interval);

    return () => {
      mountedRef.current = false;
      clearInterval(intervalId);
    };
  }, [fetchFn, interval]);

  return { data, loading, error };
};

// Convenience hooks
export const usePrinterHealth = () => useAutoRefresh(api.getPrinterHealth, 5000);
export const useJobQueue = () => useAutoRefresh(api.getJobQueue, 3000);
export const useSystemStatus = () => useAutoRefresh(api.getSystemStatus, 5000);
export const useMaterialInventory = () => useAutoRefresh(api.getMaterialInventory, 10000);
export const useEnergySummary = () => useAutoRefresh(api.getEnergySummary, 10000);
