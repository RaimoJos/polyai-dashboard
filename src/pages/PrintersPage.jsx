import React, { useEffect, useMemo, useState, useCallback } from "react";
import { PrintersAPI } from "../services/polyaiApi";
import { api } from "../services/api";

function fmt(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

// Slicer Status Card Component
function SlicerStatusCard() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    try {
      const data = await api.getSlicerStatus();
      setStatus(data);
    } catch (err) {
      console.error('Failed to load slicer status:', err);
      setStatus({ available: false, slicer_type: 'none' });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  if (loading) {
    return (
      <div style={{
        padding: 16,
        background: '#1a1a2e',
        borderRadius: 8,
        border: '1px solid #333',
        marginBottom: 16
      }}>
        <div style={{ opacity: 0.6 }}>🔪 Loading slicer status...</div>
      </div>
    );
  }

  const isReady = status?.available;
  const isInstalled = status?.slicer_installed || status?.slicer_path;
  const hasProfiles = status?.profiles_configured;

  return (
    <div style={{
      padding: 16,
      background: '#1a1a2e',
      borderRadius: 8,
      border: `1px solid ${isReady ? '#22c55e' : isInstalled ? '#eab308' : '#666'}`,
      marginBottom: 16
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: '#fff' }}>
          🔪 Slicer Integration
        </h3>
        <span style={{
          padding: '4px 10px',
          borderRadius: 12,
          fontSize: 12,
          fontWeight: 'bold',
          background: isReady ? '#22c55e33' : isInstalled ? '#eab30833' : '#66666633',
          color: isReady ? '#22c55e' : isInstalled ? '#eab308' : '#888',
          border: `1px solid ${isReady ? '#22c55e' : isInstalled ? '#eab308' : '#666'}`
        }}>
          {isReady ? '✓ Ready' : isInstalled ? '⚠️ Config Needed' : '✗ Not Found'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div style={{ padding: 10, background: '#111', borderRadius: 6 }}>
          <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Slicer</div>
          <div style={{ fontSize: 14, fontWeight: 'bold', color: isInstalled ? '#22c55e' : '#888' }}>
            {status?.slicer_type === 'orcaslicer' ? 'OrcaSlicer' :
             status?.slicer_type === 'bambu_studio' ? 'Bambu Studio' :
             'Not Installed'}
          </div>
          {status?.version && <div style={{ fontSize: 11, color: '#666' }}>v{status.version}</div>}
        </div>

        <div style={{ padding: 10, background: '#111', borderRadius: 6 }}>
          <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Profiles</div>
          <div style={{ fontSize: 14, fontWeight: 'bold', color: hasProfiles ? '#22c55e' : '#eab308' }}>
            {hasProfiles ? '✓ Configured' : '⚠️ Missing'}
          </div>
          <div style={{ fontSize: 11, color: '#666' }}>
            {hasProfiles ? 'Accurate estimates' : 'Using calculations'}
          </div>
        </div>

        <div style={{ padding: 10, background: '#111', borderRadius: 6 }}>
          <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Status</div>
          <div style={{ fontSize: 14, fontWeight: 'bold', color: isReady ? '#22c55e' : '#eab308' }}>
            {isReady ? '🚀 Ready' : '📊 Estimates'}
          </div>
          <div style={{ fontSize: 11, color: '#666' }}>
            {isReady ? 'Full integration' : 'Built-in formulas'}
          </div>
        </div>
      </div>

      {!isReady && (
        <div style={{ marginTop: 12, padding: 10, background: '#eab30811', borderRadius: 6, border: '1px solid #eab30833' }}>
          <div style={{ fontSize: 12, color: '#eab308' }}>
            {!isInstalled ? (
              <>💡 Install OrcaSlicer for accurate print time estimates. <a href="https://github.com/SoftFever/OrcaSlicer" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>Download</a></>
            ) : (
              <>💡 Open OrcaSlicer, configure your printer, and save presets to enable accurate slicing.</>
            )}
          </div>
        </div>
      )}

      {status?.slicer_path && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#666', fontFamily: 'monospace' }}>
          {status.slicer_path}
        </div>
      )}
    </div>
  );
}

export default function PrintersPage() {
  const [printers, setPrinters] = useState([]);
  const [types, setTypes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const selectedName = selected?.name;

  async function load() {
    setErr(null);
    const res = await PrintersAPI.list();
    setPrinters(res.printers || []);
  }

  async function loadTypes() {
    const res = await PrintersAPI.types();
    // your backend returns both string list + options; use options if present
    setTypes(res.options || (res.types || []).map(v => ({ value: v, label: v })));
  }

  useEffect(() => {
    load();
    loadTypes();
  }, []);

  // Poll selected printer status
  useEffect(() => {
    let t = null;
    let stopped = false;

    async function tick() {
      if (!selectedName) return;
      try {
        const s = await PrintersAPI.status(selectedName);
        if (!stopped) setStatus(s);
      } catch (e) {
        if (!stopped) setStatus({ connected: false, state: "offline", message: e.message });
      }
    }

    if (selectedName) {
      tick();
      t = setInterval(tick, 2000);
    } else {
      setStatus(null);
    }

    return () => {
      stopped = true;
      if (t) clearInterval(t);
    };
  }, [selectedName]);

  const registerDefaults = useMemo(
    () => ({
      name: "",
      type: (types[0]?.value || "unknown"),
      ip_address: "",
      location: "",
      serial_number: "",
      access_code: "",
      port: "",
      ws_port: "",
      mqtt_port: "",
      use_tls: "",
      camera_url: "",
    }),
    [types]
  );

  const [form, setForm] = useState(registerDefaults);
  useEffect(() => setForm(registerDefaults), [registerDefaults]);

  async function onRegister(e) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        ip_address: form.ip_address.trim() || undefined,
        location: form.location.trim() || undefined,
        serial_number: form.serial_number.trim() || undefined,
        access_code: form.access_code.trim() || undefined,
        port: form.port === "" ? undefined : Number(form.port),
        ws_port: form.ws_port === "" ? undefined : Number(form.ws_port),
        mqtt_port: form.mqtt_port === "" ? undefined : Number(form.mqtt_port),
        use_tls: form.use_tls === "" ? undefined : (String(form.use_tls).toLowerCase() === "true"),
        camera_url: form.camera_url.trim() || undefined,
      };

      await PrintersAPI.register(payload);
      await load();
      setForm(registerDefaults);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  async function act(fn) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      {/* Slicer Status Card */}
      <SlicerStatusCard />

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h2 style={{ margin: 0 }}>Printers</h2>
          <button onClick={load} disabled={busy}>Refresh</button>
        </div>

        {err && <div style={{ color: "crimson", marginTop: 8 }}>{err}</div>}

        <div style={{ marginTop: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">Name</th>
                <th align="left">Type</th>
                <th align="left">IP</th>
                <th align="left">Status</th>
              </tr>
            </thead>
            <tbody>
              {printers.map((p) => (
                <tr
                  key={p.name}
                  onClick={() => setSelected(p)}
                  style={{
                    cursor: "pointer",
                    background: selectedName === p.name ? "#f3f3f3" : "transparent",
                  }}
                >
                  <td style={{ padding: "6px 4px" }}>{p.name}</td>
                  <td style={{ padding: "6px 4px" }}>{p.printer_type || p.type}</td>
                  <td style={{ padding: "6px 4px" }}>{p.ip_address || ""}</td>
                  <td style={{ padding: "6px 4px" }}>{p.status || ""}</td>
                </tr>
              ))}
              {printers.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 8, opacity: 0.7 }}>No printers yet</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {selectedName && (
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button disabled={busy} onClick={() => act(() => PrintersAPI.connect(selectedName))}>Connect</button>
            <button disabled={busy} onClick={() => act(() => PrintersAPI.disconnect(selectedName))}>Disconnect</button>
            <button disabled={busy} onClick={() => act(() => PrintersAPI.control(selectedName, "pause"))}>Pause</button>
            <button disabled={busy} onClick={() => act(() => PrintersAPI.control(selectedName, "resume"))}>Resume</button>
            <button disabled={busy} onClick={() => act(() => PrintersAPI.control(selectedName, "stop"))}>Stop</button>
            <button disabled={busy} onClick={() => act(() => PrintersAPI.remove(selectedName))}>Deactivate</button>
          </div>
        )}

        <h3 style={{ marginTop: 18 }}>Register / Update</h3>
        <form onSubmit={onRegister} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input placeholder="Name (no spaces is safest)" value={form.name}
                 onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            {types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>

          <input placeholder="IP address" value={form.ip_address}
                 onChange={e => setForm(f => ({ ...f, ip_address: e.target.value }))} />
          <input placeholder="Location" value={form.location}
                 onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />

          <input placeholder="Serial number" value={form.serial_number}
                 onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))} />
          <input placeholder="Access code" value={form.access_code}
                 onChange={e => setForm(f => ({ ...f, access_code: e.target.value }))} />

          <input placeholder="Port" value={form.port}
                 onChange={e => setForm(f => ({ ...f, port: e.target.value }))} />
          <input placeholder="WS port" value={form.ws_port}
                 onChange={e => setForm(f => ({ ...f, ws_port: e.target.value }))} />

          <input placeholder="MQTT port" value={form.mqtt_port}
                 onChange={e => setForm(f => ({ ...f, mqtt_port: e.target.value }))} />
          <input placeholder="use_tls (true/false)" value={form.use_tls}
                 onChange={e => setForm(f => ({ ...f, use_tls: e.target.value }))} />

          <input style={{ gridColumn: "1 / span 2" }} placeholder="Camera URL" value={form.camera_url}
                 onChange={e => setForm(f => ({ ...f, camera_url: e.target.value }))} />

          <button disabled={busy} type="submit" style={{ gridColumn: "1 / span 2" }}>
            {busy ? "Saving..." : "Save printer"}
          </button>
        </form>
      </div>

      <div>
        <h2 style={{ margin: 0 }}>Selected status</h2>
        {!selectedName && <div style={{ marginTop: 8, opacity: 0.7 }}>Select a printer…</div>}
        {selectedName && (
          <div style={{ marginTop: 12 }}>
            <div><b>Printer:</b> {selectedName}</div>
            <div><b>Connected:</b> {fmt(status?.connected)}</div>
            <div><b>State:</b> {fmt(status?.state)}</div>
            {status?.message && <div style={{ marginTop: 8, opacity: 0.8 }}>{status.message}</div>}

            <pre style={{ marginTop: 12, padding: 12, background: "#111", color: "#eee", borderRadius: 8, overflow: "auto" }}>
              {JSON.stringify(status, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
