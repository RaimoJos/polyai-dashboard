import React, { useState, useEffect, useCallback } from 'react';
import { api, unwrap } from '../services/api';

/**
 * OrderPipeline - Kanban-style order workflow management
 */
function OrderPipeline({ onOrderClick }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggedOrder, setDraggedOrder] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [showQuickView, setShowQuickView] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pipeline stages
  const stages = [
    { id: 'pending', name: 'New', icon: '📥', color: 'yellow', statuses: ['pending', 'new', 'quote'] },
    { id: 'confirmed', name: 'Confirmed', icon: '✅', color: 'blue', statuses: ['confirmed', 'accepted'] },
    { id: 'in_progress', name: 'In Progress', icon: '🏭', color: 'purple', statuses: ['in_progress', 'preparing', 'slicing'] },
    { id: 'printing', name: 'Printing', icon: '🖨️', color: 'cyan', statuses: ['printing'] },
    { id: 'quality_check', name: 'QC', icon: '🔍', color: 'orange', statuses: ['quality_check', 'qc', 'checking'] },
    { id: 'ready', name: 'Ready', icon: '📦', color: 'green', statuses: ['ready', 'ready_for_pickup', 'completed'] },
    { id: 'shipped', name: 'Shipped', icon: '🚚', color: 'slate', statuses: ['shipped', 'delivered'] },
  ];

  useEffect(() => {
    loadOrders();
  }, []);

  // Helper to safely extract array from various response formats
  const extractArray = (response) => {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (response.data && Array.isArray(response.data)) return response.data;
    if (response.orders && Array.isArray(response.orders)) return response.orders;
    return [];
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await api.getOrders();
      const data = extractArray(unwrap(res));
      // Filter out cancelled orders
      setOrders(data.filter(o => o.status !== 'cancelled'));
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const getOrdersForStage = (stage) => {
    return orders.filter(order => {
      const status = (order.status || '').toLowerCase();
      return stage.statuses.includes(status);
    });
  };

  const handleDragStart = (e, order) => {
    setDraggedOrder(order);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, stageId) => {
    e.preventDefault();
    setDragOverColumn(stageId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e, stage) => {
    e.preventDefault();
    setDragOverColumn(null);
    
    if (!draggedOrder) return;
    
    // Get the new status (first status in the stage)
    const newStatus = stage.statuses[0];
    const orderId = draggedOrder.order_id || draggedOrder.id;
    
    // Optimistic update
    setOrders(prev => prev.map(o => 
      (o.order_id || o.id) === orderId 
        ? { ...o, status: newStatus }
        : o
    ));
    
    try {
      await api.updateOrder(orderId, { status: newStatus });
    } catch (err) {
      console.error('Failed to update order:', err);
      loadOrders(); // Reload on error
    }
    
    setDraggedOrder(null);
  };

  const moveToNextStage = async (order) => {
    const currentStatus = (order.status || '').toLowerCase();
    const currentStageIndex = stages.findIndex(s => s.statuses.includes(currentStatus));
    
    if (currentStageIndex < stages.length - 1) {
      const nextStage = stages[currentStageIndex + 1];
      const newStatus = nextStage.statuses[0];
      const orderId = order.order_id || order.id;
      
      // Optimistic update
      setOrders(prev => prev.map(o => 
        (o.order_id || o.id) === orderId 
          ? { ...o, status: newStatus }
          : o
      ));
      
      try {
        await api.updateOrder(orderId, { status: newStatus });
      } catch (err) {
        console.error('Failed to update order:', err);
        loadOrders();
      }
    }
  };

  const moveToPrevStage = async (order) => {
    const currentStatus = (order.status || '').toLowerCase();
    const currentStageIndex = stages.findIndex(s => s.statuses.includes(currentStatus));
    
    if (currentStageIndex > 0) {
      const prevStage = stages[currentStageIndex - 1];
      const newStatus = prevStage.statuses[0];
      const orderId = order.order_id || order.id;
      
      setOrders(prev => prev.map(o => 
        (o.order_id || o.id) === orderId 
          ? { ...o, status: newStatus }
          : o
      ));
      
      try {
        await api.updateOrder(orderId, { status: newStatus });
      } catch (err) {
        console.error('Failed to update order:', err);
        loadOrders();
      }
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('et-EE', { style: 'currency', currency: 'EUR' }).format(amount || 0);
  };

  const getTimeUntilDue = (dueDate) => {
    if (!dueDate) return null;
    const hours = Math.round((new Date(dueDate) - new Date()) / (1000 * 60 * 60));
    if (hours < 0) return { text: `${Math.abs(hours)}h overdue`, color: 'text-red-400', urgent: true };
    if (hours < 24) return { text: `${hours}h left`, color: 'text-yellow-400', urgent: true };
    if (hours < 48) return { text: 'Tomorrow', color: 'text-blue-400', urgent: false };
    return { text: `${Math.round(hours / 24)}d`, color: 'text-slate-400', urgent: false };
  };

  const colorClasses = {
    yellow: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', text: 'text-yellow-400' },
    blue: { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400' },
    purple: { bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-400' },
    cyan: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', text: 'text-cyan-400' },
    orange: { bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400' },
    green: { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-400' },
    slate: { bg: 'bg-slate-500/20', border: 'border-slate-500/30', text: 'text-slate-400' },
  };

  // Filter orders based on search
  const filteredOrders = searchQuery 
    ? orders.filter(o => 
        (o.order_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.client_name || o.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : orders;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            📊 Order Pipeline
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Drag orders between stages or use quick actions
          </p>
        </div>
        
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm text-white w-48"
            style={{ backgroundColor: '#334155' }}
          />
          <button
            onClick={loadOrders}
            className="px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Pipeline Stats */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {stages.map(stage => {
          const count = getOrdersForStage(stage).length;
          const colors = colorClasses[stage.color];
          return (
            <div
              key={stage.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${colors.bg} ${colors.text}`}
            >
              <span>{stage.icon}</span>
              <span>{stage.name}</span>
              <span className="font-bold">{count}</span>
            </div>
          );
        })}
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '60vh' }}>
        {stages.map(stage => {
          const stageOrders = getOrdersForStage(stage);
          const colors = colorClasses[stage.color];
          const isDragOver = dragOverColumn === stage.id;
          
          return (
            <div
              key={stage.id}
              className={`flex-shrink-0 w-72 rounded-xl border transition-all ${
                isDragOver ? 'border-purple-500 bg-purple-500/10' : ''
              }`}
              style={{ 
                backgroundColor: isDragOver ? undefined : '#1e293b', 
                borderColor: isDragOver ? undefined : '#334155' 
              }}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage)}
            >
              {/* Column Header */}
              <div className={`p-3 rounded-t-xl border-b ${colors.bg}`} style={{ borderColor: '#334155' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{stage.icon}</span>
                    <span className={`font-medium ${colors.text}`}>{stage.name}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${colors.bg} ${colors.text}`}>
                    {stageOrders.length}
                  </span>
                </div>
              </div>

              {/* Cards */}
              <div className="p-2 space-y-2 min-h-96">
                {stageOrders.map(order => {
                  const timeInfo = getTimeUntilDue(order.due_date);
                  const orderId = order.order_id || order.id;
                  
                  return (
                    <div
                      key={orderId}
                      draggable
                      onDragStart={(e) => handleDragStart(e, order)}
                      className={`p-3 rounded-lg border cursor-grab active:cursor-grabbing transition hover:border-purple-500/50 ${
                        draggedOrder?.order_id === orderId || draggedOrder?.id === orderId
                          ? 'opacity-50'
                          : ''
                      }`}
                      style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                    >
                      {/* Order Header */}
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-white text-sm">
                            {order.order_number || `#${orderId.slice(-6)}`}
                          </p>
                          <p className="text-xs text-slate-400 truncate max-w-36">
                            {order.client_name || order.customer_name || 'Walk-in'}
                          </p>
                        </div>
                        {timeInfo && (
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            timeInfo.urgent ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-400'
                          }`}>
                            {timeInfo.text}
                          </span>
                        )}
                      </div>

                      {/* Order Details */}
                      <div className="text-xs text-slate-500 space-y-1">
                        {order.items_count && (
                          <p>{order.items_count} item{order.items_count !== 1 ? 's' : ''}</p>
                        )}
                        <p className="text-green-400 font-medium">
                          {formatCurrency(order.total_price || order.total)}
                        </p>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex items-center justify-between mt-3 pt-2 border-t" style={{ borderColor: '#334155' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); moveToPrevStage(order); }}
                          className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-white transition"
                          title="Move back"
                        >
                          ◀
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowQuickView(order); }}
                          className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-white transition"
                          title="Quick view"
                        >
                          👁️
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); moveToNextStage(order); }}
                          className="p-1 rounded hover:bg-purple-500/20 text-purple-400 hover:text-purple-300 transition"
                          title="Move forward"
                        >
                          ▶
                        </button>
                      </div>
                    </div>
                  );
                })}

                {stageOrders.length === 0 && (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    No orders
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick View Modal */}
      {showQuickView && (
        <OrderQuickView 
          order={showQuickView} 
          onClose={() => setShowQuickView(null)}
          onMoveNext={() => { moveToNextStage(showQuickView); setShowQuickView(null); }}
          onMoveBack={() => { moveToPrevStage(showQuickView); setShowQuickView(null); }}
          stages={stages}
        />
      )}
    </div>
  );
}


/**
 * OrderQuickView - Quick view modal for order details
 */
function OrderQuickView({ order, onClose, onMoveNext, onMoveBack, stages }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('et-EE', { style: 'currency', currency: 'EUR' }).format(amount || 0);
  };

  const currentStage = stages.find(s => s.statuses.includes((order.status || '').toLowerCase()));
  const currentStageIndex = stages.findIndex(s => s.statuses.includes((order.status || '').toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        className="relative w-full max-w-md rounded-2xl border shadow-2xl"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#334155' }}>
          <div>
            <h2 className="text-lg font-bold text-white">
              {order.order_number || `#${(order.order_id || order.id || '').slice(-6)}`}
            </h2>
            <p className="text-sm text-slate-400">{order.client_name || order.customer_name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Status</span>
            <span className="flex items-center gap-2">
              <span>{currentStage?.icon}</span>
              <span className="font-medium text-white">{currentStage?.name}</span>
            </span>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Total</span>
            <span className="font-bold text-green-400 text-lg">
              {formatCurrency(order.total_price || order.total)}
            </span>
          </div>

          {/* Due Date */}
          {order.due_date && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Due</span>
              <span className="text-white">
                {new Date(order.due_date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          )}

          {/* Created */}
          {order.created_at && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Created</span>
              <span className="text-white">
                {new Date(order.created_at).toLocaleDateString()}
              </span>
            </div>
          )}

          {/* Notes */}
          {order.notes && (
            <div>
              <span className="text-slate-400 text-sm">Notes</span>
              <p className="text-white mt-1 p-2 rounded-lg bg-slate-800 text-sm">
                {order.notes}
              </p>
            </div>
          )}

          {/* Stage Progress */}
          <div className="pt-4">
            <div className="flex items-center justify-between mb-2">
              {stages.map((stage, idx) => (
                <div 
                  key={stage.id}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                    idx < currentStageIndex 
                      ? 'bg-green-500/20 text-green-400'
                      : idx === currentStageIndex
                        ? 'bg-purple-500 text-white'
                        : 'bg-slate-700 text-slate-500'
                  }`}
                >
                  {idx < currentStageIndex ? '✓' : stage.icon}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t flex gap-3" style={{ borderColor: '#334155' }}>
          <button
            onClick={onMoveBack}
            disabled={currentStageIndex <= 0}
            className="flex-1 px-4 py-2 rounded-lg font-medium text-slate-300 border border-slate-600 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ◀ Back
          </button>
          <button
            onClick={onMoveNext}
            disabled={currentStageIndex >= stages.length - 1}
            className="flex-1 px-4 py-2 rounded-lg font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
          >
            Next ▶
          </button>
        </div>
      </div>
    </div>
  );
}


export default OrderPipeline;
