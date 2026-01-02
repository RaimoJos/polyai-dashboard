import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api, unwrap } from '../services/api';

/**
 * BambuCameraView - Live camera feed from Bambu Lab printers
 * Supports X1C, P1S, P1P, A1 series with built-in cameras
 */
function BambuCameraView({ printerId, printerName, printerIp, accessCode, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [streamUrl, setStreamUrl] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [lightOn, setLightOn] = useState(true);
  const [printStatus, setPrintStatus] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const containerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  // Bambu printers stream JPEG over RTSP or HTTP
  // The stream URL format depends on printer model and firmware
  useEffect(() => {
    initializeCamera();
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [printerIp, accessCode]);

  const initializeCamera = async () => {
    setLoading(true);
    setError(null);

    try {
      // Try to get camera stream URL from API
      if (printerId) {
        const res = await api.getPrinterCamera?.(printerId);
        const data = unwrap(res);
        if (data?.stream_url) {
          setStreamUrl(data.stream_url);
          setLoading(false);
          return;
        }
      }

      // Construct stream URL based on Bambu LAN protocol
      // Bambu printers expose camera on port 6000 (RTSP) or snapshot on :80
      if (printerIp) {
        // For direct LAN access, use snapshot URL
        // Note: Actual RTSP streaming requires native code or websocket proxy
        const snapshotUrl = `http://${printerIp}/snapshot`;
        setStreamUrl(snapshotUrl);
      } else {
        throw new Error('No printer IP configured');
      }
    } catch (err) {
      console.error('Camera init error:', err);
      setError('Unable to connect to camera. Check printer IP and access code.');
    } finally {
      setLoading(false);
    }
  };

  // Poll for print status
  useEffect(() => {
    if (!printerId) return;

    const fetchStatus = async () => {
      try {
        const res = await api.getPrinterStatus?.(printerId);
        const data = unwrap(res);
        if (data) {
          setPrintStatus(data);
        }
      } catch (err) {
        console.error('Status fetch error:', err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [printerId]);

  // Auto-hide controls
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isFullscreen) {
        setShowControls(false);
      }
    }, 3000);
  }, [isFullscreen]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const toggleLight = async () => {
    try {
      await api.controlPrinterLight?.(printerId, !lightOn);
      setLightOn(!lightOn);
    } catch (err) {
      console.error('Light control error:', err);
    }
  };

  const refreshStream = () => {
    setRefreshKey(prev => prev + 1);
  };

  const formatTime = (seconds) => {
    if (!seconds) return '--:--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div 
      ref={containerRef}
      className={`relative ${isFullscreen ? 'fixed inset-0 z-50 bg-black' : ''}`}
      onMouseMove={handleMouseMove}
    >
      {/* Camera Feed */}
      <div className={`relative ${isFullscreen ? 'h-full' : 'aspect-video'} bg-black rounded-xl overflow-hidden`}>
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-slate-400">Connecting to camera...</p>
            </div>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center p-6">
              <p className="text-4xl mb-3">📷</p>
              <p className="text-red-400 mb-2">{error}</p>
              <button
                onClick={initializeCamera}
                className="px-4 py-2 rounded-lg text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/10"
              >
                Retry Connection
              </button>
            </div>
          </div>
        ) : streamUrl ? (
          <>
            {/* For snapshot-based viewing (refresh every few seconds) */}
            <img
              key={refreshKey}
              src={`${streamUrl}?t=${Date.now()}`}
              alt="Printer Camera"
              className="w-full h-full object-contain"
              onError={() => setError('Camera feed unavailable')}
            />
            
            {/* Auto-refresh for snapshot mode */}
            <AutoRefresh interval={2000} onRefresh={refreshStream} />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-slate-500">No camera feed available</p>
          </div>
        )}

        {/* Overlay Controls */}
        <div 
          className={`absolute inset-0 transition-opacity ${showControls ? 'opacity-100' : 'opacity-0'}`}
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.5) 100%)' }}
        >
          {/* Top Bar */}
          <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
              <span className="text-white font-medium">{printerName || 'Bambu Printer'}</span>
            </div>
            <div className="flex items-center gap-2">
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg bg-black/50 text-white hover:bg-black/70"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            {/* Print Progress */}
            {printStatus?.progress !== undefined && (
              <div className="mb-4">
                <div className="flex items-center justify-between text-white text-sm mb-2">
                  <span>{printStatus.file_name || 'Current Print'}</span>
                  <span>{printStatus.progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/20 overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-green-500 transition-all"
                    style={{ width: `${printStatus.progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-white/70 text-xs mt-2">
                  <span>Remaining: {formatTime(printStatus.remaining_time)}</span>
                  <span>Layer: {printStatus.current_layer || '-'}/{printStatus.total_layers || '-'}</span>
                </div>
              </div>
            )}

            {/* Control Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleLight}
                  className={`p-2.5 rounded-lg transition ${
                    lightOn ? 'bg-yellow-500 text-black' : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                  title="Toggle Chamber Light"
                >
                  💡
                </button>
                <button
                  onClick={refreshStream}
                  className="p-2.5 rounded-lg bg-white/20 text-white hover:bg-white/30"
                  title="Refresh Feed"
                >
                  🔄
                </button>
              </div>

              <div className="flex items-center gap-3 text-white/70 text-sm">
                {printStatus?.nozzle_temp && (
                  <span>🔥 {printStatus.nozzle_temp}°C</span>
                )}
                {printStatus?.bed_temp && (
                  <span>🛏️ {printStatus.bed_temp}°C</span>
                )}
              </div>

              <button
                onClick={toggleFullscreen}
                className="p-2.5 rounded-lg bg-white/20 text-white hover:bg-white/30"
                title="Toggle Fullscreen"
              >
                {isFullscreen ? '⊙' : '⛶'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * AutoRefresh - Component to auto-refresh parent at interval
 */
function AutoRefresh({ interval, onRefresh }) {
  useEffect(() => {
    const timer = setInterval(onRefresh, interval);
    return () => clearInterval(timer);
  }, [interval, onRefresh]);
  return null;
}

/**
 * PrinterCameraGrid - Grid view of all printer cameras
 */
function PrinterCameraGrid() {
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrinter, setSelectedPrinter] = useState(null);
  const [cameraConfig, setCameraConfig] = useState({});

  useEffect(() => {
    loadPrinters();
    loadCameraConfig();
  }, []);

  const loadPrinters = async () => {
    setLoading(true);
    try {
      const res = await api.getPrinters();
      const data = unwrap(res);
      const printersList = Array.isArray(data) ? data : (data?.printers || []);
      
      // Filter to Bambu printers (they have cameras)
      const bambuPrinters = printersList.filter(p => 
        p.printer_type?.toLowerCase().includes('bambu') ||
        p.name?.toLowerCase().includes('bambu') ||
        p.name?.toLowerCase().includes('x1c') ||
        p.name?.toLowerCase().includes('p1s') ||
        p.name?.toLowerCase().includes('p1p') ||
        p.name?.toLowerCase().includes('a1')
      );
      
      setPrinters(bambuPrinters.length > 0 ? bambuPrinters : getMockPrinters());
    } catch (err) {
      console.error('Failed to load printers:', err);
      setPrinters(getMockPrinters());
    } finally {
      setLoading(false);
    }
  };

  const loadCameraConfig = () => {
    const saved = localStorage.getItem('polywerk_camera_config');
    if (saved) {
      try {
        setCameraConfig(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse camera config:', e);
      }
    }
  };

  const saveCameraConfig = (printerId, config) => {
    const updated = { ...cameraConfig, [printerId]: config };
    setCameraConfig(updated);
    localStorage.setItem('polywerk_camera_config', JSON.stringify(updated));
  };

  const getMockPrinters = () => [
    { id: 'bambu-1', name: 'Bambu X1C #1', printer_type: 'bambu_x1c', status: 'printing' },
    { id: 'bambu-2', name: 'Bambu X1C #2', printer_type: 'bambu_x1c', status: 'idle' },
    { id: 'bambu-3', name: 'Bambu P1S', printer_type: 'bambu_p1s', status: 'printing' },
  ];

  const getStatusColor = (status) => {
    const colors = {
      printing: 'bg-green-500',
      idle: 'bg-slate-500',
      error: 'bg-red-500',
      paused: 'bg-yellow-500',
    };
    return colors[status] || 'bg-slate-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            📷 Live Cameras
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Monitor your Bambu Lab printers in real-time
          </p>
        </div>

        <button
          onClick={loadPrinters}
          className="px-4 py-2 rounded-lg text-slate-400 border border-slate-600 hover:bg-slate-700"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Camera Grid */}
      {printers.length === 0 ? (
        <div 
          className="p-12 text-center rounded-xl border"
          style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
        >
          <p className="text-4xl mb-3">📷</p>
          <p className="text-slate-400 mb-2">No Bambu printers found</p>
          <p className="text-slate-500 text-sm">
            Add Bambu Lab printers in the Printers tab to see their cameras
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {printers.map(printer => (
            <div
              key={printer.id}
              className="rounded-xl border overflow-hidden cursor-pointer hover:border-cyan-500/50 transition"
              style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
              onClick={() => setSelectedPrinter(printer)}
            >
              {/* Thumbnail/Preview */}
              <div className="aspect-video bg-black relative">
                {cameraConfig[printer.id]?.ip ? (
                  <img
                    src={`http://${cameraConfig[printer.id].ip}/snapshot?t=${Date.now()}`}
                    alt={printer.name}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-4xl mb-2">📷</p>
                      <p className="text-slate-500 text-sm">Click to configure</p>
                    </div>
                  </div>
                )}
                
                {/* Status Badge */}
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(printer.status)}`}></div>
                  <span className="text-white text-sm bg-black/50 px-2 py-0.5 rounded">
                    {printer.status}
                  </span>
                </div>

                {/* Expand Button */}
                <button
                  className="absolute bottom-3 right-3 p-2 rounded-lg bg-black/50 text-white hover:bg-black/70"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPrinter(printer);
                  }}
                >
                  ⛶
                </button>
              </div>

              {/* Printer Info */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-white">{printer.name}</h3>
                    <p className="text-xs text-slate-500">{printer.printer_type}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const ip = prompt('Enter printer IP address:', cameraConfig[printer.id]?.ip || '');
                      if (ip !== null) {
                        saveCameraConfig(printer.id, { ip });
                      }
                    }}
                    className="text-xs text-cyan-400 hover:text-cyan-300"
                  >
                    ⚙️ Config
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div 
        className="rounded-xl border p-4"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <h4 className="font-medium text-white mb-2">ℹ️ Camera Setup</h4>
        <ul className="text-sm text-slate-400 space-y-1">
          <li>• Click "Config" on each printer to set its local IP address</li>
          <li>• Bambu printers must be on the same network as this dashboard</li>
          <li>• Camera streams use Bambu's LAN mode (no cloud required)</li>
          <li>• Supported: X1 Carbon, X1E, P1S, P1P, A1, A1 Mini</li>
        </ul>
      </div>

      {/* Full Camera Modal */}
      {selectedPrinter && (
        <CameraModal
          printer={selectedPrinter}
          config={cameraConfig[selectedPrinter.id]}
          onClose={() => setSelectedPrinter(null)}
          onConfigChange={(config) => saveCameraConfig(selectedPrinter.id, config)}
        />
      )}
    </div>
  );
}

/**
 * CameraModal - Full-screen camera view with controls
 */
function CameraModal({ printer, config, onClose, onConfigChange }) {
  const [showConfig, setShowConfig] = useState(!config?.ip);
  const [ipInput, setIpInput] = useState(config?.ip || '');
  const [accessCode, setAccessCode] = useState(config?.accessCode || '');

  const handleSaveConfig = () => {
    onConfigChange({ ip: ipInput, accessCode });
    setShowConfig(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90" onClick={onClose} />
      
      <div className="relative w-full max-w-5xl">
        {showConfig ? (
          <div 
            className="rounded-xl border shadow-2xl p-6"
            style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-white text-lg">Configure Camera - {printer.name}</h3>
              <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Printer IP Address</label>
                <input
                  type="text"
                  value={ipInput}
                  onChange={(e) => setIpInput(e.target.value)}
                  placeholder="192.168.1.xxx"
                  className="w-full px-4 py-2 rounded-lg text-white"
                  style={{ backgroundColor: '#334155' }}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Find this in Bambu Studio → Device → Network → IP Address
                </p>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Access Code (Optional)</label>
                <input
                  type="text"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  placeholder="8-digit code"
                  className="w-full px-4 py-2 rounded-lg text-white"
                  style={{ backgroundColor: '#334155' }}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Find this on the printer touchscreen: Settings → Network → Access Code
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={onClose}
                  className="flex-1 py-2 rounded-lg text-slate-300 border border-slate-600 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveConfig}
                  disabled={!ipInput}
                  className="flex-1 py-2 rounded-lg font-medium text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)' }}
                >
                  Save & Connect
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden shadow-2xl">
            <BambuCameraView
              printerId={printer.id}
              printerName={printer.name}
              printerIp={config?.ip}
              accessCode={config?.accessCode}
              onClose={onClose}
            />
            
            {/* Config Button */}
            <button
              onClick={() => setShowConfig(true)}
              className="absolute top-4 right-16 p-2 rounded-lg bg-black/50 text-white hover:bg-black/70"
            >
              ⚙️
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export { BambuCameraView, PrinterCameraGrid };
export default PrinterCameraGrid;
