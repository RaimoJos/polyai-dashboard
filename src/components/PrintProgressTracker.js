// Print Progress Tracker - Real-time Monitoring
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

function PrintProgressTracker({ printers = [], onPrintComplete }) {
  const [activePrints, setActivePrints] = useState([]);
  const [refreshInterval] = useState(5000);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const printing = printers.filter(p => p?.state === 'printing');
        
        if (printing.length > 0) {
          const jobs = await Promise.all(
            printing.map(p => 
              api.printerControl(p.name, 'status')
                .then(data => ({
                  printer: p,
                  jobData: data,
                  lastUpdate: new Date()
                }))
                .catch(() => null)
            )
          );
          
          setActivePrints(jobs.filter(j => j !== null));
        } else {
          setActivePrints([]);
        }
      } catch (err) {
        console.warn('[PrintProgress] Status fetch failed:', err);
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [printers, refreshInterval]);

  if (activePrints.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <div className="text-3xl mb-2">🖨️</div>
        <p className="text-sm">No active prints</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activePrints.map(print => (
        <PrintProgressCard
          key={print.printer.name}
          print={print}
          onComplete={onPrintComplete}
        />
      ))}
    </div>
  );
}

function PrintProgressCard({ print, onComplete }) {
  const [expandedMetrics, setExpandedMetrics] = useState(false);
  const p = print.printer;
  const job = print.jobData?.job || print.jobData || {};
  
  const progress = job?.progress || 0;
  const timeRemaining = job?.time_remaining_minutes || 0;
  const currentLayer = job?.current_layer || 0;
  const totalLayers = job?.total_layers || 0;

  const formatTime = (minutes) => {
    if (!minutes) return '—';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getProgressColor = (pct) => {
    if (pct < 25) return 'from-red-500 to-orange-500';
    if (pct < 50) return 'from-orange-500 to-yellow-500';
    if (pct < 75) return 'from-yellow-500 to-green-500';
    return 'from-green-500 to-emerald-500';
  };

  const getTempColor = (current, target) => {
    const diff = Math.abs(current - target);
    if (diff > 10) return 'text-red-400';
    if (diff > 5) return 'text-yellow-400';
    return 'text-green-400';
  };

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-lg p-4 shadow-lg hover:shadow-xl transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-white text-lg">{p.name}</h3>
          <p className="text-xs text-slate-400">
            {job?.model_name || 'Active Print'}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">{progress}%</div>
          <div className="text-xs text-slate-400">
            ⏱️ {formatTime(timeRemaining)} left
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full bg-gradient-to-r ${getProgressColor(progress)} transition-all duration-500 ease-out`}
            style={{ width: `${progress}%` }}
          >
            <div className="h-full w-full bg-gradient-to-r from-transparent via-white to-transparent opacity-20 animate-pulse"></div>
          </div>
        </div>
        
        <div className="flex justify-between text-xs text-slate-400">
          <span>Layer {currentLayer} / {totalLayers}</span>
          <span>{Math.round((currentLayer / totalLayers) * 100) || 0}% layers</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-700/50 rounded p-3">
          <div className="text-xs text-slate-400 mb-1">🔥 Nozzle</div>
          <div className="flex items-baseline gap-1">
            <span className={`text-lg font-bold ${getTempColor(p.nozzle_temp, job?.nozzle_target || 200)}`}>
              {Math.round(p.nozzle_temp || 0)}°C
            </span>
            <span className="text-xs text-slate-500">
              / {job?.nozzle_target || 200}°C
            </span>
          </div>
          <div className="w-full h-1 bg-slate-600 rounded mt-1 overflow-hidden">
            <div
              className="h-full bg-orange-500"
              style={{
                width: `${Math.min(100, ((p.nozzle_temp || 0) / (job?.nozzle_target || 200)) * 100)}%`
              }}
            ></div>
          </div>
        </div>

        <div className="bg-slate-700/50 rounded p-3">
          <div className="text-xs text-slate-400 mb-1">🛏️ Bed</div>
          <div className="flex items-baseline gap-1">
            <span className={`text-lg font-bold ${getTempColor(p.bed_temp, job?.bed_target || 60)}`}>
              {Math.round(p.bed_temp || 0)}°C
            </span>
            <span className="text-xs text-slate-500">
              / {job?.bed_target || 60}°C
            </span>
          </div>
          <div className="w-full h-1 bg-slate-600 rounded mt-1 overflow-hidden">
            <div
              className="h-full bg-blue-500"
              style={{
                width: `${Math.min(100, ((p.bed_temp || 0) / (job?.bed_target || 60)) * 100)}%`
              }}
            ></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4 text-center">
        <div className="bg-slate-700/30 rounded p-2">
          <div className="text-xs text-slate-400">Elapsed</div>
          <div className="text-sm font-medium text-white">
            {formatTime(job?.print_time_elapsed_minutes || 0)}
          </div>
        </div>
        <div className="bg-slate-700/30 rounded p-2">
          <div className="text-xs text-slate-400">Remaining</div>
          <div className="text-sm font-medium text-white">
            {formatTime(timeRemaining)}
          </div>
        </div>
        <div className="bg-slate-700/30 rounded p-2">
          <div className="text-xs text-slate-400">Total</div>
          <div className="text-sm font-medium text-white">
            {formatTime((job?.print_time_elapsed_minutes || 0) + timeRemaining)}
          </div>
        </div>
      </div>

      <button
        onClick={() => setExpandedMetrics(!expandedMetrics)}
        className="w-full text-xs text-slate-400 hover:text-slate-300 text-center py-2 border-t border-slate-700 transition-colors"
      >
        {expandedMetrics ? '▼ Hide Details' : '▶ Show Details'}
      </button>

      {expandedMetrics && (
        <div className="mt-3 pt-3 border-t border-slate-700 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">Material:</span>
            <span className="text-white font-medium">{job?.material || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Filament Used:</span>
            <span className="text-white font-medium">{job?.filament_used_g?.toFixed(1) || '0'}g</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Layer Height:</span>
            <span className="text-white font-medium">{job?.layer_height || '0'}mm</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Speed:</span>
            <span className="text-white font-medium">{job?.print_speed || '—'} mm/s</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Infill:</span>
            <span className="text-white font-medium">{job?.infill || '—'}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

export { PrintProgressTracker, PrintProgressCard };
export default PrintProgressTracker;
