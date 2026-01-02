import React, { useState, useEffect, useMemo } from 'react';
import { api, unwrap } from '../services/api';

/**
 * SmartBusinessAlerts - AI-generated proactive business notifications
 * Monitors all data sources and surfaces important insights
 */
function SmartBusinessAlerts({ onNavigate, compact = false }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState([]);

  useEffect(() => {
    loadAlerts();
    // Refresh every 5 minutes
    const interval = setInterval(loadAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Load dismissed alerts
    const saved = localStorage.getItem('polywerk_dismissed_alerts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Only keep dismissals from last 24 hours
        const recent = parsed.filter(d => Date.now() - d.timestamp < 24 * 60 * 60 * 1000);
        setDismissed(recent.map(d => d.id));
      } catch (e) {
        console.error('Failed to load dismissed alerts:', e);
      }
    }
  }, []);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const [clientsRes, ordersRes, printersRes, materialsRes] = await Promise.all([
        api.getClients?.() || Promise.resolve({ data: [] }),
        api.listOrders?.() || Promise.resolve({ data: [] }),
        api.getPrinters?.() || Promise.resolve({ data: [] }),
        api.getMaterials?.() || Promise.resolve({ data: [] }),
      ]);

      const clients = unwrap(clientsRes)?.clients || [];
      const orders = unwrap(ordersRes)?.orders || getMockOrders();
      const printers = unwrap(printersRes)?.printers || getMockPrinters();
      const materials = unwrap(materialsRes)?.materials || getMockMaterials();

      // Generate alerts
      const generatedAlerts = generateAlerts(clients, orders, printers, materials);
      setAlerts(generatedAlerts);
    } catch (err) {
      console.error('Failed to load data for alerts:', err);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const getMockOrders = () => {
    const orders = [];
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    for (let i = 0; i < 14; i++) {
      const numOrders = Math.floor(Math.random() * 3) + 1;
      for (let j = 0; j < numOrders; j++) {
        orders.push({
          id: `o-${i}-${j}`,
          created_at: new Date(now - i * day).toISOString(),
          total: 50 + Math.random() * 400,
          status: i < 3 ? ['pending', 'in_progress', 'completed'][Math.floor(Math.random() * 3)] : 'completed',
          client_id: `c${Math.floor(Math.random() * 5) + 1}`,
        });
      }
    }
    return orders;
  };

  const getMockPrinters = () => [
    { id: 'p1', name: 'Bambu X1C #1', status: 'printing' },
    { id: 'p2', name: 'Bambu X1C #2', status: 'idle' },
    { id: 'p3', name: 'Bambu P1S', status: 'printing' },
    { id: 'p4', name: 'Creality K1', status: 'error' },
  ];

  const getMockMaterials = () => [
    { id: 'm1', name: 'PLA Black', stock_g: 200, reorder_point: 500 },
    { id: 'm2', name: 'PETG Clear', stock_g: 1500, reorder_point: 500 },
    { id: 'm3', name: 'ABS Gray', stock_g: 100, reorder_point: 300 },
  ];

  const generateAlerts = (clients, orders, printers, materials) => {
    const alerts = [];
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    // 1. Printer Errors
    const errorPrinters = printers.filter(p => p.status === 'error');
    if (errorPrinters.length > 0) {
      alerts.push({
        id: `printer-error-${errorPrinters.map(p => p.id).join('-')}`,
        type: 'error',
        category: 'printers',
        icon: '🔴',
        title: `${errorPrinters.length} printer${errorPrinters.length > 1 ? 's' : ''} need${errorPrinters.length === 1 ? 's' : ''} attention`,
        description: errorPrinters.map(p => p.name).join(', '),
        action: 'View Printers',
        target: 'printers',
        priority: 1,
        timestamp: now,
      });
    }

    // 2. Low Material Stock
    const lowMaterials = materials.filter(m => m.stock_g < (m.reorder_point || 500));
    if (lowMaterials.length > 0) {
      const critical = lowMaterials.filter(m => m.stock_g < 200);
      alerts.push({
        id: `material-low-${lowMaterials.map(m => m.id).join('-')}`,
        type: critical.length > 0 ? 'error' : 'warning',
        category: 'inventory',
        icon: '📦',
        title: `${lowMaterials.length} material${lowMaterials.length > 1 ? 's' : ''} running low`,
        description: lowMaterials.map(m => `${m.name}: ${m.stock_g}g`).join(', '),
        action: 'View Inventory',
        target: 'inventory',
        priority: critical.length > 0 ? 1 : 2,
        timestamp: now,
      });
    }

    // 3. Pending Orders (waiting > 24h)
    const pendingOrders = orders.filter(o => 
      o.status === 'pending' && 
      new Date(o.created_at).getTime() < now - day
    );
    if (pendingOrders.length > 0) {
      alerts.push({
        id: `pending-orders-${pendingOrders.length}`,
        type: 'warning',
        category: 'orders',
        icon: '⏳',
        title: `${pendingOrders.length} order${pendingOrders.length > 1 ? 's' : ''} waiting > 24h`,
        description: 'Review and start production',
        action: 'View Orders',
        target: 'orders',
        priority: 2,
        timestamp: now,
      });
    }

    // 4. High Capacity (>80%)
    const busyPrinters = printers.filter(p => p.status === 'printing').length;
    const capacity = printers.length > 0 ? (busyPrinters / printers.length) * 100 : 0;
    if (capacity > 80) {
      alerts.push({
        id: 'high-capacity',
        type: 'info',
        category: 'capacity',
        icon: '🏭',
        title: 'Capacity at ' + Math.round(capacity) + '%',
        description: 'Consider premium pricing for new orders',
        action: 'Adjust Pricing',
        target: 'pricing',
        priority: 3,
        timestamp: now,
      });
    }

    // 5. Revenue Trend
    const thisWeek = orders.filter(o => new Date(o.created_at).getTime() > now - 7 * day);
    const lastWeek = orders.filter(o => {
      const t = new Date(o.created_at).getTime();
      return t > now - 14 * day && t <= now - 7 * day;
    });
    const thisWeekRev = thisWeek.reduce((s, o) => s + (o.total || 0), 0);
    const lastWeekRev = lastWeek.reduce((s, o) => s + (o.total || 0), 0);
    const revTrend = lastWeekRev > 0 ? ((thisWeekRev - lastWeekRev) / lastWeekRev) * 100 : 0;

    if (revTrend > 20) {
      alerts.push({
        id: 'revenue-up',
        type: 'success',
        category: 'revenue',
        icon: '📈',
        title: `Revenue up ${Math.round(revTrend)}% this week`,
        description: 'Great momentum! Consider expanding capacity',
        action: 'View Reports',
        target: 'reports',
        priority: 4,
        timestamp: now,
      });
    } else if (revTrend < -20) {
      alerts.push({
        id: 'revenue-down',
        type: 'warning',
        category: 'revenue',
        icon: '📉',
        title: `Revenue down ${Math.abs(Math.round(revTrend))}% this week`,
        description: 'Consider promotional offers or outreach',
        action: 'View Insights',
        target: 'insights',
        priority: 2,
        timestamp: now,
      });
    }

    // 6. Customer at Risk (no order in 45+ days)
    const atRiskClients = clients.filter(c => {
      const clientOrders = orders.filter(o => o.client_id === c.id);
      if (clientOrders.length === 0) return false;
      const lastOrder = Math.max(...clientOrders.map(o => new Date(o.created_at).getTime()));
      const daysSince = (now - lastOrder) / day;
      return daysSince > 45 && daysSince < 120;
    });
    
    if (atRiskClients.length > 0) {
      alerts.push({
        id: `at-risk-${atRiskClients.length}`,
        type: 'warning',
        category: 'customers',
        icon: '⚠️',
        title: `${atRiskClients.length} customer${atRiskClients.length > 1 ? 's' : ''} at risk`,
        description: 'No orders in 45+ days - reach out!',
        action: 'View Customers',
        target: 'insights',
        priority: 2,
        timestamp: now,
      });
    }

    // 7. Today's capacity available
    const idlePrinters = printers.filter(p => p.status === 'idle').length;
    if (idlePrinters >= 2 && capacity < 50) {
      alerts.push({
        id: 'capacity-available',
        type: 'info',
        category: 'capacity',
        icon: '✨',
        title: `${idlePrinters} printers available`,
        description: 'Good time to accept rush orders',
        action: 'Create Quote',
        target: 'quote',
        priority: 4,
        timestamp: now,
      });
    }

    // Sort by priority
    return alerts.sort((a, b) => a.priority - b.priority);
  };

  const dismissAlert = (alertId) => {
    const updated = [...dismissed, alertId];
    setDismissed(updated);
    
    // Save with timestamp
    const toSave = updated.map(id => ({ id, timestamp: Date.now() }));
    localStorage.setItem('polywerk_dismissed_alerts', JSON.stringify(toSave));
  };

  const visibleAlerts = alerts.filter(a => !dismissed.includes(a.id));

  const getAlertStyle = (type) => {
    switch (type) {
      case 'error': return 'border-red-500/50 bg-red-500/5';
      case 'warning': return 'border-yellow-500/50 bg-yellow-500/5';
      case 'success': return 'border-green-500/50 bg-green-500/5';
      default: return 'border-cyan-500/50 bg-cyan-500/5';
    }
  };

  const getTextColor = (type) => {
    switch (type) {
      case 'error': return 'text-red-400';
      case 'warning': return 'text-yellow-400';
      case 'success': return 'text-green-400';
      default: return 'text-cyan-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (visibleAlerts.length === 0) {
    return compact ? null : (
      <div className="rounded-xl border p-4 text-center" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        <span className="text-2xl">✅</span>
        <p className="text-green-400 mt-2">All systems healthy</p>
        <p className="text-slate-500 text-sm">No alerts at this time</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {visibleAlerts.slice(0, 3).map(alert => (
          <div
            key={alert.id}
            className={`rounded-lg border p-3 flex items-center justify-between cursor-pointer hover:scale-[1.01] transition ${getAlertStyle(alert.type)}`}
            onClick={() => onNavigate?.(alert.target)}
          >
            <div className="flex items-center gap-2">
              <span>{alert.icon}</span>
              <span className={`text-sm font-medium ${getTextColor(alert.type)}`}>{alert.title}</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                dismissAlert(alert.id);
              }}
              className="text-slate-500 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
        ))}
        {visibleAlerts.length > 3 && (
          <p className="text-xs text-slate-500 text-center">
            +{visibleAlerts.length - 3} more alerts
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-white flex items-center gap-2">
          🔔 Smart Alerts
          <span className="px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-400">
            {visibleAlerts.length}
          </span>
        </h3>
        {dismissed.length > 0 && (
          <button
            onClick={() => {
              setDismissed([]);
              localStorage.removeItem('polywerk_dismissed_alerts');
            }}
            className="text-xs text-slate-500 hover:text-white"
          >
            Show dismissed
          </button>
        )}
      </div>

      <div className="space-y-2">
        {visibleAlerts.map(alert => (
          <div
            key={alert.id}
            className={`rounded-xl border p-4 cursor-pointer hover:scale-[1.01] transition ${getAlertStyle(alert.type)}`}
            onClick={() => onNavigate?.(alert.target)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <span className="text-xl">{alert.icon}</span>
                <div>
                  <p className={`font-medium ${getTextColor(alert.type)}`}>{alert.title}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{alert.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className={`px-3 py-1 rounded-lg text-sm ${
                    alert.type === 'error' ? 'bg-red-500/20 text-red-400' :
                    alert.type === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                    alert.type === 'success' ? 'bg-green-500/20 text-green-400' :
                    'bg-cyan-500/20 text-cyan-400'
                  }`}
                >
                  {alert.action} →
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissAlert(alert.id);
                  }}
                  className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SmartBusinessAlerts;
