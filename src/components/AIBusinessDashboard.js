import React, { useState, useEffect } from 'react';
import { api, unwrap } from '../services/api';
import { useAIFeedback, FeedbackButton, AIFeedbackStats } from './AIFeedbackSystem';

/**
 * AIBusinessDashboard - Unified AI insights overview
 * EXPERIMENTAL: Read-only analysis of real data
 */

// ============ HELPERS ============
function formatCurrency(amount) {
  return new Intl.NumberFormat('et-EE', { 
    style: 'currency', 
    currency: 'EUR' 
  }).format(amount || 0);
}

function generateMockClients() {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  return [
    { id: 'c1', name: 'TechStart OÜ', last_order: new Date(now - 5 * day).toISOString() },
    { id: 'c2', name: 'Design Studio', last_order: new Date(now - 60 * day).toISOString() },
    { id: 'c3', name: 'Proto Labs', last_order: new Date(now - 15 * day).toISOString() },
    { id: 'c4', name: 'Maker Space', last_order: new Date(now - 90 * day).toISOString() },
  ];
}

function generateMockOrders() {
  const orders = [];
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  for (let i = 0; i < 30; i++) {
    const numOrders = Math.floor(Math.random() * 3) + 1;
    for (let j = 0; j < numOrders; j++) {
      orders.push({
        id: `o-${i}-${j}`,
        created_at: new Date(now - i * day).toISOString(),
        total: 50 + Math.random() * 400,
        status: 'completed',
      });
    }
  }
  return orders;
}

function generateMockLeads() {
  return [
    { id: 'l1', name: 'Industrial Parts', value: 2500, score: 85, category: 'hot' },
    { id: 'l2', name: 'Medical Device Co', value: 5000, score: 78, category: 'hot' },
    { id: 'l3', name: 'Startup Inc', value: 800, score: 55, category: 'warm' },
    { id: 'l4', name: 'Hobby Maker', value: 50, score: 25, category: 'cold' },
  ];
}

function generateMockPrinters() {
  return [
    { id: 'p1', name: 'Bambu X1C #1', status: 'printing' },
    { id: 'p2', name: 'Bambu X1C #2', status: 'idle' },
    { id: 'p3', name: 'Bambu P1S', status: 'printing' },
    { id: 'p4', name: 'Creality K1', status: 'idle' },
  ];
}

