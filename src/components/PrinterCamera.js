import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { api } from '../services/api';
import toast from '../utils/toast';

/**
 * PrinterCamera - Live video feed from printer webcam
 *
 * Supports:
 * - MJPEG streaming
 * - Snapshot refresh
 * - WebSocket frame updates
 * - Fullscreen mode
 */
function PrinterCamera({ printerName, showControls = true, autoStart = true, className = '' }) {
  const [streamMode, setStreamMode] = useState('mjpeg'); // 'mjpeg' | 'snapshot' | 'websocket'
  const [isStreaming, setIsStreaming] = useState(autoStart);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState(null);
  const [cameraInfo, setCameraInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastFrameTime, setLastFrameTime] = useState(null);
  const [fps, setFps] = useState(10);
  const [snapshotData, setSnapshotData] = useState(null);

  const imgRef = useRef(null);
  const containerRef = useRef(null);
  const snapshotIntervalRef = useRef(null);
  const frameCountRef = useRef(0);
  const lastFpsUpdateRef = useRef(Date.now());

  // Fetch camera info on mount
  useEffect(() => {
    if (printerName) {
      fetchCameraInfo();
    }
  }, [printerName]);

  const fetchCameraInfo = async () => {
    try {
      const response = await api.get(`/printers/${printerName}/camera/info`);
      if (response.data?.data) {
        setCameraInfo(response.data.data);
        setError(null);
      }
    } catch (err) {
      console.warn('Could not fetch camera info:', err);
      // Don't set error - camera might still work
    }
    setLoading(false);
  };

  // Get stream URL
  const getStreamUrl = useCallback(() => {
    if (!printerName) return null;
    const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    return `${baseUrl}/api/v1/printers/${printerName}/camera/stream?fps=${fps}`;
  }, [printerName, fps]);

  // Get snapshot URL
  const getSnapshotUrl = useCallback(() => {
    if (!printerName) return null;
    const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    return `${baseUrl}/api/v1/printers/${printerName}/camera/snapshot?t=${Date.now()}`;
  }, [printerName]);

  // Fetch snapshot
  const fetchSnapshot = useCallback(async () => {
    if (!printerName) return;

    try {
      const response = await api.get(`/printers/${printerName}/camera/snapshot?format=base64`);
      if (response.data?.data?.image) {
        setSnapshotData(`data:image/jpeg;base64,${response.data.data.image}`);
        setLastFrameTime(new Date());
        setError(null);

        // Calculate FPS
        frameCountRef.current++;
        const now = Date.now();
        if (now - lastFpsUpdateRef.current >= 1000) {
          setFps(frameCountRef.current);
          frameCountRef.current = 0;
          lastFpsUpdateRef.current = now;
        }
      }
    } catch (err) {
      console.warn('Snapshot fetch failed:', err);
      if (err.response?.status === 503) {
        setError('Camera not available');
      }
    }
  }, [printerName]);

  // Handle MJPEG stream
  useEffect(() => {
    if (isStreaming && streamMode === 'mjpeg' && imgRef.current) {
      const streamUrl = getStreamUrl();
      if (streamUrl) {
        imgRef.current.src = streamUrl;
        setLoading(false);
      }
    }
  }, [isStreaming, streamMode, getStreamUrl]);

  // Handle snapshot mode
  useEffect(() => {
    if (isStreaming && streamMode === 'snapshot') {
      // Initial fetch
      fetchSnapshot();

      // Set up interval (2 fps for snapshot mode)
      snapshotIntervalRef.current = setInterval(fetchSnapshot, 500);

      return () => {
        if (snapshotIntervalRef.current) {
          clearInterval(snapshotIntervalRef.current);
        }
      };
    }
  }, [isStreaming, streamMode, fetchSnapshot]);

  // Toggle streaming
  const toggleStream = () => {
    setIsStreaming(!isStreaming);
    if (!isStreaming) {
      setError(null);
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Handle image load
  const handleImageLoad = () => {
    setLoading(false);
    setError(null);
    setLastFrameTime(new Date());
  };

  // Handle image error
  const handleImageError = () => {
    setLoading(false);
    if (isStreaming) {
      setError('Stream unavailable');
      // Try snapshot mode as fallback
      if (streamMode === 'mjpeg') {
        setStreamMode('snapshot');
      }
    }
  };

  // Capture current frame
  const capturePhoto = async () => {
    try {
      const response = await api.post(`/printers/${printerName}/camera/capture`, {
        photo_type: 'manual'
      });

      if (response.data?.data) {
        toast.success(`Photo captured! ID: ${response.data.data.photo_id}`);
      }
    } catch (err) {
      toast.error('Failed to capture photo');
    }
  };

  if (!printerName) {
    return (
      <div className={`bg-gray-100 rounded-lg p-4 text-center ${className}`}>
        <p className="text-gray-500">No printer selected</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`bg-gray-900 rounded-lg overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50' : ''} ${className}`}
    >
      {/* Header */}
      {showControls && (
        <div className="bg-gray-800 px-4 py-2 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
            <span className="text-white text-sm font-medium">{printerName}</span>
            {lastFrameTime && (
              <span className="text-gray-400 text-xs">
                {lastFrameTime.toLocaleTimeString()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Stream Mode Toggle */}
            <select
              value={streamMode}
              onChange={(e) => setStreamMode(e.target.value)}
              className="bg-gray-700 text-white text-xs rounded px-2 py-1"
            >
              <option value="mjpeg">MJPEG Stream</option>
              <option value="snapshot">Snapshots</option>
            </select>

            {/* FPS Control (for MJPEG) */}
            {streamMode === 'mjpeg' && (
              <select
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                className="bg-gray-700 text-white text-xs rounded px-2 py-1"
              >
                <option value={5}>5 FPS</option>
                <option value={10}>10 FPS</option>
                <option value={15}>15 FPS</option>
                <option value={30}>30 FPS</option>
              </select>
            )}
          </div>
        </div>
      )}

      {/* Video Container */}
      <div className="relative aspect-video bg-black">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center">
              <p className="text-red-400 text-lg mb-2">📹 {error}</p>
              <button
                onClick={() => { setError(null); setIsStreaming(true); }}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* MJPEG Stream */}
        {isStreaming && streamMode === 'mjpeg' && !error && (
          <img
            ref={imgRef}
            alt={`${printerName} camera`}
            className="w-full h-full object-contain"
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        )}

        {/* Snapshot Mode */}
        {isStreaming && streamMode === 'snapshot' && !error && snapshotData && (
          <img
            src={snapshotData}
            alt={`${printerName} camera`}
            className="w-full h-full object-contain"
          />
        )}

        {/* Paused State */}
        {!isStreaming && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
            <button
              onClick={toggleStream}
              className="p-4 bg-blue-500 rounded-full hover:bg-blue-600 transition"
            >
              <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Controls */}
      {showControls && (
        <div className="bg-gray-800 px-4 py-2 flex justify-between items-center">
          <div className="flex gap-2">
            {/* Play/Pause */}
            <button
              onClick={toggleStream}
              className={`p-2 rounded ${isStreaming ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white`}
              title={isStreaming ? 'Stop' : 'Start'}
            >
              {isStreaming ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Capture Photo */}
            <button
              onClick={capturePhoto}
              className="p-2 bg-gray-700 text-white rounded hover:bg-gray-600"
              title="Capture Photo"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            {/* Refresh */}
            <button
              onClick={fetchSnapshot}
              className="p-2 bg-gray-700 text-white rounded hover:bg-gray-600"
              title="Refresh"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          <div className="flex gap-2">
            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-2 bg-gray-700 text-white rounded hover:bg-gray-600"
              title="Fullscreen"
            >
              {isFullscreen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * CameraGrid - Display multiple printer cameras in a grid
 */
export function CameraGrid({ printers, columns = 2 }) {
  const [cameras, setCameras] = useState([]);

  useEffect(() => {
    // Fetch list of cameras
    const fetchCameras = async () => {
      try {
        const response = await api.get('/cameras');
        if (response.data?.data?.cameras) {
          setCameras(response.data.data.cameras);
        }
      } catch (err) {
        console.warn('Failed to fetch cameras:', err);
        // Use provided printers as fallback
        if (printers) {
          setCameras(printers.map(p => ({ printer_name: p.name || p })));
        }
      }
    };

    fetchCameras();
  }, [printers]);

  if (cameras.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500">No cameras available</p>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-${columns} gap-4`}>
      {cameras.map(camera => (
        <PrinterCamera
          key={camera.printer_name}
          printerName={camera.printer_name}
          className="shadow-lg"
        />
      ))}
    </div>
  );
}

PrinterCamera.propTypes = {
  printerName: PropTypes.string,
  showControls: PropTypes.bool,
  autoStart: PropTypes.bool,
  className: PropTypes.string
};

CameraGrid.propTypes = {
  printers: PropTypes.array,
  columns: PropTypes.number
};

export default PrinterCamera;
