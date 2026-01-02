import React, { useState, useCallback, useEffect } from 'react';
import { api } from '../services/api';

/**
 * Print Time Estimator - Upload gcode and estimate print time with AI predictions
 */
function PrintTimeEstimator() {
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [aiPrediction, setAiPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState(null);
  const [printers, setPrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [accuracyStats, setAccuracyStats] = useState(null);

  // Fetch available printers on mount
  useEffect(() => {
    const fetchPrinters = async () => {
      try {
        const response = await api.get('/printers');
        if (response.data?.data) {
          setPrinters(response.data.data);
        }
      } catch (err) {
        console.warn('Could not fetch printers:', err);
      }
    };

    const fetchAccuracy = async () => {
      try {
        const response = await api.get('/estimation/accuracy');
        if (response.data?.data?.accuracy) {
          setAccuracyStats(response.data.data.accuracy);
        }
      } catch (err) {
        console.warn('Could not fetch accuracy stats:', err);
      }
    };

    fetchPrinters();
    fetchAccuracy();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.gcode') || droppedFile.name.endsWith('.g'))) {
      processFile(droppedFile);
    } else {
      setError('Please upload a .gcode file');
    }
  }, []);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = async (gcodeFile) => {
    setFile(gcodeFile);
    setLoading(true);
    setAiLoading(true);
    setError(null);
    setAiPrediction(null);

    try {
      const text = await gcodeFile.text();
      const result = analyzeGcode(text, gcodeFile.name);
      setAnalysis(result);
      setLoading(false);

      // Call AI prediction API
      try {
        const formData = new FormData();
        formData.append('file', gcodeFile);
        if (selectedPrinter) {
          formData.append('printer_name', selectedPrinter);
        }

        const response = await api.post('/estimation/analyze-gcode', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (response.data?.data?.prediction) {
          setAiPrediction(response.data.data.prediction);
        }
      } catch (aiErr) {
        console.warn('AI prediction failed, using local analysis:', aiErr);
        // Fall back to local analysis - don't show error
      }
    } catch (err) {
      setError('Failed to analyze file: ' + err.message);
      setLoading(false);
    } finally {
      setAiLoading(false);
    }
  };

  const analyzeGcode = (content, filename) => {
    const lines = content.split('\n');
    
    // Initialize stats
    let totalE = 0;
    let maxX = 0, maxY = 0, maxZ = 0;
    let minX = Infinity, minY = Infinity;
    let layerCount = 0;
    let currentLayer = 0;
    let totalDistance = 0;
    let lastX = 0, lastY = 0, lastZ = 0;
    let printMoves = 0;
    let travelMoves = 0;
    let estimatedSeconds = 0;
    let feedrate = 0;
    
    // Slicer detection
    let slicer = 'Unknown';
    let slicerVersion = '';
    let estimatedTime = null;
    let filamentUsed = null;

    // Parse header comments for slicer info
    for (let i = 0; i < Math.min(100, lines.length); i++) {
      const line = lines[i];
      
      if (line.includes('PrusaSlicer') || line.includes('Prusa Slicer')) {
        slicer = 'PrusaSlicer';
      } else if (line.includes('Cura') || line.includes('Ultimaker')) {
        slicer = 'Cura';
      } else if (line.includes('OrcaSlicer') || line.includes('Orca')) {
        slicer = 'OrcaSlicer';
      } else if (line.includes('SuperSlicer')) {
        slicer = 'SuperSlicer';
      } else if (line.includes('Bambu Studio')) {
        slicer = 'Bambu Studio';
      } else if (line.includes('Simplify3D')) {
        slicer = 'Simplify3D';
      }

      // Extract estimated time from comments
      const timeMatch = line.match(/estimated.*?(\d+)\s*h.*?(\d+)\s*m/i) ||
                       line.match(/TIME:(\d+)/i) ||
                       line.match(/print.*?time.*?(\d+):(\d+)/i);
      if (timeMatch) {
        if (timeMatch[2]) {
          estimatedTime = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60;
        } else {
          estimatedTime = parseInt(timeMatch[1]);
        }
      }

      // Extract filament usage
      const filamentMatch = line.match(/filament\s*used.*?(\d+\.?\d*)\s*(m|mm|g)/i);
      if (filamentMatch) {
        filamentUsed = {
          value: parseFloat(filamentMatch[1]),
          unit: filamentMatch[2]
        };
      }
    }

    // Parse G-code moves
    for (const line of lines) {
      if (line.startsWith(';') || line.trim() === '') continue;
      
      // Layer change detection
      if (line.includes('LAYER:') || line.includes('layer:') || line.includes(';Z:')) {
        layerCount++;
      }

      // Parse G0/G1 moves
      const moveMatch = line.match(/^G[01]\s+(.+)/);
      if (moveMatch) {
        const params = moveMatch[1];
        
        const xMatch = params.match(/X([\d.]+)/);
        const yMatch = params.match(/Y([\d.]+)/);
        const zMatch = params.match(/Z([\d.]+)/);
        const eMatch = params.match(/E([\d.]+)/);
        const fMatch = params.match(/F([\d.]+)/);
        
        if (fMatch) feedrate = parseFloat(fMatch[1]);
        
        const newX = xMatch ? parseFloat(xMatch[1]) : lastX;
        const newY = yMatch ? parseFloat(yMatch[1]) : lastY;
        const newZ = zMatch ? parseFloat(zMatch[1]) : lastZ;
        const newE = eMatch ? parseFloat(eMatch[1]) : 0;
        
        // Calculate move distance
        const dx = newX - lastX;
        const dy = newY - lastY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0.001) {
          totalDistance += distance;
          
          if (newE > 0) {
            printMoves++;
            totalE += newE;
          } else {
            travelMoves++;
          }
          
          // Estimate time based on feedrate
          if (feedrate > 0) {
            estimatedSeconds += (distance / (feedrate / 60));
          }
        }
        
        // Track bounds
        if (newX !== lastX || newY !== lastY) {
          maxX = Math.max(maxX, newX);
          maxY = Math.max(maxY, newY);
          minX = Math.min(minX, newX);
          minY = Math.min(minY, newY);
        }
        if (newZ > lastZ) {
          maxZ = Math.max(maxZ, newZ);
          currentLayer++;
        }
        
        lastX = newX;
        lastY = newY;
        lastZ = newZ;
      }
    }

    // Calculate print dimensions
    const printWidth = maxX - (minX === Infinity ? 0 : minX);
    const printDepth = maxY - (minY === Infinity ? 0 : minY);
    const printHeight = maxZ;

    // Estimate filament in meters (assuming 1.75mm filament)
    const filamentMeters = totalE / 1000;
    const filamentGrams = filamentMeters * 3.14159 * (0.875 * 0.875) * 1.24; // PLA density

    // Use slicer's estimate if available, otherwise use calculated
    const finalTimeSeconds = estimatedTime || estimatedSeconds;
    const hours = Math.floor(finalTimeSeconds / 3600);
    const minutes = Math.floor((finalTimeSeconds % 3600) / 60);

    return {
      filename,
      slicer,
      lineCount: lines.length,
      layerCount: layerCount || currentLayer,
      dimensions: {
        width: printWidth.toFixed(1),
        depth: printDepth.toFixed(1),
        height: printHeight.toFixed(1),
      },
      filament: {
        meters: filamentMeters.toFixed(2),
        grams: filamentGrams.toFixed(1),
        fromSlicer: filamentUsed,
      },
      time: {
        seconds: finalTimeSeconds,
        formatted: `${hours}h ${minutes}m`,
        hours: hours,
        minutes: minutes,
        fromSlicer: estimatedTime !== null,
      },
      moves: {
        total: printMoves + travelMoves,
        print: printMoves,
        travel: travelMoves,
      },
      totalDistance: (totalDistance / 1000).toFixed(2), // in meters
    };
  };

  const formatBytes = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">⏱️ Print Time Estimator</h2>
        {accuracyStats && accuracyStats.total_predictions > 0 && (
          <div className="text-sm text-gray-500">
            AI Accuracy: <span className="font-medium text-green-600">{accuracyStats.within_10pct?.toFixed(0)}%</span> within 10%
          </div>
        )}
      </div>

      {/* Printer Selection */}
      {printers.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target Printer (for calibrated estimate)
          </label>
          <select
            value={selectedPrinter}
            onChange={(e) => setSelectedPrinter(e.target.value)}
            className="w-full md:w-64 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Any printer</option>
            {printers.map(p => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          loading ? 'bg-blue-50 border-blue-300' : 
          file ? 'bg-green-50 border-green-300' :
          'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
        }`}
      >
        {loading ? (
          <div>
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-600">Analyzing G-code...</p>
          </div>
        ) : file ? (
          <div>
            <p className="text-4xl mb-2">✅</p>
            <p className="font-medium">{file.name}</p>
            <p className="text-sm text-gray-500">{formatBytes(file.size)}</p>
          </div>
        ) : (
          <div>
            <p className="text-4xl mb-4">📄</p>
            <p className="text-gray-600 mb-2">Drop a .gcode file here</p>
            <p className="text-gray-400 text-sm mb-4">or</p>
            <label className="px-4 py-2 bg-blue-500 text-white rounded-lg cursor-pointer hover:bg-blue-600">
              Browse Files
              <input
                type="file"
                accept=".gcode,.g"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Analysis Results */}
      {analysis && (
        <div className="mt-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold">Analysis Results</h3>
            <span className="text-sm text-gray-500">Slicer: {analysis.slicer}</span>
          </div>

          {/* Time Estimates - AI + Local */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* AI Prediction (Primary) */}
            <div className={`rounded-lg p-6 text-white text-center ${
              aiPrediction ? 'bg-gradient-to-r from-purple-600 to-indigo-600' : 'bg-gradient-to-r from-blue-500 to-purple-500'
            }`}>
              {aiLoading ? (
                <div>
                  <div className="animate-spin h-8 w-8 border-4 border-white border-t-transparent rounded-full mx-auto mb-2" />
                  <p className="text-sm opacity-75">AI analyzing...</p>
                </div>
              ) : aiPrediction ? (
                <>
                  <p className="text-sm opacity-75 mb-1">AI Prediction</p>
                  <p className="text-4xl font-bold">{aiPrediction.predicted_formatted}</p>
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <div className="bg-white/20 rounded-full px-3 py-1 text-xs">
                      {(aiPrediction.confidence * 100).toFixed(0)}% confidence
                    </div>
                    {aiPrediction.method === 'ml' && (
                      <div className="bg-green-400/30 rounded-full px-3 py-1 text-xs">
                        ML Model
                      </div>
                    )}
                  </div>
                  {aiPrediction.confidence_interval && (
                    <p className="text-xs opacity-60 mt-2">
                      Range: {Math.floor(aiPrediction.confidence_interval[0] / 60)}m - {Math.floor(aiPrediction.confidence_interval[1] / 60)}m
                    </p>
                  )}
                  {selectedPrinter && aiPrediction.adjustments?.printer_calibration && (
                    <p className="text-xs opacity-75 mt-1">
                      Calibrated for {selectedPrinter}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm opacity-75 mb-1">Estimated Print Time</p>
                  <p className="text-4xl font-bold">{analysis.time.formatted}</p>
                  {analysis.time.fromSlicer && (
                    <p className="text-xs opacity-75 mt-2">From slicer metadata</p>
                  )}
                </>
              )}
            </div>

            {/* Slicer Estimate (Secondary) */}
            {aiPrediction && analysis.time.fromSlicer && (
              <div className="bg-gray-100 rounded-lg p-6 text-center">
                <p className="text-sm text-gray-500 mb-1">Slicer Estimate</p>
                <p className="text-3xl font-bold text-gray-700">{analysis.time.formatted}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {aiPrediction.predicted_seconds > analysis.time.seconds
                    ? `AI predicts ${Math.round((aiPrediction.predicted_seconds - analysis.time.seconds) / 60)}m longer`
                    : `AI predicts ${Math.round((analysis.time.seconds - aiPrediction.predicted_seconds) / 60)}m shorter`
                  }
                </p>
              </div>
            )}
          </div>

          {/* AI Breakdown */}
          {aiPrediction?.breakdown && (
            <div className="bg-purple-50 rounded-lg p-4">
              <h4 className="font-medium text-purple-800 mb-3">Time Breakdown</h4>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-purple-600">
                    {Math.floor(aiPrediction.breakdown.printing_time / 60)}m
                  </p>
                  <p className="text-xs text-gray-500">Printing</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-purple-600">
                    {Math.floor(aiPrediction.breakdown.travel_time / 60)}m
                  </p>
                  <p className="text-xs text-gray-500">Travel</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-purple-600">
                    {Math.floor(aiPrediction.breakdown.retraction_time / 60)}m
                  </p>
                  <p className="text-xs text-gray-500">Retractions</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-purple-600">
                    {Math.floor(aiPrediction.breakdown.layer_changes / 60)}m
                  </p>
                  <p className="text-xs text-gray-500">Layer Changes</p>
                </div>
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{analysis.layerCount}</p>
              <p className="text-sm text-gray-500">Layers</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{analysis.filament.grams}g</p>
              <p className="text-sm text-gray-500">Filament</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-purple-600">{analysis.totalDistance}m</p>
              <p className="text-sm text-gray-500">Travel Distance</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-orange-600">{(analysis.lineCount / 1000).toFixed(0)}K</p>
              <p className="text-sm text-gray-500">G-code Lines</p>
            </div>
          </div>

          {/* Dimensions */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium mb-2">📐 Print Dimensions</h4>
            <div className="flex gap-6 text-center">
              <div>
                <p className="text-lg font-mono">{analysis.dimensions.width}mm</p>
                <p className="text-xs text-gray-500">Width (X)</p>
              </div>
              <div>
                <p className="text-lg font-mono">{analysis.dimensions.depth}mm</p>
                <p className="text-xs text-gray-500">Depth (Y)</p>
              </div>
              <div>
                <p className="text-lg font-mono">{analysis.dimensions.height}mm</p>
                <p className="text-xs text-gray-500">Height (Z)</p>
              </div>
            </div>
          </div>

          {/* Move Stats */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium mb-2">🎯 Move Statistics</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-lg font-bold">{analysis.moves.total.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Total Moves</p>
              </div>
              <div>
                <p className="text-lg font-bold text-blue-600">{analysis.moves.print.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Print Moves</p>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-500">{analysis.moves.travel.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Travel Moves</p>
              </div>
            </div>
          </div>

          {/* Clear Button */}
          <button
            onClick={() => { setFile(null); setAnalysis(null); setAiPrediction(null); }}
            className="w-full py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
          >
            Analyze Another File
          </button>
        </div>
      )}
    </div>
  );
}

export default PrintTimeEstimator;
