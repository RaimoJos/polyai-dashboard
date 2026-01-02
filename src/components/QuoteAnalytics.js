/**
 * QuoteAnalytics - Dashboard for quote conversion tracking
 * Shows quote funnel, conversion rates, material popularity, revenue pipeline
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../i18n';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000/api/v1';

function QuoteAnalytics() {
  const { t } = useLanguage();
  const [analytics, setAnalytics] = useState(null);
  const [topMaterials, setTopMaterials] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [analyticsRes, materialsRes, quotesRes] = await Promise.all([
        fetch(`${API_BASE}/quote/analytics?days=${days}`, { credentials: 'include' }),
        fetch(`${API_BASE}/quote/analytics/top-materials`, { credentials: 'include' }),
        fetch(`${API_BASE}/quote/quotes?limit=20`, { credentials: 'include' }),
      ]);
      
      const analyticsData = await analyticsRes.json();
      const materialsData = await materialsRes.json();
      const quotesData = await quotesRes.json();
      
      if (analyticsData.success) setAnalytics(analyticsData.data);
      if (materialsData.success) setTopMaterials(materialsData.data?.materials || []);
      if (quotesData.success) setQuotes(quotesData.data?.quotes || []);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleConvertToOrder = async (quoteId) => {
    setActionLoading(quoteId);
    try {
      const response = await fetch(`${API_BASE}/quote/quotes/${quoteId}/convert`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json();
      
      if (data.success) {
        alert(`✅ Order(s) created: ${data.data?.order_ids?.join(', ') || 'Success'}`);
        fetchData();
      } else {
        alert(`❌ ${data.error || 'Failed to convert'}`);
      }
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendQuote = async (quoteId, email) => {
    if (!email) {
      email = prompt('Enter customer email:');
      if (!email) return;
    }
    
    setActionLoading(quoteId);
    try {
      const response = await fetch(`${API_BASE}/quote/quotes/${quoteId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      
      if (data.success) {
        alert(`✅ Quote sent to ${email}`);
        fetchData();
      } else {
        alert(`❌ ${data.error || 'Failed to send'}`);
      }
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadPdf = (quoteId) => {
    window.open(`${API_BASE}/quote/quotes/${quoteId}/pdf`, '_blank');
  };

  const getStatusColor = (status) => ({
    'draft': 'bg-slate-600 text-slate-200',
    'sent': 'bg-blue-600 text-blue-100',
    'accepted': 'bg-green-600 text-green-100',
    'converted': 'bg-purple-600 text-purple-100',
    'expired': 'bg-red-600 text-red-100',
  }[status] || 'bg-slate-600 text-slate-200');

  const getStatusIcon = (status) => ({
    'draft': '📝', 'sent': '📧', 'accepted': '✅', 'converted': '🔄', 'expired': '⏰',
  }[status] || '📋');

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-700 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-800 rounded-xl"></div>)}
          </div>
        </div>
      </div>
    );
  }

  const summary = analytics?.summary || {};
  const conversion = analytics?.conversion || {};
  const byStatus = analytics?.by_status || {};
  const dailyTrend = analytics?.daily_trend || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            📊 Quote Analytics
          </h2>
          <p className="text-slate-400 text-sm mt-1">Track quote performance and conversion rates</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="px-3 py-2 rounded-lg text-white text-sm"
            style={{ backgroundColor: '#334155' }}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
          <button
            onClick={fetchData}
            className="px-4 py-2 rounded-lg text-purple-400 border border-purple-500/30 hover:bg-purple-500/10"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-sm text-slate-400">Total Quotes</p>
          <p className="text-3xl font-bold text-white mt-1">{summary.total_quotes || 0}</p>
          <p className="text-xs text-slate-500 mt-1">Last {days} days</p>
        </div>
        
        <div className="p-5 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-sm text-slate-400">Total Value</p>
          <p className="text-3xl font-bold text-cyan-400 mt-1">€{(summary.total_value || 0).toFixed(0)}</p>
          <p className="text-xs text-slate-500 mt-1">Avg: €{(summary.average_value || 0).toFixed(0)}</p>
        </div>
        
        <div className="p-5 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-sm text-slate-400">Conversion Rate</p>
          <p className={`text-3xl font-bold mt-1 ${summary.conversion_rate >= 30 ? 'text-green-400' : summary.conversion_rate >= 15 ? 'text-yellow-400' : 'text-red-400'}`}>
            {summary.conversion_rate || 0}%
          </p>
          <p className="text-xs text-slate-500 mt-1">{conversion.converted || 0} of {conversion.sent || 0} sent</p>
        </div>
        
        <div className="p-5 rounded-xl border bg-gradient-to-br from-purple-500/20 to-cyan-500/20" style={{ borderColor: '#7c3aed50' }}>
          <p className="text-sm text-purple-300">Pipeline Value</p>
          <p className="text-3xl font-bold text-white mt-1">
            €{((byStatus.draft || 0) * (summary.average_value || 0) + (byStatus.sent || 0) * (summary.average_value || 0)).toFixed(0)}
          </p>
          <p className="text-xs text-purple-400 mt-1">Pending quotes</p>
        </div>
      </div>

      {/* Funnel + Materials Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quote Funnel */}
        <div className="p-6 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <h3 className="text-lg font-semibold text-white mb-4">📈 Quote Funnel</h3>
          
          <div className="space-y-3">
            {['draft', 'sent', 'accepted', 'converted'].map((status, i) => {
              const count = byStatus[status] || 0;
              const total = summary.total_quotes || 1;
              const pct = (count / total * 100);
              const colors = {
                draft: '#64748b',
                sent: '#3b82f6',
                accepted: '#22c55e',
                converted: '#a855f7',
              };
              
              return (
                <div key={status}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300 capitalize">{getStatusIcon(status)} {status}</span>
                    <span className="text-white font-medium">{count} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: '#334155' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: colors[status] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          
          {byStatus.expired > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <p className="text-sm text-red-400">⚠️ {byStatus.expired} expired quotes</p>
            </div>
          )}
        </div>

        {/* Top Materials */}
        <div className="p-6 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <h3 className="text-lg font-semibold text-white mb-4">🎨 Popular Materials</h3>
          
          {topMaterials.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No data yet</p>
          ) : (
            <div className="space-y-3">
              {topMaterials.slice(0, 5).map((mat, i) => (
                <div key={mat.material} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: '#334155' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-slate-500">#{i + 1}</span>
                    <div>
                      <p className="text-white font-medium">{mat.material}</p>
                      <p className="text-xs text-slate-400">{mat.quote_count} quotes</p>
                    </div>
                  </div>
                  <p className="text-cyan-400 font-bold">€{mat.total_revenue.toFixed(0)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Daily Trend Chart */}
      {dailyTrend.length > 0 && (
        <div className="p-6 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <h3 className="text-lg font-semibold text-white mb-4">📅 Daily Quote Volume</h3>
          <div className="flex items-end justify-between gap-2 h-32">
            {dailyTrend.map((day) => {
              const maxCount = Math.max(...dailyTrend.map(d => d.count), 1);
              const height = (day.count / maxCount) * 100;
              
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center">
                  <div className="w-full flex justify-center mb-2">
                    <div
                      className="w-8 rounded-t-lg transition-all"
                      style={{ 
                        height: `${Math.max(height, 4)}%`,
                        background: 'linear-gradient(to top, #7c3aed, #06b6d4)',
                      }}
                    />
                  </div>
                  <p className="text-xs text-slate-500">{day.date.slice(5)}</p>
                  <p className="text-xs text-slate-400">{day.count}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Quotes Table */}
      <div className="p-6 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        <h3 className="text-lg font-semibold text-white mb-4">📋 Recent Quotes</h3>
        
        {quotes.length === 0 ? (
          <p className="text-slate-400 text-center py-8">No quotes yet. Create one from the Instant Quote page!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                  <th className="pb-3 font-medium">Quote ID</th>
                  <th className="pb-3 font-medium">Customer</th>
                  <th className="pb-3 font-medium">Parts</th>
                  <th className="pb-3 font-medium">Total</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Created</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote) => (
                  <tr key={quote.quote_id} className="border-b border-slate-700/50 hover:bg-slate-800/50">
                    <td className="py-3">
                      <span className="text-purple-400 font-mono text-sm">{quote.quote_id}</span>
                    </td>
                    <td className="py-3">
                      <p className="text-white">{quote.customer_name || 'N/A'}</p>
                      <p className="text-xs text-slate-400">{quote.customer_email || ''}</p>
                    </td>
                    <td className="py-3 text-slate-300">{quote.parts_count || 1}</td>
                    <td className="py-3">
                      <span className="text-cyan-400 font-bold">€{(quote.total || 0).toFixed(2)}</span>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(quote.status)}`}>
                        {getStatusIcon(quote.status)} {quote.status}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-slate-400">
                      {quote.created_at ? new Date(quote.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1">
                        {quote.status === 'draft' && (
                          <button
                            onClick={() => handleSendQuote(quote.quote_id, quote.customer_email)}
                            disabled={actionLoading === quote.quote_id}
                            className="p-1.5 rounded text-blue-400 hover:bg-blue-500/20"
                            title="Send to customer"
                          >
                            📧
                          </button>
                        )}
                        {['draft', 'sent', 'accepted'].includes(quote.status) && (
                          <button
                            onClick={() => handleConvertToOrder(quote.quote_id)}
                            disabled={actionLoading === quote.quote_id}
                            className="p-1.5 rounded text-green-400 hover:bg-green-500/20"
                            title="Convert to order"
                          >
                            {actionLoading === quote.quote_id ? '⏳' : '✅'}
                          </button>
                        )}
                        <button
                          onClick={() => handleDownloadPdf(quote.quote_id)}
                          className="p-1.5 rounded text-purple-400 hover:bg-purple-500/20"
                          title="Download PDF"
                        >
                          📄
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default QuoteAnalytics;
