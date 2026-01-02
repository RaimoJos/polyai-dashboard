import React, { useState, useEffect, useCallback } from 'react';
import { api, unwrap } from '../services/api';

/**
 * ClientProfitability - Analyze profit/loss per client
 * Shows which clients are most valuable
 */
function ClientProfitability() {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [orders, setOrders] = useState([]);
  const [dateRange, setDateRange] = useState('all');
  const [sortBy, setSortBy] = useState('profit');
  const [selectedClient, setSelectedClient] = useState(null);

  // Define mock data functions BEFORE loadData to avoid initialization error
  const getMockClients = useCallback(() => [
    { id: 'client-1', name: 'TechCorp', email: 'orders@techcorp.com', company: 'TechCorp Inc' },
    { id: 'client-2', name: 'StartupXYZ', email: 'hello@startupxyz.io', company: 'StartupXYZ' },
    { id: 'client-3', name: 'Local Shop', email: 'info@localshop.ee', company: 'Local Shop OÜ' },
    { id: 'client-4', name: 'Walk-in', email: null, company: null },
    { id: 'client-5', name: 'PrototypeCo', email: 'design@prototype.co', company: 'PrototypeCo' },
  ], []);

  const getMockOrders = useCallback(() => [
    { id: 'o1', client_id: 'client-1', client_name: 'TechCorp', total_amount: 400, cost: 95, status: 'completed', created_at: '2024-12-20' },
    { id: 'o2', client_id: 'client-1', client_name: 'TechCorp', total_amount: 250, cost: 80, status: 'completed', created_at: '2024-12-25' },
    { id: 'o3', client_id: 'client-1', client_name: 'TechCorp', total_amount: 180, cost: 45, status: 'completed', created_at: '2024-12-28' },
    { id: 'o4', client_id: 'client-2', client_name: 'StartupXYZ', total_amount: 600, cost: 200, status: 'completed', created_at: '2024-12-15' },
    { id: 'o5', client_id: 'client-2', client_name: 'StartupXYZ', total_amount: 150, cost: 90, status: 'completed', created_at: '2024-12-22' },
    { id: 'o6', client_id: 'client-3', client_name: 'Local Shop', total_amount: 80, cost: 35, status: 'completed', created_at: '2024-12-18' },
    { id: 'o7', client_id: 'client-4', client_name: 'Walk-in', total_amount: 25, cost: 8, status: 'completed', created_at: '2024-12-30' },
    { id: 'o8', client_id: 'client-4', client_name: 'Walk-in', total_amount: 15, cost: 5, status: 'completed', created_at: '2024-12-30' },
    { id: 'o9', client_id: 'client-5', client_name: 'PrototypeCo', total_amount: 800, cost: 450, status: 'completed', created_at: '2024-12-10' },
    { id: 'o10', client_id: 'client-5', client_name: 'PrototypeCo', total_amount: 200, cost: 180, status: 'cancelled', created_at: '2024-12-12' },
  ], []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load clients
      const clientsRes = await api.getClients();
      const clientsData = unwrap(clientsRes);
      const clientsList = Array.isArray(clientsData) ? clientsData : (clientsData?.data || clientsData?.clients || []);
      
      // Load orders
      const ordersRes = await api.listOrders();
      const ordersData = unwrap(ordersRes);
      const ordersList = Array.isArray(ordersData) ? ordersData : (ordersData?.data || ordersData?.orders || []);

      setClients(clientsList);
      setOrders(ordersList);
    } catch (err) {
      console.error('Failed to load data:', err);
      // Use mock data if API fails
      setClients(getMockClients());
      setOrders(getMockOrders());
    } finally {
      setLoading(false);
    }
  }, [getMockClients, getMockOrders]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter orders by date range
  const getFilteredOrders = () => {
    const now = new Date();
    return orders.filter(order => {
      if (dateRange === 'all') return true;
      const orderDate = new Date(order.created_at);
      const daysDiff = (now - orderDate) / (1000 * 60 * 60 * 24);
      
      if (dateRange === 'week') return daysDiff <= 7;
      if (dateRange === 'month') return daysDiff <= 30;
      if (dateRange === 'quarter') return daysDiff <= 90;
      if (dateRange === 'year') return daysDiff <= 365;
      return true;
    });
  };

  // Calculate client metrics
  const getClientMetrics = () => {
    const filteredOrders = getFilteredOrders();
    const metrics = {};

    // Initialize metrics for all clients
    clients.forEach(client => {
      metrics[client.id] = {
        client,
        revenue: 0,
        cost: 0,
        profit: 0,
        orderCount: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        avgOrderValue: 0,
        margin: 0,
        firstOrder: null,
        lastOrder: null,
        orders: [],
      };
    });

    // Add "Unknown" client for orphan orders
    metrics['unknown'] = {
      client: { id: 'unknown', name: 'Unknown/Walk-in', email: null },
      revenue: 0, cost: 0, profit: 0, orderCount: 0, completedOrders: 0,
      cancelledOrders: 0, avgOrderValue: 0, margin: 0, firstOrder: null, lastOrder: null, orders: [],
    };

    // Calculate metrics from orders
    filteredOrders.forEach(order => {
      const clientId = order.client_id || 'unknown';
      if (!metrics[clientId]) {
        // Create a new unique object for each unknown client
        metrics[clientId] = {
          client: { id: clientId, name: order.client_name || 'Unknown/Walk-in', email: null },
          revenue: 0, cost: 0, profit: 0, orderCount: 0, completedOrders: 0,
          cancelledOrders: 0, avgOrderValue: 0, margin: 0, firstOrder: null, lastOrder: null, orders: [],
        };
      }

      const m = metrics[clientId];
      m.orderCount++;
      m.orders.push(order);

      if (order.status === 'completed' || order.status === 'delivered') {
        m.completedOrders++;
        m.revenue += order.total_amount || 0;
        m.cost += order.cost || (order.total_amount * 0.3) || 0; // Estimate cost if not provided
      } else if (order.status === 'cancelled') {
        m.cancelledOrders++;
      }

      const orderDate = new Date(order.created_at);
      if (!m.firstOrder || orderDate < new Date(m.firstOrder)) m.firstOrder = order.created_at;
      if (!m.lastOrder || orderDate > new Date(m.lastOrder)) m.lastOrder = order.created_at;
    });

    // Calculate derived metrics
    Object.values(metrics).forEach(m => {
      m.profit = m.revenue - m.cost;
      m.margin = m.revenue > 0 ? (m.profit / m.revenue) * 100 : 0;
      m.avgOrderValue = m.completedOrders > 0 ? m.revenue / m.completedOrders : 0;
    });

    // Return unique metrics, avoiding duplicate keys
    const seen = new Set();
    return Object.values(metrics).filter(m => {
      if (seen.has(m.client.id)) return false;
      seen.add(m.client.id);
      return m.orderCount > 0;
    });
  };

  const clientMetrics = getClientMetrics();

  // Sort clients
  const sortedClients = [...clientMetrics].sort((a, b) => {
    if (sortBy === 'profit') return b.profit - a.profit;
    if (sortBy === 'revenue') return b.revenue - a.revenue;
    if (sortBy === 'orders') return b.orderCount - a.orderCount;
    if (sortBy === 'margin') return b.margin - a.margin;
    if (sortBy === 'avgOrder') return b.avgOrderValue - a.avgOrderValue;
    return 0;
  });

  // Calculate totals
  const totals = clientMetrics.reduce((acc, m) => ({
    revenue: acc.revenue + m.revenue,
    cost: acc.cost + m.cost,
    profit: acc.profit + m.profit,
    orders: acc.orders + m.orderCount,
  }), { revenue: 0, cost: 0, profit: 0, orders: 0 });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('et-EE', { style: 'currency', currency: 'EUR' }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getMarginColor = (margin) => {
    if (margin >= 50) return 'text-green-400';
    if (margin >= 30) return 'text-cyan-400';
    if (margin >= 15) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getProfitColor = (profit) => {
    if (profit > 0) return 'text-green-400';
    if (profit === 0) return 'text-yellow-400';
    return 'text-red-400';
  };

  // Get tier based on revenue
  const getClientTier = (revenue) => {
    if (revenue >= 1000) return { name: 'Gold', color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
    if (revenue >= 500) return { name: 'Silver', color: 'text-slate-300', bg: 'bg-slate-500/20' };
    if (revenue >= 100) return { name: 'Bronze', color: 'text-orange-400', bg: 'bg-orange-500/20' };
    return { name: 'New', color: 'text-slate-500', bg: 'bg-slate-700' };
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
          <h2 className="text-xl font-bold text-white">👥 Client Profitability</h2>
          <p className="text-slate-400 text-sm mt-1">
            Analyze profit and value per client
          </p>
        </div>

        <div className="flex gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm text-white"
            style={{ backgroundColor: '#334155' }}
          >
            <option value="all">All Time</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="quarter">Last 90 Days</option>
            <option value="year">Last Year</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-sm text-slate-400">Total Revenue</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(totals.revenue)}</p>
        </div>
        <div className="p-4 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-sm text-slate-400">Total Profit</p>
          <p className={`text-2xl font-bold ${getProfitColor(totals.profit)}`}>{formatCurrency(totals.profit)}</p>
        </div>
        <div className="p-4 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-sm text-slate-400">Active Clients</p>
          <p className="text-2xl font-bold text-white">{clientMetrics.length}</p>
        </div>
        <div className="p-4 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-sm text-slate-400">Total Orders</p>
          <p className="text-2xl font-bold text-white">{totals.orders}</p>
        </div>
      </div>

      {/* Top Clients Chart (Simple Bar) */}
      <div 
        className="rounded-xl border p-4"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <h3 className="text-lg font-semibold text-white mb-4">📊 Top Clients by Profit</h3>
        <div className="space-y-3">
          {sortedClients.slice(0, 5).map((m, idx) => {
            const maxProfit = Math.max(...sortedClients.map(c => c.profit));
            const barWidth = maxProfit > 0 ? (m.profit / maxProfit) * 100 : 0;
            const tier = getClientTier(m.revenue);
            
            return (
              <div key={m.client.id} className="flex items-center gap-3">
                <div className="w-6 text-center text-slate-500 font-bold">#{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-white truncate">{m.client.name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${tier.bg} ${tier.color}`}>
                      {tier.name}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-500"
                      style={{ width: `${Math.max(barWidth, 2)}%` }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${getProfitColor(m.profit)}`}>{formatCurrency(m.profit)}</p>
                  <p className="text-xs text-slate-500">{m.orderCount} orders</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Client Table */}
      <div 
        className="rounded-xl border"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <div className="px-4 py-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2" style={{ borderColor: '#334155' }}>
          <h3 className="text-lg font-semibold text-white">📋 All Clients</h3>
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm text-white"
              style={{ backgroundColor: '#334155' }}
            >
              <option value="profit">Sort: Profit</option>
              <option value="revenue">Sort: Revenue</option>
              <option value="orders">Sort: Orders</option>
              <option value="margin">Sort: Margin</option>
              <option value="avgOrder">Sort: Avg Order</option>
            </select>
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="sm:hidden divide-y" style={{ borderColor: '#334155' }}>
          {sortedClients.map(m => {
            const tier = getClientTier(m.revenue);
            return (
              <div 
                key={m.client.id}
                onClick={() => setSelectedClient(m)}
                className="p-4 cursor-pointer hover:bg-slate-800/50 transition"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white">{m.client.name}</p>
                      <span className={`px-1.5 py-0.5 rounded text-xs ${tier.bg} ${tier.color}`}>
                        {tier.name}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{m.orderCount} orders</p>
                  </div>
                  <span className={`font-bold ${getProfitColor(m.profit)}`}>
                    {formatCurrency(m.profit)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Revenue: {formatCurrency(m.revenue)}</span>
                  <span className={getMarginColor(m.margin)}>
                    {m.margin.toFixed(1)}% margin
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: '#334155' }}>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Client</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-400">Orders</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-400">Revenue</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-400">Costs</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-400">Profit</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-400">Margin</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-400">Avg Order</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#334155' }}>
              {sortedClients.map(m => {
                const tier = getClientTier(m.revenue);
                return (
                  <tr 
                    key={m.client.id}
                    onClick={() => setSelectedClient(m)}
                    className="hover:bg-slate-800/50 cursor-pointer transition"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{m.client.name}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs ${tier.bg} ${tier.color}`}>
                          {tier.name}
                        </span>
                      </div>
                      {m.client.email && (
                        <p className="text-xs text-slate-500">{m.client.email}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400">
                      {m.completedOrders}
                      {m.cancelledOrders > 0 && (
                        <span className="text-red-400 text-xs ml-1">({m.cancelledOrders} cancelled)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-white">{formatCurrency(m.revenue)}</td>
                    <td className="px-4 py-3 text-right text-red-400">{formatCurrency(m.cost)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${getProfitColor(m.profit)}`}>
                      {formatCurrency(m.profit)}
                    </td>
                    <td className={`px-4 py-3 text-right ${getMarginColor(m.margin)}`}>
                      {m.margin.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400">
                      {formatCurrency(m.avgOrderValue)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Best Performers */}
        <div 
          className="rounded-xl border p-4"
          style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
        >
          <h3 className="font-semibold text-white mb-3">🏆 Best Performers</h3>
          <div className="space-y-3">
            {sortedClients.length > 0 && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-400">Highest Profit</span>
                  <span className="text-green-400 font-medium">
                    {sortedClients[0]?.client.name} ({formatCurrency(sortedClients[0]?.profit)})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Best Margin</span>
                  <span className="text-cyan-400 font-medium">
                    {[...sortedClients].sort((a, b) => b.margin - a.margin)[0]?.client.name} ({[...sortedClients].sort((a, b) => b.margin - a.margin)[0]?.margin.toFixed(1)}%)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Most Orders</span>
                  <span className="text-purple-400 font-medium">
                    {[...sortedClients].sort((a, b) => b.orderCount - a.orderCount)[0]?.client.name} ({[...sortedClients].sort((a, b) => b.orderCount - a.orderCount)[0]?.orderCount})
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Needs Attention */}
        <div 
          className="rounded-xl border p-4"
          style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
        >
          <h3 className="font-semibold text-white mb-3">⚠️ Needs Attention</h3>
          <div className="space-y-3">
            {sortedClients.filter(m => m.margin < 20).length > 0 ? (
              sortedClients.filter(m => m.margin < 20).slice(0, 3).map(m => (
                <div key={m.client.id} className="flex justify-between">
                  <span className="text-slate-400">{m.client.name}</span>
                  <span className="text-red-400 font-medium">
                    {m.margin.toFixed(1)}% margin
                  </span>
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-sm">All clients have healthy margins! 🎉</p>
            )}
          </div>
        </div>
      </div>

      {/* Client Details Modal */}
      {selectedClient && (
        <ClientDetailsModal
          metrics={selectedClient}
          onClose={() => setSelectedClient(null)}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
          getMarginColor={getMarginColor}
          getProfitColor={getProfitColor}
          getClientTier={getClientTier}
        />
      )}
    </div>
  );
}

/**
 * ClientDetailsModal - Detailed view of a single client
 */
function ClientDetailsModal({ metrics, onClose, formatCurrency, formatDate, getMarginColor, getProfitColor, getClientTier }) {
  const m = metrics;
  const tier = getClientTier(m.revenue);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border shadow-2xl"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <div className="sticky top-0 px-6 py-4 border-b flex items-center justify-between z-10" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-lg">{m.client.name}</h3>
              <span className={`px-2 py-0.5 rounded text-xs ${tier.bg} ${tier.color}`}>
                {tier.name}
              </span>
            </div>
            {m.client.email && (
              <p className="text-sm text-slate-400">{m.client.email}</p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-slate-800 text-center">
              <p className="text-sm text-slate-500">Revenue</p>
              <p className="text-xl font-bold text-white">{formatCurrency(m.revenue)}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-800 text-center">
              <p className="text-sm text-slate-500">Profit</p>
              <p className={`text-xl font-bold ${getProfitColor(m.profit)}`}>{formatCurrency(m.profit)}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-800 text-center">
              <p className="text-sm text-slate-500">Orders</p>
              <p className="text-xl font-bold text-white">{m.completedOrders}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-800 text-center">
              <p className="text-sm text-slate-500">Margin</p>
              <p className={`text-xl font-bold ${getMarginColor(m.margin)}`}>{m.margin.toFixed(1)}%</p>
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-2">
            <div className="flex justify-between py-2 border-b border-slate-700">
              <span className="text-slate-400">Average Order Value</span>
              <span className="text-white font-medium">{formatCurrency(m.avgOrderValue)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-700">
              <span className="text-slate-400">First Order</span>
              <span className="text-white">{formatDate(m.firstOrder)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-700">
              <span className="text-slate-400">Last Order</span>
              <span className="text-white">{formatDate(m.lastOrder)}</span>
            </div>
            {m.cancelledOrders > 0 && (
              <div className="flex justify-between py-2 border-b border-slate-700">
                <span className="text-slate-400">Cancelled Orders</span>
                <span className="text-red-400">{m.cancelledOrders}</span>
              </div>
            )}
          </div>

          {/* Recent Orders */}
          <div>
            <h4 className="font-semibold text-white mb-3">Recent Orders</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {m.orders.slice(0, 5).map(order => (
                <div 
                  key={order.id}
                  className="p-3 rounded-lg bg-slate-800 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm text-white">{order.id}</p>
                    <p className="text-xs text-slate-500">{formatDate(order.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-white">{formatCurrency(order.total_amount)}</p>
                    <p className={`text-xs ${order.status === 'completed' ? 'text-green-400' : order.status === 'cancelled' ? 'text-red-400' : 'text-yellow-400'}`}>
                      {order.status}
                    </p>
                  </div>
                </div>
              ))}
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

export default ClientProfitability;
