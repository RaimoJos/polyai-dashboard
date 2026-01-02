import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

/**
 * OrderTrackingPage - Public page for customers to track their order
 */
function OrderTrackingPage({ orderId, onBack }) {
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [searchId, setSearchId] = useState(orderId || '');

  useEffect(() => {
    if (orderId) {
      loadOrder(orderId);
    } else {
      setLoading(false);
    }
  }, [orderId]);

  const loadOrder = async (id) => {
    setLoading(true);
    setError(null);
    
    try {
      // Try to load order (in production, this would be a public endpoint)
      const res = await api.getOrders({ order_id: id });
      const orders = Array.isArray(res) ? res : (res?.data || []);
      const found = orders.find(o => 
        (o.order_id || o.id) === id || 
        o.order_number === id ||
        (o.order_id || o.id || '').includes(id)
      );
      
      if (found) {
        setOrder(found);
      } else {
        setError('Order not found. Please check your order number.');
      }
    } catch (err) {
      console.error('Failed to load order:', err);
      setError('Unable to load order. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchId.trim()) {
      loadOrder(searchId.trim());
    }
  };

  // Order status stages
  const stages = [
    { id: 'pending', name: 'Received', icon: '📥', statuses: ['pending', 'new', 'quote', 'confirmed'] },
    { id: 'in_progress', name: 'Processing', icon: '🏭', statuses: ['in_progress', 'preparing', 'slicing'] },
    { id: 'printing', name: 'Printing', icon: '🖨️', statuses: ['printing'] },
    { id: 'quality_check', name: 'Quality Check', icon: '🔍', statuses: ['quality_check', 'qc'] },
    { id: 'ready', name: 'Ready', icon: '📦', statuses: ['ready', 'ready_for_pickup'] },
    { id: 'shipped', name: 'Shipped', icon: '🚚', statuses: ['shipped', 'delivered'] },
  ];

  const getCurrentStageIndex = () => {
    if (!order) return -1;
    const status = (order.status || '').toLowerCase();
    return stages.findIndex(stage => stage.statuses.includes(status));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('et-EE', { style: 'currency', currency: 'EUR' }).format(amount || 0);
  };

  const currentStageIndex = getCurrentStageIndex();

  // If no orderId provided, show search form
  if (!orderId && !order) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#0a0a0b' }}>
        <div 
          className="w-full max-w-md rounded-2xl border p-8 text-center"
          style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
        >
          <div className="w-20 h-20 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">📦</span>
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-2">Track Your Order</h1>
          <p className="text-slate-400 mb-6">
            Enter your order number to see the current status
          </p>

          <form onSubmit={handleSearch} className="space-y-4">
            <input
              type="text"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder="Order number (e.g., ORD-ABC123)"
              className="w-full px-4 py-3 rounded-xl text-white text-center text-lg"
              style={{ backgroundColor: '#334155' }}
            />
            <button
              type="submit"
              disabled={!searchId.trim() || loading}
              className="w-full py-3 rounded-xl font-medium text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
            >
              {loading ? 'Searching...' : '🔍 Track Order'}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          {onBack && (
            <button
              onClick={onBack}
              className="mt-6 text-slate-400 hover:text-white text-sm"
            >
              ← Back to home
            </button>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0a0a0b' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading order...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#0a0a0b' }}>
        <div 
          className="w-full max-w-md rounded-2xl border p-8 text-center"
          style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
        >
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">❌</span>
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-2">Order Not Found</h1>
          <p className="text-slate-400 mb-6">
            {error || 'We couldn\'t find an order with that number.'}
          </p>

          <form onSubmit={handleSearch} className="space-y-4">
            <input
              type="text"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder="Try another order number"
              className="w-full px-4 py-3 rounded-xl text-white text-center"
              style={{ backgroundColor: '#334155' }}
            />
            <button
              type="submit"
              disabled={!searchId.trim()}
              className="w-full py-3 rounded-xl font-medium text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
            >
              🔍 Search Again
            </button>
          </form>

          {onBack && (
            <button
              onClick={onBack}
              className="mt-6 text-slate-400 hover:text-white text-sm"
            >
              ← Back to home
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 py-8" style={{ backgroundColor: '#0a0a0b' }}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Order Tracking</h1>
          <p className="text-slate-400">
            {order.order_number || `#${(order.order_id || order.id || '').slice(-6)}`}
          </p>
        </div>

        {/* Status Card */}
        <div 
          className="rounded-2xl border p-6 mb-6"
          style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
        >
          {/* Current Status */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">{stages[currentStageIndex]?.icon || '📋'}</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-1">
              {stages[currentStageIndex]?.name || order.status}
            </h2>
            <p className="text-slate-400">
              {currentStageIndex === stages.length - 1 
                ? 'Your order has been completed!'
                : `Last updated: ${formatDate(order.updated_at || order.created_at)}`
              }
            </p>
          </div>

          {/* Progress Steps */}
          <div className="relative">
            {/* Progress Line */}
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-700">
              <div 
                className="h-full transition-all duration-500"
                style={{ 
                  width: `${Math.max(0, (currentStageIndex / (stages.length - 1)) * 100)}%`,
                  background: 'linear-gradient(90deg, #a855f7 0%, #06b6d4 100%)'
                }}
              />
            </div>

            {/* Steps */}
            <div className="relative flex justify-between">
              {stages.map((stage, index) => {
                const isPast = index < currentStageIndex;
                const isCurrent = index === currentStageIndex;
                const isFuture = index > currentStageIndex;

                return (
                  <div key={stage.id} className="flex flex-col items-center">
                    <div 
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-lg z-10 transition ${
                        isPast ? 'bg-green-500' :
                        isCurrent ? 'bg-purple-500 ring-4 ring-purple-500/30' :
                        'bg-slate-700'
                      }`}
                    >
                      {isPast ? '✓' : stage.icon}
                    </div>
                    <span className={`text-xs mt-2 text-center ${
                      isCurrent ? 'text-purple-400 font-medium' : 
                      isPast ? 'text-green-400' : 'text-slate-500'
                    }`}>
                      {stage.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Order Details */}
        <div 
          className="rounded-2xl border p-6 mb-6"
          style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
        >
          <h3 className="text-lg font-semibold text-white mb-4">Order Details</h3>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-400">Order Number</span>
              <span className="text-white font-mono">
                {order.order_number || `#${(order.order_id || order.id || '').slice(-6)}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Order Date</span>
              <span className="text-white">{formatDate(order.created_at)}</span>
            </div>
            {order.due_date && (
              <div className="flex justify-between">
                <span className="text-slate-400">Estimated Completion</span>
                <span className="text-white">{formatDate(order.due_date)}</span>
              </div>
            )}
            <div className="flex justify-between pt-3 border-t" style={{ borderColor: '#334155' }}>
              <span className="text-slate-400">Total</span>
              <span className="text-xl font-bold text-green-400">
                {formatCurrency(order.total_price || order.total)}
              </span>
            </div>
          </div>
        </div>

        {/* Items (if available) */}
        {order.items && order.items.length > 0 && (
          <div 
            className="rounded-2xl border p-6 mb-6"
            style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
          >
            <h3 className="text-lg font-semibold text-white mb-4">Items</h3>
            <div className="space-y-3">
              {order.items.map((item, index) => (
                <div key={index} className="flex justify-between">
                  <div>
                    <p className="text-white">{item.name}</p>
                    <p className="text-sm text-slate-500">Qty: {item.quantity}</p>
                  </div>
                  <span className="text-slate-400">{formatCurrency(item.total)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contact */}
        <div 
          className="rounded-2xl border p-6 text-center"
          style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
        >
          <h3 className="text-lg font-semibold text-white mb-2">Need Help?</h3>
          <p className="text-slate-400 mb-4">
            If you have questions about your order, please contact us.
          </p>
          <div className="flex justify-center gap-4">
            <a 
              href="mailto:info@polywerk.ee"
              className="px-4 py-2 rounded-lg text-purple-400 border border-purple-500/30 hover:bg-purple-500/10"
            >
              📧 Email Us
            </a>
            <a 
              href="tel:+372XXXXXXXX"
              className="px-4 py-2 rounded-lg text-purple-400 border border-purple-500/30 hover:bg-purple-500/10"
            >
              📞 Call Us
            </a>
          </div>
        </div>

        {/* Search Another */}
        <div className="text-center mt-8">
          <form onSubmit={handleSearch} className="flex gap-2 max-w-sm mx-auto">
            <input
              type="text"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder="Track another order"
              className="flex-1 px-4 py-2 rounded-lg text-white text-sm"
              style={{ backgroundColor: '#334155' }}
            />
            <button
              type="submit"
              disabled={!searchId.trim()}
              className="px-4 py-2 rounded-lg text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
            >
              🔍
            </button>
          </form>
          
          {onBack && (
            <button
              onClick={onBack}
              className="mt-4 text-slate-400 hover:text-white text-sm"
            >
              ← Back to home
            </button>
          )}
        </div>

        {/* Powered By Footer */}
        <div className="text-center mt-8 text-slate-500 text-sm">
          Powered by <span className="text-purple-400">Polywerk</span>
        </div>
      </div>
    </div>
  );
}

export default OrderTrackingPage;
