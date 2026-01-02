import React, { useState, useEffect, useMemo } from 'react';
import { api, unwrap } from '../services/api';
import { useLanguage } from '../i18n';
import toast from '../utils/toast';

/**
 * PrintFailureLog - Comprehensive print failure tracking and analysis
 * Features: Failure logging with photos, reasons, reprint, statistics
 */
const PrintFailureLog = ({ currentUser }) => {
  const { t } = useLanguage();
  const [failures, setFailures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLogModal, setShowLogModal] = useState(null);
  const [selectedFailure, setSelectedFailure] = useState(null);
  const [filterReason, setFilterReason] = useState('all');
  const [filterPrinter, setFilterPrinter] = useState('all');
  const [dateRange, setDateRange] = useState(30);

  const FAILURE_REASONS = [
    { value: 'adhesion', label: 'Adhesion Failure', icon: '🟥', color: 'red', tips: ['Clean bed with IPA', 'Check bed level', 'Increase bed temp', 'Use glue stick/hairspray'] },
    { value: 'nozzle_clog', label: 'Nozzle Clog', icon: '🔧', color: 'orange', tips: ['Cold pull', 'Replace nozzle', 'Check retraction settings', 'Dry filament'] },
    { value: 'warping', label: 'Warping', icon: '🌀', color: 'yellow', tips: ['Use enclosure', 'Increase bed temp', 'Add brim/raft', 'Reduce cooling'] },
    { value: 'stringing', label: 'Stringing/Oozing', icon: '🧵', color: 'purple', tips: ['Increase retraction', 'Lower temp', 'Enable wipe', 'Dry filament'] },
    { value: 'layer_shift', label: 'Layer Shift', icon: '↩️', color: 'blue', tips: ['Tighten belts', 'Check stepper drivers', 'Lower acceleration', 'Check for obstructions'] },
    { value: 'under_extrusion', label: 'Under-extrusion', icon: '📉', color: 'cyan', tips: ['Check extruder tension', 'Unclog nozzle', 'Calibrate e-steps', 'Increase temp'] },
    { value: 'over_extrusion', label: 'Over-extrusion', icon: '📈', color: 'pink', tips: ['Calibrate flow rate', 'Lower temp', 'Check e-steps'] },
    { value: 'spaghetti', label: 'Spaghetti Monster', icon: '🍝', color: 'red', tips: ['Check adhesion', 'Verify supports', 'Check file integrity', 'Reduce speed for first layer'] },
    { value: 'filament_tangle', label: 'Filament Tangle', icon: '🔀', color: 'amber', tips: ['Re-spool filament', 'Check spool holder', 'Use filament guide'] },
    { value: 'filament_runout', label: 'Filament Runout', icon: '📭', color: 'gray', tips: ['Load new spool', 'Enable runout sensor', 'Check weight before print'] },
    { value: 'power_loss', label: 'Power Loss', icon: '⚡', color: 'yellow', tips: ['Use UPS', 'Enable power recovery', 'Check power connection'] },
    { value: 'thermal_runaway', label: 'Thermal Runaway', icon: '🔥', color: 'red', tips: ['Check thermistor', 'PID tune', 'Check heater cartridge'] },
    { value: 'z_offset', label: 'Z-Offset Issue', icon: '📏', color: 'blue', tips: ['Recalibrate Z', 'Check probe', 'Re-level bed'] },
    { value: 'support_failure', label: 'Support Failure', icon: '🏗️', color: 'orange', tips: ['Increase support density', 'Change support type', 'Add more support'] },
    { value: 'user_cancelled', label: 'User Cancelled', icon: '✋', color: 'gray', tips: [] },
    { value: 'other', label: 'Other', icon: '❓', color: 'slate', tips: [] },
  ];

  useEffect(() => {
    loadFailures();
  }, [dateRange]);

  const loadFailures = async () => {
    setLoading(true);
    try {
      // Try multiple endpoints
      const [failuresRes, historyRes] = await Promise.all([
        api.getFailureLogs?.({ days: dateRange }).catch(() => null),
        api.getPrintHistory?.(dateRange).catch(() => null)
      ]);

      let failureList = [];

      // From dedicated failures endpoint
      const dedicated = unwrap(failuresRes);
      if (Array.isArray(dedicated?.failures)) {
        failureList = dedicated.failures;
      }

      // From print history - extract failures
      const history = unwrap(historyRes);
      const historyItems = history?.history || history?.prints || history || [];
      if (Array.isArray(historyItems)) {
        const historyFailures = historyItems
          .filter(p => ['failed', 'error', 'cancelled'].includes(String(p.status || p.state).toLowerCase()))
          .map(p => ({
            id: p.job_id || p.id || `fail-${Math.random().toString(36).slice(2)}`,
            job_id: p.job_id || p.id,
            file_name: p.file_name || p.filename || p.name || 'Unknown',
            printer_name: p.printer_name || p.printer || 'Unknown',
            reason: p.failure_reason || p.error || p.errors || 'unknown',
            notes: p.notes || '',
            timestamp: p.failed_at || p.end_time || p.completed_at || p.created_at,
            material_type: p.material_type || p.material || 'Unknown',
            material_wasted_g: p.material_used || p.weight || p.filament_g || 0,
            print_time_wasted: p.duration || p.print_time || 0,
            order_id: p.order_id,
            logged_by: p.logged_by || p.user,
            photos: p.photos || [],
            ...p
          }));
        failureList = [...failureList, ...historyFailures];
      }

      // Remove duplicates by id
      const unique = Array.from(new Map(failureList.map(f => [f.id, f])).values());
      setFailures(unique);
    } catch (err) {
      console.error('Failed to load failures:', err);
      setFailures([]);
    } finally {
      setLoading(false);
    }
  };

  const logFailure = async (failureData) => {
    try {
      // Try to save via API
      try {
        await api.logFailure?.(failureData);
      } catch (e) {
        // Fallback: store locally
        const saved = JSON.parse(localStorage.getItem('polywerk_failure_logs') || '[]');
        saved.unshift({ ...failureData, id: `fail-${Date.now()}`, timestamp: new Date().toISOString() });
        localStorage.setItem('polywerk_failure_logs', JSON.stringify(saved.slice(0, 100)));
      }
      
      toast.success('Failure logged successfully');
      setShowLogModal(null);
      loadFailures();
    } catch (err) {
      toast.error('Failed to log failure');
    }
  };

  const handleReprint = async (failure) => {
    try {
      // Create new job from failed job
      const reprintJob = {
        file_name: failure.file_name,
        file_path: failure.file_path,
        printer_id: failure.printer_id,
        printer_name: failure.printer_name,
        material_type: failure.material_type,
        order_id: failure.order_id,
        priority: 'HIGH',
        notes: `Reprint of failed job: ${failure.reason}`,
        original_job_id: failure.job_id
      };

      await api.createJob?.(reprintJob).catch(() => {
        // Fallback
        toast.info('Reprint queued (manual start required)');
      });
      
      toast.success('Reprint job created!');
    } catch (err) {
      toast.error('Failed to create reprint job');
    }
  };

  // Statistics
  const stats = useMemo(() => {
    if (failures.length === 0) return { total: 0, byReason: {}, byPrinter: {}, wastedMaterial: 0, wastedTime: 0 };

    const byReason = {};
    const byPrinter = {};
    let wastedMaterial = 0;
    let wastedTime = 0;

    failures.forEach(f => {
      const reason = f.reason || 'unknown';
      byReason[reason] = (byReason[reason] || 0) + 1;
      
      const printer = f.printer_name || 'Unknown';
      byPrinter[printer] = (byPrinter[printer] || 0) + 1;
      
      wastedMaterial += f.material_wasted_g || 0;
      wastedTime += f.print_time_wasted || 0;
    });

    return {
      total: failures.length,
      byReason,
      byPrinter,
      wastedMaterial,
      wastedTime,
      topReason: Object.entries(byReason).sort((a, b) => b[1] - a[1])[0]?.[0],
      topPrinter: Object.entries(byPrinter).sort((a, b) => b[1] - a[1])[0]?.[0]
    };
  }, [failures]);

  // Filtered failures
  const filteredFailures = useMemo(() => {
    return failures.filter(f => {
      if (filterReason !== 'all' && f.reason !== filterReason) return false;
      if (filterPrinter !== 'all' && f.printer_name !== filterPrinter) return false;
      return true;
    });
  }, [failures, filterReason, filterPrinter]);

  const uniquePrinters = useMemo(() => {
    return Array.from(new Set(failures.map(f => f.printer_name).filter(Boolean)));
  }, [failures]);

  const getReasonInfo = (reason) => {
    return FAILURE_REASONS.find(r => r.value === reason) || FAILURE_REASONS[FAILURE_REASONS.length - 1];
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleString('en-GB', { 
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
    });
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-20 bg-gray-800 rounded-lg"></div>)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              ❌ Print Failure Log
            </h2>
            <p className="text-sm text-zinc-400">Track and analyze print failures</p>
          </div>
          <div className="flex gap-2">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button
              onClick={() => setShowLogModal({})}
              className="px-4 py-2 rounded-lg font-medium text-white"
              style={{ background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)' }}
            >
              + Log Failure
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <p className="text-xs text-zinc-500 mb-1">Total Failures</p>
            <p className="text-2xl font-bold text-red-400">{stats.total}</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <p className="text-xs text-zinc-500 mb-1">Material Wasted</p>
            <p className="text-2xl font-bold text-orange-400">{stats.wastedMaterial.toFixed(0)}g</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <p className="text-xs text-zinc-500 mb-1">Time Wasted</p>
            <p className="text-2xl font-bold text-yellow-400">{formatDuration(stats.wastedTime)}</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <p className="text-xs text-zinc-500 mb-1">Top Issue</p>
            <p className="text-lg font-bold text-white flex items-center gap-1">
              {stats.topReason ? (
                <>
                  {getReasonInfo(stats.topReason).icon}
                  <span className="text-sm">{getReasonInfo(stats.topReason).label}</span>
                </>
              ) : '--'}
            </p>
          </div>
        </div>

        {/* Failure Breakdown */}
        {Object.keys(stats.byReason).length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-zinc-500 mb-2">Failure Breakdown</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byReason)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([reason, count]) => {
                  const info = getReasonInfo(reason);
                  return (
                    <span 
                      key={reason}
                      className="px-3 py-1 bg-gray-800 rounded-full text-sm flex items-center gap-1 border border-gray-700"
                    >
                      {info.icon} {info.label}: <span className="font-bold text-red-400">{count}</span>
                    </span>
                  );
                })}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3">
          <select
            value={filterReason}
            onChange={(e) => setFilterReason(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="all">All Reasons</option>
            {FAILURE_REASONS.map(r => (
              <option key={r.value} value={r.value}>{r.icon} {r.label}</option>
            ))}
          </select>
          <select
            value={filterPrinter}
            onChange={(e) => setFilterPrinter(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="all">All Printers</option>
            {uniquePrinters.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Failure List */}
      <div className="bg-gray-900 rounded-xl border border-gray-800">
        {filteredFailures.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-4xl mb-2">🎉</p>
            <p className="text-zinc-400">No failures recorded in this period</p>
            <p className="text-xs text-zinc-600 mt-1">Great job keeping prints successful!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {filteredFailures.map(failure => {
              const reasonInfo = getReasonInfo(failure.reason);
              return (
                <div 
                  key={failure.id} 
                  className="p-4 hover:bg-gray-800/50 transition cursor-pointer"
                  onClick={() => setSelectedFailure(failure)}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="text-3xl">{reasonInfo.icon}</div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white">{failure.file_name}</span>
                        <span className={`px-2 py-0.5 rounded text-xs bg-${reasonInfo.color}-900/50 text-${reasonInfo.color}-400 border border-${reasonInfo.color}-700/50`}>
                          {reasonInfo.label}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-400 mt-1">
                        🖨️ {failure.printer_name} • 🧵 {failure.material_type}
                        {failure.material_wasted_g > 0 && ` • ${failure.material_wasted_g}g wasted`}
                      </p>
                      {failure.notes && (
                        <p className="text-sm text-zinc-500 mt-1 truncate">{failure.notes}</p>
                      )}
                    </div>
                    
                    {/* Actions */}
                    <div className="flex flex-col items-end gap-2">
                      <p className="text-xs text-zinc-500">{formatDate(failure.timestamp)}</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleReprint(failure); }}
                        className="px-3 py-1 text-xs bg-blue-900/50 text-blue-400 rounded-lg hover:bg-blue-800/50 border border-blue-700/50"
                      >
                        🔄 Reprint
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Log Failure Modal */}
      {showLogModal && (
        <LogFailureModal
          initialData={showLogModal}
          reasons={FAILURE_REASONS}
          onSave={logFailure}
          onClose={() => setShowLogModal(null)}
          currentUser={currentUser}
        />
      )}

      {/* Failure Detail Modal */}
      {selectedFailure && (
        <FailureDetailModal
          failure={selectedFailure}
          reasonInfo={getReasonInfo(selectedFailure.reason)}
          onReprint={() => handleReprint(selectedFailure)}
          onClose={() => setSelectedFailure(null)}
        />
      )}
    </div>
  );
};

/**
 * Modal for logging a new failure
 */
const LogFailureModal = ({ initialData, reasons, onSave, onClose, currentUser }) => {
  const [formData, setFormData] = useState({
    file_name: initialData?.file_name || '',
    printer_name: initialData?.printer_name || '',
    reason: initialData?.reason || 'other',
    material_type: initialData?.material_type || 'PLA',
    material_wasted_g: initialData?.material_wasted_g || 0,
    print_time_wasted: initialData?.print_time_wasted || 0,
    notes: '',
    photos: [],
    job_id: initialData?.job_id || '',
    order_id: initialData?.order_id || ''
  });
  const [photoPreview, setPhotoPreview] = useState([]);

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotoPreview(prev => [...prev, event.target.result]);
        setFormData(prev => ({
          ...prev,
          photos: [...prev.photos, { data: event.target.result, name: file.name }]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = () => {
    if (!formData.file_name || !formData.reason) {
      return;
    }
    onSave({
      ...formData,
      logged_by: currentUser?.username || 'unknown',
      timestamp: new Date().toISOString()
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-700">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-white">❌ Log Print Failure</h3>
            <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl">×</button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-zinc-400 mb-1">File Name *</label>
              <input
                type="text"
                value={formData.file_name}
                onChange={(e) => setFormData({ ...formData, file_name: e.target.value })}
                placeholder="model.stl"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Printer</label>
              <input
                type="text"
                value={formData.printer_name}
                onChange={(e) => setFormData({ ...formData, printer_name: e.target.value })}
                placeholder="Bambu X1C"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Material</label>
              <input
                type="text"
                value={formData.material_type}
                onChange={(e) => setFormData({ ...formData, material_type: e.target.value })}
                placeholder="PLA"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>

          {/* Failure Reason */}
          <div>
            <label className="block text-xs text-zinc-400 mb-2">Failure Reason *</label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {reasons.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, reason: r.value })}
                  className={`p-2 rounded-lg border text-left text-sm transition ${
                    formData.reason === r.value
                      ? 'bg-red-900/30 border-red-600 text-red-400'
                      : 'bg-gray-800 border-gray-700 text-zinc-300 hover:bg-gray-700'
                  }`}
                >
                  {r.icon} {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Waste Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Material Wasted (g)</label>
              <input
                type="number"
                value={formData.material_wasted_g}
                onChange={(e) => setFormData({ ...formData, material_wasted_g: parseFloat(e.target.value) || 0 })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                min="0"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Time Wasted (min)</label>
              <input
                type="number"
                value={Math.round(formData.print_time_wasted / 60)}
                onChange={(e) => setFormData({ ...formData, print_time_wasted: (parseFloat(e.target.value) || 0) * 60 })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                min="0"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="What happened? Any observations?"
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-zinc-600"
            />
          </div>

          {/* Photo Upload */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Photos (optional)</label>
            <div className="flex flex-wrap gap-2">
              {photoPreview.map((src, idx) => (
                <div key={idx} className="w-16 h-16 rounded-lg overflow-hidden border border-gray-700">
                  <img src={src} alt={`Failure ${idx + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
              <label className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center cursor-pointer hover:border-gray-600 transition">
                <span className="text-2xl text-zinc-600">+</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-700 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!formData.file_name || !formData.reason}
            className="flex-1 py-2 rounded-lg font-medium text-white disabled:opacity-50 transition"
            style={{ background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)' }}
          >
            Log Failure
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Modal showing failure details with tips
 */
const FailureDetailModal = ({ failure, reasonInfo, onReprint, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-700">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              {reasonInfo.icon} {reasonInfo.label}
            </h3>
            <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl">×</button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Details */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-zinc-500">File</p>
              <p className="text-white font-medium">{failure.file_name}</p>
            </div>
            <div>
              <p className="text-zinc-500">Printer</p>
              <p className="text-white">{failure.printer_name}</p>
            </div>
            <div>
              <p className="text-zinc-500">Material</p>
              <p className="text-white">{failure.material_type}</p>
            </div>
            <div>
              <p className="text-zinc-500">Wasted</p>
              <p className="text-red-400">{failure.material_wasted_g || 0}g</p>
            </div>
          </div>

          {/* Notes */}
          {failure.notes && (
            <div>
              <p className="text-zinc-500 text-sm mb-1">Notes</p>
              <p className="bg-gray-800 rounded-lg p-3 text-white text-sm">{failure.notes}</p>
            </div>
          )}

          {/* Photos */}
          {failure.photos?.length > 0 && (
            <div>
              <p className="text-zinc-500 text-sm mb-2">Photos</p>
              <div className="flex gap-2 flex-wrap">
                {failure.photos.map((photo, idx) => (
                  <img
                    key={idx}
                    src={photo.data || photo}
                    alt={`Failure ${idx + 1}`}
                    className="w-24 h-24 object-cover rounded-lg border border-gray-700"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Troubleshooting Tips */}
          {reasonInfo.tips?.length > 0 && (
            <div>
              <p className="text-zinc-500 text-sm mb-2">💡 Troubleshooting Tips</p>
              <ul className="space-y-1">
                {reasonInfo.tips.map((tip, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <span className="text-green-400">✓</span>
                    <span className="text-zinc-300">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-700 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
          >
            Close
          </button>
          <button
            onClick={() => { onReprint(); onClose(); }}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition"
          >
            🔄 Reprint Job
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrintFailureLog;
