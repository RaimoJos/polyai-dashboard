import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

/**
 * JobProfitability - Profit/Loss analytics per job and order
 * Mobile-optimized with charts and detailed breakdowns
 */
function JobProfitability() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [dateRange, setDateRange] = useState('month');
  const [sortBy, setSortBy] = useState('profit');
  const [showJobDetails, setShowJobDetails] = useState(null);

  useEffect(() => {
    loadJobs();
  }, [dateRange]);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const saved = localStorage.getItem('polywerk_job_profitability');
      const data = saved ? JSON.parse(saved) : getDefaultJobs();
      setJobs(data);
    } catch (err) {
      console.error('Failed to load jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  const getDefaultJobs = () => [
    {
      id: 'job-001',
      order_id: 'order-1234',
      order_number: 'PW-2024-1234',
      client_name: 'TechCorp',
      item_name: 'Phone Stand v3',
      quantity: 50,
      completed_at: '2024-12-28',
      // Revenue
      sell_price: 8.00,
      total_revenue: 400.00,
      // Costs
      material_cost: 45.00,
      material_used_g: 450,
      electricity_cost: 8.50,
      print_time_hours: 12.5,
      labor_cost: 25.00, // Post-processing, QC
      machine_depreciation: 5.00,
      overhead: 10.00,
      total_cost: 93.50,
      // Calculated
      profit: 306.50,
      margin_percent: 76.6,
      // Details
      printer: 'K1 Max',
      material: 'PLA Black',
      failed_prints: 0,
      reprint_cost: 0,
    },
    {
      id: 'job-002',
      order_id: 'order-1235',
      order_number: 'PW-2024-1235',
      client_name: 'StartupXYZ',
      item_name: 'Gear Assembly',
      quantity: 10,
      completed_at: '2024-12-27',
      sell_price: 25.00,
      total_revenue: 250.00,
      material_cost: 60.00,
      material_used_g: 600,
      electricity_cost: 15.00,
      print_time_hours: 22,
      labor_cost: 45.00,
      machine_depreciation: 10.00,
      overhead: 15.00,
      total_cost: 145.00,
      profit: 105.00,
      margin_percent: 42.0,
      printer: 'K1',
      material: 'PETG Blue',
      failed_prints: 2,
      reprint_cost: 25.00,
    },
    {
      id: 'job-003',
      order_id: 'order-1236',
      order_number: 'PW-2024-1236',
      client_name: 'Walk-in Customer',
      item_name: 'Custom Keychain',
      quantity: 100,
      completed_at: '2024-12-30',
      sell_price: 3.00,
      total_revenue: 300.00,
      material_cost: 25.00,
      material_used_g: 250,
      electricity_cost: 5.00,
      print_time_hours: 8,
      labor_cost: 15.00,
      machine_depreciation: 3.00,
      overhead: 8.00,
      total_cost: 56.00,
      profit: 244.00,
      margin_percent: 81.3,
      printer: 'K1 Max',
      material: 'PLA White',
      failed_prints: 0,
      reprint_cost: 0,
    },
    {
      id: 'job-004',
      order_id: 'order-1237',
      order_number: 'PW-2024-1237',
      client_name: 'PrototypeCo',
      item_name: 'Complex Housing',
      quantity: 5,
      completed_at: '2024-12-26',
      sell_price: 80.00,
      total_revenue: 400.00,
      material_cost: 120.00,
      material_used_g: 1200,
      electricity_cost: 35.00,
      print_time_hours: 48,
      labor_cost: 100.00,
      machine_depreciation: 25.00,
      overhead: 30.00,
      total_cost: 310.00,
      profit: 90.00,
      margin_percent: 22.5,
      printer: 'K1',
      material: 'ABS Grey',
      failed_prints: 3,
      reprint_cost: 85.00,
    },
  ];

  // Calculate summary stats
  const totalRevenue = jobs.reduce((sum, j) => sum + j.total_revenue, 0);
  const totalCosts = jobs.reduce((sum, j) => sum + j.total_cost, 0);
  const totalProfit = jobs.reduce((sum, j) => sum + j.profit, 0);
  const avgMargin = jobs.length > 0 
    ? jobs.reduce((sum, j) => sum + j.margin_percent, 0) / jobs.length 
    : 0;
  const totalPrintHours = jobs.reduce((sum, j) => sum + j.print_time_hours, 0);
  const totalMaterial = jobs.reduce((sum, j) => sum + j.material_used_g, 0);
  const failedPrints = jobs.reduce((sum, j) => sum + j.failed_prints, 0);
  const reprintCosts = jobs.reduce((sum, j) => sum + j.reprint_cost, 0);

  // Cost breakdown
  const costBreakdown = {
    material: jobs.reduce((sum, j) => sum + j.material_cost, 0),
    electricity: jobs.reduce((sum, j) => sum + j.electricity_cost, 0),
    labor: jobs.reduce((sum, j) => sum + j.labor_cost, 0),
    depreciation: jobs.reduce((sum, j) => sum + j.machine_depreciation, 0),
    overhead: jobs.reduce((sum, j) => sum + j.overhead, 0),
    reprints: reprintCosts,
  };

  // Sort jobs
  const sortedJobs = [...jobs].sort((a, b) => {
    if (sortBy === 'profit') return b.profit - a.profit;
    if (sortBy === 'margin') return b.margin_percent - a.margin_percent;
    if (sortBy === 'revenue') return b.total_revenue - a.total_revenue;
    if (sortBy === 'date') return new Date(b.completed_at) - new Date(a.completed_at);
    return 0;
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('et-EE', { style: 'currency', currency: 'EUR' }).format(amount || 0);
  };

  const getMarginColor = (margin) => {
    if (margin >= 60) return 'text-green-400';
    if (margin >= 40) return 'text-cyan-400';
    if (margin >= 20) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getProfitColor = (profit) => {
    if (profit > 0) return 'text-green-400';
    if (profit === 0) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">💰 Job Profitability</h2>
          <p className="text-slate-400 text-sm mt-1">
            Analyze profit margins and costs per job
          </p>
        </div>

        <div className="flex gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm text-white"
            style={{ backgroundColor: '#334155' }}
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-sm text-slate-400">Revenue</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="p-4 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-sm text-slate-400">Costs</p>
          <p className="text-2xl font-bold text-red-400">{formatCurrency(totalCosts)}</p>
        </div>
        <div className="p-4 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-sm text-slate-400">Profit</p>
          <p className={`text-2xl font-bold ${getProfitColor(totalProfit)}`}>
            {formatCurrency(totalProfit)}
          </p>
        </div>
        <div className="p-4 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-sm text-slate-400">Avg Margin</p>
          <p className={`text-2xl font-bold ${getMarginColor(avgMargin)}`}>
            {avgMargin.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-slate-800">
          <p className="text-xs text-slate-500">Print Hours</p>
          <p className="text-lg font-semibold text-white">{totalPrintHours.toFixed(1)}h</p>
        </div>
        <div className="p-3 rounded-lg bg-slate-800">
          <p className="text-xs text-slate-500">Material Used</p>
          <p className="text-lg font-semibold text-white">{(totalMaterial / 1000).toFixed(2)}kg</p>
        </div>
        <div className="p-3 rounded-lg bg-slate-800">
          <p className="text-xs text-slate-500">Failed Prints</p>
          <p className="text-lg font-semibold text-red-400">{failedPrints}</p>
        </div>
        <div className="p-3 rounded-lg bg-slate-800">
          <p className="text-xs text-slate-500">Reprint Costs</p>
          <p className="text-lg font-semibold text-red-400">{formatCurrency(reprintCosts)}</p>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div 
        className="rounded-xl border p-4"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <h3 className="text-lg font-semibold text-white mb-4">📊 Cost Breakdown</h3>
        <div className="space-y-3">
          {Object.entries(costBreakdown).map(([key, value]) => {
            const percent = totalCosts > 0 ? (value / totalCosts) * 100 : 0;
            const colors = {
              material: 'bg-purple-500',
              electricity: 'bg-yellow-500',
              labor: 'bg-cyan-500',
              depreciation: 'bg-blue-500',
              overhead: 'bg-slate-500',
              reprints: 'bg-red-500',
            };
            return (
              <div key={key}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400 capitalize">{key}</span>
                  <span className="text-white">
                    {formatCurrency(value)} ({percent.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${colors[key]}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Jobs List */}
      <div 
        className="rounded-xl border"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <div className="px-4 py-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2" style={{ borderColor: '#334155' }}>
          <h3 className="text-lg font-semibold text-white">📋 Job Details</h3>
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm text-white"
              style={{ backgroundColor: '#334155' }}
            >
              <option value="profit">Sort: Profit</option>
              <option value="margin">Sort: Margin</option>
              <option value="revenue">Sort: Revenue</option>
              <option value="date">Sort: Date</option>
            </select>
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="sm:hidden divide-y" style={{ borderColor: '#334155' }}>
          {sortedJobs.map(job => (
            <div 
              key={job.id}
              onClick={() => setShowJobDetails(job)}
              className="p-4 cursor-pointer hover:bg-slate-800/50 transition"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium text-white">{job.item_name}</p>
                  <p className="text-xs text-slate-500">{job.client_name} • {job.order_number}</p>
                </div>
                <span className={`font-bold ${getProfitColor(job.profit)}`}>
                  {formatCurrency(job.profit)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{job.quantity}x @ {formatCurrency(job.sell_price)}</span>
                <span className={getMarginColor(job.margin_percent)}>
                  {job.margin_percent.toFixed(1)}% margin
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: '#334155' }}>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Job</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Client</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-400">Qty</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-400">Revenue</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-400">Costs</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-400">Profit</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-400">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#334155' }}>
              {sortedJobs.map(job => (
                <tr 
                  key={job.id}
                  onClick={() => setShowJobDetails(job)}
                  className="hover:bg-slate-800/50 cursor-pointer transition"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{job.item_name}</p>
                    <p className="text-xs text-slate-500">{job.order_number}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{job.client_name}</td>
                  <td className="px-4 py-3 text-right text-slate-400">{job.quantity}</td>
                  <td className="px-4 py-3 text-right text-white">{formatCurrency(job.total_revenue)}</td>
                  <td className="px-4 py-3 text-right text-red-400">{formatCurrency(job.total_cost)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${getProfitColor(job.profit)}`}>
                    {formatCurrency(job.profit)}
                  </td>
                  <td className={`px-4 py-3 text-right ${getMarginColor(job.margin_percent)}`}>
                    {job.margin_percent.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Job Details Modal */}
      {showJobDetails && (
        <JobDetailsModal
          job={showJobDetails}
          onClose={() => setShowJobDetails(null)}
          formatCurrency={formatCurrency}
          getMarginColor={getMarginColor}
          getProfitColor={getProfitColor}
        />
      )}
    </div>
  );
}

/**
 * JobDetailsModal - Detailed breakdown of a single job
 */
function JobDetailsModal({ job, onClose, formatCurrency, getMarginColor, getProfitColor }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border shadow-2xl"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <div className="sticky top-0 px-6 py-4 border-b flex items-center justify-between z-10" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <div>
            <h3 className="font-bold text-white">{job.item_name}</h3>
            <p className="text-sm text-slate-400">{job.order_number} • {job.client_name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 rounded-lg bg-slate-800">
              <p className="text-sm text-slate-500">Revenue</p>
              <p className="text-xl font-bold text-white">{formatCurrency(job.total_revenue)}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-800">
              <p className="text-sm text-slate-500">Costs</p>
              <p className="text-xl font-bold text-red-400">{formatCurrency(job.total_cost)}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-800">
              <p className="text-sm text-slate-500">Profit</p>
              <p className={`text-xl font-bold ${getProfitColor(job.profit)}`}>{formatCurrency(job.profit)}</p>
            </div>
          </div>

          {/* Margin Bar */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-400">Profit Margin</span>
              <span className={`font-bold ${getMarginColor(job.margin_percent)}`}>
                {job.margin_percent.toFixed(1)}%
              </span>
            </div>
            <div className="h-4 rounded-full bg-slate-700 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${
                  job.margin_percent >= 60 ? 'bg-green-500' :
                  job.margin_percent >= 40 ? 'bg-cyan-500' :
                  job.margin_percent >= 20 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, job.margin_percent)}%` }}
              />
            </div>
          </div>

          {/* Revenue Details */}
          <div>
            <h4 className="text-sm font-medium text-slate-400 mb-2">Revenue</h4>
            <div className="p-3 rounded-lg bg-slate-800 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Quantity</span>
                <span className="text-white">{job.quantity} units</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Price per unit</span>
                <span className="text-white">{formatCurrency(job.sell_price)}</span>
              </div>
              <div className="flex justify-between font-medium border-t border-slate-700 pt-2">
                <span className="text-white">Total Revenue</span>
                <span className="text-white">{formatCurrency(job.total_revenue)}</span>
              </div>
            </div>
          </div>

          {/* Cost Breakdown */}
          <div>
            <h4 className="text-sm font-medium text-slate-400 mb-2">Cost Breakdown</h4>
            <div className="p-3 rounded-lg bg-slate-800 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Material ({job.material_used_g}g {job.material})</span>
                <span className="text-white">{formatCurrency(job.material_cost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Electricity ({job.print_time_hours}h)</span>
                <span className="text-white">{formatCurrency(job.electricity_cost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Labor</span>
                <span className="text-white">{formatCurrency(job.labor_cost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Machine Depreciation</span>
                <span className="text-white">{formatCurrency(job.machine_depreciation)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Overhead</span>
                <span className="text-white">{formatCurrency(job.overhead)}</span>
              </div>
              {job.reprint_cost > 0 && (
                <div className="flex justify-between text-red-400">
                  <span>Reprint Cost ({job.failed_prints} failed)</span>
                  <span>{formatCurrency(job.reprint_cost)}</span>
                </div>
              )}
              <div className="flex justify-between font-medium border-t border-slate-700 pt-2">
                <span className="text-red-400">Total Cost</span>
                <span className="text-red-400">{formatCurrency(job.total_cost)}</span>
              </div>
            </div>
          </div>

          {/* Print Details */}
          <div>
            <h4 className="text-sm font-medium text-slate-400 mb-2">Print Details</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-slate-800">
                <p className="text-xs text-slate-500">Printer</p>
                <p className="text-white">{job.printer}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-800">
                <p className="text-xs text-slate-500">Material</p>
                <p className="text-white">{job.material}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-800">
                <p className="text-xs text-slate-500">Print Time</p>
                <p className="text-white">{job.print_time_hours}h</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-800">
                <p className="text-xs text-slate-500">Completed</p>
                <p className="text-white">{job.completed_at}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 px-6 py-4 border-t" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <button
            onClick={onClose}
            className="w-full py-2 rounded-lg text-slate-300 border border-slate-600 hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default JobProfitability;
