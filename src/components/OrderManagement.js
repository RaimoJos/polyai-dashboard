import React, { useEffect, useState, useMemo } from 'react';
import { api, unwrap } from '../services/api';
import { safeUnwrap, formatErrorMessage, logError } from '../utils/apiSafety';
import toast from '../utils/toast';
import { useLanguage } from '../i18n';
import PaymentTracker from './PaymentTracker';

const OrderManagement = () => {
  const { t } = useLanguage();
  const [activeOrders, setActiveOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [fileLinkModal, setFileLinkModal] = useState(null);
  const [invoiceModal, setInvoiceModal] = useState(null);
  const [paymentModal, setPaymentModal] = useState(null);
  const [availableFiles, setAvailableFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [paymentData, setPaymentData] = useState({ method: 'bank_transfer', reference: '' });

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 15000);
    
    // Listen for new orders from QuoteCalculator
    const handleOrderCreated = () => {
      fetchOrders();
      toast.success(t('orders.title') + '!');
    };
    window.addEventListener('orderCreated', handleOrderCreated);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('orderCreated', handleOrderCreated);
    };
  }, [filterStatus, t]);

  const fetchOrders = async () => {
    try {
      setError(null);
      const params = filterStatus === 'all' ? {} : { status: filterStatus };
      const res = await api.listOrders(params);
      // FIXED: Use safeUnwrap for response validation
      const ordersData = safeUnwrap(res, 'array') ?? res ?? [];
      const orders = Array.isArray(ordersData) ? ordersData : (ordersData?.orders ?? ordersData?.data ?? []);
      setActiveOrders(orders);
      setError(null);
    } catch (err) {
      // FIXED: User-friendly error message
      const msg = formatErrorMessage(err, { action: 'load orders' });
      setError(msg);
      setActiveOrders([]);
      // FIXED: Log error with context
      logError(err, { component: 'OrderManagement', action: 'fetchOrders', filterStatus });
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableFiles = async () => {
    try {
      const res = await api.listFiles();
      // FIXED: Use safeUnwrap for response validation
      const body = safeUnwrap(res, 'object') || res || {};
      setAvailableFiles(Array.isArray(body.files) ? body.files : (Array.isArray(body) ? body : []));
    } catch (err) {
      // FIXED: Log error but don't break UX
      logError(err, { component: 'OrderManagement', action: 'fetchAvailableFiles' });
      setAvailableFiles([]);
    }
  };

  // Filter and sort orders
  const filteredOrders = useMemo(() => {
    let orders = [...activeOrders];
    
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      orders = orders.filter(o => 
        o.order_id?.toLowerCase().includes(q) ||
        o.item_name?.toLowerCase().includes(q) ||
        o.client_name?.toLowerCase().includes(q) ||
        o.material_type?.toLowerCase().includes(q)
      );
    }
    
    // Sort
    orders.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        case 'oldest':
          return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        case 'value-high':
          return (b.quote?.total || 0) - (a.quote?.total || 0);
        case 'value-low':
          return (a.quote?.total || 0) - (b.quote?.total || 0);
        case 'client':
          return (a.client_name || '').localeCompare(b.client_name || '');
        default:
          return 0;
      }
    });
    
    return orders;
  }, [activeOrders, searchQuery, sortBy]);

  const getStatusColor = (status) => ({
    'quoted': 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
    'accepted': 'bg-blue-900/50 text-blue-300 border-blue-700',
    'queued': 'bg-purple-900/50 text-purple-300 border-purple-700',
    'printing': 'bg-cyan-900/50 text-cyan-300 border-cyan-700',
    'post_processing': 'bg-orange-900/50 text-orange-300 border-orange-700',
    'ready': 'bg-green-900/50 text-green-300 border-green-700',
    'delivered': 'bg-emerald-900/50 text-emerald-300 border-emerald-700',
    'cancelled': 'bg-red-900/50 text-red-300 border-red-700'
  }[status] || 'bg-gray-700 text-gray-300 border-gray-600');

  const getStatusIcon = (status) => ({
    'quoted': '💬', 'accepted': '✅', 'queued': '⏳', 'printing': '🖨️',
    'post_processing': '🔧', 'ready': '📦', 'delivered': '🚚', 'cancelled': '❌'
  }[status] || '❔');

  const getStatusLabel = (status) => {
    const key = `orders.status.${status}`;
    const translated = t(key);
    return translated !== key ? translated : status;
  };

  const getPaymentBadge = (order) => {
    const status = order.payment_status || 'pending';
    const colors = {
      'paid': 'bg-green-900/50 text-green-300',
      'invoiced': 'bg-blue-900/50 text-blue-300',
      'pending': 'bg-yellow-900/50 text-yellow-300',
      'unpaid': 'bg-yellow-900/50 text-yellow-300',
      'overdue': 'bg-red-900/50 text-red-300'
    };
    const icons = { 'paid': '✓', 'invoiced': '📄', 'pending': '⏳', 'unpaid': '⏳', 'overdue': '⚠️' };
    const labels = {
      'paid': t('common.paid'),
      'invoiced': t('orders.status.invoiced'),
      'pending': t('common.unpaid'),
      'unpaid': t('common.unpaid'),
      'overdue': 'Overdue'
    };
    return { color: colors[status] || 'bg-gray-700', icon: icons[status] || '', label: labels[status] || status };
  };

  const handleAccept = async (order) => {
    setActionLoading(order.order_id);
    try {
      await api.updateOrderStatus(order.order_id, 'accepted');
      toast.success(t('orders.status.accepted') + '!');
      fetchOrders();
    } catch (err) {
      toast.error('Failed to accept order');
    } finally {
      setActionLoading(null);
    }
  };

  const handleQueueForProduction = async (order) => {
    // BLOCK if no file - must have STL to queue
    if (!order.file_path) {
      setFileLinkModal({ ...order, afterAction: 'queue' });
      setSelectedFile('');
      await fetchAvailableFiles();
      toast.error('File required');
      return;
    }
    
    setActionLoading(order.order_id);
    try {
      await api.queueOrderForProduction(order.order_id);
      toast.success(t('orders.status.queued') + '!');
      fetchOrders();
    } catch (err) {
      // Fallback: just update status
      await api.updateOrderStatus(order.order_id, 'queued').catch(() => {});
      fetchOrders();
    } finally {
      setActionLoading(null);
    }
  };

  const handleLinkFile = async () => {
    if (!fileLinkModal || !selectedFile) return;
    
    setActionLoading(fileLinkModal.order_id);
    try {
      await api.updateOrder(fileLinkModal.order_id, { file_path: selectedFile });
      toast.success('File linked!');
      
      // Continue with the pending action
      if (fileLinkModal.afterAction === 'queue') {
        try {
          await api.queueOrderForProduction(fileLinkModal.order_id);
        } catch {
          await api.updateOrderStatus(fileLinkModal.order_id, 'queued');
        }
        toast.success(t('orders.status.queued') + '!');
      }
      
      setFileLinkModal(null);
      fetchOrders();
    } catch (err) {
      toast.error('Failed to link file');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    setActionLoading(orderId);
    try {
      await api.updateOrderStatus(orderId, newStatus);
      toast.success(`${t('common.status')}: ${getStatusLabel(newStatus)}`);
      fetchOrders();
    } catch (err) {
      toast.error('Failed to update status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelOrder = async (order) => {
    if (!window.confirm(`${t('orders.cancelOrder')} "${order.item_name}"?`)) return;
    
    setActionLoading(order.order_id);
    try {
      await api.updateOrderStatus(order.order_id, 'cancelled', 'Cancelled by user');
      toast.success(t('orders.status.cancelled'));
      fetchOrders();
    } catch (err) {
      toast.error('Failed to cancel order');
    } finally {
      setActionLoading(null);
    }
  };

  const handleGenerateInvoice = async (order) => {
    setActionLoading(order.order_id);
    try {
      const res = await api.createInvoice({
        order_id: order.order_id,
        client_name: order.client_name,
        client_email: order.client_email,
        items: [{
          description: order.item_name,
          quantity: order.quantity || 1,
          unit_price: order.quote?.unit_price || order.quote?.total || 0,
          material: order.material_type
        }],
        total: order.quote?.total || 0
      });

      // FIXED: Use safeUnwrap for response validation
      const invoice = safeUnwrap(res, 'object') || res?.data || null;
      await api.updateOrder(order.order_id, { 
        invoice_number: invoice?.invoice_number,
        payment_status: 'invoiced'
      });
      
      toast.success(`${t('orders.invoice')} ${invoice?.invoice_number}!`);
      setInvoiceModal({ order, invoice });
      fetchOrders();
    } catch (err) {
      // FIXED: User-friendly error message
      const msg = formatErrorMessage(err, { action: 'generate invoice' });
      toast.error(msg);
      // FIXED: Log error with context
      logError(err, { component: 'OrderManagement', action: 'handleGenerateInvoice', order_id: order.order_id });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentModal) return;
    setActionLoading(paymentModal.order_id);
    try {
      if (paymentModal.invoice_number) {
        await api.markInvoicePaid(paymentModal.invoice_number, paymentData.method, paymentData.reference);
      }
      await api.updateOrder(paymentModal.order_id, { 
        payment_status: 'paid',
        payment_method: paymentData.method,
        paid_at: new Date().toISOString()
      });
      toast.success(t('common.paid') + '!');
      setPaymentModal(null);
      setPaymentData({ method: 'bank_transfer', reference: '' });
      fetchOrders();
    } catch (err) {
      toast.error('Failed to record payment');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleDateString('et-EE', { day: 'numeric', month: 'short' });
  };

  const stats = useMemo(() => ({
    total: activeOrders.length,
    unpaid: activeOrders.filter(o => ['pending', 'invoiced', 'unpaid'].includes(o.payment_status)).length,
    totalValue: activeOrders.reduce((sum, o) => sum + (o.quote?.total || 0), 0),
    noFile: activeOrders.filter(o => !o.file_path && !['delivered', 'cancelled'].includes(o.status)).length
  }), [activeOrders]);

  // Status filter labels
  const statusFilters = [
    { id: 'active', label: t('common.active') },
    { id: 'quoted', label: t('orders.status.quoted') },
    { id: 'accepted', label: t('orders.status.accepted') },
    { id: 'printing', label: t('orders.status.printing') },
    { id: 'ready', label: t('orders.status.ready') },
    { id: 'delivered', label: t('orders.status.delivered') },
    { id: 'all', label: t('common.all') },
  ];

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/4"></div>
          <div className="h-40 bg-gray-800 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h2 className="text-xl font-bold text-white">📦 {t('nav.orders')}</h2>
            <p className="text-sm text-zinc-500">
              {stats.total} {t('business.orders').toLowerCase()} • €{stats.totalValue.toFixed(2)}
              {stats.unpaid > 0 && <span className="text-orange-400 ml-2">• {stats.unpaid} {t('common.unpaid')}</span>}
            </p>
          </div>
          <button onClick={fetchOrders} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition">🔄</button>
        </div>

        {/* Search & Sort */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`${t('common.search')}...`}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
              >
                ×
              </button>
            )}
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="newest">{t('common.newest')}</option>
            <option value="oldest">{t('common.oldest')}</option>
            <option value="value-high">{t('common.valueHigh')}</option>
            <option value="value-low">{t('common.valueLow')}</option>
            <option value="client">{t('common.client')}</option>
          </select>
        </div>

        {/* Status Filters */}
        <div className="flex gap-2 flex-wrap">
          {statusFilters.map(f => (
            <button
              key={f.id}
              onClick={() => setFilterStatus(f.id)}
              className={`px-3 py-1.5 text-sm rounded-lg transition ${
                filterStatus === f.id 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-800 text-zinc-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-900/30 border border-red-700 text-red-400 rounded-lg text-sm flex justify-between">
          {error} <button onClick={() => setError(null)} className="text-red-300 hover:text-white">×</button>
        </div>
      )}

      {/* Orders List */}
      <div className="p-4 max-h-[500px] overflow-y-auto">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            <p className="text-4xl mb-2">{searchQuery ? '🔍' : '📭'}</p>
            <p>{searchQuery ? t('common.noData') : t('orders.noActive')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map(order => {
              const paymentBadge = getPaymentBadge(order);
              const hasFile = !!order.file_path;
              const isActive = !['delivered', 'cancelled'].includes(order.status);
              
              return (
                <div key={order.order_id} className={`border rounded-lg p-4 transition ${
                  !isActive ? 'opacity-60 bg-gray-800/30 border-gray-700' :
                  hasFile ? 'bg-gray-800/50 border-gray-700 hover:bg-gray-800' : 'bg-yellow-900/10 border-yellow-700/50'
                }`}>
                  {/* Order Header */}
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-zinc-500">{order.order_id}</span>
                        <span className={`px-2 py-0.5 rounded text-xs border ${getStatusColor(order.status)}`}>
                          {getStatusIcon(order.status)} {getStatusLabel(order.status)}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs ${paymentBadge.color}`}>
                          {paymentBadge.icon} {paymentBadge.label}
                        </span>
                        {order.rush_order && <span className="px-2 py-0.5 bg-red-900/50 text-red-300 rounded text-xs">🔥 RUSH</span>}
                      </div>
                      <h3 className="font-bold mt-1 text-white">{order.item_name || 'Unnamed'}</h3>
                      <p className="text-sm text-zinc-500">
                        {order.client_name} • {order.quantity || 1}× • {order.material_type}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-green-400">€{(order.quote?.total || 0).toFixed(2)}</p>
                      <p className="text-xs text-zinc-500">{formatDate(order.created_at)}</p>
                    </div>
                  </div>

                  {/* File Status */}
                  {isActive && (
                    hasFile ? (
                      <p className="text-xs text-green-400 mb-2">📄 {order.file_path.split(/[/\\]/).pop()}</p>
                    ) : (
                      <div className="text-xs text-yellow-400 mb-2 flex items-center gap-2">
                        <span>⚠️ No file linked</span>
                        <button 
                          onClick={async () => {
                            setFileLinkModal(order);
                            setSelectedFile('');
                            await fetchAvailableFiles();
                          }}
                          className="underline hover:text-yellow-300"
                        >
                          {t('common.add')}
                        </button>
                      </div>
                    )
                  )}

                  {order.invoice_number && (
                    <p className="text-xs text-blue-400 mb-2">📄 {t('orders.invoice')}: {order.invoice_number}</p>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    {/* Status workflow */}
                    {order.status === 'quoted' && (
                      <>
                        <button onClick={() => handleAccept(order)} disabled={actionLoading === order.order_id}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-500 disabled:opacity-50 transition">
                          ✅ {t('orders.status.accepted')}
                        </button>
                        <button onClick={() => handleCancelOrder(order)} disabled={actionLoading === order.order_id}
                          className="px-3 py-1.5 bg-gray-700 text-zinc-400 rounded-lg text-sm hover:bg-gray-600 disabled:opacity-50 transition">
                          ✕ {t('orders.cancelOrder')}
                        </button>
                      </>
                    )}
                    {order.status === 'accepted' && (
                      <>
                        <button 
                          onClick={() => handleQueueForProduction(order)} 
                          disabled={actionLoading === order.order_id}
                          className={`px-3 py-1.5 rounded-lg text-sm transition disabled:opacity-50 ${
                            hasFile 
                              ? 'bg-blue-600 text-white hover:bg-blue-500' 
                              : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                          }`}
                          title={hasFile ? t('orders.status.queued') : 'Add file first'}
                        >
                          🏭 {t('orders.status.queued')}
                        </button>
                        <button onClick={() => handleCancelOrder(order)} disabled={actionLoading === order.order_id}
                          className="px-3 py-1.5 bg-gray-700 text-zinc-400 rounded-lg text-sm hover:bg-gray-600 disabled:opacity-50 transition">
                          ✕ {t('orders.cancelOrder')}
                        </button>
                      </>
                    )}
                    {order.status === 'queued' && (
                      <>
                        <button onClick={() => handleStatusUpdate(order.order_id, 'printing')} disabled={actionLoading === order.order_id}
                          className="px-3 py-1.5 bg-cyan-600 text-white rounded-lg text-sm hover:bg-cyan-500 disabled:opacity-50 transition">
                          🖨️ {t('orders.startPrint')}
                        </button>
                        <button onClick={() => handleCancelOrder(order)} disabled={actionLoading === order.order_id}
                          className="px-3 py-1.5 bg-gray-700 text-zinc-400 rounded-lg text-sm hover:bg-gray-600 disabled:opacity-50 transition">
                          ✕ {t('orders.cancelOrder')}
                        </button>
                      </>
                    )}
                    {order.status === 'printing' && (
                      <button onClick={() => handleStatusUpdate(order.order_id, 'post_processing')} disabled={actionLoading === order.order_id}
                        className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-500 disabled:opacity-50 transition">
                        ✓ {t('orders.status.completed')}
                      </button>
                    )}
                    {order.status === 'post_processing' && (
                      <button onClick={() => handleStatusUpdate(order.order_id, 'ready')} disabled={actionLoading === order.order_id}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-500 disabled:opacity-50 transition">
                        ✓ {t('orders.status.ready')}
                      </button>
                    )}
                    {order.status === 'ready' && (
                      <button onClick={() => handleStatusUpdate(order.order_id, 'delivered')} disabled={actionLoading === order.order_id}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-500 disabled:opacity-50 transition">
                        🚚 {t('orders.status.delivered')}
                      </button>
                    )}

                    {/* Invoice & Payment - only for active orders */}
                    {isActive && !order.invoice_number && order.status !== 'quoted' && (
                      <button onClick={() => handleGenerateInvoice(order)} disabled={actionLoading === order.order_id}
                        className="px-3 py-1.5 bg-gray-700 text-zinc-300 rounded-lg text-sm hover:bg-gray-600 disabled:opacity-50 transition">
                        📄 {t('orders.invoice')}
                      </button>
                    )}
                    {order.payment_status !== 'paid' && order.invoice_number && (
                      <button onClick={() => setPaymentModal(order)}
                        className="px-3 py-1.5 bg-green-900/50 text-green-300 rounded-lg text-sm hover:bg-green-800/50 transition">
                        💳 {t('orders.recordPayment')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* File Link Modal */}
      {fileLinkModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-white mb-4">📄 Link STL/3MF File</h3>
            <p className="text-sm text-zinc-400 mb-4">
              {t('nav.orders')}: <span className="text-white">{fileLinkModal.item_name}</span>
            </p>
            
            <select 
              value={selectedFile} 
              onChange={(e) => setSelectedFile(e.target.value)} 
              className="w-full border border-gray-700 bg-gray-800 text-white rounded-lg px-3 py-3 mb-4"
            >
              <option value="">{t('common.search')}...</option>
              {availableFiles.map(f => (
                <option key={f.path || f.name} value={f.path || f.name}>{f.name || f.path}</option>
              ))}
            </select>
            
            <input 
              type="text" 
              value={selectedFile} 
              onChange={(e) => setSelectedFile(e.target.value)} 
              placeholder="/path/to/file.stl" 
              className="w-full border border-gray-700 bg-gray-800 text-white rounded-lg px-3 py-2 mb-4" 
            />
            
            <div className="flex gap-2">
              <button onClick={() => setFileLinkModal(null)} className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition">
                {t('common.cancel')}
              </button>
              <button 
                onClick={handleLinkFile} 
                disabled={!selectedFile} 
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg disabled:opacity-50 hover:bg-purple-500 transition"
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {invoiceModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-white mb-4">📄 {t('orders.invoice')}</h3>
            <div className="bg-green-900/30 border border-green-700 p-4 rounded-lg mb-4">
              <p className="font-bold text-green-400">{t('orders.invoice')} #{invoiceModal.invoice?.invoice_number}</p>
              <p className="text-sm text-zinc-400">{invoiceModal.order?.client_name}</p>
              <p className="text-lg font-bold mt-2 text-white">€{(invoiceModal.order?.quote?.total || 0).toFixed(2)}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setInvoiceModal(null)} className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition">
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Tracker Modal */}
      {paymentModal && (
        <PaymentTracker
          order={paymentModal}
          onClose={() => setPaymentModal(null)}
          onPaymentRecorded={() => {
            setPaymentModal(null);
            fetchOrders();
          }}
        />
      )}
    </div>
  );
};

export default OrderManagement;
