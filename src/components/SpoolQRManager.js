import React, { useState, useEffect, useRef } from 'react';

/**
 * SpoolQRManager - Generate and scan QR codes for spool inventory
 * Enables quick inventory updates via mobile camera
 */
function SpoolQRManager({ spools = [], onSpoolUpdate }) {
  const [selectedSpool, setSelectedSpool] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [printMode, setPrintMode] = useState(false);
  const [selectedForPrint, setSelectedForPrint] = useState(new Set());

  // Filter spools
  const filteredSpools = spools.filter(spool => 
    !searchTerm || 
    spool.material?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    spool.color?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    spool.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    spool.id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const generateQRData = (spool) => {
    // Encode essential spool data in QR
    return JSON.stringify({
      type: 'polywerk_spool',
      id: spool.id,
      material: spool.material,
      color: spool.color,
      brand: spool.brand,
      weight_total: spool.weight_total,
    });
  };

  const generateQRCodeSVG = (data, size = 200) => {
    // Simple QR code generator using a basic pattern
    // In production, use a proper QR library like 'qrcode'
    const encoded = btoa(data);
    const matrix = generateQRMatrix(encoded);
    const cellSize = size / matrix.length;
    
    let paths = '';
    matrix.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell) {
          paths += `M${x * cellSize},${y * cellSize}h${cellSize}v${cellSize}h-${cellSize}z`;
        }
      });
    });

    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
        <rect width="100%" height="100%" fill="white"/>
        <path d="${paths}" fill="black"/>
      </svg>
    `;
  };

  // Simple QR-like matrix generator (placeholder - use proper QR lib in production)
  const generateQRMatrix = (data) => {
    const size = 25;
    const matrix = Array(size).fill(null).map(() => Array(size).fill(false));
    
    // Position patterns (corners)
    const addPositionPattern = (x, y) => {
      for (let i = 0; i < 7; i++) {
        for (let j = 0; j < 7; j++) {
          const isOuter = i === 0 || i === 6 || j === 0 || j === 6;
          const isInner = i >= 2 && i <= 4 && j >= 2 && j <= 4;
          matrix[y + i][x + j] = isOuter || isInner;
        }
      }
    };
    
    addPositionPattern(0, 0);
    addPositionPattern(size - 7, 0);
    addPositionPattern(0, size - 7);
    
    // Timing patterns
    for (let i = 8; i < size - 8; i++) {
      matrix[6][i] = i % 2 === 0;
      matrix[i][6] = i % 2 === 0;
    }
    
    // Data encoding (simplified)
    let dataIndex = 0;
    const dataBytes = data.split('').map(c => c.charCodeAt(0));
    
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col = 5;
      for (let row = 0; row < size; row++) {
        for (let c = 0; c < 2; c++) {
          const x = col - c;
          if (!matrix[row][x] && row > 8 && x > 8) {
            if (dataIndex < dataBytes.length * 8) {
              const byteIndex = Math.floor(dataIndex / 8);
              const bitIndex = dataIndex % 8;
              matrix[row][x] = (dataBytes[byteIndex] >> (7 - bitIndex)) & 1;
              dataIndex++;
            }
          }
        }
      }
    }
    
    return matrix;
  };

  const handlePrintQRCodes = () => {
    const spoolsToPrint = selectedForPrint.size > 0 
      ? spools.filter(s => selectedForPrint.has(s.id))
      : [selectedSpool];
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Spool QR Codes - Polywerk</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            .qr-card { 
              display: inline-block; 
              width: 200px; 
              margin: 10px; 
              padding: 15px;
              border: 2px solid #333;
              border-radius: 8px;
              text-align: center;
              page-break-inside: avoid;
            }
            .qr-code { margin: 10px auto; }
            .spool-info { font-size: 12px; margin-top: 10px; }
            .spool-id { font-family: monospace; font-size: 10px; color: #666; }
            .material { font-weight: bold; font-size: 14px; }
            .color-dot { 
              display: inline-block; 
              width: 12px; 
              height: 12px; 
              border-radius: 50%; 
              margin-right: 5px;
              vertical-align: middle;
              border: 1px solid #333;
            }
            @media print {
              .qr-card { break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          ${spoolsToPrint.map(spool => `
            <div class="qr-card">
              <div class="qr-code">
                ${generateQRCodeSVG(generateQRData(spool), 150)}
              </div>
              <div class="spool-info">
                <div class="material">
                  <span class="color-dot" style="background: ${getColorHex(spool.color)};"></span>
                  ${spool.material} - ${spool.color}
                </div>
                <div>${spool.brand || 'Unknown Brand'}</div>
                <div>${spool.weight_total || 1000}g spool</div>
                <div class="spool-id">${spool.id}</div>
              </div>
            </div>
          `).join('')}
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const getColorHex = (colorName) => {
    const colors = {
      'black': '#1a1a1a',
      'white': '#ffffff',
      'red': '#ef4444',
      'blue': '#3b82f6',
      'green': '#22c55e',
      'yellow': '#eab308',
      'orange': '#f97316',
      'purple': '#a855f7',
      'pink': '#ec4899',
      'gray': '#6b7280',
      'grey': '#6b7280',
      'silver': '#94a3b8',
      'gold': '#fbbf24',
      'transparent': 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)',
    };
    return colors[colorName?.toLowerCase()] || '#6b7280';
  };

  const togglePrintSelection = (spoolId) => {
    const newSelection = new Set(selectedForPrint);
    if (newSelection.has(spoolId)) {
      newSelection.delete(spoolId);
    } else {
      newSelection.add(spoolId);
    }
    setSelectedForPrint(newSelection);
  };

  const selectAllForPrint = () => {
    setSelectedForPrint(new Set(filteredSpools.map(s => s.id)));
  };

  const clearPrintSelection = () => {
    setSelectedForPrint(new Set());
    setPrintMode(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            📱 Spool QR Codes
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Generate QR codes for quick inventory scanning
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowScanModal(true)}
            className="px-4 py-2 rounded-lg font-medium text-white text-sm flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg, #22c55e 0%, #06b6d4 100%)' }}
          >
            📷 Scan QR
          </button>
          <button
            onClick={() => setPrintMode(!printMode)}
            className={`px-4 py-2 rounded-lg text-sm border transition ${
              printMode 
                ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                : 'text-slate-400 border-slate-600 hover:bg-slate-700'
            }`}
          >
            🖨️ Print Mode
          </button>
        </div>
      </div>

      {/* Print Mode Bar */}
      {printMode && (
        <div 
          className="p-3 rounded-xl border flex flex-wrap items-center gap-3"
          style={{ backgroundColor: '#7c3aed20', borderColor: '#7c3aed50' }}
        >
          <span className="text-purple-400 font-medium">
            {selectedForPrint.size} selected
          </span>
          <div className="flex-1" />
          <button
            onClick={selectAllForPrint}
            className="px-3 py-1.5 rounded-lg text-sm text-purple-400 hover:bg-purple-500/20"
          >
            Select All
          </button>
          <button
            onClick={handlePrintQRCodes}
            disabled={selectedForPrint.size === 0}
            className="px-3 py-1.5 rounded-lg text-sm bg-purple-500 text-white disabled:opacity-50"
          >
            🖨️ Print {selectedForPrint.size} QR Codes
          </button>
          <button
            onClick={clearPrintSelection}
            className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white"
          >
            ✕ Cancel
          </button>
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search spools..."
        className="w-full px-4 py-2 rounded-lg text-white text-sm"
        style={{ backgroundColor: '#334155' }}
      />

      {/* Spools Grid */}
      {filteredSpools.length === 0 ? (
        <div 
          className="p-12 text-center rounded-xl border"
          style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
        >
          <p className="text-4xl mb-3">📦</p>
          <p className="text-slate-400 mb-2">No spools found</p>
          <p className="text-slate-500 text-sm">Add spools in the Inventory → Spools section</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filteredSpools.map(spool => (
            <div
              key={spool.id}
              onClick={() => printMode ? togglePrintSelection(spool.id) : (setSelectedSpool(spool), setShowQRModal(true))}
              className={`rounded-xl border p-3 cursor-pointer transition relative ${
                selectedForPrint.has(spool.id)
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'hover:border-purple-500/50'
              }`}
              style={{ backgroundColor: '#1e293b', borderColor: selectedForPrint.has(spool.id) ? '#a855f7' : '#334155' }}
            >
              {/* Selection Checkbox */}
              {printMode && (
                <div className={`absolute top-2 right-2 w-5 h-5 rounded border-2 flex items-center justify-center ${
                  selectedForPrint.has(spool.id)
                    ? 'bg-purple-500 border-purple-500'
                    : 'border-slate-500 bg-slate-800'
                }`}>
                  {selectedForPrint.has(spool.id) && <span className="text-white text-xs">✓</span>}
                </div>
              )}

              {/* Color Preview */}
              <div 
                className="w-full aspect-square rounded-lg mb-2 flex items-center justify-center"
                style={{ backgroundColor: getColorHex(spool.color) }}
              >
                <span className="text-3xl opacity-50">🧵</span>
              </div>

              {/* Info */}
              <p className="text-sm font-medium text-white">{spool.material}</p>
              <p className="text-xs text-slate-400">{spool.color}</p>
              <p className="text-xs text-slate-500">{spool.brand}</p>
              
              {/* Weight Bar */}
              <div className="mt-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">Remaining</span>
                  <span className="text-slate-400">{spool.weight_remaining || spool.weight_total}g</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-500"
                    style={{ width: `${((spool.weight_remaining || spool.weight_total) / (spool.weight_total || 1000)) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && selectedSpool && (
        <QRCodeModal
          spool={selectedSpool}
          qrSvg={generateQRCodeSVG(generateQRData(selectedSpool), 250)}
          onPrint={handlePrintQRCodes}
          onClose={() => { setShowQRModal(false); setSelectedSpool(null); }}
          getColorHex={getColorHex}
        />
      )}

      {/* Scan Modal */}
      {showScanModal && (
        <ScanQRModal
          onScan={(data) => {
            setScanResult(data);
            setShowScanModal(false);
          }}
          onClose={() => setShowScanModal(false)}
          spools={spools}
          onSpoolUpdate={onSpoolUpdate}
        />
      )}

      {/* Scan Result */}
      {scanResult && (
        <ScanResultModal
          result={scanResult}
          spools={spools}
          onSpoolUpdate={onSpoolUpdate}
          onClose={() => setScanResult(null)}
          getColorHex={getColorHex}
        />
      )}
    </div>
  );
}

