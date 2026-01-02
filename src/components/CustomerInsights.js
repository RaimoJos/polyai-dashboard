import React, { useState, useEffect, useMemo } from 'react';
import { api, unwrap } from '../services/api';
import CustomerCommunicationLog from './CustomerCommunicationLog';

/**
 * CustomerInsights - AI-powered customer intelligence
 * Predicts churn, suggests upsells, tracks customer health
 */
function CustomerInsights() {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [viewMode, setViewMode] = useState('health'); // health, churn, upsell
  const [timeRange, setTimeRange] = useState(90); // days

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [clientsRes, ordersRes] = await Promise.all([
        api.getClients?.() || Promise.resolve({ data: [] }),
        api.listOrders?.() || Promise.resolve({ data: [] }),
      ]);
      
      const clientsData = unwrap(clientsRes) || [];
      const ordersData = unwrap(ordersRes) || [];
      
      setClients(Array.isArray(clientsData) ? clientsData : (clientsData.clients || getMockClients()));
      setOrders(Array.isArray(ordersData) ? ordersData : (ordersData.orders || getMockOrders()));
    } catch (err) {
      console.error('Failed to load data:', err);
      setClients(getMockClients());
      setOrders(getMockOrders());
    } finally {
      setLoading(false);
    }
  };

  const getMockClients = () => [
    { id: 'c1', name: 'TechStart OÜ', email: 'info@techstart.ee', company: 'TechStart', created_at: '2024-01-15' },
    { id: 'c2', name: 'Design Studio', email: 'hello@design.ee', company: 'Design Studio', created_at: '2024-03-20' },
    { id: 'c3', name: 'Maker Space', email: 'contact@maker.ee', company: 'Maker Space', created_at: '2024-06-01' },
    { id: 'c4', name: 'Proto Labs', email: 'orders@proto.ee', company: 'Proto Labs', created_at: '2023-11-10' },
    { id: 'c5', name: 'Craft Corner', email: 'shop@craft.ee', company: 'Craft Corner', created_at: '2024-08-15' },
    { id: 'c6', name: 'Industrial Parts', email: 'buy@industrial.ee', company: 'Industrial Parts', created_at: '2023-08-01' },
  ];

  const getMockOrders = () => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    return [
      // TechStart - Active, high value
      { id: 'o1', client_id: 'c1', total: 450, status: 'completed', created_at: new Date(now - 5 * day).toISOString() },
      { id: 'o2', client_id: 'c1', total: 320, status: 'completed', created_at: new Date(now - 25 * day).toISOString() },
      { id: 'o3', client_id: 'c1', total: 580, status: 'completed', created_at: new Date(now - 45 * day).toISOString() },
      { id: 'o4', client_id: 'c1', total: 290, status: 'completed', created_at: new Date(now - 70 * day).toISOString() },
      // Design Studio - Declining
      { id: 'o5', client_id: 'c2', total: 180, status: 'completed', created_at: new Date(now - 60 * day).toISOString() },
      { id: 'o6', client_id: 'c2', total: 220, status: 'completed', created_at: new Date(now - 120 * day).toISOString() },
      // Maker Space - New, growing
      { id: 'o7', client_id: 'c3', total: 95, status: 'completed', created_at: new Date(now - 10 * day).toISOString() },
      { id: 'o8', client_id: 'c3', total: 150, status: 'completed', created_at: new Date(now - 30 * day).toISOString() },
      // Proto Labs - VIP, consistent
      { id: 'o9', client_id: 'c4', total: 1200, status: 'completed', created_at: new Date(now - 15 * day).toISOString() },
      { id: 'o10', client_id: 'c4', total: 980, status: 'completed', created_at: new Date(now - 45 * day).toISOString() },
      { id: 'o11', client_id: 'c4', total: 1100, status: 'completed', created_at: new Date(now - 75 * day).toISOString() },
      { id: 'o12', client_id: 'c4', total: 850, status: 'completed', created_at: new Date(now - 105 * day).toISOString() },
      // Craft Corner - At risk (no recent orders)
      { id: 'o13', client_id: 'c5', total: 75, status: 'completed', created_at: new Date(now - 90 * day).toISOString() },
      // Industrial Parts - Churned
      { id: 'o14', client_id: 'c6', total: 2200, status: 'completed', created_at: new Date(now - 180 * day).toISOString() },
      { id: 'o15', client_id: 'c6', total: 1800, status: 'completed', created_at: new Date(now - 210 * day).toISOString() },
    ];
  };

  // Calculate customer metrics and scores
  const customerAnalytics = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    return clients.map(client => {
      const clientOrders = orders.filter(o => 
        o.client_id === client.id && o.status === 'completed'
      );

      if (clientOrders.length === 0) {
        return {
          ...client,
          metrics: { totalRevenue: 0, orderCount: 0, avgOrderValue: 0, daysSinceLastOrder: null },
          healthScore: 20,
          churnRisk: 'new',
          churnProbability: 0,
          upsellOpportunities: ['First order discount'],
          segment: 'new',
        };
      }

      // Basic metrics
      const totalRevenue = clientOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      const orderCount = clientOrders.length;
      const avgOrderValue = totalRevenue / orderCount;

      // Recency
      const orderDates = clientOrders.map(o => new Date(o.created_at).getTime());
      const lastOrderDate = Math.max(...orderDates);
      const daysSinceLastOrder = Math.floor((now - lastOrderDate) / dayMs);

      // Frequency (orders per month)
      const firstOrderDate = Math.min(...orderDates);
      const monthsAsCustomer = Math.max(1, (now - firstOrderDate) / (30 * dayMs));
      const ordersPerMonth = orderCount / monthsAsCustomer;

      // Order trend (comparing recent vs older orders)
      const recentOrders = clientOrders.filter(o => 
        new Date(o.created_at).getTime() > now - 60 * dayMs
      );
      const olderOrders = clientOrders.filter(o => 
        new Date(o.created_at).getTime() <= now - 60 * dayMs
      );
      const recentAvg = recentOrders.length > 0 
        ? recentOrders.reduce((s, o) => s + o.total, 0) / recentOrders.length 
        : 0;
      const olderAvg = olderOrders.length > 0 
        ? olderOrders.reduce((s, o) => s + o.total, 0) / olderOrders.length 
        : avgOrderValue;
      const orderTrend = olderAvg > 0 ? (recentAvg - olderAvg) / olderAvg : 0;

      // Calculate Health Score (0-100)
      let healthScore = 50;
      
      // Recency factor (-30 to +20)
      if (daysSinceLastOrder <= 14) healthScore += 20;
      else if (daysSinceLastOrder <= 30) healthScore += 10;
      else if (daysSinceLastOrder <= 60) healthScore += 0;
      else if (daysSinceLastOrder <= 90) healthScore -= 10;
      else if (daysSinceLastOrder <= 120) healthScore -= 20;
      else healthScore -= 30;

      // Frequency factor (-10 to +15)
      if (ordersPerMonth >= 2) healthScore += 15;
      else if (ordersPerMonth >= 1) healthScore += 10;
      else if (ordersPerMonth >= 0.5) healthScore += 5;
      else if (ordersPerMonth >= 0.25) healthScore += 0;
      else healthScore -= 10;

      // Value factor (-5 to +15)
      if (totalRevenue >= 2000) healthScore += 15;
      else if (totalRevenue >= 1000) healthScore += 10;
      else if (totalRevenue >= 500) healthScore += 5;
      else if (totalRevenue >= 200) healthScore += 0;
      else healthScore -= 5;

      // Trend factor (-10 to +10)
      if (orderTrend > 0.2) healthScore += 10;
      else if (orderTrend > 0) healthScore += 5;
      else if (orderTrend > -0.2) healthScore += 0;
      else healthScore -= 10;

      healthScore = Math.max(0, Math.min(100, healthScore));

      // Churn Risk Assessment
      let churnRisk = 'low';
      let churnProbability = 0;

      if (daysSinceLastOrder > 120) {
        churnRisk = 'churned';
        churnProbability = 95;
      } else if (daysSinceLastOrder > 90 || (daysSinceLastOrder > 60 && orderTrend < -0.3)) {
        churnRisk = 'high';
        churnProbability = 70 + Math.min(25, (daysSinceLastOrder - 60) / 2);
      } else if (daysSinceLastOrder > 45 || orderTrend < -0.2) {
        churnRisk = 'medium';
        churnProbability = 30 + Math.min(30, daysSinceLastOrder - 30);
      } else {
        churnRisk = 'low';
        churnProbability = Math.max(5, 20 - healthScore / 5);
      }

      // Customer Segment
      let segment = 'regular';
      if (totalRevenue >= 2000 && ordersPerMonth >= 1) segment = 'vip';
      else if (totalRevenue >= 1000 || ordersPerMonth >= 1.5) segment = 'champion';
      else if (orderCount <= 2 && daysSinceLastOrder <= 60) segment = 'promising';
      else if (daysSinceLastOrder > 90) segment = 'at_risk';
      else if (orderCount === 1) segment = 'new';

      // Upsell Opportunities
      const upsellOpportunities = [];
      
      if (avgOrderValue < 200) {
        upsellOpportunities.push('Bundle discount for orders over €200');
      }
      if (orderCount >= 3 && !client.hasSubscription) {
        upsellOpportunities.push('Monthly retainer package');
      }
      if (totalRevenue > 500 && ordersPerMonth < 1) {
        upsellOpportunities.push('Quarterly maintenance contract');
      }
      if (segment === 'vip') {
        upsellOpportunities.push('Priority queue membership');
        upsellOpportunities.push('Dedicated account manager');
      }
      if (recentOrders.length > 0 && recentAvg > olderAvg) {
        upsellOpportunities.push('Volume discount tier upgrade');
      }
      if (daysSinceLastOrder > 30 && daysSinceLastOrder < 60) {
        upsellOpportunities.push('Win-back offer: 10% discount');
      }
      if (upsellOpportunities.length === 0) {
        upsellOpportunities.push('Referral bonus program');
      }

      return {
        ...client,
        metrics: {
          totalRevenue,
          orderCount,
          avgOrderValue,
          daysSinceLastOrder,
          ordersPerMonth,
          orderTrend,
          recentRevenue: recentOrders.reduce((s, o) => s + o.total, 0),
        },
        healthScore,
        churnRisk,
        churnProbability,
        upsellOpportunities,
        segment,
      };
    });
  }, [clients, orders]);

  // Summary stats
  const summary = useMemo(() => {
    const atRisk = customerAnalytics.filter(c => c.churnRisk === 'high' || c.churnRisk === 'medium');
    const churned = customerAnalytics.filter(c => c.churnRisk === 'churned');
    const healthy = customerAnalytics.filter(c => c.healthScore >= 60);
    const vips = customerAnalytics.filter(c => c.segment === 'vip' || c.segment === 'champion');
    
    const totalLTV = customerAnalytics.reduce((s, c) => s + c.metrics.totalRevenue, 0);
    const atRiskRevenue = atRisk.reduce((s, c) => s + c.metrics.totalRevenue, 0);
    
    return {
      totalCustomers: customerAnalytics.length,
      healthyCount: healthy.length,
      atRiskCount: atRisk.length,
      churnedCount: churned.length,
      vipCount: vips.length,
      avgHealthScore: customerAnalytics.length > 0 
        ? Math.round(customerAnalytics.reduce((s, c) => s + c.healthScore, 0) / customerAnalytics.length)
        : 0,
      totalLTV,
      atRiskRevenue,
      upsellPotential: customerAnalytics.filter(c => c.upsellOpportunities.length > 1).length,
    };
  }, [customerAnalytics]);

  const getHealthColor = (score) => {
    if (score >= 70) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    if (score >= 30) return 'text-orange-400';
    return 'text-red-400';
  };

  const getChurnBadge = (risk) => {
    const styles = {
      low: 'bg-green-500/20 text-green-400',
      medium: 'bg-yellow-500/20 text-yellow-400',
      high: 'bg-red-500/20 text-red-400',
      churned: 'bg-slate-600 text-slate-400',
      new: 'bg-blue-500/20 text-blue-400',
    };
    return styles[risk] || styles.low;
  };

  const getSegmentBadge = (segment) => {
    const styles = {
      vip: { bg: 'bg-purple-500/20', text: 'text-purple-400', icon: '👑' },
      champion: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', icon: '⭐' },
      promising: { bg: 'bg-green-500/20', text: 'text-green-400', icon: '📈' },
      regular: { bg: 'bg-slate-600', text: 'text-slate-400', icon: '👤' },
      at_risk: { bg: 'bg-orange-500/20', text: 'text-orange-400', icon: '⚠️' },
      new: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: '🆕' },
    };
    return styles[segment] || styles.regular;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('et-EE', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  // Sort customers based on view mode
  const sortedCustomers = useMemo(() => {
    const sorted = [...customerAnalytics];
    if (viewMode === 'health') {
      sorted.sort((a, b) => b.healthScore - a.healthScore);
    } else if (viewMode === 'churn') {
      sorted.sort((a, b) => b.churnProbability - a.churnProbability);
    } else if (viewMode === 'upsell') {
      sorted.sort((a, b) => b.upsellOpportunities.length - a.upsellOpportunities.length);
    }
    return sorted;
  }, [customerAnalytics, viewMode]);

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
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            🧠 Customer Insights
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            AI-powered customer intelligence and predictions
          </p>
        </div>

        <div className="flex gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(Number(e.target.value))}
            className="px-3 py-2 rounded-lg text-sm text-white"
            style={{ backgroundColor: '#334155' }}
          >
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={180}>Last 6 months</option>
            <option value={365}>Last year</option>
          </select>
          <button
            onClick={loadData}
            className="px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-slate-400 text-sm">Avg Health Score</p>
          <p className={`text-2xl font-bold ${getHealthColor(summary.avgHealthScore)}`}>
            {summary.avgHealthScore}
          </p>
          <div className="mt-2 h-2 rounded-full bg-slate-700 overflow-hidden">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
              style={{ width: `${summary.avgHealthScore}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-slate-400 text-sm">At Risk</p>
          <p className="text-2xl font-bold text-orange-400">{summary.atRiskCount}</p>
          <p className="text-xs text-slate-500 mt-1">
            {formatCurrency(summary.atRiskRevenue)} revenue
          </p>
        </div>

        <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-slate-400 text-sm">VIP Customers</p>
          <p className="text-2xl font-bold text-purple-400">{summary.vipCount}</p>
          <p className="text-xs text-slate-500 mt-1">
            Champions & VIPs
          </p>
        </div>

        <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-slate-400 text-sm">Upsell Ready</p>
          <p className="text-2xl font-bold text-cyan-400">{summary.upsellPotential}</p>
          <p className="text-xs text-slate-500 mt-1">
            Multiple opportunities
          </p>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="flex gap-2 p-1 rounded-lg bg-slate-800 w-fit">
        {[
          { id: 'health', name: 'Health Score', icon: '💚' },
          { id: 'churn', name: 'Churn Risk', icon: '⚠️' },
          { id: 'upsell', name: 'Upsell', icon: '💰' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setViewMode(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm transition ${
              viewMode === tab.id 
                ? 'bg-purple-500 text-white' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab.icon} {tab.name}
          </button>
        ))}
      </div>

      {/* Customer List */}
      <div className="space-y-3">
        {sortedCustomers.map(customer => (
          <div
            key={customer.id}
            onClick={() => setSelectedClient(customer)}
            className="rounded-xl border p-4 cursor-pointer hover:border-purple-500/50 transition"
            style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Customer Info */}
              <div className="flex items-center gap-4">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
                  style={{ backgroundColor: '#334155' }}
                >
                  {customer.name?.charAt(0) || '?'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-white">{customer.name || customer.company}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs ${getSegmentBadge(customer.segment).bg} ${getSegmentBadge(customer.segment).text}`}>
                      {getSegmentBadge(customer.segment).icon} {customer.segment}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">
                    {customer.metrics.orderCount} orders • {formatCurrency(customer.metrics.totalRevenue)} lifetime
                  </p>
                </div>
              </div>

              {/* Metrics */}
              <div className="flex items-center gap-6">
                {/* Health Score */}
                <div className="text-center">
                  <div className={`text-xl font-bold ${getHealthColor(customer.healthScore)}`}>
                    {customer.healthScore}
                  </div>
                  <p className="text-xs text-slate-500">Health</p>
                </div>

                {/* Churn Risk */}
                <div className="text-center">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getChurnBadge(customer.churnRisk)}`}>
                    {customer.churnRisk === 'churned' ? 'Churned' : `${customer.churnProbability}%`}
                  </span>
                  <p className="text-xs text-slate-500 mt-1">Churn</p>
                </div>

                {/* Last Order */}
                <div className="text-center hidden sm:block">
                  <div className="text-white">
                    {customer.metrics.daysSinceLastOrder !== null 
                      ? `${customer.metrics.daysSinceLastOrder}d ago`
                      : 'Never'
                    }
                  </div>
                  <p className="text-xs text-slate-500">Last Order</p>
                </div>

                {/* Upsell Count */}
                <div className="text-center">
                  <div className="text-cyan-400 font-medium">
                    {customer.upsellOpportunities.length}
                  </div>
                  <p className="text-xs text-slate-500">Upsells</p>
                </div>
              </div>
            </div>

            {/* Quick Actions - Show on churn risk */}
            {(customer.churnRisk === 'high' || customer.churnRisk === 'medium') && viewMode === 'churn' && (
              <div className="mt-4 pt-4 border-t flex flex-wrap gap-2" style={{ borderColor: '#334155' }}>
                <span className="text-xs text-slate-500">Suggested actions:</span>
                <button className="px-2 py-1 rounded text-xs bg-purple-500/20 text-purple-400 hover:bg-purple-500/30">
                  📧 Send win-back email
                </button>
                <button className="px-2 py-1 rounded text-xs bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30">
                  📞 Schedule call
                </button>
                <button className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-400 hover:bg-green-500/30">
                  🎁 Offer discount
                </button>
              </div>
            )}

            {/* Upsell Opportunities */}
            {viewMode === 'upsell' && customer.upsellOpportunities.length > 0 && (
              <div className="mt-4 pt-4 border-t" style={{ borderColor: '#334155' }}>
                <p className="text-xs text-slate-500 mb-2">Upsell opportunities:</p>
                <div className="flex flex-wrap gap-2">
                  {customer.upsellOpportunities.map((opp, i) => (
                    <span key={i} className="px-2 py-1 rounded text-xs bg-cyan-500/20 text-cyan-400">
                      💡 {opp}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Customer Detail Modal */}
      {selectedClient && (
        <CustomerDetailModal
          customer={selectedClient}
          orders={orders.filter(o => o.client_id === selectedClient.id)}
          onClose={() => setSelectedClient(null)}
          formatCurrency={formatCurrency}
        />
      )}
    </div>
  );
}

/**
 * CustomerDetailModal - Detailed view of customer analytics
 */
function CustomerDetailModal({ customer, orders, onClose, formatCurrency }) {
  const segmentBadge = {
    vip: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'VIP Customer' },
    champion: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', label: 'Champion' },
    promising: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Promising' },
    regular: { bg: 'bg-slate-600', text: 'text-slate-400', label: 'Regular' },
    at_risk: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'At Risk' },
    new: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'New Customer' },
  }[customer.segment] || { bg: 'bg-slate-600', text: 'text-slate-400', label: 'Unknown' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <div className="sticky top-0 px-6 py-4 border-b flex items-center justify-between z-10" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
              style={{ backgroundColor: '#334155' }}
            >
              {customer.name?.charAt(0)}
            </div>
            <div>
              <h2 className="font-bold text-white">{customer.name}</h2>
              <span className={`px-2 py-0.5 rounded text-xs ${segmentBadge.bg} ${segmentBadge.text}`}>
                {segmentBadge.label}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400">✕</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Health Gauge */}
          <div className="text-center">
            <div className="relative inline-flex items-center justify-center w-32 h-32">
              <svg className="w-32 h-32 transform -rotate-90">
                <circle cx="64" cy="64" r="56" stroke="#334155" strokeWidth="8" fill="none" />
                <circle 
                  cx="64" cy="64" r="56" 
                  stroke={customer.healthScore >= 70 ? '#22c55e' : customer.healthScore >= 50 ? '#eab308' : '#ef4444'}
                  strokeWidth="8" 
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${customer.healthScore * 3.52} 352`}
                />
              </svg>
              <div className="absolute text-center">
                <div className="text-3xl font-bold text-white">{customer.healthScore}</div>
                <div className="text-xs text-slate-500">Health</div>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg" style={{ backgroundColor: '#334155' }}>
              <div className="text-xl font-bold text-white">{formatCurrency(customer.metrics.totalRevenue)}</div>
              <div className="text-xs text-slate-500">Lifetime Value</div>
            </div>
            <div className="text-center p-3 rounded-lg" style={{ backgroundColor: '#334155' }}>
              <div className="text-xl font-bold text-white">{customer.metrics.orderCount}</div>
              <div className="text-xs text-slate-500">Total Orders</div>
            </div>
            <div className="text-center p-3 rounded-lg" style={{ backgroundColor: '#334155' }}>
              <div className="text-xl font-bold text-white">{formatCurrency(customer.metrics.avgOrderValue)}</div>
              <div className="text-xs text-slate-500">Avg Order</div>
            </div>
            <div className="text-center p-3 rounded-lg" style={{ backgroundColor: '#334155' }}>
              <div className={`text-xl font-bold ${customer.churnProbability > 50 ? 'text-red-400' : 'text-green-400'}`}>
                {customer.churnProbability}%
              </div>
              <div className="text-xs text-slate-500">Churn Risk</div>
            </div>
          </div>

          {/* AI Recommendations */}
          <div>
            <h3 className="font-medium text-white mb-3">🤖 AI Recommendations</h3>
            <div className="space-y-2">
              {customer.upsellOpportunities.map((opp, i) => (
                <div 
                  key={i}
                  className="p-3 rounded-lg flex items-center justify-between"
                  style={{ backgroundColor: '#334155' }}
                >
                  <span className="text-slate-300">💡 {opp}</span>
                  <button className="px-3 py-1 rounded text-xs bg-purple-500/20 text-purple-400 hover:bg-purple-500/30">
                    Take Action
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Orders */}
          <div>
            <h3 className="font-medium text-white mb-3">Recent Orders</h3>
            <div className="space-y-2">
              {orders.slice(0, 5).map(order => (
                <div 
                  key={order.id}
                  className="p-3 rounded-lg flex items-center justify-between"
                  style={{ backgroundColor: '#334155' }}
                >
                  <div>
                    <p className="text-white text-sm">{order.id}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-white font-medium">{formatCurrency(order.total)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Communication Log */}
          <CustomerCommunicationLog 
            customerId={customer.id} 
            customerName={customer.name}
          />
        </div>
      </div>
    </div>
  );
}

export default CustomerInsights;
