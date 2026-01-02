import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { api } from '../services/api';
import toast from '../utils/toast';

/**
 * Printer Tools Dashboard
 * 
 * Unified interface for:
 * - Quick actions (preheat, cooldown, home)
 * - Slice & Print workflow
 * - Calibration tools
 */
function PrinterTools({ printers = [], onRefresh }) {
  const [activeTab, setActiveTab] = useState('quick');
  const [loading, setLoading] = useState({});
  const [selectedMaterial, setSelectedMaterial] = useState('PLA');
  const [slicerStatus, setSlicerStatus] = useState(null);

  const materials = ['PLA', 'PLA+', 'PETG', 'ABS', 'TPU', 'ASA', 'NYLON'];

  useEffect(() => {
    checkSlicerStatus();
  }, []);

  const checkSlicerStatus = async () => {
    try {
      const data = await api.getSlicerStatus();
      setSlicerStatus(data);
    } catch (err) {
      console.error('Failed to check slicer status:', err);
    }
  };

  // Quick action handlers
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
      console.error('Cooldown failed:', err);
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
      console.error('Home failed:', err);
      toast.error(err.message || 'Home failed');
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const handlePreheatAll = async () => {
    setLoading(prev => ({ ...prev, preheatAll: true }));
    try {
      const idlePrinters = printers.filter(p => p.connected && p.state === 'idle');
      await Promise.all(
        idlePrinters.map(p => api.quickPreheat(p.name, selectedMaterial))
      );
      toast.success(`Preheating ${idlePrinters.length} printers for ${selectedMaterial}`);
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
      const hotPrinters = printers.filter(p => p.connected && (p.nozzle_temp > 50 || p.bed_temp > 40));
      await Promise.all(
        hotPrinters.map(p => api.quickCooldown(p.name))
      );
      toast.success(`Cooling down ${hotPrinters.length} printers`);
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error('Some cooldowns failed');
    } finally {
      setLoading(prev => ({ ...prev, cooldownAll: false }));
    }
  };

  const connectedPrinters = printers.filter(p => p.connected);
  const idlePrinters = connectedPrinters.filter(p => p.state === 'idle');
  const hotPrinters = connectedPrinters.filter(p => p.nozzle_temp > 50 || p.bed_temp > 40);
  const printingPrinters = connectedPrinters.filter(p => p.state === 'printing');

  const tabs = [
    { id: 'quick', label: 'Quick Actions', icon: '⚡' },
    { id: 'slice', label: 'Slice & Print', icon: '🚀' },
    { id: 'calibrate', label: 'Calibration', icon: '🔧' },
  ];

  return (
    <div className="space-y-6">
      {/* Slicer status banner */}
      {slicerStatus && !slicerStatus.available && (
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-medium text-yellow-200">OrcaSlicer not configured</p>
            <p className="text-sm text-yellow-400 mt-1">
              {slicerStatus.slicer_installed
                ? 'Slicer is installed but profiles are missing. Please configure K1 profiles in OrcaSlicer.'
                : 'OrcaSlicer is not installed. Install OrcaSlicer for advanced slicing features.'}
            </p>
          </div>
        </div>
      )}

      {/* Tab navigation */}
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

        {/* Quick Actions Tab */}
        {activeTab === 'quick' && (
          <div className="p-6">
            {/* Status summary */}
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
                📡 {connectedPrinters.length} Connected
              </div>
            </div>

            {/* Material selector for preheat */}
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

            {/* Global quick actions */}
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

            {/* Per-printer actions */}
            <h3 className="font-medium text-slate-300 mb-4">Individual Printer Controls</h3>
            
            {connectedPrinters.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <div className="text-4xl mb-2">📡</div>
                <p>No printers connected</p>
                <p className="text-sm">Connect a printer to use quick actions</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {connectedPrinters.map(printer => (
                  <div
                    key={printer.name}
                    className="border border-slate-700 rounded-lg p-4 bg-slate-800/50"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-white">{printer.name}</h4>
                        <p className="text-sm text-slate-400">
                          {printer.state === 'printing' ? (
                            <span className="text-blue-400">🖨️ Printing {printer.job?.progress?.toFixed(0) || 0}%</span>
                          ) : printer.state === 'idle' ? (
                            <span className="text-green-400">✅ Ready</span>
                          ) : (
                            <span className="text-slate-400">{printer.state}</span>
                          )}
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        {printer.nozzle_temp > 0 && (
                          <div className={printer.nozzle_temp > 50 ? 'text-orange-400' : 'text-slate-500'}>
                            🔥 {Math.round(printer.nozzle_temp)}°C
                          </div>
                        )}
                        {printer.bed_temp > 0 && (
                          <div className={printer.bed_temp > 40 ? 'text-orange-400' : 'text-slate-500'}>
                            🛏️ {Math.round(printer.bed_temp)}°C
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleQuickPreheat(printer.name)}
                        disabled={loading[`preheat-${printer.name}`] || printer.state === 'printing'}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-orange-900/50 text-orange-300 rounded hover:bg-orange-800/50 disabled:opacity-50 text-sm font-medium border border-orange-800"
                      >
                        {loading[`preheat-${printer.name}`] ? '⏳' : '🔥'} Heat
                      </button>

                      <button
                        onClick={() => handleQuickCooldown(printer.name)}
                        disabled={loading[`cooldown-${printer.name}`]}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-900/50 text-blue-300 rounded hover:bg-blue-800/50 disabled:opacity-50 text-sm font-medium border border-blue-800"
                      >
                        {loading[`cooldown-${printer.name}`] ? '⏳' : '❄️'} Cool
                      </button>

                      <button
                        onClick={() => handleQuickHome(printer.name)}
                        disabled={loading[`home-${printer.name}`] || printer.state === 'printing'}
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

        {/* Slice & Print Tab */}
        {activeTab === 'slice' && (
          <div className="p-6">
            <SliceAndPrintContent printers={printers} onRefresh={onRefresh} />
          </div>
        )}

        {/* Calibration Tab */}
        {activeTab === 'calibrate' && (
          <div className="p-6">
            <CalibrationContent printers={printers} onRefresh={onRefresh} />
          </div>
        )}
      </div>
    </div>
  );
}

// Inline Slice and Print content
function SliceAndPrintContent({ printers = [], onRefresh }) {
  const [file, setFile] = useState(null);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [autoStart, setAutoStart] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [settings, setSettings] = useState({
    material: 'PLA',
    layer_height: 0.2,
    infill: 20,
    supports: false,
  });

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

  const connectedPrinters = printers.filter(p => p.connected);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* File upload */}
        <div className="space-y-4">
          <div className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center hover:border-slate-500 transition-colors">
            {file ? (
              <div className="space-y-2">
                <div className="text-4xl">📄</div>
                <div className="font-medium text-white">{file.name}</div>
                <div className="text-sm text-slate-400">{(file.size / 1024).toFixed(1)} KB</div>
                <button
                  onClick={() => setFile(null)}
                  className="text-sm text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-4xl">📥</div>
                <div className="text-slate-400">Drop STL file here or click to browse</div>
                <label className="inline-block px-4 py-2 bg-green-600 text-white rounded-lg cursor-pointer hover:bg-green-700">
                  Browse Files
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
            <label className="block text-sm font-medium text-slate-300 mb-2">Target Printer</label>
            <select
              value={selectedPrinter}
              onChange={e => setSelectedPrinter(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2"
            >
              <option value="">Select a printer...</option>
              {connectedPrinters.map(p => (
                <option key={p.name} value={p.name} disabled={p.state === 'printing'}>
                  {p.name} - {p.state === 'printing' ? '🖨️ Busy' : '✅ Ready'}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={autoStart}
              onChange={e => setAutoStart(e.target.checked)}
              className="w-5 h-5 rounded text-green-600"
            />
            <span className="text-slate-300">Start print automatically after upload</span>
          </label>
        </div>

        {/* Settings */}
        <div className="space-y-4">
          <h3 className="font-medium text-slate-300">Print Settings</h3>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Material</label>
            <select
              value={settings.material}
              onChange={e => setSettings(prev => ({ ...prev, material: e.target.value }))}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2"
            >
              <option value="PLA">PLA</option>
              <option value="PETG">PETG</option>
              <option value="ABS">ABS</option>
              <option value="TPU">TPU</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Layer Height</label>
            <select
              value={settings.layer_height}
              onChange={e => setSettings(prev => ({ ...prev, layer_height: parseFloat(e.target.value) }))}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2"
            >
              <option value={0.12}>0.12mm (Fine)</option>
              <option value={0.2}>0.20mm (Standard)</option>
              <option value={0.28}>0.28mm (Draft)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Infill: {settings.infill}%</label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={settings.infill}
              onChange={e => setSettings(prev => ({ ...prev, infill: parseInt(e.target.value) }))}
              className="w-full"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.supports}
              onChange={e => setSettings(prev => ({ ...prev, supports: e.target.checked }))}
              className="w-5 h-5 rounded text-green-600"
            />
            <span className="text-slate-300">Enable supports</span>
          </label>
        </div>
      </div>

      <button
        onClick={handleSliceAndPrint}
        disabled={!file || !selectedPrinter || processing}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-500 text-white rounded-lg hover:from-green-700 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-lg"
      >
        {processing ? (
          <>
            <span className="animate-spin">⏳</span>
            Processing...
          </>
        ) : (
          <>
            🚀 Slice & {autoStart ? 'Print' : 'Upload'}
          </>
        )}
      </button>

      {result && (
        <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
          <h4 className="font-medium text-white mb-3">
            {result.result?.success ? '✅' : '❌'} Result
          </h4>
          {result.result?.slice_result && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-slate-800 rounded-lg p-3">
                <div className="text-slate-400 text-xs">Print Time</div>
                <div className="font-bold text-white">{result.result.slice_result.print_time_formatted || 'N/A'}</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-3">
                <div className="text-slate-400 text-xs">Filament</div>
                <div className="font-bold text-white">{result.result.slice_result.filament_used_g?.toFixed(1) || '0'}g</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-3">
                <div className="text-slate-400 text-xs">Layers</div>
                <div className="font-bold text-white">{result.result.slice_result.layer_count || 'N/A'}</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-3">
                <div className="text-slate-400 text-xs">Status</div>
                <div className="font-bold text-green-400">
                  {result.result.print_started ? '🖨️ Printing' : result.result.uploaded ? '✅ Uploaded' : '⚠️ Pending'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Inline Calibration content
function CalibrationContent({ printers = [], onRefresh }) {
  const [calibrationTypes] = useState([
    { type: 'flow_rate', name: 'Flow Rate Calibration', description: 'Calibrate extrusion multiplier' },
    { type: 'pressure_advance', name: 'Pressure Advance', description: 'Tune linear advance for clean corners' },
    { type: 'temp_tower', name: 'Temperature Tower', description: 'Find optimal printing temperature' },
    { type: 'retraction', name: 'Retraction Test', description: 'Optimize retraction settings' },
    { type: 'first_layer', name: 'First Layer', description: 'Verify Z offset and adhesion' },
    { type: 'max_flow', name: 'Max Flow Test', description: 'Find maximum volumetric flow rate' },
    { type: 'bed_level', name: 'Bed Level Check', description: 'Verify bed leveling' },
  ]);
  const [selectedType, setSelectedType] = useState('flow_rate');
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [params, setParams] = useState({
    material: 'PLA',
    nozzle_temp: 200,
    bed_temp: 60,
  });

  const typeIcons = {
    flow_rate: '💧',
    pressure_advance: '📐',
    temp_tower: '🌡️',
    retraction: '↔️',
    first_layer: '📏',
    max_flow: '🚀',
    bed_level: '⬛',
  };

  const handleGenerate = async () => {
    if (!selectedType) {
      toast.error('Please select a calibration type');
      return;
    }

    setGenerating(true);
    setResult(null);

    try {
      const data = await api.generateCalibration(selectedType, selectedPrinter || null, params);
      setResult(data);
      toast.success('Calibration G-code generated!');
    } catch (err) {
      console.error('Generation failed:', err);
      toast.error(err.message || 'Failed to generate calibration');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!result?.calibration?.gcode_path) {
      toast.error('No G-code file available');
      return;
    }
    const filename = result.calibration.gcode_path.split(/[\\/]/).pop();
    const url = api.getCalibrationDownloadUrl(filename);
    window.open(url, '_blank');
  };

  const connectedPrinters = printers.filter(p => p.connected);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calibration Type Selection */}
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-300">Calibration Type</label>
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

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Target Printer (Optional)</label>
            <select
              value={selectedPrinter}
              onChange={e => setSelectedPrinter(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2"
            >
              <option value="">Generic (no specific printer)</option>
              {connectedPrinters.map(p => (
                <option key={p.name} value={p.name} disabled={p.state === 'printing'}>
                  {p.name} - {p.state === 'printing' ? '🖨️ Printing' : '✅ Ready'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Parameters */}
        <div className="space-y-4">
          <h3 className="font-medium text-slate-300">Parameters</h3>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Material</label>
            <select
              value={params.material}
              onChange={e => setParams(prev => ({ ...prev, material: e.target.value }))}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2"
            >
              <option value="PLA">PLA</option>
              <option value="PETG">PETG</option>
              <option value="ABS">ABS</option>
              <option value="TPU">TPU</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Nozzle Temp (°C)</label>
              <input
                type="number"
                value={params.nozzle_temp}
                onChange={e => setParams(prev => ({ ...prev, nozzle_temp: parseInt(e.target.value) || 200 }))}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Bed Temp (°C)</label>
              <input
                type="number"
                value={params.bed_temp}
                onChange={e => setParams(prev => ({ ...prev, bed_temp: parseInt(e.target.value) || 60 }))}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleGenerate}
          disabled={generating || !selectedType}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-cyan-500 text-white rounded-lg hover:from-purple-700 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
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

        {result?.calibration?.gcode_path && (
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 font-medium"
          >
            💾 Download G-code
          </button>
        )}
      </div>

      {/* Result / Instructions */}
      {result && (
        <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
          <h4 className="font-medium text-white mb-3">📋 Instructions</h4>
          {result.calibration?.instructions && (
            <pre className="whitespace-pre-wrap text-sm text-slate-300 font-sans">
              {result.calibration.instructions}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

PrinterTools.propTypes = {
  printers: PropTypes.arrayOf(PropTypes.shape({
    name: PropTypes.string,
    state: PropTypes.string,
    connected: PropTypes.bool,
    nozzle_temp: PropTypes.number,
    bed_temp: PropTypes.number,
    job: PropTypes.object,
  })),
  onRefresh: PropTypes.func,
};

export default PrinterTools;
