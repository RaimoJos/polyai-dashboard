import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { api } from '../services/api';
import toast from '../utils/toast';
import { useLanguage } from '../i18n';

/**
 * Slice and Print Component
 * 
 * Upload STL → Slice with OrcaSlicer → Upload to printer → Start print
 * All in one streamlined workflow.
 */
function SliceAndPrint({ printers = [], onRefresh }) {
  const { t } = useLanguage();
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [autoStart, setAutoStart] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ stage: '', percent: 0 });
  const [result, setResult] = useState(null);
  
  // Slice settings
  const [settings, setSettings] = useState({
    material: 'PLA',
    layer_height: 0.2,
    infill: 20,
    supports: false,
  });

  const materialPresets = {
    PLA: { layer_height: 0.2, infill: 20 },
    'PLA+': { layer_height: 0.2, infill: 20 },
    PETG: { layer_height: 0.2, infill: 25 },
    ABS: { layer_height: 0.2, infill: 25 },
    TPU: { layer_height: 0.24, infill: 15 },
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFile = e.dataTransfer?.files?.[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  }, []);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  const validateAndSetFile = (f) => {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext !== 'stl' && ext !== '3mf') {
      toast.error('Please upload an STL or 3MF file');
      return;
    }
    
    // Check file size (max 100MB)
    if (f.size > 100 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 100MB');
      return;
    }

    setFile(f);
    setResult(null);
  };

  const handleSliceAndPrint = async () => {
    if (!file) {
      toast.error('Please select an STL file');
      return;
    }
    if (!selectedPrinter) {
      toast.error('Please select a printer');
      return;
    }

    setProcessing(true);
    setProgress({ stage: 'Uploading...', percent: 10 });
    setResult(null);

    try {
      setProgress({ stage: 'Slicing with OrcaSlicer...', percent: 30 });
      
      const data = await api.sliceAndPrint(file, selectedPrinter, settings, autoStart);
      
      setProgress({ stage: 'Complete!', percent: 100 });
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
      setProgress({ stage: 'Failed', percent: 0 });
    } finally {
      setProcessing(false);
    }
  };

  const handleMaterialChange = (material) => {
    const preset = materialPresets[material];
    setSettings(prev => ({
      ...prev,
      material,
      ...(preset || {}),
    }));
  };

  const connectedPrinters = printers.filter(p => p.connected);
  const idlePrinters = connectedPrinters.filter(p => p.state === 'idle');
  const selectedPrinterData = printers.find(p => p.name === selectedPrinter);

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-500 px-6 py-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          🚀 Slice & Print
        </h2>
        <p className="text-green-100 text-sm mt-1">
          Upload STL → Slice → Print in one click
        </p>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column - File upload */}
          <div className="space-y-4">
            {/* Drop zone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                dragActive
                  ? 'border-green-500 bg-green-50'
                  : file
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              {file ? (
                <div className="space-y-2">
                  <div className="text-4xl">📄</div>
                  <div className="font-medium text-gray-800">{file.name}</div>
                  <div className="text-sm text-gray-500">{formatFileSize(file.size)}</div>
                  <button
                    onClick={() => setFile(null)}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-4xl">📥</div>
                  <div className="text-gray-600">
                    Drag & drop STL file here
                  </div>
                  <div className="text-sm text-gray-400">or</div>
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

            {/* Printer selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Printer
              </label>
              <select
                value={selectedPrinter}
                onChange={e => setSelectedPrinter(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">Select a printer...</option>
                {connectedPrinters.map(p => (
                  <option 
                    key={p.name} 
                    value={p.name}
                    disabled={p.state === 'printing'}
                  >
                    {p.name} - {p.state === 'printing' ? '🖨️ Busy' : '✅ Ready'}
                    {p.nozzle_temp > 50 ? ` (${Math.round(p.nozzle_temp)}°C)` : ''}
                  </option>
                ))}
              </select>
              
              {connectedPrinters.length === 0 && (
                <p className="text-sm text-yellow-600 mt-1">
                  ⚠️ No printers connected. Connect a printer first.
                </p>
              )}
              
              {selectedPrinterData && selectedPrinterData.state === 'printing' && (
                <p className="text-sm text-yellow-600 mt-1">
                  ⚠️ This printer is currently printing. File will be uploaded but won't start.
                </p>
              )}
            </div>

            {/* Auto-start toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoStart}
                onChange={e => setAutoStart(e.target.checked)}
                className="w-5 h-5 rounded text-green-600 focus:ring-green-500"
              />
              <span className="text-gray-700">Start print automatically after upload</span>
            </label>
          </div>

          {/* Right column - Settings */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-700 flex items-center gap-2">
              ⚙️ Print Settings
            </h3>

            {/* Material */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Material</label>
              <select
                value={settings.material}
                onChange={e => handleMaterialChange(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                {Object.keys(materialPresets).map(mat => (
                  <option key={mat} value={mat}>{mat}</option>
                ))}
              </select>
            </div>

            {/* Layer height */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Layer Height
              </label>
              <select
                value={settings.layer_height}
                onChange={e => setSettings(prev => ({ ...prev, layer_height: parseFloat(e.target.value) }))}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value={0.08}>0.08mm (Ultra Fine)</option>
                <option value={0.12}>0.12mm (Fine)</option>
                <option value={0.16}>0.16mm (Quality)</option>
                <option value={0.2}>0.20mm (Standard)</option>
                <option value={0.24}>0.24mm (Fast)</option>
                <option value={0.28}>0.28mm (Draft)</option>
              </select>
            </div>

            {/* Infill */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Infill: {settings.infill}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={settings.infill}
                onChange={e => setSettings(prev => ({ ...prev, infill: parseInt(e.target.value) }))}
                className="w-full accent-green-500"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0% (Hollow)</span>
                <span>50%</span>
                <span>100% (Solid)</span>
              </div>
            </div>

            {/* Supports */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.supports}
                onChange={e => setSettings(prev => ({ ...prev, supports: e.target.checked }))}
                className="w-5 h-5 rounded text-green-600 focus:ring-green-500"
              />
              <span className="text-gray-700">Enable supports</span>
            </label>
          </div>
        </div>

        {/* Progress bar */}
        {processing && (
          <div className="mt-6">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span>{progress.stage}</span>
              <span>{progress.percent}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Action button */}
        <div className="mt-6">
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
        </div>

        {/* Result */}
        {result && (
          <div className="mt-6 bg-gray-50 rounded-lg p-4 border">
            <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
              {result.result?.success ? '✅' : '❌'} Result
            </h4>

            {result.result?.slice_result && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="bg-white rounded-lg p-3 border">
                  <div className="text-gray-500 text-xs">Print Time</div>
                  <div className="font-bold text-lg">
                    {result.result.slice_result.print_time_formatted || 'N/A'}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 border">
                  <div className="text-gray-500 text-xs">Filament</div>
                  <div className="font-bold text-lg">
                    {result.result.slice_result.filament_used_g?.toFixed(1) || '0'}g
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 border">
                  <div className="text-gray-500 text-xs">Layers</div>
                  <div className="font-bold text-lg">
                    {result.result.slice_result.layer_count || 'N/A'}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 border">
                  <div className="text-gray-500 text-xs">Status</div>
                  <div className="font-bold text-lg text-green-600">
                    {result.result.print_started ? '🖨️ Printing' : result.result.uploaded ? '✅ Uploaded' : '⚠️ Pending'}
                  </div>
                </div>
              </div>
            )}

            {result.result?.error && (
              <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200 text-red-700 text-sm">
                {result.result.error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

SliceAndPrint.propTypes = {
  printers: PropTypes.arrayOf(PropTypes.shape({
    name: PropTypes.string,
    state: PropTypes.string,
    connected: PropTypes.bool,
    nozzle_temp: PropTypes.number,
  })),
  onRefresh: PropTypes.func,
};

export default SliceAndPrint;
