import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { api } from '../services/api';
import toast from '../utils/toast';
import { useLanguage } from '../i18n';

/**
 * Printer Calibration Component
 * 
 * Generate and send calibration G-codes to printers:
 * - Flow rate calibration
 * - Pressure advance tuning
 * - Temperature tower
 * - Retraction test
 * - First layer calibration
 * - Max volumetric flow test
 * - Bed level verification
 */
function PrinterCalibration({ printers = [], onRefresh }) {
  const { t } = useLanguage();
  const [calibrationTypes, setCalibrationTypes] = useState([]);
  const [selectedType, setSelectedType] = useState('');
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [showInstructions, setShowInstructions] = useState(false);
  
  // Calibration parameters
  const [params, setParams] = useState({
    material: 'PLA',
    nozzle_temp: 200,
    bed_temp: 60,
    // Flow rate params
    flow_start: 90,
    flow_end: 110,
    flow_step: 5,
    // Pressure advance params
    pa_start: 0.0,
    pa_end: 0.1,
    pa_step: 0.005,
    // Temp tower params
    temp_start: 190,
    temp_end: 220,
    temp_step: 5,
    // Retraction params
    retract_start: 0.2,
    retract_end: 1.0,
    retract_step: 0.2,
  });

  // Material presets for temperatures
  const materialPresets = {
    PLA: { nozzle_temp: 200, bed_temp: 55, temp_start: 190, temp_end: 220 },
    'PLA+': { nozzle_temp: 210, bed_temp: 60, temp_start: 195, temp_end: 225 },
    PETG: { nozzle_temp: 235, bed_temp: 70, temp_start: 220, temp_end: 250 },
    ABS: { nozzle_temp: 245, bed_temp: 100, temp_start: 230, temp_end: 260 },
    TPU: { nozzle_temp: 220, bed_temp: 50, temp_start: 200, temp_end: 240 },
    ASA: { nozzle_temp: 250, bed_temp: 100, temp_start: 240, temp_end: 270 },
  };

  useEffect(() => {
    loadCalibrationTypes();
  }, []);

  useEffect(() => {
    // Update temps when material changes
    const preset = materialPresets[params.material];
    if (preset) {
      setParams(prev => ({
        ...prev,
        nozzle_temp: preset.nozzle_temp,
        bed_temp: preset.bed_temp,
        temp_start: preset.temp_start,
        temp_end: preset.temp_end,
      }));
    }
  }, [params.material]);

  const loadCalibrationTypes = async () => {
    setLoading(true);
    try {
      const data = await api.getCalibrationTypes();
      setCalibrationTypes(data.calibrations || []);
      if (data.calibrations?.length > 0) {
        setSelectedType(data.calibrations[0].type);
      }
    } catch (err) {
      console.error('Failed to load calibration types:', err);
      // Use fallback data
      setCalibrationTypes([
        { type: 'flow_rate', name: 'Flow Rate Calibration', description: 'Calibrate extrusion multiplier' },
        { type: 'pressure_advance', name: 'Pressure Advance', description: 'Tune linear advance for clean corners' },
        { type: 'temp_tower', name: 'Temperature Tower', description: 'Find optimal printing temperature' },
        { type: 'retraction', name: 'Retraction Test', description: 'Optimize retraction settings' },
        { type: 'first_layer', name: 'First Layer', description: 'Verify Z offset and adhesion' },
        { type: 'max_flow', name: 'Max Flow Test', description: 'Find maximum volumetric flow rate' },
        { type: 'bed_level', name: 'Bed Level Check', description: 'Verify bed leveling' },
      ]);
      setSelectedType('flow_rate');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedType) {
      toast.error('Please select a calibration type');
      return;
    }

    setGenerating(true);
    setResult(null);

    try {
      const data = await api.generateCalibration(
        selectedType,
        selectedPrinter || null,
        params
      );
      
      setResult(data);
      toast.success('Calibration G-code generated!');
      setShowInstructions(true);
    } catch (err) {
      console.error('Generation failed:', err);
      toast.error(err.message || 'Failed to generate calibration');
    } finally {
      setGenerating(false);
    }
  };

  const handleSendToPrinter = async () => {
    if (!selectedPrinter) {
      toast.error('Please select a printer');
      return;
    }

    setGenerating(true);
    try {
      const data = await api.sendCalibrationToPrinter(
        selectedType,
        selectedPrinter,
        params,
        false // Don't auto-start
      );
      
      setResult(data);
      toast.success(`Calibration uploaded to ${selectedPrinter}`);
    } catch (err) {
      console.error('Send to printer failed:', err);
      toast.error(err.message || 'Failed to send to printer');
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
  const idlePrinters = connectedPrinters.filter(p => p.state === 'idle');

  const selectedCalibration = calibrationTypes.find(c => c.type === selectedType);

  // Render parameter inputs based on calibration type
  const renderParams = () => {
    const commonParams = (
      <>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Material</label>
          <select
            value={params.material}
            onChange={e => setParams(prev => ({ ...prev, material: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            {Object.keys(materialPresets).map(mat => (
              <option key={mat} value={mat}>{mat}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nozzle Temp (°C)</label>
            <input
              type="number"
              value={params.nozzle_temp}
              onChange={e => setParams(prev => ({ ...prev, nozzle_temp: parseInt(e.target.value) || 200 }))}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bed Temp (°C)</label>
            <input
              type="number"
              value={params.bed_temp}
              onChange={e => setParams(prev => ({ ...prev, bed_temp: parseInt(e.target.value) || 60 }))}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>
      </>
    );

    switch (selectedType) {
      case 'flow_rate':
        return (
          <>
            {commonParams}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Flow Start (%)</label>
                <input
                  type="number"
                  value={params.flow_start}
                  onChange={e => setParams(prev => ({ ...prev, flow_start: parseInt(e.target.value) || 90 }))}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Flow End (%)</label>
                <input
                  type="number"
                  value={params.flow_end}
                  onChange={e => setParams(prev => ({ ...prev, flow_end: parseInt(e.target.value) || 110 }))}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Step (%)</label>
                <input
                  type="number"
                  value={params.flow_step}
                  onChange={e => setParams(prev => ({ ...prev, flow_step: parseInt(e.target.value) || 5 }))}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
          </>
        );

      case 'pressure_advance':
        return (
          <>
            {commonParams}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PA Start</label>
                <input
                  type="number"
                  step="0.001"
                  value={params.pa_start}
                  onChange={e => setParams(prev => ({ ...prev, pa_start: parseFloat(e.target.value) || 0 }))}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PA End</label>
                <input
                  type="number"
                  step="0.001"
                  value={params.pa_end}
                  onChange={e => setParams(prev => ({ ...prev, pa_end: parseFloat(e.target.value) || 0.1 }))}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Step</label>
                <input
                  type="number"
                  step="0.001"
                  value={params.pa_step}
                  onChange={e => setParams(prev => ({ ...prev, pa_step: parseFloat(e.target.value) || 0.005 }))}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
          </>
        );

      case 'temp_tower':
        return (
          <>
            {commonParams}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Temp (°C)</label>
                <input
                  type="number"
                  value={params.temp_start}
                  onChange={e => setParams(prev => ({ ...prev, temp_start: parseInt(e.target.value) || 190 }))}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Temp (°C)</label>
                <input
                  type="number"
                  value={params.temp_end}
                  onChange={e => setParams(prev => ({ ...prev, temp_end: parseInt(e.target.value) || 220 }))}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Step (°C)</label>
                <input
                  type="number"
                  value={params.temp_step}
                  onChange={e => setParams(prev => ({ ...prev, temp_step: parseInt(e.target.value) || 5 }))}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
          </>
        );

      case 'retraction':
        return (
          <>
            {commonParams}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Retract Start (mm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={params.retract_start}
                  onChange={e => setParams(prev => ({ ...prev, retract_start: parseFloat(e.target.value) || 0.2 }))}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Retract End (mm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={params.retract_end}
                  onChange={e => setParams(prev => ({ ...prev, retract_end: parseFloat(e.target.value) || 1.0 }))}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Step (mm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={params.retract_step}
                  onChange={e => setParams(prev => ({ ...prev, retract_step: parseFloat(e.target.value) || 0.2 }))}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
          </>
        );

      default:
        return commonParams;
    }
  };

  // Icons for calibration types
  const typeIcons = {
    flow_rate: '💧',
    pressure_advance: '📐',
    temp_tower: '🌡️',
    retraction: '↔️',
    first_layer: '📏',
    max_flow: '🚀',
    bed_level: '⬛',
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-cyan-500 px-6 py-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          🔧 Printer Calibration
        </h2>
        <p className="text-purple-100 text-sm mt-1">
          Generate calibration prints to optimize your printer settings
        </p>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column - Selection */}
          <div className="space-y-4">
            {/* Calibration Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Calibration Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {calibrationTypes.map(cal => (
                  <button
                    key={cal.type}
                    onClick={() => setSelectedType(cal.type)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      selectedType === cal.type
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{typeIcons[cal.type] || '⚙️'}</span>
                      <div>
                        <div className="font-medium text-sm">{cal.name}</div>
                        <div className="text-xs text-gray-500 truncate">{cal.description}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Printer Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Printer (Optional)
              </label>
              <select
                value={selectedPrinter}
                onChange={e => setSelectedPrinter(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Generic (no specific printer)</option>
                {connectedPrinters.map(p => (
                  <option key={p.name} value={p.name} disabled={p.state === 'printing'}>
                    {p.name} - {p.state === 'printing' ? '🖨️ Printing...' : p.state === 'idle' ? '✅ Ready' : p.state}
                  </option>
                ))}
              </select>
              {connectedPrinters.length === 0 && (
                <p className="text-sm text-yellow-600 mt-1">
                  ⚠️ No printers connected. Connect a printer to send calibration directly.
                </p>
              )}
            </div>
          </div>

          {/* Right column - Parameters */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-700 flex items-center gap-2">
              ⚙️ Parameters
              <span className="text-xs text-gray-400">
                ({selectedCalibration?.name || 'Select type'})
              </span>
            </h3>
            {renderParams()}
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex flex-wrap gap-3 border-t pt-4">
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

          {selectedPrinter && idlePrinters.some(p => p.name === selectedPrinter) && (
            <button
              onClick={handleSendToPrinter}
              disabled={generating || !selectedType}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {generating ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Sending...
                </>
              ) : (
                <>
                  📤 Send to {selectedPrinter}
                </>
              )}
            </button>
          )}

          {result?.calibration?.gcode_path && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
            >
              💾 Download G-code
            </button>
          )}
        </div>

        {/* Result / Instructions */}
        {result && showInstructions && (
          <div className="mt-6 bg-gray-50 rounded-lg p-4 border">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-800 flex items-center gap-2">
                📋 Instructions
              </h4>
              <button
                onClick={() => setShowInstructions(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            {result.calibration?.instructions && (
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap text-sm text-gray-600 font-sans">
                  {result.calibration.instructions}
                </pre>
              </div>
            )}

            {result.uploaded && (
              <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-green-700 text-sm font-medium">
                  ✅ G-code uploaded to printer: {result.remote_filename}
                </p>
                {result.print_started && (
                  <p className="text-green-600 text-sm mt-1">
                    🖨️ Print started automatically
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

PrinterCalibration.propTypes = {
  printers: PropTypes.arrayOf(PropTypes.shape({
    name: PropTypes.string,
    state: PropTypes.string,
    connected: PropTypes.bool,
  })),
  onRefresh: PropTypes.func,
};

export default PrinterCalibration;
