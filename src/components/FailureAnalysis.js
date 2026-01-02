import React, { useState, useEffect } from 'react';
import { Doughnut, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, ArcElement, BarElement, Tooltip, Legend } from 'chart.js';
import { api, unwrap } from '../services/api';

ChartJS.register(CategoryScale, LinearScale, ArcElement, BarElement, Tooltip, Legend);

/**
 * Failure Pattern Analysis - Track what fails and why
 */
function FailureAnalysis() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30');

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
            const res = await api.getPrintJobs();
      const payload = unwrap(res) || {};
      const jobs = [
        ...(payload.active_jobs || payload.activeJobs || []),
        ...(payload.recent_jobs || payload.recentJobs || []),
        ...(payload.jobs || []),
      ];

      const days = Number.parseInt(timeRange, 10);
      const cutoff = Number.isFinite(days)
        ? new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        : null;

      const filteredJobs = cutoff
        ? jobs.filter((j) => {
            const dt = new Date(j.started_at || j.completed_at || j.created_at || j.queued_at);
            return Number.isNaN(dt.getTime()) ? true : dt >= cutoff;
          })
        : jobs;

      // Analyze failures
      const failedJobs = filteredJobs.filter(
        (j) => String(j.status || '').toLowerCase() === 'failed'
      );
      const successfulJobs = filteredJobs.filter(
        (j) => String(j.status || '').toLowerCase() === 'completed'
      );

      // By printer
      const byPrinter = {};
      failedJobs.forEach(job => {
        const printer = job.printer_name || job.assigned_printer || job.printer || 'Unknown';
        if (!byPrinter[printer]) {
          byPrinter[printer] = { failed: 0, total: 0 };
        }
        byPrinter[printer].failed++;
      });
      jobs.forEach(job => {
        const printer = job.printer_name || job.assigned_printer || job.printer || 'Unknown';
        if (!byPrinter[printer]) {
          byPrinter[printer] = { failed: 0, total: 0 };
        }
        byPrinter[printer].total++;
      });

      // By material
      const byMaterial = {};
      failedJobs.forEach(job => {
        const material = job.filament_type || job.material || job.settings?.material || job.settings?.filament_type || 'Unknown';
        byMaterial[material] = (byMaterial[material] || 0) + 1;
      });

      // By time of day (hour)
      const byHour = Array(24).fill(0);
      failedJobs.forEach(job => {
        const date = new Date(job.started_at || job.queued_at);
        if (!isNaN(date)) {
          byHour[date.getHours()]++;
        }
      });

      // By day of week
      const byDayOfWeek = Array(7).fill(0);
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      failedJobs.forEach(job => {
        const date = new Date(job.started_at || job.queued_at);
        if (!isNaN(date)) {
          byDayOfWeek[date.getDay()]++;
        }
      });

      // Failure reasons (from notes or metadata)
      const reasons = {
        'Adhesion': 0,
        'Clog': 0,
        'Warping': 0,
        'Layer Shift': 0,
        'Thermal': 0,
        'Power': 0,
        'User Cancelled': 0,
        'Unknown': 0,
      };
      failedJobs.forEach(job => {
        const notes = String(job.failure_reason || job.notes || '').toLowerCase();
        if (notes.includes('adhes') || notes.includes('bed')) reasons['Adhesion']++;
        else if (notes.includes('clog') || notes.includes('nozzle')) reasons['Clog']++;
        else if (notes.includes('warp')) reasons['Warping']++;
        else if (notes.includes('shift') || notes.includes('layer')) reasons['Layer Shift']++;
        else if (notes.includes('thermal') || notes.includes('temp')) reasons['Thermal']++;
        else if (notes.includes('power')) reasons['Power']++;
        else if (notes.includes('cancel')) reasons['User Cancelled']++;
        else reasons['Unknown']++;
      });

      setData({
        totalJobs: jobs.length,
        failedCount: failedJobs.length,
        successCount: successfulJobs.length,
        failureRate: jobs.length > 0 ? (failedJobs.length / jobs.length * 100) : 0,
        byPrinter,
        byMaterial,
        byHour,
        byDayOfWeek,
        dayNames,
        reasons,
        recentFailures: failedJobs.slice(0, 5),
      });
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-500">Analyzing failures...</p>
      </div>
    );
  }

  if (!data) return null;

  // Chart data for failure reasons
  const reasonsChartData = {
    labels: Object.keys(data.reasons).filter(k => data.reasons[k] > 0),
    datasets: [{
      data: Object.values(data.reasons).filter(v => v > 0),
      backgroundColor: [
        '#ef4444', '#f97316', '#eab308', '#22c55e', 
        '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'
      ],
    }]
  };

  // Chart for failures by hour
  const hourChartData = {
    labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
    datasets: [{
      label: 'Failures',
      data: data.byHour,
      backgroundColor: 'rgba(239, 68, 68, 0.5)',
      borderColor: 'rgb(239, 68, 68)',
      borderWidth: 1,
    }]
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">🔍 Failure Pattern Analysis</h2>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-1.5 border rounded-lg text-sm"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold">{data.totalJobs}</p>
            <p className="text-sm text-gray-500">Total Prints</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{data.successCount}</p>
            <p className="text-sm text-gray-500">Successful</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{data.failedCount}</p>
            <p className="text-sm text-gray-500">Failed</p>
          </div>
          <div className={`rounded-lg p-4 text-center ${
            data.failureRate > 10 ? 'bg-red-50' : 
            data.failureRate > 5 ? 'bg-yellow-50' : 'bg-green-50'
          }`}>
            <p className={`text-2xl font-bold ${
              data.failureRate > 10 ? 'text-red-600' : 
              data.failureRate > 5 ? 'text-yellow-600' : 'text-green-600'
            }`}>
              {data.failureRate.toFixed(1)}%
            </p>
            <p className="text-sm text-gray-500">Failure Rate</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Failure Reasons */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-bold mb-4">📊 Failure Reasons</h3>
          {Object.values(data.reasons).some(v => v > 0) ? (
            <div className="h-64">
              <Doughnut 
                data={reasonsChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: 'right' } }
                }}
              />
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No failure data</p>
          )}
        </div>

        {/* By Printer */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-bold mb-4">🖨️ Failures by Printer</h3>
          <div className="space-y-3">
            {Object.entries(data.byPrinter).map(([printer, stats]) => {
              const failRate = stats.total > 0 ? (stats.failed / stats.total * 100) : 0;
              return (
                <div key={printer} className="flex items-center gap-3">
                  <span className="w-24 truncate font-medium">{printer}</span>
                  <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${failRate > 15 ? 'bg-red-500' : failRate > 5 ? 'bg-yellow-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(failRate * 3, 100)}%` }}
                    />
                  </div>
                  <span className={`text-sm font-medium w-16 text-right ${
                    failRate > 15 ? 'text-red-600' : failRate > 5 ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {failRate.toFixed(1)}%
                  </span>
                  <span className="text-xs text-gray-400 w-16">
                    ({stats.failed}/{stats.total})
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* By Material */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-bold mb-4">🧵 Failures by Material</h3>
          <div className="space-y-2">
            {Object.entries(data.byMaterial).length > 0 ? (
              Object.entries(data.byMaterial)
                .sort((a, b) => b[1] - a[1])
                .map(([material, count]) => (
                  <div key={material} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span>{material}</span>
                    <span className="font-bold text-red-600">{count} failures</span>
                  </div>
                ))
            ) : (
              <p className="text-gray-500 text-center py-4">No data</p>
            )}
          </div>
        </div>

        {/* By Time of Day */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-bold mb-4">🕐 Failures by Time of Day</h3>
          <div className="h-48">
            <Bar 
              data={hourChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: { ticks: { maxTicksLimit: 12 } },
                  y: { beginAtZero: true }
                }
              }}
            />
          </div>
          <p className="text-xs text-gray-500 text-center mt-2">
            Identify if failures cluster around specific times
          </p>
        </div>
      </div>

      {/* Recent Failures */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-bold mb-4">🕐 Recent Failures</h3>
        {data.recentFailures.length > 0 ? (
          <div className="divide-y">
            {data.recentFailures.map((job, i) => (
              <div key={job.job_id || i} className="py-3 flex justify-between items-center">
                <div>
                  <p className="font-medium">{job.file_path || 'Unknown Print'}</p>
                  <p className="text-sm text-gray-500">
                    {job.assigned_printer && `🖨️ ${job.assigned_printer} • `}
                    {job.filament_type && `🧵 ${job.filament_type} • `}
                    {job.queued_at && new Date(job.queued_at).toLocaleDateString()}
                  </p>
                </div>
                {job.notes && (
                  <span className="text-sm text-red-600 max-w-xs truncate">
                    {job.notes}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No recent failures 🎉</p>
        )}
      </div>
    </div>
  );
}

export default FailureAnalysis;
