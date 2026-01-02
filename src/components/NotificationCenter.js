import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { sanitizeText } from '../utils/sanitization';

/**
 * NotificationCenter - Central hub for all alerts and notifications
 */
function NotificationCenter({ currentUser, isOpen, onClose }) {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      // Aggregate notifications from multiple sources
      const [alertsRes, ordersRes, printersRes] = await Promise.all([
        api.getInventoryAlerts().catch(() => ({ data: [] })),
        api.getOrders().catch(() => []),
        api.getPrinters().catch(() => []),
      ]);

      const alerts = extractArray(alertsRes);
      const orders = extractArray(ordersRes);
      const printers = extractArray(printersRes);

      // Build notification list
      const notifs = [];

      // Inventory alerts
      alerts.forEach(alert => {
        notifs.push({
          id: `alert-${alert.alert_id}`,
          type: 'inventory',
          icon: alert.alert_type === 'out_of_stock' ? '🚨' : '⚠️',
          title: alert.alert_type === 'out_of_stock' ? 'Out of Stock' : 'Low Stock',
          message: `${alert.product_name} - ${alert.current_stock} left`,
          priority: alert.alert_type === 'out_of_stock' ? 'high' : 'medium',
          created_at: alert.created_at,
          action: { label: 'View Inventory', tab: 'inventory' },
        });
      });

      // Overdue orders
      orders.filter(o => {
        if (o.status === 'completed' || o.status === 'cancelled') return false;
        if (!o.due_date) return false;
        return new Date(o.due_date) < new Date();
      }).forEach(order => {
        const hoursOverdue = Math.round((new Date() - new Date(order.due_date)) / (1000 * 60 * 60));
        notifs.push({
          id: `order-overdue-${order.order_id || order.id}`,
          type: 'order',
          icon: '🔴',
          title: 'Overdue Order',
          message: `${order.order_number || `#${(order.order_id || order.id || '').slice(-6)}`} - ${hoursOverdue}h overdue`,
          priority: 'high',
          created_at: order.due_date,
          action: { label: 'View Order', tab: 'business' },
        });
      });

      // Urgent orders (due within 24h)
      orders.filter(o => {
        if (o.status === 'completed' || o.status === 'cancelled') return false;
        if (!o.due_date) return false;
        const hoursUntilDue = (new Date(o.due_date) - new Date()) / (1000 * 60 * 60);
        return hoursUntilDue > 0 && hoursUntilDue <= 24;
      }).forEach(order => {
        const hoursLeft = Math.round((new Date(order.due_date) - new Date()) / (1000 * 60 * 60));
        notifs.push({
          id: `order-urgent-${order.order_id || order.id}`,
          type: 'order',
          icon: '⏰',
          title: 'Order Due Soon',
          message: `${order.order_number || `#${(order.order_id || order.id || '').slice(-6)}`} - ${hoursLeft}h left`,
          priority: 'medium',
          created_at: new Date().toISOString(),
          action: { label: 'View Order', tab: 'business' },
        });
      });

      // Offline printers
      printers.filter(p => 
        p.status === 'offline' || p.status === 'error' || p.state === 'offline' || p.state === 'error'
      ).forEach(printer => {
        notifs.push({
          id: `printer-offline-${printer.printer_id || printer.id}`,
          type: 'printer',
          icon: '🔌',
          title: 'Printer Offline',
          message: `${printer.name} is offline`,
          priority: 'high',
          created_at: new Date().toISOString(),
          action: { label: 'View Printers', tab: 'printers' },
        });
      });

      // Printer errors
      printers.filter(p => 
        p.status === 'error' || p.state === 'error'
      ).forEach(printer => {
        notifs.push({
          id: `printer-error-${printer.printer_id || printer.id}`,
          type: 'printer',
          icon: '❌',
          title: 'Printer Error',
          message: `${printer.name} - ${printer.error || 'Error detected'}`,
          priority: 'high',
          created_at: new Date().toISOString(),
          action: { label: 'View Printers', tab: 'printers' },
        });
      });

      // Ready for pickup
      orders.filter(o => 
        o.status === 'ready' || o.status === 'ready_for_pickup'
      ).forEach(order => {
        notifs.push({
          id: `order-ready-${order.order_id || order.id}`,
          type: 'order',
          icon: '📦',
          title: 'Ready for Pickup',
          message: `${order.order_number || `#${(order.order_id || order.id || '').slice(-6)}`} - ${order.client_name || order.customer_name}`,
          priority: 'low',
          created_at: order.updated_at || order.created_at,
          action: { label: 'View Order', tab: 'business' },
        });
      });

      // Sort by priority and date
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      notifs.sort((a, b) => {
        const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (pDiff !== 0) return pDiff;
        return new Date(b.created_at) - new Date(a.created_at);
      });

      setNotifications(notifs);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const extractArray = (response) => {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (response.data && Array.isArray(response.data)) return response.data;
    return [];
  };

  const dismissNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const dismissAll = () => {
    setNotifications([]);
  };

  const formatTimeAgo = (dateStr) => {
    const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  // Filter notifications
  const filteredNotifications = notifications.filter(n => {
    if (filter === 'all') return true;
    return n.type === filter;
  });

  // Count by type
  const counts = {
    all: notifications.length,
    order: notifications.filter(n => n.type === 'order').length,
    printer: notifications.filter(n => n.type === 'printer').length,
    inventory: notifications.filter(n => n.type === 'inventory').length,
  };

  const priorityColors = {
    high: 'border-l-red-500',
    medium: 'border-l-yellow-500',
    low: 'border-l-green-500',
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4 pt-16">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div 
        className="relative w-full max-w-md max-h-[80vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: '#334155' }}>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            🔔 Notifications
            {notifications.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400">
                {notifications.length}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <button
                onClick={dismissAll}
                className="text-xs text-slate-400 hover:text-white"
              >
                Clear all
              </button>
            )}
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-700 text-slate-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 py-2 border-b flex gap-1" style={{ borderColor: '#334155' }}>
          {['all', 'order', 'printer', 'inventory'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg text-xs capitalize transition ${
                filter === f
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {f} {counts[f] > 0 && `(${counts[f]})`}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <p className="text-4xl mb-2">🎉</p>
              <p>All clear!</p>
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: '#334155' }}>
              {filteredNotifications.map(notif => (
                <div
                  key={notif.id}
                  className={`p-4 hover:bg-slate-800/50 transition border-l-4 ${priorityColors[notif.priority]}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{notif.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        {/* FIXED: Sanitize notification title to prevent XSS */}
                        <p className="font-medium text-white">{sanitizeText(notif.title)}</p>
                        <button
                          onClick={() => dismissNotification(notif.id)}
                          className="text-slate-500 hover:text-white flex-shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                      {/* FIXED: Sanitize notification message to prevent XSS */}
                      <p className="text-sm text-slate-400 mt-0.5">{sanitizeText(notif.message)}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-slate-500">
                          {formatTimeAgo(notif.created_at)}
                        </span>
                        {notif.action && (
                          <button
                            onClick={() => {
                              // In a real app, this would navigate to the tab
                              onClose();
                            }}
                            className="text-xs text-purple-400 hover:text-purple-300"
                          >
                            {notif.action.label} →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t text-center" style={{ borderColor: '#334155' }}>
          <button
            onClick={loadNotifications}
            className="text-sm text-slate-400 hover:text-white"
          >
            🔄 Refresh
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * NotificationBell - Bell icon with badge for header
 */
export function NotificationBell({ currentUser, onClick, count }) {
  return (
    <button
      onClick={onClick}
      className="relative p-2 rounded-lg hover:bg-slate-700 transition"
    >
      <span className="text-xl">🔔</span>
      {count > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}

/**
 * useNotificationCount - Hook to get notification count
 */
export function useNotificationCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const [alertsRes, ordersRes, printersRes] = await Promise.all([
          api.getInventoryAlerts().catch(() => ({ data: [] })),
          api.getOrders().catch(() => []),
          api.getPrinters().catch(() => []),
        ]);

        const extractArray = (response) => {
          if (!response) return [];
          if (Array.isArray(response)) return response;
          if (response.data && Array.isArray(response.data)) return response.data;
          return [];
        };

        const alerts = extractArray(alertsRes);
        const orders = extractArray(ordersRes);
        const printers = extractArray(printersRes);

        let total = alerts.length;

        // Overdue orders
        total += orders.filter(o => {
          if (o.status === 'completed' || o.status === 'cancelled') return false;
          if (!o.due_date) return false;
          return new Date(o.due_date) < new Date();
        }).length;

        // Offline/error printers
        total += printers.filter(p => 
          p.status === 'offline' || p.status === 'error' || p.state === 'offline' || p.state === 'error'
        ).length;

        setCount(total);
      } catch (err) {
        console.error('Failed to fetch notification count:', err);
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, []);

  return count;
}

export default NotificationCenter;