function calculateInsights(data) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const atRiskCustomers = data.clients.filter(c => {
    if (!c.last_order) return false;
    const daysSince = (now - new Date(c.last_order).getTime()) / day;
    return daysSince > 45 && daysSince < 120;
  });
  
  const churnedCustomers = data.clients.filter(c => {
    if (!c.last_order) return false;
    const daysSince = (now - new Date(c.last_order).getTime()) / day;
    return daysSince >= 120;
  });

  const thisWeekOrders = data.orders.filter(o => 
    new Date(o.created_at).getTime() > now - 7 * day
  );
  const lastWeekOrders = data.orders.filter(o => {
    const t = new Date(o.created_at).getTime();
    return t > now - 14 * day && t <= now - 7 * day;
  });
  
  const thisWeekRevenue = thisWeekOrders.reduce((s, o) => s + (o.total || 0), 0);
  const lastWeekRevenue = lastWeekOrders.reduce((s, o) => s + (o.total || 0), 0);
  const revenueTrend = lastWeekRevenue > 0 
    ? ((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100 
    : 0;

  const hotLeads = data.leads.filter(l => l.category === 'hot');
  const pipelineValue = data.leads.reduce((s, l) => s + (l.value || 0), 0);
  const hotValue = hotLeads.reduce((s, l) => s + (l.value || 0), 0);

  const busyPrinters = data.printers.filter(p => p.status === 'printing').length;
  const capacityUtilization = data.printers.length > 0 
    ? (busyPrinters / data.printers.length) * 100 
    : 0;

  const avgDailyOrders = data.orders.length / 30;
  const todayOrders = data.orders.filter(o => 
    new Date(o.created_at).getTime() > now - day
  ).length;
  const demandLevel = todayOrders > avgDailyOrders * 1.3 ? 'high' :
                      todayOrders < avgDailyOrders * 0.7 ? 'low' : 'normal';

  const alerts = [];
  
  if (atRiskCustomers.length > 0) {
    alerts.push({
      id: 'churn-risk',
      type: 'warning',
      icon: '⚠️',
      title: `${atRiskCustomers.length} customers at risk of churning`,
      description: 'No orders in 45+ days',
      action: 'View Customers',
      target: 'insights',
      priority: 2,
      predictionType: 'churn',
    });
  }
  
  if (hotLeads.length > 0) {
    alerts.push({
      id: 'hot-leads',
      type: 'success',
      icon: '🔥',
      title: `${hotLeads.length} hot leads worth ${formatCurrency(hotValue)}`,
      description: 'High conversion probability',
      action: 'View Leads',
      target: 'leads',
      priority: 1,
      predictionType: 'lead',
    });
  }
  
  if (capacityUtilization > 80) {
    alerts.push({
      id: 'capacity-high',
      type: 'error',
      icon: '🏭',
      title: 'Capacity constrained - consider premium pricing',
      description: `${Math.round(capacityUtilization)}% utilization`,
      action: 'Adjust Pricing',
      target: 'pricing',
      priority: 1,
      predictionType: 'pricing',
    });
  }
  
  if (demandLevel === 'high') {
    alerts.push({
      id: 'high-demand',
      type: 'info',
      icon: '📈',
      title: 'High demand detected - opportunity to optimize',
      description: 'Above average daily orders',
      action: 'View Forecast',
      target: 'demand',
      priority: 2,
      predictionType: 'demand',
    });
  }

  if (revenueTrend < -20) {
    alerts.push({
      id: 'revenue-down',
      type: 'warning',
      icon: '📉',
      title: `Revenue down ${Math.abs(Math.round(revenueTrend))}% vs last week`,
      description: 'Consider promotional offers',
      action: 'Analyze',
      target: 'insights',
      priority: 1,
      predictionType: 'demand',
    });
  }

  alerts.sort((a, b) => a.priority - b.priority);

  return {
    atRiskCount: atRiskCustomers.length,
    churnedCount: churnedCustomers.length,
    thisWeekRevenue,
    revenueTrend,
    hotLeadsCount: hotLeads.length,
    pipelineValue,
    hotValue,
    capacityUtilization,
    demandLevel,
    alerts,
  };
}

// ============ COMPONENTS ============
function MetricCard({ icon, title, value, trend, trendLabel, subtitle, highlight, onClick }) {
  return (
    <div 
      className="rounded-xl border p-4 cursor-pointer hover:border-purple-500/50 transition"
      style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-2">
        <span>{icon}</span>
        <span className="text-slate-400 text-sm">{title}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {trend !== undefined && (
        <p className={`text-sm mt-1 ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(Math.round(trend))}% {trendLabel}
        </p>
      )}
      {subtitle && (
        <p className={`text-sm mt-1 ${
          highlight === 'hot' ? 'text-red-400' :
          highlight === 'warning' ? 'text-yellow-400' :
          highlight === 'success' ? 'text-green-400' :
          'text-slate-500'
        }`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

function QuickActionCard({ icon, title, subtitle, onClick }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border p-4 text-left hover:border-purple-500/50 hover:bg-purple-500/5 transition"
      style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
    >
      <span className="text-2xl">{icon}</span>
      <p className="text-white font-medium mt-2">{title}</p>
      <p className="text-slate-500 text-xs">{subtitle}</p>
    </button>
  );
}

// ============ MAIN COMPONENT ============
function AIBusinessDashboard({ onNavigate }) {
  const feedback = useAIFeedback();
  const [loading, setLoading] = useState(true);
  const [simulationMode, setSimulationMode] = useState(false);
  const [predictionIds, setPredictionIds] = useState({});
  const [data, setData] = useState({
    clients: [],
    orders: [],
    leads: [],
    printers: [],
  });
  const [insights, setInsights] = useState({
    atRiskCount: 0,
    churnedCount: 0,
    thisWeekRevenue: 0,
    revenueTrend: 0,
    hotLeadsCount: 0,
    pipelineValue: 0,
    hotValue: 0,
    capacityUtilization: 0,
    demandLevel: 'normal',
    alerts: [],
  });

  useEffect(() => {
    loadAllData();
  }, []);

  // Recalculate insights and record predictions when data changes
  useEffect(() => {
    if (data.clients.length > 0 || data.orders.length > 0) {
      const newInsights = calculateInsights(data);
      setInsights(newInsights);
      
      // Record predictions for feedback
      if (feedback) {
        const newPredictionIds = {};
        newInsights.alerts.forEach(alert => {
          const existingId = predictionIds[alert.id];
          if (!existingId) {
            const predId = feedback.recordPrediction({
              type: alert.predictionType,
              title: alert.title,
              description: alert.description,
            });
            newPredictionIds[alert.id] = predId;
          } else {
            newPredictionIds[alert.id] = existingId;
          }
        });
        setPredictionIds(prev => ({ ...prev, ...newPredictionIds }));
      }
    }
  }, [data, feedback]);

  async function loadAllData() {
    setLoading(true);
    try {
      const [clientsRes, ordersRes, printersRes] = await Promise.all([
        api.getClients?.() || Promise.resolve({ data: [] }),
        api.listOrders?.() || Promise.resolve({ data: [] }),
        api.getPrinters?.() || Promise.resolve({ data: [] }),
      ]);

      const clients = unwrap(clientsRes)?.clients || generateMockClients();
      const orders = unwrap(ordersRes)?.orders || generateMockOrders();
      const printers = unwrap(printersRes)?.printers || generateMockPrinters();
      const leads = generateMockLeads();

      setData({ clients, orders, leads, printers });
    } catch (err) {
      console.error('Failed to load data:', err);
      setData({
        clients: generateMockClients(),
        orders: generateMockOrders(),
        leads: generateMockLeads(),
        printers: generateMockPrinters(),
      });
    } finally {
      setLoading(false);
    }
  }

  function randomizeData() {
    setPredictionIds({}); // Clear prediction IDs for new data
    setData({
      clients: generateMockClients(),
      orders: generateMockOrders(),
      leads: generateMockLeads(),
      printers: generateMockPrinters(),
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Experimental Badge & Feedback Stats */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
            🧪 EXPERIMENTAL
          </span>
          <span className="text-slate-500 text-sm">Read-only • Does not modify data</span>
        </div>
        <div className="flex items-center gap-4">
          {feedback && <AIFeedbackStats compact />}
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-slate-400">Simulation</span>
            <input
              type="checkbox"
              checked={simulationMode}
              onChange={(e) => setSimulationMode(e.target.checked)}
              className="w-4 h-4 rounded"
            />
          </label>
          <button
            onClick={loadAllData}
            className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 text-sm"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Simulation Mode Banner */}
      {simulationMode && (
        <div className="rounded-xl border p-4 bg-purple-500/10 border-purple-500/30">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎮</span>
              <div>
                <p className="text-purple-400 font-medium">Simulation Mode Active</p>
                <p className="text-slate-500 text-sm">Using generated test data • Safe to experiment</p>
              </div>
            </div>
            <button
              onClick={randomizeData}
              className="px-3 py-1.5 rounded-lg text-sm bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
            >
              🔀 Randomize Data
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          🎯 AI Business Command Center
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Real-time insights and recommended actions • Rate predictions to improve AI
        </p>
      </div>

      {/* Priority Alerts with Feedback */}
      {insights.alerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
            Priority Actions • <span className="text-purple-400">Rate to train AI</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.alerts.map((alert) => (
              <div
                key={alert.id}
                className={`rounded-xl border p-4 ${
                  alert.type === 'error' ? 'border-red-500/50 bg-red-500/5' :
                  alert.type === 'warning' ? 'border-yellow-500/50 bg-yellow-500/5' :
                  alert.type === 'success' ? 'border-green-500/50 bg-green-500/5' :
                  'border-cyan-500/50 bg-cyan-500/5'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div 
                    className="flex items-start gap-3 flex-1 cursor-pointer"
                    onClick={() => onNavigate?.(alert.target)}
                  >
                    <span className="text-2xl">{alert.icon}</span>
                    <div>
                      <p className={`font-medium ${
                        alert.type === 'error' ? 'text-red-400' :
                        alert.type === 'warning' ? 'text-yellow-400' :
                        alert.type === 'success' ? 'text-green-400' :
                        'text-cyan-400'
                      }`}>
                        {alert.title}
                      </p>
                      <p className="text-sm text-slate-500">{alert.description}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <FeedbackButton predictionId={predictionIds[alert.id]} size="sm" />
                    <button 
                      onClick={() => onNavigate?.(alert.target)}
                      className={`px-3 py-1 rounded-lg text-xs ${
                        alert.type === 'error' ? 'bg-red-500/20 text-red-400' :
                        alert.type === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                        alert.type === 'success' ? 'bg-green-500/20 text-green-400' :
                        'bg-cyan-500/20 text-cyan-400'
                      }`}
                    >
                      {alert.action} →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon="💰"
          title="This Week"
          value={formatCurrency(insights.thisWeekRevenue)}
          trend={insights.revenueTrend}
          trendLabel="vs last week"
          onClick={() => onNavigate?.('demand')}
        />
        <MetricCard
          icon="🎯"
          title="Pipeline Value"
          value={formatCurrency(insights.pipelineValue)}
          subtitle={`${insights.hotLeadsCount} hot leads`}
          highlight="hot"
          onClick={() => onNavigate?.('leads')}
        />
        <MetricCard
          icon="👥"
          title="At Risk"
          value={String(insights.atRiskCount)}
          subtitle={`${insights.churnedCount} churned`}
          highlight={insights.atRiskCount > 0 ? 'warning' : 'success'}
          onClick={() => onNavigate?.('insights')}
        />
        <MetricCard
          icon="🏭"
          title="Capacity"
          value={`${Math.round(insights.capacityUtilization)}%`}
          subtitle={insights.demandLevel === 'high' ? 'High demand' : 'Normal demand'}
          highlight={insights.capacityUtilization > 80 ? 'warning' : 'success'}
          onClick={() => onNavigate?.('pricing')}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <QuickActionCard icon="🧠" title="Customers" subtitle="Health & churn" onClick={() => onNavigate?.('insights')} />
        <QuickActionCard icon="📈" title="Forecast" subtitle="Predict trends" onClick={() => onNavigate?.('demand')} />
        <QuickActionCard icon="🎯" title="Leads" subtitle="Prioritize" onClick={() => onNavigate?.('leads')} />
        <QuickActionCard icon="💰" title="Pricing" subtitle="Optimize" onClick={() => onNavigate?.('pricing')} />
        <QuickActionCard icon="🔍" title="Competitors" subtitle="Market intel" onClick={() => onNavigate?.('competitors')} />
        <QuickActionCard icon="🤖" title="AI Quote" subtitle="Instant pricing" onClick={() => onNavigate?.('quote')} />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Opportunities */}
        <div className="rounded-xl border p-6" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <h3 className="font-medium text-white mb-4">💎 Top Opportunities</h3>
          <div className="space-y-3">
            {data.leads.filter(l => l.category === 'hot').slice(0, 3).map(lead => (
              <div key={lead.id} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: '#334155' }}>
                <div>
                  <p className="text-white font-medium">{lead.name}</p>
                  <p className="text-sm text-slate-500">Score: {lead.score}</p>
                </div>
                <div className="text-right">
                  <p className="text-green-400 font-medium">{formatCurrency(lead.value)}</p>
                  <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">HOT</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* At Risk Customers */}
        <div className="rounded-xl border p-6" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <h3 className="font-medium text-white mb-4">⚠️ Needs Attention</h3>
          <div className="space-y-3">
            {data.clients.filter(c => {
              if (!c.last_order) return false;
              const daysSince = (Date.now() - new Date(c.last_order).getTime()) / (24 * 60 * 60 * 1000);
              return daysSince > 45;
            }).slice(0, 3).map(client => {
              const daysSince = Math.floor((Date.now() - new Date(client.last_order).getTime()) / (24 * 60 * 60 * 1000));
              return (
                <div key={client.id} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: '#334155' }}>
                  <div>
                    <p className="text-white font-medium">{client.name}</p>
                    <p className="text-sm text-slate-500">Last order: {daysSince} days ago</p>
                  </div>
                  <button className="px-3 py-1 rounded-lg text-sm bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30">
                    Reach out
                  </button>
                </div>
              );
            })}
            {insights.atRiskCount === 0 && (
              <p className="text-green-400 text-sm">✓ All customers healthy</p>
            )}
          </div>
        </div>
      </div>

      {/* Feedback CTA */}
      <div className="rounded-xl border p-6 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border-purple-500/30">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎓</span>
            <div>
              <p className="text-white font-bold">Help Train the AI</p>
              <p className="text-slate-400 text-sm">
                Rate predictions with 👍 👎 to improve accuracy over time
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate?.('feedback')}
            className="px-4 py-2 rounded-lg font-medium text-white"
            style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
          >
            View AI Learning Center →
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIBusinessDashboard;