/**
 * QRCodeModal - Display QR code for a spool
 */
function QRCodeModal({ spool, qrSvg, onPrint, onClose, getColorHex }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        className="relative w-full max-w-sm rounded-xl border shadow-2xl"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#334155' }}>
          <h3 className="font-bold text-white">QR Code</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="p-6 space-y-4">
          {/* QR Code */}
          <div 
            className="bg-white p-4 rounded-xl mx-auto w-fit"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />

          {/* Spool Info */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div 
                className="w-6 h-6 rounded-full border border-slate-600"
                style={{ backgroundColor: getColorHex(spool.color) }}
              />
              <span className="text-lg font-bold text-white">{spool.material} - {spool.color}</span>
            </div>
            <p className="text-slate-400">{spool.brand}</p>
            <p className="text-xs text-slate-500 font-mono mt-2">{spool.id}</p>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex gap-2" style={{ borderColor: '#334155' }}>
          <button
            onClick={onPrint}
            className="flex-1 py-2 rounded-lg font-medium text-white"
            style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
          >
            🖨️ Print QR
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-slate-400 border border-slate-600 hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * ScanQRModal - Camera-based QR scanning
 */
function ScanQRModal({ onScan, onClose, spools, onSpoolUpdate }) {
  const [manualInput, setManualInput] = useState('');
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const [hasCamera, setHasCamera] = useState(true);

  useEffect(() => {
    // Try to access camera
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(err => {
          console.error('Camera access denied:', err);
          setHasCamera(false);
        });
    } else {
      setHasCamera(false);
    }

    return () => {
      // Cleanup camera stream
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleManualSubmit = () => {
    try {
      // Try to parse as JSON (our QR format)
      const data = JSON.parse(manualInput);
      if (data.type === 'polywerk_spool') {
        onScan(data);
      } else {
        setError('Invalid QR code format');
      }
    } catch {
      // Try to find spool by ID
      const spool = spools.find(s => s.id === manualInput);
      if (spool) {
        onScan({ type: 'polywerk_spool', id: spool.id, ...spool });
      } else {
        setError('Spool not found');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        className="relative w-full max-w-md rounded-xl border shadow-2xl"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#334155' }}>
          <h3 className="font-bold text-white">📷 Scan QR Code</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="p-6 space-y-4">
          {hasCamera ? (
            <div className="aspect-square rounded-xl overflow-hidden bg-black">
              <video 
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-white/50 rounded-xl" />
              </div>
            </div>
          ) : (
            <div className="aspect-square rounded-xl bg-slate-800 flex items-center justify-center">
              <div className="text-center">
                <p className="text-4xl mb-2">📷</p>
                <p className="text-slate-400">Camera not available</p>
                <p className="text-slate-500 text-sm">Use manual input below</p>
              </div>
            </div>
          )}

          <p className="text-center text-slate-500 text-sm">
            Point camera at QR code or enter spool ID manually
          </p>

          {/* Manual Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => { setManualInput(e.target.value); setError(null); }}
              placeholder="Enter spool ID..."
              className="flex-1 px-3 py-2 rounded-lg text-white text-sm"
              style={{ backgroundColor: '#334155' }}
            />
            <button
              onClick={handleManualSubmit}
              className="px-4 py-2 rounded-lg font-medium text-white"
              style={{ background: 'linear-gradient(135deg, #22c55e 0%, #06b6d4 100%)' }}
            >
              Find
            </button>
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          {/* Quick Select */}
          <div>
            <p className="text-sm text-slate-500 mb-2">Or quick select:</p>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {spools.slice(0, 10).map(spool => (
                <button
                  key={spool.id}
                  onClick={() => onScan({ type: 'polywerk_spool', id: spool.id, ...spool })}
                  className="px-2 py-1 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600"
                >
                  {spool.material} {spool.color}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ScanResultModal - Actions after scanning a spool
 */
function ScanResultModal({ result, spools, onSpoolUpdate, onClose, getColorHex }) {
  const [weightUsed, setWeightUsed] = useState('');
  const [action, setAction] = useState(null);

  const spool = spools.find(s => s.id === result.id) || result;

  const handleRecordUsage = () => {
    const used = parseFloat(weightUsed);
    if (isNaN(used) || used <= 0) return;

    const newRemaining = Math.max(0, (spool.weight_remaining || spool.weight_total || 1000) - used);
    onSpoolUpdate?.(spool.id, { weight_remaining: newRemaining });
    onClose();
  };

  const handleMarkEmpty = () => {
    onSpoolUpdate?.(spool.id, { weight_remaining: 0, status: 'empty' });
    onClose();
  };

  const handleStartDrying = () => {
    onSpoolUpdate?.(spool.id, { status: 'drying', drying_started: new Date().toISOString() });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        className="relative w-full max-w-sm rounded-xl border shadow-2xl"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#334155' }}>
          <h3 className="font-bold text-white">✅ Spool Found</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Spool Info */}
          <div className="flex items-center gap-4">
            <div 
              className="w-16 h-16 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: getColorHex(spool.color) }}
            >
              <span className="text-2xl opacity-50">🧵</span>
            </div>
            <div>
              <p className="text-lg font-bold text-white">{spool.material}</p>
              <p className="text-slate-400">{spool.color} • {spool.brand}</p>
              <p className="text-sm text-slate-500">
                {spool.weight_remaining || spool.weight_total}g remaining
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          {!action && (
            <div className="space-y-2">
              <button
                onClick={() => setAction('usage')}
                className="w-full py-3 rounded-lg text-left px-4 bg-slate-700 text-white hover:bg-slate-600 flex items-center gap-3"
              >
                <span className="text-xl">📝</span>
                <div>
                  <p className="font-medium">Record Usage</p>
                  <p className="text-xs text-slate-400">Log filament used</p>
                </div>
              </button>
              <button
                onClick={handleMarkEmpty}
                className="w-full py-3 rounded-lg text-left px-4 bg-slate-700 text-white hover:bg-slate-600 flex items-center gap-3"
              >
                <span className="text-xl">📭</span>
                <div>
                  <p className="font-medium">Mark Empty</p>
                  <p className="text-xs text-slate-400">Spool is finished</p>
                </div>
              </button>
              <button
                onClick={handleStartDrying}
                className="w-full py-3 rounded-lg text-left px-4 bg-slate-700 text-white hover:bg-slate-600 flex items-center gap-3"
              >
                <span className="text-xl">☀️</span>
                <div>
                  <p className="font-medium">Start Drying</p>
                  <p className="text-xs text-slate-400">Put in dryer</p>
                </div>
              </button>
            </div>
          )}

          {/* Record Usage Form */}
          {action === 'usage' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">How much filament was used?</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={weightUsed}
                  onChange={(e) => setWeightUsed(e.target.value)}
                  placeholder="Grams used"
                  className="flex-1 px-3 py-2 rounded-lg text-white"
                  style={{ backgroundColor: '#334155' }}
                  autoFocus
                />
                <span className="flex items-center text-slate-400">g</span>
              </div>
              <div className="flex gap-2">
                {[10, 25, 50, 100].map(amount => (
                  <button
                    key={amount}
                    onClick={() => setWeightUsed(String(amount))}
                    className="flex-1 py-2 rounded-lg text-sm bg-slate-700 text-slate-300 hover:bg-slate-600"
                  >
                    {amount}g
                  </button>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setAction(null)}
                  className="flex-1 py-2 rounded-lg text-slate-400 border border-slate-600 hover:bg-slate-700"
                >
                  Back
                </button>
                <button
                  onClick={handleRecordUsage}
                  disabled={!weightUsed}
                  className="flex-1 py-2 rounded-lg font-medium text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #22c55e 0%, #06b6d4 100%)' }}
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SpoolQRManager;
