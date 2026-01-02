import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { api, unwrap } from '../services/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

/**
 * Printer Utilization Charts - Dark Theme
 */
function PrinterUtilization({ printers = [] }) {
  const [stats, setStats] = useState(null);
  const [timeRange, setTimeRange] = useState('7');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await api.getJobQueue();
      const data = unwrap(res) || res.data?.data || res.data || {};
      let jobs = Array.isArray(data.jobs) ? data.jobs : (Array.isArray(res.data?.jobs) ? res.data.jobs : []);

      const days = parseInt(timeRange, 10);
      if (Number.isFinite(days) && days > 0) {
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        const parseTs = (v) => {
          if (!v) return null;
          const d = new Date(String(v));
          return Number.isFinite(d.getTime()) ? d : null;
        };
        jobs = jobs.filter((j) => {
          const ts = parseTs(j.queued_at) || parseTs(j.started_at);
          return ts ? ts.getTime() >= cutoff : true;
        });
      }

      const jobPrinter = (j) => j.assigned_printer || j.printer_id || j.printer || j.printer_name || null;
      const jobMinutes = (j) =>
        Number(j.estimated_time_minutes ?? j.estimated_duration_minutes ?? j.total_time_minutes ?? 0) || 0;

      const printerStats = {};
      printers.forEach((p) => {
        printerStats[p.name] = {
          name: p.name,
          printCount: 0,
          successCount: 0,
          failedCount: 0,
          totalMinutes: 0,
          connected: p.connected,
          state: p.state || p.status
        };
      });

      jobs.forEach((job) => {
        const pName = jobPrinter(job);
        if (pName && printerStats[pName]) {
          printerStats[pName].printCount++;
          if (job.status === 'completed') printerStats[pName].successCount++;
          if (job.status === 'failed') printerStats[pName].failedCount++;
          printerStats[pName].totalMinutes += jobMinutes(job);
        }
      });

      setStats({
        printers: Object.values(printerStats),
        totalJobs: jobs.length,
        completedJobs: jobs.filter((j) => j.status === 'completed').length,
        failedJobs: jobs.filter((j) => j.status === 'failed').length,
      });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-800 rounded-lg"></div>)}
          </div>
        </div>
      </div>
    );
  }

  if (!stats || stats.printers.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="text-center py-8">
          <p className="text-4xl mb-2">📊</p>
          <p className="text-zinc-400">No utilization data available</p>
          <p className="text-sm text-zinc-500 mt-1">Register printers to see usage stats</p>
        </div>
      </div>
    );
  }

  // Bar chart - prints per printer
  const barData = {
    labels: stats.printers.map(p => p.name),
    datasets: [
      {
        label: 'Successful',
        data: stats.printers.map(p => p.successCount),
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
      },
      {
        label: 'Failed',
        data: stats.printers.map(p => p.failedCount),
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
      },
    ],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#a1a1aa' }
      },
      title: {
        display: true,
        text: 'Prints per Printer',
        color: '#fafafa'
      }
    },
    scales: {
      x: { 
        stacked: true,
        grid: { color: 'rgba(39, 39, 42, 0.8)' },
        ticks: { color: '#71717a' }
      },
      y: { 
        stacked: true, 
        beginAtZero: true,
        grid: { color: 'rgba(39, 39, 42, 0.8)' },
        ticks: { color: '#71717a' }
      }
    }
  };

  // Status doughnut
  const statusData = {
    labels: ['Printing', 'Idle', 'Offline'],
    datasets: [
      {
        data: [
          printers.filter(p => p.state === 'printing').length,
          printers.filter(p => p.state === 'idle' && p.connected).length,
          printers.filter(p => !p.connected).length,
        ],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(113, 113, 122, 0.8)',
        ],
      },
    ],
  };

  const maxHours = Math.max(...stats.printers.map(p => p.totalMinutes / 60));
  const avgHours = stats.printers.reduce((a, p) => a + p.totalMinutes, 0) / 60 / stats.printers.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              📊 Printer Utilization
            </h2>
            <p className="text-sm text-zinc-400 mt-1">Performance and usage statistics</p>
          </div>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-zinc-200"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div 
            className="p-4 rounded-lg border text-center"
            style={{ 
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)',
              borderColor: 'rgba(59, 130, 246, 0.3)'
            }}
          >
            <p className="text-2xl font-bold text-blue-400">{stats.totalJobs}</p>
            <p className="text-sm text-zinc-400">Total Prints</p>
          </div>
          <div 
            className="p-4 rounded-lg border text-center"
            style={{ 
              background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)',
              borderColor: 'rgba(34, 197, 94, 0.3)'
            }}
          >
            <p className="text-2xl font-bold text-green-400">
              {stats.totalJobs > 0 ? ((stats.completedJobs / stats.totalJobs) * 100).toFixed(0) : 0}%
            </p>
            <p className="text-sm text-zinc-400">Success Rate</p>
          </div>
          <div 
            className="p-4 rounded-lg border text-center"
            style={{ 
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(168, 85, 247, 0.05) 100%)',
              borderColor: 'rgba(168, 85, 247, 0.3)'
            }}
          >
            <p className="text-2xl font-bold text-purple-400">{maxHours.toFixed(1)}h</p>
            <p className="text-sm text-zinc-400">Most Active Printer</p>
          </div>
          <div 
            className="p-4 rounded-lg border text-center"
            style={{ 
              background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.1) 0%, rgba(249, 115, 22, 0.05) 100%)',
              borderColor: 'rgba(249, 115, 22, 0.3)'
            }}
          >
            <p className="text-2xl font-bold text-orange-400">{avgHours.toFixed(1)}h</p>
            <p className="text-sm text-zinc-400">Avg per Printer</p>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Prints per Printer */}
        <div className="lg:col-span-2 bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="h-64">
            <Bar data={barData} options={barOptions} />
          </div>
        </div>

        {/* Current Status */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="font-bold text-white mb-4">Current Status</h3>
          <div className="h-48">
            <Doughnut 
              data={statusData} 
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { 
                    position: 'bottom',
                    labels: { color: '#a1a1aa' }
                  }
                }
              }} 
            />
          </div>
        </div>
      </div>

      {/* Printer Details Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h3 className="font-bold text-white mb-4">Printer Details</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-2 text-zinc-400 font-medium">Printer</th>
                <th className="text-center py-3 px-2 text-zinc-400 font-medium">Status</th>
                <th className="text-right py-3 px-2 text-zinc-400 font-medium">Prints</th>
                <th className="text-right py-3 px-2 text-zinc-400 font-medium">Success</th>
                <th className="text-right py-3 px-2 text-zinc-400 font-medium">Failed</th>
                <th className="text-right py-3 px-2 text-zinc-400 font-medium">Hours</th>
                <th className="text-right py-3 px-2 text-zinc-400 font-medium">Utilization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {stats.printers.map(printer => {
                const utilization = maxHours > 0 ? ((printer.totalMinutes / 60) / maxHours * 100) : 0;
                
                return (
                  <tr key={printer.name} className="hover:bg-gray-800/50">
                    <td className="py-3 px-2 font-medium text-white">{printer.name}</td>
                    <td className="py-3 px-2 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                        printer.state === 'printing' ? 'bg-blue-900/50 text-blue-400 border-blue-700/50' :
                        printer.connected ? 'bg-green-900/50 text-green-400 border-green-700/50' :
                        'bg-gray-800 text-zinc-400 border-gray-700'
                      }`}>
                        {printer.connected ? printer.state : 'offline'}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right text-zinc-300">{printer.printCount}</td>
                    <td className="py-3 px-2 text-right text-green-400">{printer.successCount}</td>
                    <td className="py-3 px-2 text-right text-red-400">{printer.failedCount}</td>
                    <td className="py-3 px-2 text-right text-zinc-300">{(printer.totalMinutes / 60).toFixed(1)}h</td>
                    <td className="py-3 px-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-purple-500 rounded-full"
                            style={{ width: `${utilization}%` }}
                          />
                        </div>
                        <span className="text-xs text-zinc-400">{utilization.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

PrinterUtilization.propTypes = {
  printers: PropTypes.arrayOf(PropTypes.shape({
    name: PropTypes.string,
    connected: PropTypes.bool,
    state: PropTypes.string,
    status: PropTypes.string
  }))
};

export default PrinterUtilization;
