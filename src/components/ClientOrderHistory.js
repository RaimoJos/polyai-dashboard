import React, { useState, useEffect, useMemo } from 'react';
import { api, unwrap } from '../services/api';
import { useLanguage } from '../i18n';

/**
 * ClientOrderHistory - Detailed order history view for a specific client
 * Features: Full order timeline, stats, payment history, communication log
 */
const ClientOrderHistory = ({ client, onClose, onCreateOrder }) => {
  const { t } = useLanguage();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('orders');
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    if (client?.client_id) {
      loadClientOrders();
    }
  }, [client]);

  const loadClientOrders = async () => {
    setLoading(true);
    try {
      // Try dedicated client orders endpoint
      const res = await api.getClientOrders?.(client.client_id).catch(() => null);
      let orderList = unwrap(res)?.orders || unwrap(res) || [];

      // Fallback: filter from all orders
      if (!Array.isArray(orderList) || orderList.length === 0) {
        const allOrdersRes = await api.listOrders({ status: 'all' }).catch(() => []);
        const allOrders = unwrap(allOrdersRes) || allOrdersRes?.orders || allOrdersRes || [];
        orderList = allOrders.filter(o => 
          o.client_id === client.client_id || 
          o.client_name?.toLowerCase() === client.name?.toLowerCase()
        );
      }

      setOrders(Array.isArray(orderList) ? orderList : []);
    } catch (err) {
      console.error('Failed to load client orders:', err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const stats = useMemo(() => {
    if (orders.length === 0) {
      return {
        totalOrders: 0,
        totalRevenue: 0,
        avgOrderValue: 0,
        paidOrders: 0,
        unpaidOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        firstOrder: null,
        lastOrder: null,
        favoritesMaterials: [],
        avgLeadTime: 0
      };
    }

    const totalRevenue = orders.reduce((sum, o) => sum + (o.quote?.total || o.total_price || 0), 0);
    const paidOrders = orders.filter(o => o.payment_status === 'paid').length;
    const completedOrders = orders.filter(o => ['delivered', 'completed'].includes(o.status)).length;
    const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;

    // Sort by date
    const sortedByDate = [...orders].sort((a, b) => 
      new Date(a.created_at || 0) - new Date(b.created_at || 0)
    );

    // Favorite materials
    const materialCounts = {};
    orders.forEach(o => {
      const mat = o.material_type || 'Unknown';
      materialCounts[mat] = (materialCounts[mat] || 0) + 1;
    });
    const favoritesMaterials = Object.entries(materialCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([mat, count]) => ({ material: mat, count }));

    // Average lead time (for completed orders)
    const completedWithDates = orders.filter(o => 
      o.status === 'delivered' && o.created_at && o.delivered_at
    );
    const avgLeadTime = completedWithDates.length > 0
      ? completedWithDates.reduce((sum, o) => {
          const days = (new Date(o.delivered_at) - new Date(o.created_at)) / (1000 * 60 * 60 * 24);
          return sum + days;
        }, 0) / completedWithDates.length
      : 0;

    return {
      totalOrders: orders.length,
      totalRevenue,
      avgOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
      paidOrders,
      unpaidOrders: orders.length - paidOrders,
      completedOrders,
      cancelledOrders,
      firstOrder: sortedByDate[0]?.created_at,
      lastOrder: sortedByDate[sortedByDate.length - 1]?.created_at,
      favoritesMaterials,
      avgLeadTime
    };
  }, [orders]);

  // Group orders by status
  const ordersByStatus = useMemo(() => {
    const groups = {
      active: orders.filter(o => !['delivered', 'completed', 'cancelled'].includes(o.status)),
      completed: orders.filter(o => ['delivered', 'completed'].includes(o.status)),
      cancelled: orders.filter(o => o.status === 'cancelled')
    };
    return groups;
  }, [orders]);

  const getStatusColor = (status) => ({
    'quoted': 'bg-yellow-900/50 text-yellow-400',
    'accepted': 'bg-blue-900/50 text-blue-400',
    'queued': 'bg-purple-900/50 text-purple-400',
    'printing': 'bg-cyan-900/50 text-cyan-400',
    'post_processing': 'bg-orange-900/50 text-orange-400',
    'ready': 'bg-green-900/50 text-green-400',
    'delivered': 'bg-emerald-900/50 text-emerald-400',
    'completed': 'bg-emerald-900/50 text-emerald-400',
    'cancelled': 'bg-red-900/50 text-red-400'
  }[status] || 'bg-gray-700 text-gray-300');

  const getPaymentBadge = (order) => {
    const status = order.payment_status || 'pending';
    return {
      paid: { bg: 'bg-green-900/50', text: 'text-green-400', label: '✓ Paid' },
      partial: { bg: 'bg-yellow-900/50', text: 'text-yellow-400', label: '◐ Partial' },
      invoiced: { bg: 'bg-blue-900/50', text: 'text-blue-400', label: '📄 Invoiced' },
      pending: { bg: 'bg-gray-700', text: 'text-gray-400', label: '○ Unpaid' },
      unpaid: { bg: 'bg-gray-700', text: 'text-gray-400', label: '○ Unpaid' }
    }[status] || { bg: 'bg-gray-700', text: 'text-gray-400', label: status };
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('et-EE', { style: 'currency', currency: 'EUR' }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-xl p-8">
          <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-zinc-400 mt-4">Loading order history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                👤 {client.name}
              </h2>
              <p className="text-sm text-zinc-400">
                {client.company && `${client.company} • `}
                {client.email}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onCreateOrder}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-white"
                style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
              >
                + New Order
              </button>
              <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl p-1">×</button>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="p-4 border-b border-gray-700 bg-gray-800/30 flex-shrink-0">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{stats.totalOrders}</p>
              <p className="text-xs text-zinc-500">Total Orders</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-400">{formatCurrency(stats.totalRevenue)}</p>
              <p className="text-xs text-zinc-500">Total Revenue</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-400">{formatCurrency(stats.avgOrderValue)}</p>
              <p className="text-xs text-zinc-500">Avg Order</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-cyan-400">{stats.completedOrders}</p>
              <p className="text-xs text-zinc-500">Completed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-400">{stats.avgLeadTime.toFixed(1)}d</p>
              <p className="text-xs text-zinc-500">Avg Lead Time</p>
            </div>
          </div>

          {/* Favorite Materials */}
          {stats.favoritesMaterials.length > 0 && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-zinc-500">Favorite materials:</span>
              {stats.favoritesMaterials.map(({ material, count }) => (
                <span key={material} className="px-2 py-0.5 bg-gray-700 rounded text-zinc-300">
                  {material} ({count})
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 px-4 flex-shrink-0">
          {[
            { id: 'orders', label: '📦 All Orders', count: stats.totalOrders },
            { id: 'active', label: '🔄 Active', count: ordersByStatus.active.length },
            { id: 'completed', label: '✓ Completed', count: ordersByStatus.completed.length },
            { id: 'timeline', label: '📅 Timeline' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-zinc-400 hover:text-white'
              }`}
            >
              {tab.label} {tab.count !== undefined && `(${tab.count})`}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {orders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-2">📭</p>
              <p className="text-zinc-400">No orders found for this client</p>
              <button
                onClick={onCreateOrder}
                className="mt-4 px-4 py-2 rounded-lg font-medium text-white"
                style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
              >
                Create First Order
              </button>
            </div>
          ) : (
            <>
              {/* Orders List */}
              {(activeTab === 'orders' || activeTab === 'active' || activeTab === 'completed') && (
                <div className="space-y-3">
                  {(activeTab === 'orders' ? orders : 
                    activeTab === 'active' ? ordersByStatus.active : ordersByStatus.completed
                  ).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
                  .map(order => {
                    const paymentBadge = getPaymentBadge(order);
                    return (
                      <div
                        key={order.order_id}
                        className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:bg-gray-800 transition cursor-pointer"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-mono text-xs text-zinc-500">{order.order_id?.slice(-8)}</span>
                              <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(order.status)}`}>
                                {order.status}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-xs ${paymentBadge.bg} ${paymentBadge.text}`}>
                                {paymentBadge.label}
                              </span>
                              {order.rush_order && (
                                <span className="px-2 py-0.5 bg-red-900/50 text-red-400 rounded text-xs">🔥 RUSH</span>
                              )}
                            </div>
                            <h4 className="font-medium text-white">{order.item_name || 'Unnamed Order'}</h4>
                            <p className="text-sm text-zinc-400">
                              {order.material_type} • Qty: {order.quantity || 1}
                              {order.file_path && ' • 📄 File attached'}
                            </p>
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-lg font-bold text-green-400">
                              {formatCurrency(order.quote?.total || order.total_price)}
                            </p>
                            <p className="text-xs text-zinc-500">{formatDate(order.created_at)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Timeline View */}
              {activeTab === 'timeline' && (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-700"></div>
                  <div className="space-y-4">
                    {orders
                      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
                      .map((order, idx) => (
                        <div key={order.order_id} className="relative pl-10">
                          <div className={`absolute left-2.5 w-3 h-3 rounded-full ${
                            order.status === 'cancelled' ? 'bg-red-500' :
                            ['delivered', 'completed'].includes(order.status) ? 'bg-green-500' :
                            'bg-purple-500'
                          }`}></div>
                          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-white">{order.item_name}</p>
                                <p className="text-xs text-zinc-500">{formatDate(order.created_at)}</p>
                              </div>
                              <p className="text-green-400 font-medium">
                                {formatCurrency(order.quote?.total || order.total_price)}
                              </p>
                            </div>
                            <div className="mt-2 flex gap-2 text-xs">
                              <span className={`px-2 py-0.5 rounded ${getStatusColor(order.status)}`}>
                                {order.status}
                              </span>
                              <span className="text-zinc-500">{order.material_type}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Stats */}
        <div className="p-4 border-t border-gray-700 bg-gray-800/30 flex-shrink-0">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">
              Customer since {formatDate(stats.firstOrder)} • Last order {formatDate(stats.lastOrder)}
            </span>
            <span className="text-zinc-400">
              {client.discount_percentage > 0 && (
                <span className="text-orange-400 mr-2">🏷️ {client.discount_percentage}% discount</span>
              )}
              {client.pricing_tier && client.pricing_tier !== 'standard' && (
                <span className="text-purple-400">{client.pricing_tier} tier</span>
              )}
            </span>
          </div>
        </div>

        {/* Order Detail Modal */}
        {selectedOrder && (
          <OrderDetailModal
            order={selectedOrder}
            onClose={() => setSelectedOrder(null)}
          />
        )}
      </div>
    </div>
  );
};

/**
 * Order detail modal
 */
const OrderDetailModal = ({ order, onClose }) => {
  const formatDate = (dateStr) => {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleString('en-GB');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('et-EE', { style: 'currency', currency: 'EUR' }).format(amount || 0);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-700">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-white">Order Details</h3>
            <button onClick={onClose} className="text-zinc-400 hover:text-white">×</button>
          </div>
        </div>
        
        <div className="p-4 space-y-4">
          <div>
            <p className="text-xs text-zinc-500">Order ID</p>
            <p className="font-mono text-sm text-white">{order.order_id}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-zinc-500">Item</p>
              <p className="text-white">{order.item_name}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Status</p>
              <p className="text-white capitalize">{order.status}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Material</p>
              <p className="text-white">{order.material_type}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Quantity</p>
              <p className="text-white">{order.quantity || 1}</p>
            </div>
          </div>

          <div>
            <p className="text-xs text-zinc-500">Total</p>
            <p className="text-2xl font-bold text-green-400">
              {formatCurrency(order.quote?.total || order.total_price)}
            </p>
          </div>

          {order.quote && (
            <div className="bg-gray-800 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-400">Material cost</span>
                <span className="text-white">{formatCurrency(order.quote.material_cost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Machine cost</span>
                <span className="text-white">{formatCurrency(order.quote.machine_cost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Labor cost</span>
                <span className="text-white">{formatCurrency(order.quote.labor_cost)}</span>
              </div>
              {order.quote.discount > 0 && (
                <div className="flex justify-between text-orange-400">
                  <span>Discount</span>
                  <span>-{formatCurrency(order.quote.discount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-700 pt-1 mt-1">
                <span className="text-zinc-400">VAT</span>
                <span className="text-white">{formatCurrency(order.quote.vat)}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-zinc-500">Created</p>
              <p className="text-zinc-300">{formatDate(order.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Due Date</p>
              <p className="text-zinc-300">{formatDate(order.due_date)}</p>
            </div>
          </div>

          {order.notes && (
            <div>
              <p className="text-xs text-zinc-500">Notes</p>
              <p className="text-zinc-300 text-sm">{order.notes}</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClientOrderHistory;
