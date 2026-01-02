import React, { useState, useEffect, useMemo, useCallback } from "react";
import { api, unwrap } from "../services/api";
import { useLivePrinters } from "../hooks/useWebSocket";
import { useLanguage } from "../i18n";

function normalizeProgress(raw) {
  if (raw === null || raw === undefined) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;

  // FIXED: Handle 0 explicitly in decimal range [0..1]
  if (n >= 0 && n <= 1) return Math.round(n * 100);
  // If backend gives [1..100], keep as-is
  if (n > 1 && n <= 100) return Math.round(n);

  // Clamp anything else
  if (n > 100) return 100;
  
  return 0; // Explicit fallback
}

function PrinterDashboard() {
  const { t } = useLanguage();
  const { printers: livePrintersRaw, connected: wsConnected } = useLivePrinters();

  const [dbPrinters, setDbPrinters] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedPrinter, setSelectedPrinter] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [printerTypes, setPrinterTypes] = useState([]);

  const [formData, setFormData] = useState({
    name: "",
    type: "creality_k1",
    ip_address: "",
    port: "",
    access_code: "",
    serial_number: "",
    location: "",
  });

  const liveMap = useMemo(() => {
    // supports either map { [name]: obj } or array [{name,...}]
    if (!livePrintersRaw) return {};
    if (Array.isArray(livePrintersRaw)) {
      const m = {};
      for (const p of livePrintersRaw) {
        if (p?.name) m[p.name] = p;
      }
      return m;
    }
    return typeof livePrintersRaw === "object" ? livePrintersRaw : {};
  }, [livePrintersRaw]);

  const fetchPrinters = useCallback(async () => {
    try {
      const res = await api.getPrinters();
      const payload = unwrap(res);
      const list = payload?.printers || [];
      setDbPrinters(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Failed to fetch printers:", err);
      setDbPrinters([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPrinterTypes = useCallback(async () => {
    try {
      const res = await api.getPrinterTypes();
      const payload = unwrap(res);
      const opts = payload?.options;
      if (Array.isArray(opts) && opts.length) {
        setPrinterTypes(opts);
        // ensure default type is valid
        if (!opts.some((o) => o.value === formData.type) && opts[0]?.value) {
          setFormData((f) => ({ ...f, type: opts[0].value }));
        }
      } else {
        setPrinterTypes([
          { value: "creality_k1", label: "Creality K1" },
          { value: "bambu_p1s", label: "Bambu P1S" },
          { value: "bambu_p2s", label: "Bambu P2S" },
        ]);
      }
    } catch {
      setPrinterTypes([
        { value: "creality_k1", label: "Creality K1" },
        { value: "bambu_p1s", label: "Bambu P1S" },
        { value: "bambu_p2s", label: "Bambu P2S" },
      ]);
    }
  }, [formData.type]);

  useEffect(() => {
    fetchPrinters();
    fetchPrinterTypes();
  }, [fetchPrinters, fetchPrinterTypes]);

  // Merge DB printers with live WebSocket data
  const printerList = useMemo(() => {
    return (dbPrinters || []).map((dbP) => {
      const live = liveMap?.[dbP.name] || {};
      const type = live.printer_type || live.type || dbP.printer_type || dbP.type || "unknown";

      const stateRaw = (live.state || live.status || dbP.status || "offline");
      const state = String(stateRaw).toLowerCase();

      const isOnline = ["operational", "ready", "printing", "idle", "online", "paused"].includes(state);
      const connected =
        typeof live.connected === "boolean" ? live.connected : isOnline;

      const nozzle_temp =
        live.nozzle_temp ??
        live.temperatures?.nozzle?.actual ??
        live.temps?.nozzle ??
        0;

      const bed_temp =
        live.bed_temp ??
        live.temperatures?.bed?.actual ??
        live.temps?.bed ??
        0;

      const chamber_temp =
        live.chamber_temp ??
        live.temperatures?.chamber?.actual ??
        live.temps?.chamber ??
        null;

      const job = live.job || {};
      const progress = normalizeProgress(job.progress ?? live.progress);

      return {
        ...dbP,
        ...live,
        printer_type: type,
        connected,
        state,
        nozzle_temp: Number(nozzle_temp) || 0,
        bed_temp: Number(bed_temp) || 0,
        chamber_temp: chamber_temp === null ? null : (Number(chamber_temp) || 0),
        progress,
        filename: job.filename || live.filename || "",
        time_remaining: Number(job.time_remaining || live.time_remaining || 0) || 0,
      };
    });
  }, [dbPrinters, liveMap]);

  // Printer actions
  const sendCommand = async (printerName, command, params = {}) => {
    setActionLoading(`${printerName}-${command}`);
    setError(null);
    try {
      await api.printerControl(printerName, command, params);
      setTimeout(fetchPrinters, 500);
    } catch (err) {
      const msg = unwrap(err?.response)?.error || err?.message || "Unknown error";
      setError(`${command} failed: ${msg}`);
    } finally {
      setActionLoading(null);
    }
  };

  const connectPrinter = async (printerName) => {
    setActionLoading(`${printerName}-connect`);
    setError(null);
    try {
      await api.connectPrinter(printerName);
      fetchPrinters();
    } catch (err) {
      const msg = unwrap(err?.response)?.error || err?.message || "Unknown error";
      setError(`${t('common.connect')} failed: ${msg}`);
    } finally {
      setActionLoading(null);
    }
  };

  const disconnectPrinter = async (printerName) => {
    setActionLoading(`${printerName}-disconnect`);
    setError(null);
    try {
      await api.disconnectPrinter(printerName);
      fetchPrinters();
    } catch (err) {
      const msg = unwrap(err?.response)?.error || err?.message || "Unknown error";
      setError(`${t('common.disconnect')} failed: ${msg}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddPrinter = async (e) => {
    e.preventDefault();
    setActionLoading("add");
    setError(null);
    try {
      const payload = {
        name: String(formData.name || "").trim(),
        type: formData.type,
        ip_address: String(formData.ip_address || "").trim() || undefined,
        port: formData.port === "" ? undefined : Number(formData.port),
        access_code: String(formData.access_code || "").trim() || undefined,
        serial_number: String(formData.serial_number || "").trim() || undefined,
        location: String(formData.location || "").trim() || undefined,
      };

      await api.registerPrinter(payload);

      setShowAddForm(false);
      setFormData({
        name: "",
        type: formData.type || "creality_k1",
        ip_address: "",
        port: "",
        access_code: "",
        serial_number: "",
        location: "",
      });

      fetchPrinters();
    } catch (err) {
      const msg = unwrap(err?.response)?.error || err?.message || "Failed to add printer";
      setError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const deletePrinter = async (printerName) => {
    if (!window.confirm(`${t('common.delete')} "${printerName}"?`)) return;
    setError(null);
    try {
      await api.deletePrinter(printerName);
      fetchPrinters();
    } catch (err) {
      const msg = unwrap(err?.response)?.error || err?.message || "Failed to delete printer";
      setError(msg);
    }
  };

  const getStateColor = (state) => {
    const colors = {
      printing: "text-blue-400 bg-blue-900/50 border border-blue-700/50",
      idle: "text-green-400 bg-green-900/50 border border-green-700/50",
      paused: "text-yellow-400 bg-yellow-900/50 border border-yellow-700/50",
      error: "text-red-400 bg-red-900/50 border border-red-700/50",
      offline: "text-zinc-400 bg-zinc-800/50 border border-zinc-700/50",
    };
    return colors[state] || colors.offline;
  };

  const getStateLabel = (state) => {
    const stateMap = {
      printing: t('printers.printing'),
      idle: t('printers.idle'),
      paused: t('printers.paused'),
      error: t('printers.error'),
      offline: t('printers.offline'),
      online: t('printers.online'),
    };
    return stateMap[state] || state;
  };

  const getTypeIcon = (type) => {
    const t = String(type || "").toLowerCase();
    if (t.includes("bambu")) return "🎋";
    if (t.includes("creality")) return "🦎";
    return "🖨️";
  };

  const formatTime = (seconds) => {
    const s = Number(seconds || 0);
    if (!Number.isFinite(s) || s <= 0) return "--";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="h-48 bg-gray-800 rounded-xl"></div>)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">🖨️ {t('printers.title')}</h2>
            <p className="text-sm text-zinc-400 mt-1">{printerList.length} {t('printers.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`text-xs px-3 py-1 rounded-full border ${
                wsConnected
                  ? "border-green-500 text-green-400 bg-green-900/30"
                  : "border-yellow-500 text-yellow-400 bg-yellow-900/30"
              }`}
            >
              {wsConnected ? `● ${t('printers.live')}` : `◐ ${t('printers.connecting')}`}
            </span>
            <button
              onClick={fetchPrinters}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-zinc-300 hover:bg-gray-700"
              title={t('common.refresh')}
            >
              🔄
            </button>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 rounded-lg text-white font-medium"
              style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)' }}
            >
              {showAddForm ? t('common.cancel') : `+ ${t('printers.addPrinter')}`}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 flex justify-between">
            {error}
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">×</button>
          </div>
        )}
      </div>

      {/* Add Printer Form */}
      {showAddForm && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="font-bold text-white mb-4">{t('printers.addPrinter')}</h3>
          <form onSubmit={handleAddPrinter} className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">{t('common.name')} *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-zinc-200 placeholder-zinc-500"
                placeholder="K1-Main"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">{t('printers.type')} *</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-zinc-200"
              >
                {printerTypes.map((pt) => (
                  <option key={pt.value} value={pt.value}>
                    {pt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">{t('printers.ipAddress')} *</label>
              <input
                type="text"
                value={formData.ip_address}
                onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-zinc-200 placeholder-zinc-500"
                placeholder="192.168.1.100"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">{t('printers.port')}</label>
              <input
                type="number"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-zinc-200 placeholder-zinc-500"
                placeholder="9999 (K1) / 8883 (Bambu)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">{t('printers.accessCode')}</label>
              <input
                type="text"
                value={formData.access_code}
                onChange={(e) => setFormData({ ...formData, access_code: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-zinc-200 placeholder-zinc-500"
                placeholder="For Bambu printers"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">{t('printers.location')}</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-zinc-200 placeholder-zinc-500"
                placeholder="Workshop A"
              />
            </div>
            <div className="col-span-full flex gap-2">
              <button
                type="submit"
                disabled={actionLoading === "add"}
                className="px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #22c55e 0%, #06b6d4 100%)' }}
              >
                {actionLoading === "add" ? `⏳ ${t('common.loading')}` : `💾 ${t('common.save')}`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Printer Grid */}
      {printerList.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
          <p className="text-5xl mb-4">🖨️</p>
          <p className="text-zinc-400">{t('printers.noPrinters')}</p>
          <p className="text-sm text-zinc-500">{t('printers.addFirst')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {printerList.map((p) => (
            <div
              key={p.name}
              className={`bg-gray-900 rounded-xl border-2 transition-all ${
                p.state === "printing"
                  ? "border-blue-500 ring-2 ring-blue-500/20"
                  : p.connected
                  ? "border-green-700/50"
                  : "border-gray-700"
              }`}
            >
              {/* Header */}
              <div className="p-4 border-b border-gray-800">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                      {getTypeIcon(p.printer_type)} {p.name}
                    </h3>
                    <p className="text-xs text-zinc-500">
                      {p.printer_type} • {p.ip_address || "no ip"}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${getStateColor(p.state)}`}>
                    {getStateLabel(p.state)}
                  </span>
                </div>
              </div>

              {/* Temperatures */}
              <div className="p-4 grid grid-cols-3 gap-2 text-center bg-gray-800/50">
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase">{t('printers.nozzle')}</p>
                  <p className="text-lg font-mono font-bold text-orange-400">{(p.nozzle_temp ?? 0).toFixed?.(0) ?? 0}°</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase">{t('printers.bed')}</p>
                  <p className="text-lg font-mono font-bold text-red-400">{(p.bed_temp ?? 0).toFixed?.(0) ?? 0}°</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase">{t('printers.chamber')}</p>
                  <p className="text-lg font-mono font-bold text-purple-400">
                    {p.chamber_temp === null ? "--" : ((p.chamber_temp ?? 0).toFixed?.(0) ?? 0)}°
                  </p>
                </div>
              </div>

              {/* Print Progress (if printing) */}
              {p.state === "printing" && (
                <div className="p-4 bg-blue-900/20 border-t border-blue-800/50">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="truncate font-medium text-zinc-300">{p.filename || t('printers.printing') + "..."}</span>
                    <span className="font-bold text-blue-400">{p.progress || 0}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${p.progress || 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-blue-400 mt-1">⏱️ {formatTime(p.time_remaining)} {t('printers.remaining')}</p>
                </div>
              )}

              {/* Actions */}
              <div className="p-3 flex flex-wrap gap-2 border-t border-gray-800">
                {!p.connected ? (
                  <button
                    onClick={() => connectPrinter(p.name)}
                    disabled={actionLoading === `${p.name}-connect`}
                    className="flex-1 px-3 py-1.5 text-sm bg-green-900/50 text-green-400 border border-green-700/50 rounded-lg hover:bg-green-900/70 disabled:opacity-50"
                  >
                    {actionLoading === `${p.name}-connect` ? "⏳" : "🔗"} {t('common.connect')}
                  </button>
                ) : (
                  <>
                    <span
                      className="px-2 py-1 text-[10px] bg-gray-800 text-zinc-500 rounded border border-gray-700"
                      title={p.mode === "moonraker" ? "Full Moonraker control" : "Some controls may be limited"}
                    >
                      {p.mode === "moonraker" ? "🌙 Full" : "📡 Limited"}
                    </span>

                    {p.state === "printing" && (
                      <>
                        <button
                          onClick={() => sendCommand(p.name, "pause")}
                          disabled={!!actionLoading}
                          className="px-3 py-1.5 text-sm bg-yellow-900/50 text-yellow-400 border border-yellow-700/50 rounded-lg hover:bg-yellow-900/70"
                          title={t('common.pause')}
                        >
                          ⏸️
                        </button>
                        <button
                          onClick={() => sendCommand(p.name, "stop")}
                          disabled={!!actionLoading}
                          className="px-3 py-1.5 text-sm bg-red-900/50 text-red-400 border border-red-700/50 rounded-lg hover:bg-red-900/70"
                          title={t('common.stop')}
                        >
                          ⏹️
                        </button>
                      </>
                    )}

                    {p.state === "paused" && (
                      <button
                        onClick={() => sendCommand(p.name, "resume")}
                        disabled={!!actionLoading}
                        className="px-3 py-1.5 text-sm bg-green-900/50 text-green-400 border border-green-700/50 rounded-lg hover:bg-green-900/70"
                        title={t('common.resume')}
                      >
                        ▶️
                      </button>
                    )}

                    <button
                      onClick={() => {
                        const nozzle = prompt(`${t('printers.nozzle')} temp (0 = cool):`, "200");
                        if (nozzle !== null) sendCommand(p.name, "temp", { nozzle: parseInt(nozzle, 10) });
                      }}
                      disabled={!!actionLoading}
                      className="px-3 py-1.5 text-sm bg-orange-900/50 text-orange-400 border border-orange-700/50 rounded-lg hover:bg-orange-900/70"
                      title={t('printers.nozzle')}
                    >
                      🔥
                    </button>

                    <button
                      onClick={() => {
                        const bed = prompt(`${t('printers.bed')} temp (0 = cool):`, "60");
                        if (bed !== null) sendCommand(p.name, "temp", { bed: parseInt(bed, 10) });
                      }}
                      disabled={!!actionLoading}
                      className="px-3 py-1.5 text-sm bg-purple-900/50 text-purple-400 border border-purple-700/50 rounded-lg hover:bg-purple-900/70"
                      title={t('printers.bed')}
                    >
                      🛏️
                    </button>

                    <button
                      onClick={() => sendCommand(p.name, "light")}
                      disabled={!!actionLoading}
                      className="px-3 py-1.5 text-sm bg-yellow-900/30 text-yellow-400 border border-yellow-700/50 rounded-lg hover:bg-yellow-900/50"
                      title="Toggle light"
                    >
                      💡
                    </button>

                    <button
                      onClick={() => disconnectPrinter(p.name)}
                      disabled={!!actionLoading}
                      className="px-3 py-1.5 text-sm bg-orange-900/50 text-orange-400 border border-orange-700/50 rounded-lg hover:bg-orange-900/70"
                      title={t('common.disconnect')}
                    >
                      🔌
                    </button>
                  </>
                )}

                <button
                  onClick={() => setSelectedPrinter(selectedPrinter === p.name ? null : p.name)}
                  className="px-3 py-1.5 text-sm bg-gray-800 text-zinc-400 border border-gray-700 rounded-lg hover:bg-gray-700"
                  title={t('common.details')}
                >
                  📊
                </button>

                <button
                  onClick={() => deletePrinter(p.name)}
                  className="px-3 py-1.5 text-sm bg-red-900/30 text-red-400 border border-red-700/50 rounded-lg hover:bg-red-900/50"
                  title={t('common.delete')}
                >
                  🗑️
                </button>
              </div>

              {/* Expanded Details */}
              {selectedPrinter === p.name && (
                <div className="p-4 bg-gray-800/50 border-t border-gray-700 text-xs">
                  <h4 className="font-bold text-zinc-300 mb-2">{t('common.details')}</h4>
                  <pre className="bg-gray-900 p-2 rounded-lg overflow-auto max-h-40 text-[10px] text-zinc-400 border border-gray-700">
                    {JSON.stringify(liveMap[p.name] || p, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Quick Help */}
      <div 
        className="rounded-xl border p-6"
        style={{ 
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(34, 197, 94, 0.08) 100%)',
          borderColor: 'rgba(59, 130, 246, 0.2)'
        }}
      >
        <h4 className="font-bold text-white mb-3 flex items-center gap-2">💡 {t('printers.connectionTips')}</h4>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800">
            <p className="font-medium text-zinc-200 mb-1">🦎 Creality K1</p>
            <p className="text-zinc-400 text-xs">Uses WebSocket on port 9999. Make sure firmware supports local API.</p>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800">
            <p className="font-medium text-zinc-200 mb-1">🎋 Bambu Lab</p>
            <p className="text-zinc-400 text-xs">Enable LAN mode, use Access Code from printer settings. Port 8883 (MQTT).</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PrinterDashboard;
