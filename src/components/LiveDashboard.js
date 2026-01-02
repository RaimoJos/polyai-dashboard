import React, { useState, useEffect } from 'react';
import { useLiveUpdates } from '../hooks/useLiveUpdates';
import { useSoundAlerts } from '../hooks/useSoundAlerts';
import { api, unwrap } from '../services/api';
import QuickActions from './QuickActions';
import TemperatureOverview from './TemperatureGraph';
import PrinterCamera from './PrinterCamera';
import toast from '../utils/toast';

/**
 * Live Dashboard - Real-time printer monitoring with WebSocket
 */
function LiveDashboard() {
  const { 
    connected, 
    printers, 
    lastUpdate, 
    alerts, 
    sendCommand,
    markAlertRead,
    clearAlerts,
    unreadAlerts 
  } = useLiveUpdates();

  const [selectedPrinter, setSelectedPrinter] = useState(null);
  const [controlLoading, setControlLoading] = useState({});
  const [showAlerts, setShowAlerts] = useState(false);
  const [autoStartStatus, setAutoStartStatus] = useState(null);
  const [showCamera, setShowCamera] = useState({});
  const [aiTimeEstimates, setAiTimeEstimates] = useState({});

  // Fetch auto-start status
  useEffect(() => {
    api.getAutoStartStatus()
      .then(res => setAutoStartStatus(res.data?.data))
      .catch(err => console.error('Failed to get auto-start status:', err));
  }, []);

  // Fetch AI time estimates for printing printers
  useEffect(() => {
    const fetchTimeEstimates = async () => {
      const printerArray = Object.values(printers);
      const printingPrinters = printerArray.filter(p => p.state === 'printing');

      for (const printer of printingPrinters) {
        // Only fetch if we have job info
        if (printer.time_remaining > 0 && printer.progress > 0) {
          try {
            // Calculate adaptive time estimate
            const totalPredicted = printer.time_remaining + (printer.time_elapsed || 0);
            const response = await api.get(`/estimation/job/${printer.job_id || 0}/remaining`).catch(() => null);

            if (response?.data?.data) {
              setAiTimeEstimates(prev => ({
                ...prev,
                [printer.name]: response.data.data
              }));
            } else {
              // Local estimation based on progress rate
              const elapsedSeconds = printer.time_elapsed || 0;
              const progressRate = printer.progress / Math.max(elapsedSeconds, 1);
              const estimatedTotal = 100 / progressRate;
              const remaining = Math.max(estimatedTotal - elapsedSeconds, 0);

              setAiTimeEstimates(prev => ({
                ...prev,
                [printer.name]: {
                  remaining_seconds: Math.round(remaining),
                  remaining_formatted: formatTime(remaining),
                  adjusted: Math.abs(remaining - printer.time_remaining) > 60,
                  adjustment_percent: ((remaining - printer.time_remaining) / Math.max(printer.time_remaining, 1)) * 100
                }
              }));
            }
          } catch (err) {
            // Silently fail - use original estimate
          }
        }
      }
    };

    if (Object.keys(printers).length > 0) {
      fetchTimeEstimates();
      // Refresh every 30 seconds
      const interval = setInterval(fetchTimeEstimates, 30000);
      return () => clearInterval(interval);
    }
  }, [printers, formatTime]);

  const printerList = Object.values(printers);

  // Send control command
  const handleCommand = async (printerName, command, params = {}) => {
    setControlLoading(prev => ({ ...prev, [`${printerName}-${command}`]: true }));
    try {
      await sendCommand(printerName, command, params);
    } catch (err) {
      console.error('Command failed:', err);
      toast.error(`Command failed: ${err.message}`);
    } finally {
      setControlLoading(prev => ({ ...prev, [`${printerName}-${command}`]: false }));
    }
  };

  // Toggle auto-start
  const toggleAutoStart = async () => {
    try {
      if (autoStartStatus?.enabled) {
        await api.disableAutoStart();
        setAutoStartStatus(prev => ({ ...prev, enabled: false }));
      } else {
        await api.enableAutoStart();
        setAutoStartStatus(prev => ({ ...prev, enabled: true }));
      }
    } catch (err) {
      console.error('Failed to toggle auto-start:', err);
    }
  };

  // Format time remaining
  const formatTime = (seconds) => {
    if (!seconds || seconds <= 0) return '--:--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  // Get state color
  const getStateColor = (state) => {
    switch (state) {
      case 'printing': return 'bg-blue-500';
      case 'idle': return 'bg-green-500';
      case 'paused': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  // Get severity color
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-600 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      default: return 'bg-blue-500 text-white';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              📡 Live Dashboard
              <span className={`inline-block w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              {connected ? 'Connected • Real-time updates' : 'Disconnected • Reconnecting...'}
              {lastUpdate && ` • Last: ${new Date(lastUpdate).toLocaleTimeString()}`}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Auto-Start Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Auto-Start</span>
              <button
                onClick={toggleAutoStart}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  autoStartStatus?.enabled ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoStartStatus?.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Alerts Button */}
            <button
              onClick={() => setShowAlerts(!showAlerts)}
              className="relative px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              🔔 Alerts
              {unreadAlerts > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadAlerts}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Alerts Panel */}
        {showAlerts && (
          <div className="mt-4 border-t pt-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium">Recent Alerts</h3>
              <button
                onClick={clearAlerts}
                className="text-sm text-red-500 hover:text-red-700"
              >
                Clear All
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {alerts.length === 0 ? (
                <p className="text-gray-500 text-sm">No alerts</p>
              ) : (
                alerts.map(alert => (
                  <div
                    key={alert.id}
                    onClick={() => markAlertRead(alert.id)}
                    className={`p-3 rounded-lg cursor-pointer ${
                      alert.read ? 'bg-gray-50' : getSeverityColor(alert.severity)
                    }`}
                  >
                    <div className="flex justify-between">
                      <span className="font-medium">{alert.type}</span>
                      <span className="text-xs opacity-75">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className={`text-sm ${alert.read ? 'text-gray-600' : ''}`}>
                      {alert.message}
                    </p>
                    {alert.printer && (
                      <span className="text-xs opacity-75">Printer: {alert.printer}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <QuickActions printers={printerList} onRefresh={() => {}} />

      {/* Printer Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {printerList.length === 0 ? (
          <div className="col-span-full bg-white rounded-lg shadow p-8 text-center">
            <p className="text-4xl mb-4">🖨️</p>
            <p className="text-gray-500">
              {connected ? 'No printers connected' : 'Connecting to printers...'}
            </p>
          </div>
        ) : (
          printerList.map(printer => (
            <div
              key={printer.name}
              className={`bg-white rounded-lg shadow overflow-hidden ${
                selectedPrinter === printer.name ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              {/* Printer Header */}
              <div 
                className="p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setSelectedPrinter(
                  selectedPrinter === printer.name ? null : printer.name
                )}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg">{printer.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs text-white ${getStateColor(printer.state)}`}>
                        {printer.state}
                      </span>
                      {!printer.connected && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-600">
                          Offline
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Progress Circle */}
                  {printer.state === 'printing' && (
                    <div className="relative w-16 h-16">
                      <svg className="w-16 h-16 transform -rotate-90">
                        <circle
                          cx="32" cy="32" r="28"
                          fill="none"
                          stroke="#e5e7eb"
                          strokeWidth="6"
                        />
                        <circle
                          cx="32" cy="32" r="28"
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="6"
                          strokeDasharray={`${printer.progress * 1.76} 176`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
                        {printer.progress.toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Current File */}
                {printer.filename && (
                  <p className="text-sm text-gray-500 mt-2 truncate">
                    📄 {printer.filename}
                  </p>
                )}

                {/* Time Remaining - with AI adjustment */}
                {printer.state === 'printing' && printer.time_remaining > 0 && (
                  <div className="text-sm text-gray-500 mt-1">
                    {aiTimeEstimates[printer.name]?.adjusted ? (
                      <div className="flex items-center gap-2">
                        <span className="text-purple-600 font-medium">
                          ⏱️ {aiTimeEstimates[printer.name].remaining_formatted}
                        </span>
                        <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                          AI
                        </span>
                        {aiTimeEstimates[printer.name].adjustment_percent > 5 && (
                          <span className="text-xs text-orange-500">
                            +{Math.round(aiTimeEstimates[printer.name].adjustment_percent)}%
                          </span>
                        )}
                        {aiTimeEstimates[printer.name].adjustment_percent < -5 && (
                          <span className="text-xs text-green-500">
                            {Math.round(aiTimeEstimates[printer.name].adjustment_percent)}%
                          </span>
                        )}
                      </div>
                    ) : (
                      <span>⏱️ {formatTime(printer.time_remaining)} remaining</span>
                    )}
                  </div>
                )}
              </div>

              {/* Temperature Display */}
              <div className="px-4 py-3 bg-gray-50 border-t grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-gray-500">Nozzle</span>
                  <p className="font-mono font-bold">
                    🔥 {printer.nozzle_temp.toFixed(0)}°C
                    {printer.nozzle_target > 0 && (
                      <span className="text-gray-400 text-sm"> / {printer.nozzle_target}°C</span>
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Bed</span>
                  <p className="font-mono font-bold">
                    🛏️ {printer.bed_temp.toFixed(0)}°C
                    {printer.bed_target > 0 && (
                      <span className="text-gray-400 text-sm"> / {printer.bed_target}°C</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Expanded Controls */}
              {selectedPrinter === printer.name && (
                <div className="p-4 border-t bg-blue-50 space-y-4">
                  {/* Print Controls */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Print Controls</h4>
                    <div className="flex gap-2">
                      {printer.state === 'printing' && (
                        <button
                          onClick={() => handleCommand(printer.name, 'pause')}
                          disabled={controlLoading[`${printer.name}-pause`]}
                          className="px-3 py-1.5 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
                        >
                          ⏸️ Pause
                        </button>
                      )}
                      {printer.state === 'paused' && (
                        <button
                          onClick={() => handleCommand(printer.name, 'resume')}
                          disabled={controlLoading[`${printer.name}-resume`]}
                          className="px-3 py-1.5 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                        >
                          ▶️ Resume
                        </button>
                      )}
                      {(printer.state === 'printing' || printer.state === 'paused') && (
                        <button
                          onClick={() => {
                            if (window.confirm('Stop this print?')) {
                              handleCommand(printer.name, 'stop');
                            }
                          }}
                          disabled={controlLoading[`${printer.name}-stop`]}
                          className="px-3 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                        >
                          ⏹️ Stop
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Speed Control */}
                  {printer.state === 'printing' && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        Speed: {printer.speed_percent}%
                      </h4>
                      <div className="flex gap-2">
                        {[50, 75, 100, 125, 150].map(speed => (
                          <button
                            key={speed}
                            onClick={() => handleCommand(printer.name, 'speed', { speed })}
                            className={`px-3 py-1 rounded text-sm ${
                              printer.speed_percent === speed
                                ? 'bg-blue-500 text-white'
                                : 'bg-white border hover:bg-gray-50'
                            }`}
                          >
                            {speed}%
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fan Control */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Fan: {printer.fan_percent}%
                    </h4>
                    <div className="flex gap-2">
                      {[0, 25, 50, 75, 100].map(fan => (
                        <button
                          key={fan}
                          onClick={() => handleCommand(printer.name, 'fan', { speed: fan })}
                          className={`px-3 py-1 rounded text-sm ${
                            printer.fan_percent === fan
                              ? 'bg-blue-500 text-white'
                              : 'bg-white border hover:bg-gray-50'
                          }`}
                        >
                          {fan}%
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Layer Info */}
                  {printer.layer_total > 0 && (
                    <div className="text-sm text-gray-600">
                      📐 Layer {printer.layer_current} / {printer.layer_total}
                    </div>
                  )}

                  {/* Light Toggle */}
                  <button
                    onClick={() => handleCommand(printer.name, 'light')}
                    className="px-3 py-1.5 bg-gray-200 rounded hover:bg-gray-300 text-sm"
                  >
                    💡 Toggle Light
                  </button>

                  {/* Camera Toggle */}
                  <button
                    onClick={() => setShowCamera(prev => ({ ...prev, [printer.name]: !prev[printer.name] }))}
                    className={`px-3 py-1.5 rounded text-sm ${
                      showCamera[printer.name]
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 hover:bg-gray-300'
                    }`}
                  >
                    📹 {showCamera[printer.name] ? 'Hide Camera' : 'Show Camera'}
                  </button>
                </div>

                {/* Camera Feed */}
                {showCamera[printer.name] && (
                  <div className="mt-4">
                    <PrinterCamera
                      printerName={printer.name}
                      showControls={true}
                      autoStart={true}
                      className="rounded-lg overflow-hidden"
                    />
                  </div>
                )}
              </div>
            )}
            </div>
          ))
        )}
      </div>

      {/* Auto-Start Status Panel */}
      {autoStartStatus && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold mb-4">🤖 Auto-Start Service</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <span className="text-sm text-gray-500">Status</span>
              <p className={`font-bold ${autoStartStatus.running ? 'text-green-600' : 'text-gray-500'}`}>
                {autoStartStatus.running ? '● Running' : '○ Stopped'}
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Check Interval</span>
              <p className="font-bold">{autoStartStatus.check_interval}s</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Cooldown Wait</span>
              <p className="font-bold">{autoStartStatus.cooldown_wait_minutes} min</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Min Bed Temp</span>
              <p className="font-bold">{autoStartStatus.min_bed_temp}°C</p>
            </div>
          </div>
          
          {autoStartStatus.disabled_printers?.length > 0 && (
            <div className="mt-4">
              <span className="text-sm text-gray-500">Disabled Printers:</span>
              <div className="flex gap-2 mt-1">
                {autoStartStatus.disabled_printers.map(p => (
                  <span key={p} className="px-2 py-1 bg-red-100 text-red-600 rounded text-sm">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Temperature Overview */}
      {printerList.length > 0 && (
        <TemperatureOverview printers={printerList} />
      )}
    </div>
  );
}

export default LiveDashboard;
