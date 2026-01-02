import React, { useEffect, useMemo, useState } from 'react';
import { api, unwrap } from '../services/api';
import FailureDiagnosisPanel, { QuickDiagnosisButton } from './FailureDiagnosisPanel';

const PrintHistory = () => {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [filters, setFilters] = useState({ status: 'all', printer: 'all', sortBy: 'date', sortOrder: 'desc' });
  const [dateRange, setDateRange] = useState(30);
  const [stats, setStats] = useState({ totalPrints: 0, totalTime: 0, successRate: 0, avgPrintTime: 0, totalMaterials: 0 });
  const [selectedPrint, setSelectedPrint] = useState(null);

  const normalizeJob = (job) => {
    if (!job) return null;
    return {
      id: job.job_id ?? job.id ?? job.print_id ?? `job-${Math.random().toString(36).slice(2)}`,
      printer: job.printer ?? job.printer_name ?? job.printer_id ?? 'Unknown',
      status: job.status ?? job.state ?? 'unknown',
      filename: job.filename ?? job.file_name ?? job.name ?? 'Unknown file',
      startTime: job.start_time ?? job.started_at ?? job.created_at ?? job.start ?? null,
      endTime: job.end_time ?? job.completed_at ?? job.finished_at ?? job.end ?? null,
      duration: job.duration ?? job.print_time ?? job.time_seconds ?? 0,
      material: job.material ?? job.material_type ?? 'Unknown',
      weight: job.weight ?? job.material_used ?? job.filament_g ?? 0,
      cost: job.cost ?? job.total_cost ?? job.price ?? 0,
      qualityScore: job.quality_score ?? job.score ?? null,
      notes: job.notes ?? job.comment ?? '',
      settings: job.settings ?? job.profile ?? null,
      errors: job.errors ?? job.error ?? null,
      ...job,
    };
  };

  const extractList = (res, keys = []) => {
    const data = unwrap(res);
    if (!data) return [];
    const d = (data && data.data && typeof data.data === 'object') ? data.data : data;

    for (const k of keys) {
      const v = d?.[k];
      if (Array.isArray(v)) return v;
    }
    if (Array.isArray(d)) return d;
    return [];
  };

  const calculateStats = (prints) => {
    if (!prints || prints.length === 0) {
      setStats({ totalPrints: 0, totalTime: 0, successRate: 0, avgPrintTime: 0, totalMaterials: 0 });
      return;
    }

    const totalPrints = prints.length;
    const completed = prints.filter(p => ['completed', 'success', 'finished', 'done'].includes(String(p.status).toLowerCase()));
    const totalTime = prints.reduce((sum, p) => sum + (Number(p.duration) || 0), 0);
    const totalMaterials = prints.reduce((sum, p) => sum + (Number(p.weight) || 0), 0);
    const successRate = totalPrints > 0 ? (completed.length / totalPrints) * 100 : 0;
    const avgPrintTime = totalPrints > 0 ? totalTime / totalPrints : 0;

    setStats({
      totalPrints,
      totalTime,
      successRate: Number(successRate.toFixed(1)),
      avgPrintTime,
      totalMaterials
    });
  };

  const loadHistory = async () => {
    setLoading(true);
    try {
      const histRes = await api.getPrintHistory(dateRange).catch(() => null);
      let prints = extractList(histRes, ['history', 'prints', 'items']);

      if (prints.length === 0) {
        const [productionRes, jobsRes, ordersRes] = await Promise.all([
          api.getProductionQueue().catch(() => null),
          api.getJobQueue().catch(() => null),
          api.getOrders().catch(() => null),
        ]);

        const production = extractList(productionRes, ['queue', 'jobs', 'items']);
        const jobs = extractList(jobsRes, ['queue', 'jobs', 'items']);
        const orders = extractList(ordersRes, ['orders', 'data', 'items']);

        const normalizedProduction = production.map(normalizeJob).filter(Boolean);
        const normalizedJobs = jobs.map(normalizeJob).filter(Boolean);
        const normalizedOrders = orders.map((order) =>
          normalizeJob({
            id: order.order_id ?? order.id,
            printer: order.assigned_printer ?? order.printer_name,
            status: order.status,
            filename: order.file_name ?? order.model_name ?? order.product_name,
            startTime: order.created_at,
            endTime: order.completed_at,
            duration: order.estimated_print_time ?? 0,
            material: order.material_type ?? order.material,
            weight: order.estimated_material_g ?? 0,
            cost: order.total_cost ?? order.price ?? 0,
            notes: order.notes,
          })
        ).filter(Boolean);

        prints = [...normalizedProduction, ...normalizedJobs, ...normalizedOrders];
      } else {
        prints = prints.map(normalizeJob).filter(Boolean);
      }

      setHistory(prints);
      calculateStats(prints);
    } catch (err) {
      console.error('Failed to load print history:', err);
      setHistory([]);
      calculateStats([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadHistory(); }, [dateRange]);

  const filteredHistory = useMemo(() => {
    let result = [...history];

    if (filters.status !== 'all') {
      result = result.filter(p => String(p.status).toLowerCase() === String(filters.status).toLowerCase());
    }

    if (filters.printer !== 'all') {
      result = result.filter(p => String(p.printer) === String(filters.printer));
    }

    result.sort((a, b) => {
      let aValue, bValue;

      switch (filters.sortBy) {
        case 'date':
          aValue = new Date(a.startTime || 0).getTime();
          bValue = new Date(b.startTime || 0).getTime();
          break;
        case 'duration':
          aValue = Number(a.duration) || 0;
          bValue = Number(b.duration) || 0;
          break;
        case 'cost':
          aValue = Number(a.cost) || 0;
          bValue = Number(b.cost) || 0;
          break;
        case 'quality':
          aValue = Number(a.qualityScore) || 0;
          bValue = Number(b.qualityScore) || 0;
          break;
        default:
          aValue = 0;
          bValue = 0;
      }

      return filters.sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });

    return result;
  }, [history, filters]);

  const uniquePrinters = useMemo(() => {
    return Array.from(new Set(history.map(p => p.printer))).filter(Boolean);
  }, [history]);

  const formatDuration = (seconds) => {
    const sec = Number(seconds) || 0;
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return String(dateString);
    return d.toLocaleString();
  };

  const getStatusColor = (status) => {
    const s = String(status || '').toLowerCase();
    if (['completed', 'success', 'finished', 'done'].includes(s)) return 'text-green-400 bg-green-900/50 border-green-700/50';
    if (['failed', 'error'].includes(s)) return 'text-red-400 bg-red-900/50 border-red-700/50';
    if (['printing', 'running', 'in_progress'].includes(s)) return 'text-blue-400 bg-blue-900/50 border-blue-700/50';
    if (['paused'].includes(s)) return 'text-yellow-400 bg-yellow-900/50 border-yellow-700/50';
    return 'text-zinc-400 bg-gray-800 border-gray-700';
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-5 gap-4">
            {[1,2,3,4,5].map(i => <div key={i} className="h-20 bg-gray-800 rounded-lg"></div>)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              📋 Print History
            </h2>
            <p className="text-sm text-zinc-400 mt-1">Track completed prints and performance</p>
          </div>
          <button
            onClick={loadHistory}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
          >
            🔄 Refresh
          </button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-gray-800/50 border border-gray-700 p-3 rounded-lg">
            <div className="text-sm text-zinc-400">Total Prints</div>
            <div className="text-2xl font-bold text-white">{stats.totalPrints}</div>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 p-3 rounded-lg">
            <div className="text-sm text-zinc-400">Total Time</div>
            <div className="text-2xl font-bold text-white">{formatDuration(stats.totalTime)}</div>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 p-3 rounded-lg">
            <div className="text-sm text-zinc-400">Success Rate</div>
            <div className="text-2xl font-bold text-green-400">{stats.successRate}%</div>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 p-3 rounded-lg">
            <div className="text-sm text-zinc-400">Avg Print</div>
            <div className="text-2xl font-bold text-white">{formatDuration(stats.avgPrintTime)}</div>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 p-3 rounded-lg">
            <div className="text-sm text-zinc-400">Material Used</div>
            <div className="text-2xl font-bold text-white">{(Number(stats.totalMaterials) || 0).toFixed(0)}g</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Date Range</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-zinc-200"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last year</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-zinc-200"
            >
              <option value="all">All</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="printing">Printing</option>
              <option value="paused">Paused</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Printer</label>
            <select
              value={filters.printer}
              onChange={(e) => setFilters({ ...filters, printer: e.target.value })}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-zinc-200"
            >
              <option value="all">All Printers</option>
              {uniquePrinters.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Sort By</label>
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-zinc-200"
            >
              <option value="date">Date</option>
              <option value="duration">Duration</option>
              <option value="cost">Cost</option>
              <option value="quality">Quality</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Order</label>
            <select
              value={filters.sortOrder}
              onChange={(e) => setFilters({ ...filters, sortOrder: e.target.value })}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-zinc-200"
            >
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {filteredHistory.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-4xl mb-2">📭</p>
            <p className="text-zinc-400">No print history found for the selected filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="min-w-full">
              <thead className="bg-gray-800/50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">File</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Printer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Start</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Duration</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Material</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Cost</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Quality</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredHistory.map(print => (
                  <tr key={print.id} className="hover:bg-gray-800/50 cursor-pointer" onClick={() => setSelectedPrint(print)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(print.status)}`}>
                          {String(print.status || '').toUpperCase()}
                        </span>
                        {['failed', 'error'].includes(String(print.status || '').toLowerCase()) && (
                          <QuickDiagnosisButton failureReason={print.errors || print.failure_reason || 'unknown'} />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-white truncate max-w-xs">{print.filename}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-300">{print.printer}</td>
                    <td className="px-4 py-3 text-sm text-zinc-300">{formatDate(print.startTime)}</td>
                    <td className="px-4 py-3 text-sm text-zinc-300">{formatDuration(print.duration)}</td>
                    <td className="px-4 py-3 text-sm text-zinc-300">
                      <div>{print.material}</div>
                      {Number(print.weight) > 0 && <div className="text-xs text-zinc-500">{Number(print.weight).toFixed(0)}g</div>}
                    </td>
                    <td className="px-4 py-3 text-sm text-green-400">€{(Number(print.cost) || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm">
                      {print.qualityScore != null ? (
                        <span className={`font-medium ${
                          print.qualityScore >= 8 ? 'text-green-400' :
                          print.qualityScore >= 6 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {Number(print.qualityScore).toFixed(1)}/10
                        </span>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedPrint && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-xl border border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-white">Print Details</h3>
                <button
                  onClick={() => setSelectedPrint(null)}
                  className="text-zinc-400 hover:text-white text-xl"
                >
                  ×
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <div className="text-sm text-zinc-400">Status</div>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedPrint.status)}`}>
                    {String(selectedPrint.status || '').toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="text-sm text-zinc-400">Printer</div>
                  <div className="font-medium text-white">{selectedPrint.printer}</div>
                </div>
                <div>
                  <div className="text-sm text-zinc-400">File</div>
                  <div className="font-medium text-white">{selectedPrint.filename}</div>
                </div>
                <div>
                  <div className="text-sm text-zinc-400">Duration</div>
                  <div className="font-medium text-white">{formatDuration(selectedPrint.duration)}</div>
                </div>
                <div>
                  <div className="text-sm text-zinc-400">Material</div>
                  <div className="font-medium text-white">
                    {selectedPrint.material} {Number(selectedPrint.weight) > 0 ? `(${Number(selectedPrint.weight).toFixed(0)}g)` : ''}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-zinc-400">Cost</div>
                  <div className="font-medium text-green-400">€{(Number(selectedPrint.cost) || 0).toFixed(2)}</div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="text-sm text-zinc-400">Start Time</div>
                  <div className="text-zinc-300">{formatDate(selectedPrint.startTime)}</div>
                </div>
                <div>
                  <div className="text-sm text-zinc-400">End Time</div>
                  <div className="text-zinc-300">{formatDate(selectedPrint.endTime)}</div>
                </div>

                {selectedPrint.qualityScore != null && (
                  <div>
                    <div className="text-sm text-zinc-400">Quality Score</div>
                    <div className="text-lg font-bold text-white">{Number(selectedPrint.qualityScore).toFixed(1)}/10</div>
                  </div>
                )}

                {selectedPrint.notes && (
                  <div>
                    <div className="text-sm text-zinc-400">Notes</div>
                    <div className="bg-gray-800 border border-gray-700 p-3 rounded-lg text-zinc-300">{selectedPrint.notes}</div>
                  </div>
                )}

                {selectedPrint.errors && (
                  <div>
                    <div className="text-sm text-zinc-400">Errors</div>
                    <div className="bg-red-900/30 border border-red-700 text-red-300 p-3 rounded-lg">
                      {typeof selectedPrint.errors === 'string' ? selectedPrint.errors : JSON.stringify(selectedPrint.errors, null, 2)}
                    </div>
                  </div>
                )}

                {['failed', 'error'].includes(String(selectedPrint.status || '').toLowerCase()) && (
                  <div className="mt-4">
                    <div className="text-sm text-zinc-400 mb-2">AI Failure Diagnosis</div>
                    <FailureDiagnosisPanel
                      jobId={selectedPrint.id}
                      failureReason={selectedPrint.errors || selectedPrint.failure_reason || 'unknown'}
                      inline={true}
                    />
                  </div>
                )}

                {selectedPrint.settings && (
                  <div>
                    <div className="text-sm text-zinc-400">Settings</div>
                    <pre className="bg-gray-800 border border-gray-700 p-3 rounded-lg text-xs overflow-x-auto text-zinc-300">
                      {JSON.stringify(selectedPrint.settings, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedPrint(null)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrintHistory;
