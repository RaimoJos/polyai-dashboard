import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { logError } from '../utils/apiSafety';
import { useLanguage } from '../i18n';
import { QuickDiagnosisButton } from './FailureDiagnosisPanel';

const rawApiBase = process.env.REACT_APP_API_BASE || 'http://localhost:5000/api/v1';
const API_BASE = rawApiBase.includes('/v1')
  ? rawApiBase
  : rawApiBase.replace(/\/api\/?$/, '/api/v1');

const JobQueue = () => {
  const { t } = useLanguage();
  const [jobs, setJobs] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [draggedJob, setDraggedJob] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [expandedJob, setExpandedJob] = useState(null);
  const [bulkSelect, setBulkSelect] = useState([]);
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterStatus, setFilterStatus] = useState('active');
  const [sortBy, setSortBy] = useState('priority');
  const dragCounter = useRef(0);

  const FAILURE_REASONS = [
    { value: 'adhesion', label: '🟥 Adhesion failure', icon: '🟥' },
    { value: 'nozzle_clog', label: '🔧 Nozzle clog', icon: '🔧' },
    { value: 'warping', label: '🌀 Warping', icon: '🌀' },
    { value: 'stringing', label: '🧵 Stringing', icon: '🧵' },
    { value: 'layer_shift', label: '↩️ Layer shift', icon: '↩️' },
    { value: 'filament_tangle', label: '🔀 Filament tangle', icon: '🔀' },
    { value: 'power_loss', label: '⚡ Power loss', icon: '⚡' },
    { value: 'user_cancelled', label: '✋ Cancelled', icon: '✋' },
    { value: 'other', label: '❓ Other', icon: '❓' },
  ];

  const PRIORITIES = ['URGENT', 'HIGH', 'NORMAL', 'LOW'];

  const fetchJobs = async () => {
    try {
      try {
        const res = await axios.get(`${API_BASE}/production/queue`);
        if (res.data.queue) {
          setJobs(res.data.queue);
          setLoading(false);
          return;
        }
      } catch (e) {
        // FIXED: Log error but continue to fallback
        logError(e, { component: 'JobQueue', action: 'fetchJobsFromProduction' });
      }
      
      const res = await axios.get(`${API_BASE}/scheduling/queue`);
      setJobs(res.data.jobs || []);
    } catch (err) {
      // FIXED: Log error with context
      logError(err, { component: 'JobQueue', action: 'fetchJobs' });
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
    try {
      const res = await axios.get(`${API_BASE}/materials/spools?active_only=true`);
      setInventory(res.data.spools || []);
    } catch (err) {
      // FIXED: Log error but don't break UX
      logError(err, { component: 'JobQueue', action: 'fetchInventory' });
    }
  };

  const checkMaterialStatus = (materialType, requiredG = 0) => {
    if (!materialType) return { available: true, totalG: 0, spools: 0 };
    const matchingSpools = inventory.filter(
      spool => spool.material_type?.toUpperCase() === materialType?.toUpperCase() && 
               spool.remaining_weight_g > 10
    );
    const totalG = matchingSpools.reduce((sum, s) => sum + (s.remaining_weight_g || 0), 0);
    return {
      available: matchingSpools.length > 0,
      hasEnough: matchingSpools.length > 0 && (requiredG <= 0 || totalG >= requiredG),
      totalG,
      spools: matchingSpools.length
    };
  };

  useEffect(() => {
    fetchJobs();
    fetchInventory();
    const interval = setInterval(() => {
      fetchJobs();
      fetchInventory();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const filteredJobs = jobs
    .filter(job => {
      const status = job.job_status || job.status;
      if (filterStatus === 'active' && ['completed', 'failed', 'cancelled'].includes(status)) return false;
      if (filterStatus === 'completed' && !['completed', 'failed', 'cancelled'].includes(status)) return false;
      if (filterPriority !== 'all' && job.priority !== filterPriority) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'priority') {
        const pOrder = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
        return (pOrder[a.priority] || 2) - (pOrder[b.priority] || 2);
      }
      if (sortBy === 'time') {
        return (a.estimated_minutes || 0) - (b.estimated_minutes || 0);
      }
      if (sortBy === 'date') {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
      return 0;
    });

  const handleDragStart = (e, job, index) => {
    setDraggedJob({ job, index });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', job.job_id);
    e.target.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedJob(null);
    setDragOverIndex(null);
    dragCounter.current = 0;
  };

  const handleDragEnter = (e, index) => {
    e.preventDefault();
    dragCounter.current++;
    if (draggedJob && draggedJob.index !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = (e) => {
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragOverIndex(null);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetIndex) => {
    e.preventDefault();
    if (!draggedJob || draggedJob.index === targetIndex) return;

    const newJobs = [...filteredJobs];
    const [removed] = newJobs.splice(draggedJob.index, 1);
    newJobs.splice(targetIndex, 0, removed);

    setJobs(newJobs);
    setDragOverIndex(null);
    setDraggedJob(null);

    try {
      await axios.post(`${API_BASE}/scheduling/reorder`, {
        job_ids: newJobs.map(j => j.job_id)
      });
    } catch (err) {
      console.log('Reorder API not available, order saved locally');
    }
  };

  const updatePriority = async (jobId, newPriority) => {
    setActionLoading(jobId);
    try {
      await axios.put(`${API_BASE}/scheduling/jobs/${jobId}`, { priority: newPriority });
      fetchJobs();
    } catch (err) {
      setJobs(jobs.map(j => j.job_id === jobId ? { ...j, priority: newPriority } : j));
    } finally {
      setActionLoading(null);
    }
  };

  const startJob = async (jobId) => {
    setActionLoading(jobId);
    try {
      try {
        await axios.post(`${API_BASE}/production/start/${jobId}`);
      } catch (e) {
        await axios.post(`${API_BASE}/scheduling/jobs/${jobId}/start`);
      }
      fetchJobs();
    } catch (err) {
      console.error('Error starting job:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const completeJob = async (jobId, success = true, failureReason = null) => {
    setActionLoading(jobId);
    try {
      const job = jobs.find(j => j.job_id === jobId);
      if (job) {
        try {
          await axios.post(`${API_BASE}/print-stats/record`, {
            job_id: jobId,
            printer_name: job.assigned_printer || 'unknown',
            material_type: job.filament_type || 'PLA',
            material_weight_g: job.material_weight_g || 50,
            print_time_hours: (job.estimated_minutes || 60) / 60,
            success,
            failure_reason: failureReason,
          });
        } catch (statsErr) {}
      }

      try {
        await axios.post(`${API_BASE}/production/complete/${jobId}`, { success, failure_reason: failureReason });
      } catch (e) {
        await axios.post(`${API_BASE}/scheduling/jobs/${jobId}/complete`, { success });
      }
      fetchJobs();
    } catch (err) {
      console.error('Error completing job:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const cancelJob = async (jobId) => {
    if (!window.confirm('Cancel this job?')) return;
    setActionLoading(jobId);
    try {
      try {
        await axios.post(`${API_BASE}/production/cancel/${jobId}`);
      } catch (e) {
        await axios.post(`${API_BASE}/scheduling/jobs/${jobId}/cancel`);
      }
      fetchJobs();
    } catch (err) {
      console.error('Error canceling job:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkSelect = (jobId) => {
    setBulkSelect(prev => 
      prev.includes(jobId) ? prev.filter(id => id !== jobId) : [...prev, jobId]
    );
  };

  const bulkUpdatePriority = async (priority) => {
    for (const jobId of bulkSelect) {
      await updatePriority(jobId, priority);
    }
    setBulkSelect([]);
  };

  const bulkCancel = async () => {
    if (!window.confirm(`Cancel ${bulkSelect.length} jobs?`)) return;
    for (const jobId of bulkSelect) {
      try {
        await axios.post(`${API_BASE}/scheduling/jobs/${jobId}/cancel`);
      } catch (e) {}
    }
    setBulkSelect([]);
    fetchJobs();
  };

  const getStatusStyle = (status) => ({
    'printing': 'bg-purple-900/50 text-purple-400 border-purple-700/50',
    'assigned': 'bg-blue-900/50 text-blue-400 border-blue-700/50',
    'queued': 'bg-yellow-900/50 text-yellow-400 border-yellow-700/50',
    'completed': 'bg-green-900/50 text-green-400 border-green-700/50',
    'failed': 'bg-red-900/50 text-red-400 border-red-700/50',
    'cancelled': 'bg-gray-800 text-zinc-400 border-gray-700'
  }[status] || 'bg-gray-800 text-zinc-400 border-gray-700');

  const getStatusIcon = (status) => ({
    'printing': '🖨️', 'assigned': '📌', 'queued': '⏳',
    'completed': '✅', 'failed': '❌', 'cancelled': '🚫'
  }[status] || '❔');

  const getPriorityStyle = (priority) => ({
    'URGENT': 'bg-red-600 text-white',
    'HIGH': 'bg-orange-600 text-white',
    'NORMAL': 'bg-blue-600 text-white',
    'LOW': 'bg-gray-600 text-white'
  }[priority] || 'bg-gray-600 text-white');

  const formatTime = (minutes) => {
    if (!minutes) return '--';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const stats = {
    total: jobs.length,
    printing: jobs.filter(j => (j.job_status || j.status) === 'printing').length,
    queued: jobs.filter(j => ['queued', 'assigned'].includes(j.job_status || j.status)).length,
    urgent: jobs.filter(j => j.priority === 'URGENT').length,
    totalTime: jobs.filter(j => !['completed', 'failed', 'cancelled'].includes(j.job_status || j.status))
      .reduce((sum, j) => sum + (j.estimated_minutes || 0), 0)
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/3"></div>
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-800 rounded-lg"></div>)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              🏭 {t('production.jobQueue')}
            </h2>
            <div className="flex gap-4 text-sm text-zinc-400 mt-1">
              <span>{stats.printing} printing</span>
              <span>{stats.queued} queued</span>
              {stats.urgent > 0 && <span className="text-red-400 font-medium">⚡ {stats.urgent} urgent</span>}
              <span>~{formatTime(stats.totalTime)} total</span>
            </div>
          </div>
          <button 
            onClick={fetchJobs} 
            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-zinc-300"
          >
            🔄
          </button>
        </div>

        {/* Filters & Sort */}
        <div className="flex flex-wrap gap-2">
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-sm bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-zinc-200"
          >
            <option value="active">Active Jobs</option>
            <option value="all">All Jobs</option>
            <option value="completed">Completed</option>
          </select>
          <select 
            value={filterPriority} 
            onChange={(e) => setFilterPriority(e.target.value)}
            className="text-sm bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-zinc-200"
          >
            <option value="all">All Priorities</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="text-sm bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-zinc-200"
          >
            <option value="priority">Sort: Priority</option>
            <option value="time">Sort: Duration</option>
            <option value="date">Sort: Date</option>
          </select>
        </div>

        {/* Bulk Actions */}
        {bulkSelect.length > 0 && (
          <div className="mt-3 p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white">{bulkSelect.length} selected:</span>
            {PRIORITIES.map(p => (
              <button 
                key={p}
                onClick={() => bulkUpdatePriority(p)}
                className={`px-2 py-1 text-xs rounded ${getPriorityStyle(p)}`}
              >
                → {p}
              </button>
            ))}
            <button onClick={bulkCancel} className="px-2 py-1 text-xs bg-red-900/50 text-red-400 rounded border border-red-700/50">
              Cancel All
            </button>
            <button onClick={() => setBulkSelect([])} className="px-2 py-1 text-xs bg-gray-800 text-zinc-300 rounded ml-auto">
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Job List */}
      <div className="p-4">
        {filteredJobs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-2">📭</p>
            <p className="text-zinc-400">{t('production.noJobs')}</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {filteredJobs.map((job, index) => {
              const status = job.job_status || job.status;
              const isLoading = actionLoading === job.job_id;
              const isExpanded = expandedJob === job.job_id;
              const isDragging = draggedJob?.job?.job_id === job.job_id;
              const isDragOver = dragOverIndex === index;
              const isSelected = bulkSelect.includes(job.job_id);
              const materialStatus = checkMaterialStatus(job.filament_type, job.material_weight_g);

              return (
                <div
                  key={job.job_id}
                  draggable={!['printing', 'completed', 'failed'].includes(status)}
                  onDragStart={(e) => handleDragStart(e, job, index)}
                  onDragEnd={handleDragEnd}
                  onDragEnter={(e) => handleDragEnter(e, index)}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`
                    border rounded-lg transition-all cursor-move bg-gray-800/50
                    ${isDragging ? 'opacity-50 scale-95' : ''}
                    ${isDragOver ? 'border-purple-500 border-2 bg-purple-900/20' : 'border-gray-700'}
                    ${status === 'printing' ? 'border-purple-600 bg-purple-900/20 cursor-default' : ''}
                    ${isSelected ? 'ring-2 ring-purple-500' : ''}
                  `}
                >
                  {/* Compact View */}
                  <div className="p-3 flex items-center gap-3">
                    {/* Drag Handle + Checkbox */}
                    <div className="flex items-center gap-2">
                      {!['printing', 'completed', 'failed'].includes(status) && (
                        <span className="text-zinc-600 cursor-grab">⋮⋮</span>
                      )}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleBulkSelect(job.job_id)}
                        className="w-4 h-4 accent-purple-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    {/* Priority Badge */}
                    <div className="relative group">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${getPriorityStyle(job.priority)}`}>
                        {job.priority === 'URGENT' && '⚡'}{job.priority?.charAt(0)}
                      </span>
                      <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-10 bg-gray-800 border border-gray-700 shadow-lg rounded p-1">
                        {PRIORITIES.map(p => (
                          <button
                            key={p}
                            onClick={(e) => { e.stopPropagation(); updatePriority(job.job_id, p); }}
                            className={`block w-full text-left px-2 py-1 text-xs rounded hover:bg-gray-700 text-zinc-200 ${job.priority === p ? 'font-bold' : ''}`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Job Info */}
                    <div className="flex-1 min-w-0" onClick={() => setExpandedJob(isExpanded ? null : job.job_id)}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate text-white">{job.item_name || job.file_name || 'Print Job'}</span>
                        {job.client_name && <span className="text-xs text-zinc-500">• {job.client_name}</span>}
                      </div>
                      <div className="flex gap-3 text-xs text-zinc-400">
                        <span>⏱️ {formatTime(job.estimated_minutes)}</span>
                        {job.filament_type && (
                          <span className={!materialStatus.available ? 'text-red-400 font-bold' : ''}>
                            🧵 {job.filament_type} {!materialStatus.available && '⚠️'}
                          </span>
                        )}
                        {job.assigned_printer && <span>🖨️ {job.assigned_printer}</span>}
                      </div>
                    </div>

                    {/* Status */}
                    <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap border ${getStatusStyle(status)}`}>
                      {getStatusIcon(status)} {status}
                    </span>

                    {/* AI Diagnosis */}
                    {status === 'failed' && job.failure_reason && (
                      <QuickDiagnosisButton failureReason={job.failure_reason} className="ml-1" />
                    )}

                    {/* Quick Actions */}
                    <div className="flex gap-1">
                      {['queued', 'assigned'].includes(status) && (
                        <button
                          onClick={() => startJob(job.job_id)}
                          disabled={isLoading}
                          className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
                        >
                          {isLoading ? '⏳' : '▶️'}
                        </button>
                      )}
                      {status === 'printing' && (
                        <>
                          <button
                            onClick={() => completeJob(job.job_id, true)}
                            disabled={isLoading}
                            className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => setExpandedJob(isExpanded ? null : job.job_id)}
                            className="px-2 py-1 bg-red-900/50 text-red-400 rounded text-xs hover:bg-red-900 border border-red-700/50"
                          >
                            ✕
                          </button>
                        </>
                      )}
                      {['queued', 'assigned'].includes(status) && (
                        <button
                          onClick={() => cancelJob(job.job_id)}
                          disabled={isLoading}
                          className="px-2 py-1 bg-gray-800 text-zinc-400 rounded text-xs hover:bg-gray-700"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-0 border-t border-gray-700 bg-gray-800/30">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm py-3">
                        <div>
                          <span className="text-zinc-500 text-xs">Job ID</span>
                          <p className="font-mono text-xs text-zinc-300">{job.job_id}</p>
                        </div>
                        <div>
                          <span className="text-zinc-500 text-xs">Material</span>
                          <p className="text-zinc-300">{job.filament_type || '--'} ({job.material_weight_g || 0}g)</p>
                        </div>
                        <div>
                          <span className="text-zinc-500 text-xs">Quantity</span>
                          <p className="text-zinc-300">{job.quantity || 1}</p>
                        </div>
                        <div>
                          <span className="text-zinc-500 text-xs">Order Value</span>
                          <p className="text-green-400 font-medium">{job.order_total ? `€${job.order_total.toFixed(2)}` : '--'}</p>
                        </div>
                      </div>

                      {status === 'printing' && (
                        <div className="border-t border-gray-700 pt-3">
                          <p className="text-xs text-zinc-500 mb-2">Mark as failed:</p>
                          <div className="flex flex-wrap gap-1">
                            {FAILURE_REASONS.map(reason => (
                              <button
                                key={reason.value}
                                onClick={() => completeJob(job.job_id, false, reason.value)}
                                className="px-2 py-1 text-xs bg-red-900/30 text-red-400 rounded hover:bg-red-900/50 border border-red-700/50"
                              >
                                {reason.icon} {reason.value}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {status === 'printing' && (
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-zinc-500 mb-1">
                            <span>Progress</span>
                            <span>{job.progress || 0}%</span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div 
                              className="bg-purple-600 h-2 rounded-full transition-all" 
                              style={{ width: `${job.progress || 50}%` }} 
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Tip */}
      <div className="p-4 border-t border-gray-800 bg-gray-800/30">
        <p className="text-xs text-zinc-500 text-center">
          💡 Drag jobs to reorder • Click priority badge to change • Use checkboxes for bulk actions
        </p>
      </div>
    </div>
  );
};

export default JobQueue;
