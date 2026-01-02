/**
 * SmartPrintScheduler - Intelligent job queue management and optimization
 * 
 * Features:
 * - Visual job queue with drag-drop reordering
 * - Auto-assign jobs to best printers
 * - Load balancing visualization
 * - Priority management
 * - Optimization suggestions
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../i18n';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000/api/v1';

const PRIORITY_CONFIG = {
  URGENT: { color: '#ef4444', bg: 'bg-red-500/20', border: 'border-red-500/30', icon: '🔴' },
  HIGH: { color: '#f97316', bg: 'bg-orange-500/20', border: 'border-orange-500/30', icon: '🟠' },
  NORMAL: { color: '#3b82f6', bg: 'bg-blue-500/20', border: 'border-blue-500/30', icon: '🔵' },
  LOW: { color: '#6b7280', bg: 'bg-gray-500/20', border: 'border-gray-500/30', icon: '⚪' },
};

const STATUS_CONFIG = {
  queued: { color: '#eab308', bg: 'bg-yellow-500/20', label: 'Queued', icon: '⏳' },
  assigned: { color: '#3b82f6', bg: 'bg-blue-500/20', label: 'Assigned', icon: '📋' },
  printing: { color: '#22c55e', bg: 'bg-green-500/20', label: 'Printing', icon: '🖨️' },
  completed: { color: '#6b7280', bg: 'bg-gray-500/20', label: 'Completed', icon: '✅' },
  failed: { color: '#ef4444', bg: 'bg-red-500/20', label: 'Failed', icon: '❌' },
  cancelled: { color: '#6b7280', bg: 'bg-gray-500/20', label: 'Cancelled', icon: '🚫' },
};

function SmartPrintScheduler({ currentUser }) {
  const { t } = useLanguage();
  
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState(null);
  const [printerLoads, setPrinterLoads] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [activeTab, setActiveTab] = useState('queue');
  const [selectedJob, setSelectedJob] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // Fetch queue data
  const fetchQueue = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/scheduler/queue`, {
        credentials: 'include',
      });
      const data = await response.json();
      
      if (data.success && data.data) {
        setQueue(data.data.jobs || []);
        setStats(data.data.stats || {});
      }
    } catch (err) {
      console.error('Failed to fetch queue:', err);
    }
  }, []);

  // Fetch printer loads
  const fetchLoads = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/scheduler/printers/loads`, {
        credentials: 'include',
      });
      const data = await response.json();
      
      if (data.success && data.data) {
        setPrinterLoads(data.data.printer_loads || []);
      }
    } catch (err) {
      console.error('Failed to fetch loads:', err);
    }
  }, []);

  // Fetch optimization suggestions
  const fetchSuggestions = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/scheduler/optimize`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json();
      
      if (data.success && data.data) {
        setSuggestions(data.data.suggestions || []);
      }
    } catch (err) {
      console.error('Failed to fetch suggestions:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchQueue(), fetchLoads(), fetchSuggestions()]);
      setLoading(false);
    };
    loadData();
    
    // Refresh every 30s
    const interval = setInterval(() => {
      fetchQueue();
      fetchLoads();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchQueue, fetchLoads, fetchSuggestions]);

  // Update priority
  const handlePriorityChange = async (jobId, newPriority) => {
    setActionLoading(jobId);
    try {
      const response = await fetch(`${API_BASE}/scheduler/jobs/${jobId}/priority`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ priority: newPriority }),
      });
      
      if (response.ok) {
        await fetchQueue();
      }
    } catch (err) {
      console.error('Failed to update priority:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // Auto-assign all jobs
  const handleAutoAssign = async () => {
    setActionLoading('auto-assign');
    try {
      const response = await fetch(`${API_BASE}/scheduler/auto-assign`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json();
      
      if (data.success) {
        await fetchQueue();
        await fetchLoads();
      }
    } catch (err) {
      console.error('Auto-assign failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // Cancel job
  const handleCancelJob = async (jobId) => {
    if (!window.confirm('Cancel this job?')) return;
    
    setActionLoading(jobId);
    try {
      const response = await fetch(`${API_BASE}/scheduler/jobs/${jobId}/cancel`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        await fetchQueue();
        await fetchLoads();
      }
    } catch (err) {
      console.error('Failed to cancel job:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // Start job
  const handleStartJob = async (jobId) => {
    setActionLoading(jobId);
    try {
      const response = await fetch(`${API_BASE}/scheduler/jobs/${jobId}/start`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        await fetchQueue();
      }
    } catch (err) {
      console.error('Failed to start job:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // Format time display
  const formatTime = (minutes) => {
    if (!minutes) return '--';
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Get max load for progress bar scaling
  const maxLoad = Math.max(...printerLoads.map(p => p.queued_minutes), 60);

  const tabs = [
    { id: 'queue', label: 'Job Queue', icon: '📋', count: stats?.queued || 0 },
    { id: 'printers', label: 'Printer Loads', icon: '🖨️', count: printerLoads.length },
    { id: 'optimize', label: 'Optimize', icon: '⚡', count: suggestions.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            📅 Smart Print Scheduler
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Intelligent job queue management and printer load balancing
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleAutoAssign}
            disabled={actionLoading === 'auto-assign'}
            className="px-4 py-2 rounded-lg font-medium text-white flex items-center gap-2 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
          >
            {actionLoading === 'auto-assign' ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <span>🤖</span>
            )}
            Auto-Assign All
          </button>
          <button
            onClick={() => {
              fetchQueue();
              fetchLoads();
              fetchSuggestions();
            }}
            className="px-4 py-2 rounded-lg font-medium text-slate-300 border border-slate-600 hover:bg-slate-700"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          {[
            { label: 'Total Jobs', value: stats.total_jobs, color: 'text-white' },
            { label: 'Queued', value: stats.queued, color: 'text-yellow-400' },
            { label: 'Assigned', value: stats.assigned, color: 'text-blue-400' },
            { label: 'Printing', value: stats.printing, color: 'text-green-400' },
            { label: 'Completed', value: stats.completed, color: 'text-slate-400' },
            { label: 'Failed', value: stats.failed, color: 'text-red-400' },
          ].map(stat => (
            <div key={stat.label} className="p-3 rounded-lg text-center" style={{ backgroundColor: '#1e293b' }}>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value || 0}</p>
              <p className="text-xs text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 p-1 rounded-lg" style={{ backgroundColor: '#1e293b' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition flex items-center justify-center gap-2 ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-purple-500/20 to-cyan-500/20 text-white border border-purple-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span className="px-1.5 py-0.5 rounded text-xs bg-slate-700">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="p-8 text-center">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-400 mt-2">Loading scheduler...</p>
        </div>
      ) : activeTab === 'queue' ? (
        /* Job Queue */
        <div className="space-y-3">
          {queue.length === 0 ? (
            <div className="rounded-xl border p-8 text-center" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
              <div className="text-5xl mb-4">📭</div>
              <p className="text-slate-400">No jobs in queue</p>
              <p className="text-slate-500 text-sm mt-1">Jobs will appear here when added</p>
            </div>
          ) : (
            queue.map(job => {
              const priorityConfig = PRIORITY_CONFIG[job.priority] || PRIORITY_CONFIG.NORMAL;
              const statusConfig = STATUS_CONFIG[job.status] || STATUS_CONFIG.queued;
              
              return (
                <div
                  key={job.job_id}
                  className="rounded-xl border p-4 transition hover:border-purple-500/30"
                  style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {/* Left: Job Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm text-slate-400">{job.job_id}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${priorityConfig.bg} ${priorityConfig.border} border`}>
                          {priorityConfig.icon} {job.priority}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs ${statusConfig.bg}`}>
                          {statusConfig.icon} {statusConfig.label}
                        </span>
                      </div>
                      
                      <p className="text-white font-medium mt-1 truncate">
                        {job.metadata?.job_name || job.file_path?.split('/').pop() || 'Untitled'}
                      </p>
                      
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                        <span>⏱️ {job.estimated_time_display || formatTime(job.estimated_time_minutes)}</span>
                        {job.filament_type && <span>🧵 {job.filament_type}</span>}
                        {job.assigned_printer && <span>🖨️ {job.assigned_printer}</span>}
                        {job.metadata?.client_name && <span>👤 {job.metadata.client_name}</span>}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Priority Selector */}
                      {job.status === 'queued' && (
                        <select
                          value={job.priority}
                          onChange={(e) => handlePriorityChange(job.job_id, e.target.value)}
                          disabled={actionLoading === job.job_id}
                          className="px-3 py-1.5 rounded text-sm bg-slate-700 text-white border border-slate-600"
                        >
                          <option value="URGENT">🔴 Urgent</option>
                          <option value="HIGH">🟠 High</option>
                          <option value="NORMAL">🔵 Normal</option>
                          <option value="LOW">⚪ Low</option>
                        </select>
                      )}
                      
                      {/* Start Button */}
                      {job.status === 'assigned' && (
                        <button
                          onClick={() => handleStartJob(job.job_id)}
                          disabled={actionLoading === job.job_id}
                          className="px-3 py-1.5 rounded text-sm font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-50"
                        >
                          ▶️ Start
                        </button>
                      )}
                      
                      {/* Cancel Button */}
                      {['queued', 'assigned'].includes(job.status) && (
                        <button
                          onClick={() => handleCancelJob(job.job_id)}
                          disabled={actionLoading === job.job_id}
                          className="px-3 py-1.5 rounded text-sm font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50"
                        >
                          ✗ Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : activeTab === 'printers' ? (
        /* Printer Loads */
        <div className="space-y-4">
          {printerLoads.length === 0 ? (
            <div className="rounded-xl border p-8 text-center" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
              <div className="text-5xl mb-4">🖨️</div>
              <p className="text-slate-400">No printers with queued jobs</p>
            </div>
          ) : (
            printerLoads.map(printer => {
              const loadPercent = (printer.queued_minutes / maxLoad) * 100;
              
              return (
                <div
                  key={printer.printer}
                  className="rounded-xl border p-4"
                  style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🖨️</span>
                      <span className="text-white font-medium">{printer.printer}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-cyan-400 font-bold">{printer.queued_display}</span>
                      <span className="text-slate-500 text-sm ml-2">({printer.jobs_count} jobs)</span>
                    </div>
                  </div>
                  
                  {/* Load Bar */}
                  <div className="h-3 rounded-full bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${loadPercent}%`,
                        background: loadPercent > 80 
                          ? 'linear-gradient(90deg, #ef4444, #f97316)' 
                          : loadPercent > 50 
                            ? 'linear-gradient(90deg, #eab308, #22c55e)'
                            : 'linear-gradient(90deg, #22c55e, #06b6d4)',
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Optimization Suggestions */
        <div className="space-y-4">
          {suggestions.length === 0 ? (
            <div className="rounded-xl border p-8 text-center" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
              <div className="text-5xl mb-4">✅</div>
              <p className="text-green-400 font-medium">Queue is optimized!</p>
              <p className="text-slate-500 text-sm mt-1">No optimization suggestions at this time</p>
            </div>
          ) : (
            suggestions.map((suggestion, i) => {
              const impactColors = {
                high: 'border-red-500/30 bg-red-500/10',
                medium: 'border-yellow-500/30 bg-yellow-500/10',
                low: 'border-blue-500/30 bg-blue-500/10',
              };
              
              return (
                <div
                  key={i}
                  className={`rounded-xl border p-4 ${impactColors[suggestion.impact] || impactColors.medium}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">
                      {suggestion.type === 'material_grouping' ? '🧵' :
                       suggestion.type === 'load_balance' ? '⚖️' :
                       suggestion.type === 'priority' ? '🔴' : '💡'}
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium">{suggestion.title}</p>
                      <p className="text-slate-400 text-sm mt-1">{suggestion.description}</p>
                      
                      {suggestion.jobs && suggestion.jobs.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {suggestion.jobs.slice(0, 5).map(jobId => (
                            <span key={jobId} className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-300">
                              {jobId}
                            </span>
                          ))}
                          {suggestion.jobs.length > 5 && (
                            <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-400">
                              +{suggestion.jobs.length - 5} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      suggestion.impact === 'high' ? 'bg-red-500/20 text-red-400' :
                      suggestion.impact === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {suggestion.impact?.toUpperCase()} IMPACT
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default SmartPrintScheduler;
