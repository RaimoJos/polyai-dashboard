// Statistics Dashboard - Phase B
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import ExportPanel from './ExportSystem';

function StatisticsDashboard({ printers = [] }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(7);
  const [showExport, setShowExport] = useState(false);
  const [prints, setPrints] = useState([]);

  useEffect(() => {
    fetchStats();
  }, [timeRange]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const printHistory = await api.getPrintHistory(timeRange).catch(() => []);
      
      const totalPrints = Array.isArray(printHistory) ? printHistory.length : 0;
      const successfulPrints = Array.isArray(printHistory) 
        ? printHistory.filter(p => p?.status === 'success').length 
        : 0;
      const totalFilament = Array.isArray(printHistory)
        ? printHistory.reduce((sum, p) => sum + (p?.filament_used_g || 0), 0)
        : 0;
      const totalTime = Array.isArray(printHistory)
        ? printHistory.reduce((sum, p) => sum + (p?.print_time_minutes || 0), 0)
        : 0;

      setPrints(Array.isArray(printHistory) ? printHistory : []);
      
      setStats({
        totalPrints,
        successfulPrints,
        successRate: totalPrints > 0 ? (successfulPrints / totalPrints * 100).toFixed(1) : 0,
        totalFilament: totalFilament.toFixed(1),
        totalTime,
        totalCost: 50, // Mock value, should come from backend
        energySaved: 12,
        printHistory: Array.isArray(printHistory) ? printHistory : [],
      });
    } catch (err) {
      console.error('[Stats] Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-4xl mb-2 animate-spin">⏳</div>
          <p className="text-slate-400">Loading statistics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">📊 Operation Statistics</h2>
        <div className="flex gap-2">
          {[7, 30, 90].map(days => (
            <button
              key={days}
              onClick={() => setTimeRange(days)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === days
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {days}d
            </button>
          ))}
          <button
            onClick={() => setShowExport(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors"
          >
            📥 Export
          </button>
        </div>
      </div>

      {showExport && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
          <ExportPanel 
            stats={stats}
            prints={prints}
            onClose={() => setShowExport(false)}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 border border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl">🖨️</span>
            <span className="text-xs text-blue-400 font-medium">TOTAL PRINTS</span>
          </div>
          <div className="text-3xl font-bold text-white">{stats?.totalPrints || 0}</div>
          <div className="text-xs text-slate-400 mt-1">
            ✅ {stats?.successfulPrints || 0} successful
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 border border-green-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl">📈</span>
            <span className="text-xs text-green-400 font-medium">SUCCESS RATE</span>
          </div>
          <div className="text-3xl font-bold text-white">{stats?.successRate || 0}%</div>
          <div className="text-xs text-slate-400 mt-1">
            {stats?.totalPrints > 0 ? `${stats?.successfulPrints} / ${stats?.totalPrints}` : 'No data'}
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-900/30 to-orange-800/20 border border-orange-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl">📦</span>
            <span className="text-xs text-orange-400 font-medium">FILAMENT USED</span>
          </div>
          <div className="text-3xl font-bold text-white">{stats?.totalFilament || 0}<span className="text-lg">g</span></div>
          <div className="text-xs text-slate-400 mt-1">
            ~{((stats?.totalFilament || 0) / 1000).toFixed(2)} kg
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 border border-purple-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl">⏱️</span>
            <span className="text-xs text-purple-400 font-medium">PRINT TIME</span>
          </div>
          <div className="text-3xl font-bold text-white">
            {Math.floor((stats?.totalTime || 0) / 60)}
            <span className="text-lg">h</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {Math.round((stats?.totalTime || 0) % 60)}m
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            💵 Cost Analytics ({timeRange}d)
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-3 border-b border-slate-700">
              <span className="text-slate-400">Energy Cost</span>
              <span className="font-bold text-white">€{stats?.totalCost.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-slate-700">
              <span className="text-slate-400">Avg per Print</span>
              <span className="font-bold text-white">
                €{stats?.totalPrints > 0 ? (stats.totalCost / stats.totalPrints).toFixed(2) : '0.00'}
              </span>
            </div>
            <div className="flex justify-between items-center text-green-400">
              <span className="text-slate-400">Energy Saved</span>
              <span className="font-bold">€{stats?.energySaved.toFixed(2) || '0.00'}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            📊 Top Materials
          </h3>
          <div className="space-y-3">
            {[
              { name: 'PLA', percent: 65, color: 'bg-blue-500' },
              { name: 'PETG', percent: 25, color: 'bg-orange-500' },
              { name: 'Other', percent: 10, color: 'bg-purple-500' },
            ].map(mat => (
              <div key={mat.name} className="flex justify-between items-center">
                <span className="text-slate-400">{mat.name}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full ${mat.color}`} style={{ width: `${mat.percent}%` }}></div>
                  </div>
                  <span className="text-white text-sm">{mat.percent}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          📋 Recent Prints ({stats?.printHistory?.length || 0})
        </h3>

        {stats?.printHistory && stats.printHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="text-left py-2 px-3">Model</th>
                  <th className="text-left py-2 px-3">Printer</th>
                  <th className="text-center py-2 px-3">Material</th>
                  <th className="text-center py-2 px-3">Time</th>
                  <th className="text-right py-2 px-3">Filament</th>
                  <th className="text-center py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.printHistory.slice(0, 10).map((print, idx) => (
                  <tr key={idx} className="border-b border-slate-700 hover:bg-slate-700/30">
                    <td className="py-3 px-3 text-white truncate">
                      {print.filename || print.model_name || `Print ${idx + 1}`}
                    </td>
                    <td className="py-3 px-3 text-slate-400">{print.printer_name || '—'}</td>
                    <td className="py-3 px-3 text-center text-slate-400">{print.material || '—'}</td>
                    <td className="py-3 px-3 text-center text-slate-400">
                      {print.print_time_minutes ? `${Math.round(print.print_time_minutes)}m` : '—'}
                    </td>
                    <td className="py-3 px-3 text-right text-orange-400 font-medium">
                      {print.filament_used_g ? `${print.filament_used_g.toFixed(1)}g` : '—'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {print.status === 'success' ? (
                        <span className="inline-block px-2 py-1 bg-green-900/30 text-green-400 rounded text-xs">
                          ✅ Success
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-1 bg-red-900/30 text-red-400 rounded text-xs">
                          ❌ Failed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400">
            <p>No print data available</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default StatisticsDashboard;
