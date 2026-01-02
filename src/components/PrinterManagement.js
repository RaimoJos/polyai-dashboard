import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api, unwrap } from "../services/api";

/**
 * PrinterManagement (compile-safe minimal)
 * - Lists printers and provides basic actions (connect/disconnect/pause/resume).
 * - Includes a simple "Add printer" form (optional backend support).
 */
export default function PrinterManagement() {
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [printers, setPrinters] = useState([]);

  const [newName, setNewName] = useState("");
  const [newIp, setNewIp] = useState("");
  const [newType, setNewType] = useState("bambu");

  const loadPrinters = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await (api.listPrinters?.() || api.getPrinters?.());
      const data = unwrap(resp) || resp?.data || [];
      const list = Array.isArray(data) ? data : data.items || data.printers || [];

      const normalized = list.map((p, idx) => ({
        id: p.id || p.printer_id || p.serial || String(idx),
        name: p.name || p.model || p.id || "Printer",
        ip: p.ip || p.host || "",
        type: p.type || p.brand || "",
        status: p.status || p.state || "unknown",
      }));

      setPrinters(normalized);
    } catch (e) {
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.message ||
        "Failed to load printers";
      setError(String(msg));
      setPrinters([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrinters();
  }, [loadPrinters]);

  const safeAction = async (printerId, fn) => {
    setBusyId(printerId);
    setError("");
    try {
      await fn();
      await loadPrinters();
    } catch (e) {
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.message ||
        "Action failed";
      setError(String(msg));
    } finally {
      setBusyId(null);
    }
  };

  const addPrinter = async () => {
    setError("");
    const payload = {
      name: newName || undefined,
      ip: newIp || undefined,
      type: newType || undefined,
    };

    if (!payload.name && !payload.ip) {
      setError("Provide at least a Name or IP/Host.");
      return;
    }

    await safeAction("new", async () => {
      await api.createPrinter?.(payload);
      setNewName("");
      setNewIp("");
      setNewType("bambu");
    });
  };

  const rows = useMemo(() => printers, [printers]);

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Printer Management</h2>
        <div className="panel-subheader">Manage registered printers and connections</div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button className="btn btn-secondary" onClick={loadPrinters} disabled={loading}>
          Refresh
        </button>
      </div>

      {error ? <div className="notice notice-error">{error}</div> : null}

      <div className="section">
        <h3>Add printer</h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            className="input"
            placeholder="Name (e.g., P1S-Office)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ minWidth: 220 }}
          />
          <input
            className="input"
            placeholder="IP/Host (e.g., 192.168.1.127)"
            value={newIp}
            onChange={(e) => setNewIp(e.target.value)}
            style={{ minWidth: 220 }}
          />
          <select className="input" value={newType} onChange={(e) => setNewType(e.target.value)}>
            <option value="bambu">Bambu</option>
            <option value="klipper">Klipper</option>
            <option value="octoprint">OctoPrint</option>
            <option value="other">Other</option>
          </select>
          <button className="btn btn-primary" onClick={addPrinter} disabled={busyId === "new"}>
            {busyId === "new" ? "Adding…" : "Add"}
          </button>
        </div>
      </div>

      <div className="section" style={{ marginTop: 18 }}>
        <h3>Registered printers</h3>

        {loading ? (
          <div style={{ opacity: 0.85 }}>Loading…</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>IP/Host</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th style={{ width: 380 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.ip}</td>
                    <td>{p.type}</td>
                    <td>{p.status}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          className="btn btn-secondary"
                          disabled={busyId === p.id}
                          onClick={() => safeAction(p.id, () => api.connectPrinter?.(p.id))}
                        >
                          Connect
                        </button>
                        <button
                          className="btn btn-secondary"
                          disabled={busyId === p.id}
                          onClick={() => safeAction(p.id, () => api.disconnectPrinter?.(p.id))}
                        >
                          Disconnect
                        </button>
                        <button
                          className="btn btn-secondary"
                          disabled={busyId === p.id}
                          onClick={() => safeAction(p.id, () => api.pausePrinter?.(p.id))}
                        >
                          Pause
                        </button>
                        <button
                          className="btn btn-secondary"
                          disabled={busyId === p.id}
                          onClick={() => safeAction(p.id, () => api.resumePrinter?.(p.id))}
                        >
                          Resume
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={5} style={{ opacity: 0.85 }}>
                      No printers found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ opacity: 0.8, marginTop: 12 }}>
        Note: If a backend route is not implemented yet, actions may return 404; the UI will show the
        error message but will not crash.
      </div>
    </div>
  );
}
