// Enhanced PrinterTools - Phase A with real-time estimates
import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { api } from '../services/api';

const toast = {
  success: (msg) => {
    console.log('[SUCCESS]', msg);
    if (window?.showNotification) window.showNotification(msg, 'success');
  },
  error: (msg) => {
    console.error('[ERROR]', msg);
    if (window?.showNotification) window.showNotification(msg, 'error');
  },
};

function PrinterToolsEnhanced({ printers = [], onRefresh }) {
  const [activeTab, setActiveTab] = useState('quick');
  const [loading, setLoading] = useState({});
  const [selectedMaterial, setSelectedMaterial] = useState('PLA');

  const materials = ['PLA', 'PLA+', 'PETG', 'ABS', 'TPU', 'ASA', 'NYLON'];

  const getIsConnected = (printer) => {
    if (printer?.connected) return true;
    if ((printer?.nozzle_temp || 0) > 0 || (printer?.bed_temp || 0) > 0) return true;
    if (printer?.status && !['unknown', 'disconnected', 'offline'].includes(printer.status.toLowerCase())) return true;
    return false;
  };

  const safePrinters = Array.isArray(printers) ? printers : [];
  const displayPrinters = safePrinters;
  const actuallyConnectedPrinters = safePrinters.filter(p => getIsConnected(p));
  
  const idlePrinters = actuallyConnectedPrinters.filter(p => p?.state === 'idle');
  const hotPrinters = actuallyConnectedPrinters.filter(p => (p?.nozzle_temp || 0) > 50 || (p?.bed_temp || 0) > 40);
  const printingPrinters = actuallyConnectedPrinters.filter(p => p?.state === 'printing');

  const tabs = [
    { id: 'quick', label: 'Quick Actions', icon: '⚡' },
    { id: 'slice', label: 'Slice & Print', icon: '🚀' },
    { id: 'calibrate', label: 'Calibration', icon: '🔧' },
  ];

  const handleQuickPreheat = async (printerName) => {
    const key = `preheat-${printerName}`;
    setLoading(prev => ({ ...prev, [key]: true }));
    try {
      await api.quickPreheat(printerName, selectedMaterial);
      toast.success(`Preheating ${printerName} for ${selectedMaterial}`);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Preheat failed:', err);
      toast.error(err.message || 'Preheat failed');
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleQuickCooldown = async (printerName) => {
    const key = `cooldown-${printerName}`;
    setLoading(prev => ({ ...prev, [key]: true }));
    try {
      await api.quickCooldown(printerName);
      toast.success(`Cooling down ${printerName}`);
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error(err.message || 'Cooldown failed');
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleQuickHome = async (printerName) => {
    const key = `home-${printerName}`;
    setLoading(prev => ({ ...prev, [key]: true }));
    try {
      await api.quickHome(printerName);
      toast.success(`Homing ${printerName}`);
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error(err.message || 'Home failed');
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const handlePreheatAll = async () => {
    setLoading(prev => ({ ...prev, preheatAll: true }));
    try {
      const idle = printers.filter(p => getIsConnected(p) && p.state === 'idle');
      await Promise.all(
        idle.map(p => api.quickPreheat(p.name, selectedMaterial))
      );
      toast.success(`Preheating ${idle.length} printers for ${selectedMaterial}`);
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error('Some preheats failed');
    } finally {
      setLoading(prev => ({ ...prev, preheatAll: false }));
    }
  };

  const handleCooldownAll = async () => {
    setLoading(prev => ({ ...prev, cooldownAll: true }));
    try {
      const hot = printers.filter(p => getIsConnected(p) && ((p.nozzle_temp || 0) > 50 || (p.bed_temp || 0) > 40));
      await Promise.all(
        hot.map(p => api.quickCooldown(p.name))
      );
      toast.success(`Cooling down ${hot.length} printers`);
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error('Some cooldowns failed');
    } finally {
      setLoading(prev => ({ ...prev, cooldownAll: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl shadow-lg overflow-hidden" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>
        <div className="border-b border-slate-700 flex">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-purple-900/50 to-cyan-900/50 text-white border-b-2 border-purple-500'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {activeTab === 'quick' && (
          <div className="p-6">
            <div className="flex flex-wrap gap-3 mb-6">
              <div className="px-4 py-2 bg-blue-900/30 text-blue-300 rounded-lg text-sm font-medium border border-blue-800">
                🖨️ {printingPrinters.length} Printing
              </div>
              <div className="px-4 py-2 bg-green-900/30 text-green-300 rounded-lg text-sm font-medium border border-green-800">
                ✅ {idlePrinters.length} Idle
              </div>
              <div className="px-4 py-2 bg-orange-900/30 text-orange-300 rounded-lg text-sm font-medium border border-orange-800">
                🔥 {hotPrinters.length} Hot
              </div>
              <div className="px-4 py-2 bg-slate-700/50 text-slate-300 rounded-lg text-sm font-medium border border-slate-600">
                📡 {actuallyConnectedPrinters.length} Connected
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Preheat Material
              </label>
              <div className="flex flex-wrap gap-2">
                {materials.map(mat => (
                  <button
                    key={mat}
                    onClick={() => setSelectedMaterial(mat)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedMaterial === mat
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {mat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mb-6 pb-6 border-b border-slate-700">
              <button
                onClick={handlePreheatAll}
                disabled={loading.preheatAll || idlePrinters.length === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {loading.preheatAll ? <span className="animate-spin">⏳</span> : '🔥'}
                Preheat All ({idlePrinters.length})
              </button>

              <button
                onClick={handleCooldownAll}
                disabled={loading.cooldownAll || hotPrinters.length === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {loading.cooldownAll ? <span className="animate-spin">⏳</span> : '❄️'}
                Cooldown All ({hotPrinters.length})
              </button>
            </div>

            <h3 className="font-medium text-slate-300 mb-4">Individual Printer Controls</h3>
            
            {displayPrinters.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <div className="text-4xl mb-2">📡</div>
                <p className="font-medium">No printers connected</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayPrinters.map(printer => (
                  <div
                    key={printer.name}
                    className="border border-slate-700 rounded-lg p-4 bg-slate-800/50"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-white">{printer.name}</h4>
                        <p className="text-sm text-slate-400">
                          {printer.state === 'printing' ? (
                            <span className="text-blue-400">🖨️ Printing</span>
                          ) : printer.state === 'idle' ? (
                            <span className="text-green-400">✅ Ready</span>
                          ) : (
                            <span className="text-slate-400">{printer.state}</span>
                          )}
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        {!getIsConnected(printer) && (
                          <div className="text-red-400 text-xs font-bold mb-1">📡 OFFLINE</div>
                        )}
                        {(printer.nozzle_temp || 0) > 0 && (
                          <div className={(printer.nozzle_temp || 0) > 50 ? 'text-orange-400' : 'text-slate-500'}>
                            🔥 {Math.round(printer.nozzle_temp || 0)}°C
                          </div>
                        )}
                        {(printer.bed_temp || 0) > 0 && (
                          <div className={(printer.bed_temp || 0) > 40 ? 'text-orange-400' : 'text-slate-500'}>
                            🛏️ {Math.round(printer.bed_temp || 0)}°C
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleQuickPreheat(printer.name)}
                        disabled={loading[`preheat-${printer.name}`] || printer.state === 'printing' || !getIsConnected(printer)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-orange-900/50 text-orange-300 rounded hover:bg-orange-800/50 disabled:opacity-50 text-sm font-medium border border-orange-800"
                      >
                        {loading[`preheat-${printer.name}`] ? '⏳' : '🔥'} Heat
                      </button>

                      <button
                        onClick={() => handleQuickCooldown(printer.name)}
                        disabled={loading[`cooldown-${printer.name}`] || !getIsConnected(printer)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-900/50 text-blue-300 rounded hover:bg-blue-800/50 disabled:opacity-50 text-sm font-medium border border-blue-800"
                      >
                        {loading[`cooldown-${printer.name}`] ? '⏳' : '❄️'} Cool
                      </button>

                      <button
                        onClick={() => handleQuickHome(printer.name)}
                        disabled={loading[`home-${printer.name}`] || printer.state === 'printing' || !getIsConnected(printer)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 disabled:opacity-50 text-sm font-medium border border-slate-600"
                      >
                        {loading[`home-${printer.name}`] ? '⏳' : '🏠'} Home
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'slice' && (
          <div className="p-6">
            <SliceAndPrintContent printers={displayPrinters} onRefresh={onRefresh} />
          </div>
        )}

        {activeTab === 'calibrate' && (
          <div className="p-6">
            <CalibrationContent printers={displayPrinters} onRefresh={onRefresh} />
          </div>
        )}
      </div>
    </div>
  );
}

// Slice and Print with real-time estimates
function SliceAndPrintContent({ printers = [], onRefresh }) {
  const [file, setFile] = useState(null);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [autoStart, setAutoStart] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [estimate, setEstimate] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const [settings, setSettings] = useState({
    material: 'PLA',
    layer_height: 0.2,
    infill: 20,
    supports: false,
  });
  const estimateTimeoutRef = useRef(null);

  useEffect(() => {
    if (!file) {
      setEstimate(null);
      return;
    }

    if (estimateTimeoutRef.current) {
      clearTimeout(estimateTimeoutRef.current);
    }

    estimateTimeoutRef.current = setTimeout(() => {
      fetchEstimate();
    }, 300);

    return () => {
      if (estimateTimeoutRef.current) {
        clearTimeout(estimateTimeoutRef.current);
      }
    };
  }, [file, settings]);

  const fetchEstimate = async () => {
    if (!file) return;
    setEstimating(true);
    try {
      const data = await api.getQuickEstimate(file, settings).catch(() => null);
      if (data?.estimate || data) {
        setEstimate(data?.estimate || data);
      }
    } catch (err) {
      console.warn('Estimate failed:', err.message);
    } finally {
      setEstimating(false);
    }
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const ext = selectedFile.name.split('.').pop()?.toLowerCase();
      if (ext !== 'stl' && ext !== '3mf') {
        toast.error('Please upload an STL or 3MF file');
        return;
      }
      setFile(selectedFile);
      setResult(null);
      setEstimate(null);
    }
  };

  const handleSliceAndPrint = async () => {
    if (!file || !selectedPrinter) {
      toast.error('Please select a file and printer');
      return;
    }

    setProcessing(true);
    setResult(null);

    try {
      const data = await api.sliceAndPrint(file, selectedPrinter, settings, autoStart);
      setResult(data);
      
      if (data.result?.print_started) {
        toast.success(`Print started on ${selectedPrinter}!`);
      } else if (data.result?.uploaded) {
        toast.success(`G-code uploaded to ${selectedPrinter}`);
      } else {
        toast.success('Slicing complete!');
      }

      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Slice and print failed:', err);
      toast.error(err.message || 'Failed to slice and print');
    } finally {
      setProcessing(false);
    }
  };

  const formatTime = (minutes) => {
    if (!minutes) return '—';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const estimateCost = () => {
    if (!estimate?.filament_used_g) return null;
    const costPerKg = 18;
    const costPerGram = costPerKg / 1000;
    return (estimate.filament_used_g * costPerGram).toFixed(2);
  };

  const connectedPrinters = printers.filter(p => p?.nozzle_temp >= 0 || p?.connected);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <h3 className="font-medium text-slate-300">📄 Model File</h3>
          
          <div className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center hover:border-slate-500 transition-colors cursor-pointer">
            {file ? (
              <div className="space-y-2">
                <div className="text-4xl">✅</div>
                <div className="font-medium text-white text-sm">{file.name}</div>
                <div className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                <button
                  onClick={() => setFile(null)}
                  className="text-xs text-red-400 hover:text-red-300 mt-2"
                >
                  Change File
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-4xl">📥</div>
                <div className="text-sm text-slate-400">Drop model here</div>
                <label className="inline-block px-3 py-1 bg-green-600 text-white text-xs rounded cursor-pointer hover:bg-green-700">
                  Browse
                  <input
                    type="file"
                    accept=".stl,.3mf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">🖨️ Target Printer</label>
            <select
              value={selectedPrinter}
              onChange={e => setSelectedPrinter(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Select printer...</option>
              {connectedPrinters.map(p => (
                <option key={p.name} value={p.name} disabled={p.state === 'printing'}>
                  {p.name} {p.state === 'printing' ? '(🖨️ Busy)' : '(✅ Ready)'}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={autoStart}
              onChange={e => setAutoStart(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-slate-300">Auto-start after upload</span>
          </label>
        </div>

        <div className="lg:col-span-1 space-y-4">
          <h3 className="font-medium text-slate-300">⚙️ Print Settings</h3>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2 uppercase">Material</label>
            <div className="grid grid-cols-2 gap-2">
              {['PLA', 'PETG', 'ABS', 'TPU'].map(mat => (
                <button
                  key={mat}
                  onClick={() => setSettings(prev => ({ ...prev, material: mat }))}
                  className={`px-3 py-2 rounded text-xs font-medium transition-all ${
                    settings.material === mat
                      ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {mat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Layer Height: {settings.layer_height}mm</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 0.12, label: 'Fine' },
                { value: 0.2, label: 'Std' },
                { value: 0.28, label: 'Draft' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSettings(prev => ({ ...prev, layer_height: opt.value }))}
                  className={`px-2 py-1.5 rounded text-xs font-medium transition-all ${
                    settings.layer_height === opt.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Infill: {settings.infill}%</label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={settings.infill}
              onChange={e => setSettings(prev => ({ ...prev, infill: parseInt(e.target.value) }))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={settings.supports}
              onChange={e => setSettings(prev => ({ ...prev, supports: e.target.checked }))}
              className="w-4 h-4 rounded"
            />
            <span className="text-slate-300 text-xs">Tree supports</span>
          </label>
        </div>

        <div className="lg:col-span-1 space-y-4">
          <h3 className="font-medium text-slate-300">📊 Live Estimate {estimating && '⏳'}</h3>

          {file && estimate ? (
            <div className="space-y-3 bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <div className="bg-slate-900 rounded p-3">
                <div className="text-xs text-slate-400">⏱️ Print Time</div>
                <div className="text-2xl font-bold text-white">{formatTime(estimate.print_time_minutes)}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-900 rounded p-3">
                  <div className="text-xs text-slate-400">📦 Filament</div>
                  <div className="text-xl font-bold text-orange-400">{estimate.filament_used_g?.toFixed(1) || '0'}g</div>
                </div>
                <div className="bg-slate-900 rounded p-3">
                  <div className="text-xs text-slate-400">💵 Cost</div>
                  <div className="text-xl font-bold text-green-400">${estimateCost() || '0.00'}</div>
                </div>
              </div>

              <div className="text-xs text-slate-500 text-center mt-2">
                ✨ Updates as you adjust settings
              </div>
            </div>
          ) : file && estimating ? (
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 text-center">
              <div className="text-4xl mb-2 animate-spin">⏳</div>
              <div className="text-sm text-slate-400">Calculating...</div>
            </div>
          ) : (
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 text-center">
              <div className="text-3xl mb-2">📤</div>
              <div className="text-sm text-slate-400">Select a file to see estimates</div>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={handleSliceAndPrint}
        disabled={!file || !selectedPrinter || processing}
        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-500 text-white rounded-lg hover:from-green-700 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg transition-all"
      >
        {processing ? (
          <>
            <span className="animate-spin">⏳</span>
            Slicing & {autoStart ? 'Printing' : 'Uploading'}...
          </>
        ) : (
          <>
            🚀 {autoStart ? 'Slice & Print' : 'Slice & Upload'}
          </>
        )}
      </button>

      {result && (
        <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
          <h4 className="font-medium text-white mb-4 flex items-center gap-2">
            {result.result?.success ? '✅ Success!' : '⚠️ Complete'}
          </h4>
          {result.result?.slice_result && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-800 rounded-lg p-4">
                <div className="text-slate-400 text-xs mb-1">PRINT TIME</div>
                <div className="font-bold text-white">{result.result.slice_result.print_time_formatted || 'N/A'}</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-4">
                <div className="text-slate-400 text-xs mb-1">FILAMENT</div>
                <div className="font-bold text-orange-400">{result.result.slice_result.filament_used_g?.toFixed(1) || '0'}g</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-4">
                <div className="text-slate-400 text-xs mb-1">LAYERS</div>
                <div className="font-bold text-white">{result.result.slice_result.layer_count || 'N/A'}</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-4">
                <div className="text-slate-400 text-xs mb-1">STATUS</div>
                <div className="font-bold text-green-400">
                  {result.result.print_started ? '🖨️ Printing' : result.result.uploaded ? '✅ Uploaded' : '⚠️ Ready'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Calibration content
function CalibrationContent({ printers = [], onRefresh }) {
  const [calibrationTypes] = useState([
    { type: 'flow_rate', name: 'Flow Rate Calibration', description: 'Calibrate extrusion multiplier' },
    { type: 'pressure_advance', name: 'Pressure Advance', description: 'Tune linear advance for clean corners' },
    { type: 'temp_tower', name: 'Temperature Tower', description: 'Find optimal printing temperature' },
    { type: 'retraction', name: 'Retraction Test', description: 'Optimize retraction settings' },
  ]);
  const [selectedType, setSelectedType] = useState('flow_rate');
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [generating, setGenerating] = useState(false);

  const typeIcons = {
    flow_rate: '💧',
    pressure_advance: '📐',
    temp_tower: '🌡️',
    retraction: '↔️',
  };

  const connectedPrinters = printers.filter(p => p?.nozzle_temp >= 0 || p?.connected);

  return (
    <div className="space-y-6">
      <h3 className="font-medium text-slate-300 mb-4">🔨 Calibration Tools</h3>
      <div className="grid grid-cols-2 gap-2">
        {calibrationTypes.map(cal => (
          <button
            key={cal.type}
            onClick={() => setSelectedType(cal.type)}
            className={`p-3 rounded-lg border text-left transition-all ${
              selectedType === cal.type
                ? 'border-purple-500 bg-purple-900/30'
                : 'border-slate-600 hover:border-slate-500 bg-slate-700/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">{typeIcons[cal.type] || '⚙️'}</span>
              <div>
                <div className="font-medium text-sm text-white">{cal.name}</div>
                <div className="text-xs text-slate-400 truncate">{cal.description}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={() => setGenerating(true)}
        disabled={generating || !selectedType}
        className="w-full flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-cyan-500 text-white rounded-lg hover:from-purple-700 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
      >
        {generating ? (
          <>
            <span className="animate-spin">⏳</span>
            Generating...
          </>
        ) : (
          <>
            🔨 Generate G-code
          </>
        )}
      </button>
    </div>
  );
}

PrinterToolsEnhanced.propTypes = {
  printers: PropTypes.arrayOf(PropTypes.object),
  onRefresh: PropTypes.func,
};

export default PrinterToolsEnhanced;
