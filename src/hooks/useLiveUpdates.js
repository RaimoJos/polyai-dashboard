// printer-dashboard/src/hooks/useLiveUpdates.js
//
// Real-time updates hook (WebSocket + notifications polling)
// Provides a stable interface used by LiveDashboard and other UI components.
//
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import wsService from '../services/websocket';
import { api, unwrap } from '../services/api';

const NOTIFICATIONS_POLL_MS = 15000;

function normalizePrintersPayload(payload) {
  // backend may send { data: { printers: {...} } } or { printers: [...] } or { states: {...} }
  const p = payload?.data?.printers ?? payload?.printers ?? payload?.states ?? payload?.data?.states;
  if (!p) return {};
  if (Array.isArray(p)) {
    const map = {};
    p.forEach((it) => {
      const name = it?.name || it?.printer_name || it?.id;
      if (name) map[name] = it;
    });
    return map;
  }
  if (typeof p === 'object') return p;
  return {};
}

function applyPrinterUpdate(prev, update) {
  // update might look like { printer: {...} } or { name, status, temps... }
  const u = update?.printer ?? update?.data?.printer ?? update;
  const name = u?.name || u?.printer_name || u?.id;
  if (!name) return prev;
  return { ...prev, [name]: { ...(prev[name] || {}), ...u } };
}

/**
 * Main hook used by LiveDashboard.
 */
export function useLiveUpdates() {
  const [connected, setConnected] = useState(wsService.isConnected());
  const [printers, setPrinters] = useState({});
  const [lastUpdate, setLastUpdate] = useState(null);

  const [alerts, setAlerts] = useState([]);
  const alertsRef = useRef(alerts);
  useEffect(() => { alertsRef.current = alerts; }, [alerts]);

  // Connect WS once
  useEffect(() => {
    wsService.connect();

    const offConnect = wsService.on('onConnect', () => setConnected(true));
    const offDisconnect = wsService.on('onDisconnect', () => setConnected(false));

    const offStates = wsService.on('onPrinterStates', (msg) => {
      const next = normalizePrintersPayload(msg);
      setPrinters(next);
      setLastUpdate(Date.now());
    });

    const offUpdate = wsService.on('onPrinterUpdate', (msg) => {
      setPrinters((prev) => applyPrinterUpdate(prev, msg));
      setLastUpdate(Date.now());
    });

    return () => {
      offConnect?.();
      offDisconnect?.();
      offStates?.();
      offUpdate?.();
    };
  }, []);

  // Notifications polling (optional, keeps alerts list populated)
  useEffect(() => {
    let stop = false;

    async function tick() {
      try {
        const res = await api.getNotifications();
        const data = unwrap(res);
        const list = data?.notifications || data?.items || data || [];
        if (!stop && Array.isArray(list)) setAlerts(list);
      } catch {
        // ignore
      }
    }

    tick();
    const id = setInterval(tick, NOTIFICATIONS_POLL_MS);
    return () => { stop = true; clearInterval(id); };
  }, []);

  const unreadAlerts = useMemo(() => {
    const list = alerts || [];
    return list.filter((a) => a && (a.read === false || a.is_read === false)).length;
  }, [alerts]);

  const markAlertRead = useCallback((alertId) => {
    setAlerts((prev) =>
      (prev || []).map((a) => {
        const id = a?.id ?? a?.alert_id ?? a?._id;
        if (id === alertId) return { ...a, read: true, is_read: true };
        return a;
      })
    );
  }, []);

  const clearAlerts = useCallback(() => setAlerts([]), []);

  const sendCommand = useCallback(async (printerName, command, params = {}) => {
    // Prefer the single control endpoint
    return api.controlPrinter(printerName, command, params);
  }, []);

  return {
    connected,
    printers,
    lastUpdate,
    alerts,
    sendCommand,
    markAlertRead,
    clearAlerts,
    unreadAlerts,
  };
}

export default useLiveUpdates;
