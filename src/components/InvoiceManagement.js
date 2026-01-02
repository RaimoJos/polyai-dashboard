import React, { useState, useEffect, useMemo } from 'react';
import { api, unwrap } from '../services/api';
import { sanitizeText } from '../utils/sanitization';
import { useLanguage } from '../i18n';
import toast from '../utils/toast';
import InvoicePDFPreview from './InvoicePDFPreview';
import { DEFAULT_COMPANY } from '../utils/estonianInvoice';

/**
 * InvoiceManagement - Manage business invoices
 * Lists, filters, and allows marking invoices as paid
 */
const InvoiceManagement = () => {
  const { t } = useLanguage();
  const [invoices, setInvoices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [paymentModal, setPaymentModal] = useState(null);
  const [createModal, setCreateModal] = useState(null);
  const [detailsModal, setDetailsModal] = useState(null);
  const [pdfPreviewModal, setPdfPreviewModal] = useState(null);
  const [pdfPreviewClient, setPdfPreviewClient] = useState(null);
  const [paymentData, setPaymentData] = useState({ method: 'bank_transfer', reference: '' });

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [invoicesRes, ordersRes, clientsRes] = await Promise.all([
        api.listInvoices().catch(() => []),
        api.listOrders({ status: 'all' }).catch(() => []),
        api.getClients().catch(() => [])
      ]);
      
      const invoicesData = Array.isArray(invoicesRes) ? invoicesRes : (invoicesRes?.data ?? invoicesRes?.invoices ?? []);
      const ordersData = Array.isArray(ordersRes) ? ordersRes : (ordersRes?.data ?? ordersRes?.orders ?? []);
      const clientsData = Array.isArray(clientsRes) ? clientsRes : (clientsRes?.data ?? clientsRes?.clients ?? []);
      
      setInvoices(invoicesData);
      setOrders(ordersData);
      setClients(clientsData);
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort invoices
  const filteredInvoices = useMemo(() => {
    let result = [...invoices];
    
    // Status filter
    if (filterStatus !== 'all') {
      if (filterStatus === 'overdue') {
        result = result.filter(inv => {
          if (inv.status === 'paid') return false;
          const dueDate = new Date(inv.due_date);
          return dueDate < new Date();
        });
      } else {
        result = result.filter(inv => inv.status === filterStatus);
      }
    }
    
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(inv =>
        inv.invoice_number?.toLowerCase().includes(q) ||
        inv.client_name?.toLowerCase().includes(q) ||
        inv.order_id?.toLowerCase().includes(q)
      );
    }
    
    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at || b.date || 0) - new Date(a.created_at || a.date || 0);
        case 'oldest':
          return new Date(a.created_at || a.date || 0) - new Date(b.created_at || b.date || 0);
        case 'amount-high':
          return (b.total || 0) - (a.total || 0);
        case 'amount-low':
          return (a.total || 0) - (b.total || 0);
        case 'due-date':
          return new Date(a.due_date || 0) - new Date(b.due_date || 0);
        default:
          return 0;
      }
    });
    
    return result;
  }, [invoices, filterStatus, searchQuery, sortBy]);

  // Calculate stats
  const stats = useMemo(() => {
    const now = new Date();
    return {
      total: invoices.length,
      pending: invoices.filter(inv => inv.status === 'pending' || inv.status === 'sent').length,
      paid: invoices.filter(inv => inv.status === 'paid').length,
      overdue: invoices.filter(inv => {
        if (inv.status === 'paid') return false;
        const dueDate = new Date(inv.due_date);
        return dueDate < now;
      }).length,
      totalPending: invoices
        .filter(inv => inv.status !== 'paid')
        .reduce((sum, inv) => sum + (inv.total || 0), 0),
      totalPaid: invoices
        .filter(inv => inv.status === 'paid')
        .reduce((sum, inv) => sum + (inv.total || 0), 0),
    };
  }, [invoices]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('et-EE', { style: 'currency', currency: 'EUR' }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('et-EE');
  };

  // Find client by ID or name - first check if invoice has embedded client data
  const findClient = (invoice) => {
    if (!invoice) return null;
    
    // Helper to check if client object has useful data (beyond just name)
    const hasUsefulClientData = (client) => {
      if (!client || typeof client !== 'object') return false;
      return !!(client.address || client.reg_number || client.vat_number || client.city || client.postal_code);
    };
    
    // FIRST: Check if invoice already has embedded client data with useful info
    if (invoice.client && hasUsefulClientData(invoice.client)) {
      // Invoice has full client data from backend
      return {
        client_id: invoice.client.client_id || invoice.client_id || '',
        name: invoice.client.name || invoice.client_name || '',
        company: invoice.client.company || invoice.client.name || '',
        email: invoice.client.email || '',
        phone: invoice.client.phone || '',
        address: invoice.client.address || '',
        city: invoice.client.city || '',
        postal_code: invoice.client.postal_code || '',
        county: invoice.client.county || '',
        reg_number: invoice.client.reg_number || '',
        vat_number: invoice.client.vat_number || '',
      };
    }
    
    // SECOND: Try to find in clients list by client_id
    if (invoice.client_id) {
      const client = clients.find(c => 
        c.client_id === invoice.client_id || 
        c.id === invoice.client_id
      );
      if (client) return client;
    }
    
    // THIRD: Fall back to matching by name (case-insensitive, normalize characters)
    const normalize = (str) => (str || '').toLowerCase().replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ä/g, 'a').replace(/õ/g, 'o').trim();
    const invoiceName = normalize(invoice.client_name || invoice.client?.name);
    
    if (invoiceName) {
      const client = clients.find(c => {
        const name = normalize(c.name);
        const company = normalize(c.company);
        return name === invoiceName || company === invoiceName ||
               name.includes(invoiceName) || invoiceName.includes(name) ||
               company.includes(invoiceName) || invoiceName.includes(company);
      });
      if (client) return client;
    }
    
    // LAST: Return basic info from invoice if no client found
    console.log('[InvoiceManagement] Could not find client for invoice:', {
      invoice_number: invoice.invoice_number,
      client_id: invoice.client_id,
      client_name: invoice.client_name || invoice.client?.name,
      available_clients: clients.map(c => ({ id: c.client_id, name: c.name, company: c.company }))
    });
    
    return {
      name: invoice.client_name || invoice.client?.name || '',
      company: invoice.client?.company || invoice.client_name || invoice.client?.name || '',
    };
  };

  // Open PDF preview with full client info
  const openPdfPreview = (invoice) => {
    const client = findClient(invoice);
    setPdfPreviewClient(client);
    setPdfPreviewModal(invoice);
  };

  const getStatusColor = (invoice) => {
    if (invoice.status === 'paid') return 'bg-green-500/20 text-green-400 border-green-500/30';
    const dueDate = new Date(invoice.due_date);
    if (dueDate < new Date()) return 'bg-red-500/20 text-red-400 border-red-500/30';
    if (invoice.status === 'sent') return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  };

  const getStatusLabel = (invoice) => {
    if (invoice.status === 'paid') return t('invoices.status.paid') || 'Paid';
    const dueDate = new Date(invoice.due_date);
    if (dueDate < new Date()) return t('invoices.status.overdue') || 'Overdue';
    if (invoice.status === 'sent') return t('invoices.status.sent') || 'Sent';
    return t('invoices.status.pending') || 'Pending';
  };

  const handleMarkPaid = async () => {
    if (!paymentModal) return;
    
    try {
      await api.markInvoicePaid(
        paymentModal.invoice_number,
        paymentData.method,
        paymentData.reference
      );
      toast.success(t('invoices.markedPaid') || 'Invoice marked as paid');
      setPaymentModal(null);
      setPaymentData({ method: 'bank_transfer', reference: '' });
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to update invoice');
    }
  };

  const handleCreateInvoice = async () => {
    if (!createModal) return;
    
    try {
      const order = createModal;
      
      // Find full client data
      let clientData = {};
      if (order.client_id) {
        const client = clients.find(c => 
          c.client_id === order.client_id || 
          c.id === order.client_id
        );
        if (client) {
          clientData = {
            client_id: client.client_id,
            client_name: client.company || client.name,
            client_company: client.company,
            client_email: client.email,
            client_phone: client.phone,
            client_address: client.address,
            client_city: client.city,
            client_postal_code: client.postal_code,
            client_county: client.county,
            client_reg_number: client.reg_number,
            client_vat_number: client.vat_number,
          };
        }
      }
      
      // Fallback to order data if no client found
      if (!clientData.client_name) {
        clientData.client_name = order.client_name || order.customer_name;
        clientData.client_id = order.client_id;
      }
      
      const invoiceData = {
        order_id: order.order_id,
        ...clientData,
        // Store client object with all contact info for PDF generation
        client: {
          name: clientData.client_name || clientData.client_company || '',
          company: clientData.client_company || '',
          email: clientData.client_email || order.client_email || '',
          phone: clientData.client_phone || order.client_phone || '',
          address: clientData.client_address || '',
          city: clientData.client_city || '',
          postal_code: clientData.client_postal_code || '',
          county: clientData.client_county || '',
          reg_number: clientData.client_reg_number || '',
          vat_number: clientData.client_vat_number || '',
        },
        items: (() => {
          const items = [];
          
          // Main print job item - calculate base price (without modeling)
          const quote = order.quote || {};
          const modelingFee = parseFloat(quote.modeling_fee) || 0;
          const baseSubtotal = (parseFloat(quote.subtotal) || order.total_price || 0) - modelingFee;
          
          // Build description with material info
          const materialInfo = order.material_type ? ` (${order.material_type}` : '';
          const weightInfo = order.material_weight_g ? `, ${Math.round(order.material_weight_g)}g)` : (materialInfo ? ')' : '');
          const itemDesc = (order.item_name || 'Print Job') + materialInfo + weightInfo;
          
          items.push({
            description: itemDesc,
            quantity: order.quantity || 1,
            unit_price: baseSubtotal / (order.quantity || 1),
            unit: 'tk'
          });
          
          // Add modeling fee as separate line item if present
          if (modelingFee > 0) {
            const hours = quote.modeling_hours || 1;
            items.push({
              description: `3D Modelleerimine (${hours}h)`,
              quantity: 1,
              unit_price: modelingFee,
              unit: 'h'
            });
          }
          
          return items;
        })(),
        subtotal: order.quote?.subtotal || order.total_price || 0,
        vat_rate: 0.24,
        total: order.quote?.total || order.total_price || 0,
        notes: order.notes || ''
      };
      
      console.log('[Invoice] Creating with data:', JSON.stringify(invoiceData, null, 2));
      console.log('[Invoice] Items being sent:', invoiceData.items);
      await api.createInvoice(invoiceData);
      toast.success(t('invoices.created') || 'Invoice created');
      setCreateModal(null);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to create invoice');
    }
  };

  // Orders that don't have invoices yet
  const uninvoicedOrders = useMemo(() => {
    const invoicedOrderIds = new Set(invoices.map(inv => inv.order_id));
    return orders.filter(order => 
      !invoicedOrderIds.has(order.order_id) &&
      (order.status === 'quoted' || order.status === 'accepted' || order.status === 'queued' || 
       order.status === 'printing' || order.status === 'ready' || 
       order.status === 'delivered' || order.status === 'completed')
    );
  }, [orders, invoices]);

  if (loading && invoices.length === 0) {
    return (
      <div className="rounded-xl border p-6" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-3 text-slate-400">{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <span>📄</span>
            {t('invoices.total') || 'Total Invoices'}
          </div>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        
        <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <div className="flex items-center gap-2 text-yellow-400 text-sm mb-1">
            <span>⏳</span>
            {t('invoices.pending') || 'Pending'}
          </div>
          <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
          <p className="text-xs text-slate-500">{formatCurrency(stats.totalPending)}</p>
        </div>
        
        <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <div className="flex items-center gap-2 text-green-400 text-sm mb-1">
            <span>✅</span>
            {t('invoices.paid') || 'Paid'}
          </div>
          <p className="text-2xl font-bold text-green-400">{stats.paid}</p>
          <p className="text-xs text-slate-500">{formatCurrency(stats.totalPaid)}</p>
        </div>
        
        <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <div className="flex items-center gap-2 text-red-400 text-sm mb-1">
            <span>⚠️</span>
            {t('invoices.overdue') || 'Overdue'}
          </div>
          <p className="text-2xl font-bold text-red-400">{stats.overdue}</p>
        </div>
      </div>

      {/* Main Panel */}
      <div className="rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        {/* Header */}
        <div className="p-4 border-b" style={{ borderColor: '#334155' }}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              📋 {t('invoices.title') || 'Invoices'}
            </h2>
            
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('common.search') || 'Search...'}
                className="px-3 py-1.5 rounded-lg text-sm text-white border"
                style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
              />
              
              {/* Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-sm text-white border"
                style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
              >
                <option value="all">{t('common.all') || 'All'}</option>
                <option value="pending">{t('invoices.status.pending') || 'Pending'}</option>
                <option value="sent">{t('invoices.status.sent') || 'Sent'}</option>
                <option value="paid">{t('invoices.status.paid') || 'Paid'}</option>
                <option value="overdue">{t('invoices.status.overdue') || 'Overdue'}</option>
              </select>
              
              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-sm text-white border"
                style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
              >
                <option value="newest">{t('common.newest') || 'Newest'}</option>
                <option value="oldest">{t('common.oldest') || 'Oldest'}</option>
                <option value="amount-high">{t('invoices.amountHigh') || 'Amount (High)'}</option>
                <option value="amount-low">{t('invoices.amountLow') || 'Amount (Low)'}</option>
                <option value="due-date">{t('invoices.dueDate') || 'Due Date'}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Uninvoiced Orders Banner */}
        {uninvoicedOrders.length > 0 && (
          <div className="p-3 border-b bg-purple-500/10" style={{ borderColor: '#334155' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-purple-300">
                <span>💡</span>
                <span className="text-sm">
                  {uninvoicedOrders.length} {t('invoices.ordersNeedInvoice') || 'orders need invoices'}
                </span>
              </div>
              <button
                onClick={() => setCreateModal(uninvoicedOrders[0])}
                className="px-3 py-1 rounded-lg text-xs font-medium text-purple-300 border border-purple-500/30 hover:bg-purple-500/20 transition"
              >
                {t('invoices.createInvoice') || 'Create Invoice'}
              </button>
            </div>
          </div>
        )}

        {/* Invoice List */}
        <div className="divide-y" style={{ borderColor: '#334155' }}>
          {filteredInvoices.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <span className="text-4xl block mb-2">📄</span>
              <p>{t('invoices.noInvoices') || 'No invoices found'}</p>
            </div>
          ) : (
            filteredInvoices.map((invoice) => (
              <div
                key={invoice.invoice_id || invoice.invoice_number}
                className="p-4 hover:bg-slate-700/30 transition cursor-pointer"
                onClick={() => setDetailsModal(invoice)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-medium text-white">
                        {invoice.invoice_number}
                      </p>
                      <p className="text-sm text-slate-400">
                        {sanitizeText(invoice.client_name) || t('common.unknown')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold text-white">{formatCurrency(invoice.total)}</p>
                      <p className="text-xs text-slate-500">
                        {t('invoices.due') || 'Due'}: {formatDate(invoice.due_date)}
                      </p>
                    </div>
                    
                    <span className={`px-2 py-1 rounded-full text-xs border ${getStatusColor(invoice)}`}>
                      {getStatusLabel(invoice)}
                    </span>
                    
                    {invoice.status !== 'paid' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPaymentModal(invoice);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-green-400 border border-green-500/30 hover:bg-green-500/20 transition"
                      >
                        💰 {t('invoices.markPaid') || 'Mark Paid'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setPaymentModal(null)} />
          <div className="relative w-full max-w-md rounded-xl border p-6" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
            <h3 className="text-lg font-semibold text-white mb-4">
              💰 {t('invoices.recordPayment') || 'Record Payment'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-slate-400 text-sm mb-1">{t('invoices.invoice') || 'Invoice'}</p>
                <p className="text-white font-medium">{paymentModal.invoice_number}</p>
                <p className="text-green-400 font-bold">{formatCurrency(paymentModal.total)}</p>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  {t('invoices.paymentMethod') || 'Payment Method'}
                </label>
                <select
                  value={paymentData.method}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, method: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-white border"
                  style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                >
                  <option value="bank_transfer">{t('invoices.methods.bankTransfer') || 'Bank Transfer'}</option>
                  <option value="cash">{t('invoices.methods.cash') || 'Cash'}</option>
                  <option value="card">{t('invoices.methods.card') || 'Card'}</option>
                  <option value="other">{t('invoices.methods.other') || 'Other'}</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  {t('invoices.reference') || 'Payment Reference'}
                </label>
                <input
                  type="text"
                  value={paymentData.reference}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, reference: e.target.value }))}
                  placeholder={t('invoices.referencePlaceholder') || 'Transaction ID or note'}
                  className="w-full px-3 py-2 rounded-lg text-white border"
                  style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setPaymentModal(null)}
                className="flex-1 px-4 py-2 rounded-lg border text-slate-300 hover:bg-slate-700 transition"
                style={{ borderColor: '#334155' }}
              >
                {t('common.cancel') || 'Cancel'}
              </button>
              <button
                onClick={handleMarkPaid}
                className="flex-1 px-4 py-2 rounded-lg font-medium text-white transition"
                style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}
              >
                ✓ {t('invoices.confirmPayment') || 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Invoice Modal */}
      {createModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setCreateModal(null)} />
          <div className="relative w-full max-w-lg rounded-xl border p-6" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
            <h3 className="text-lg font-semibold text-white mb-4">
              📄 {t('invoices.createInvoice') || 'Create Invoice'}
            </h3>
            
            <div className="space-y-4">
              <div className="p-4 rounded-lg" style={{ backgroundColor: '#0f172a' }}>
                <p className="text-sm text-slate-400 mb-2">{t('invoices.fromOrder') || 'From Order'}</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">
                      {createModal.order_number || `#${createModal.order_id?.slice(-6)}`}
                    </p>
                    <p className="text-sm text-slate-400">
                      {sanitizeText(createModal.client_name) || sanitizeText(createModal.customer_name)}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-green-400">
                    {formatCurrency(createModal.quote?.total || createModal.total_price)}
                  </p>
                </div>
              </div>
              
              <div className="text-sm text-slate-400">
                <p>• {t('invoices.vatIncluded') || 'VAT 24% will be calculated automatically'}</p>
                <p>• {t('invoices.dueDays') || 'Due date: 14 days from today'}</p>
              </div>
              
              {/* Order selector for other uninvoiced orders */}
              {uninvoicedOrders.length > 1 && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">
                    {t('invoices.selectOrder') || 'Or select another order'}
                  </label>
                  <select
                    value={createModal.order_id}
                    onChange={(e) => {
                      const order = uninvoicedOrders.find(o => o.order_id === e.target.value);
                      if (order) setCreateModal(order);
                    }}
                    className="w-full px-3 py-2 rounded-lg text-white border"
                    style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                  >
                    {uninvoicedOrders.map(order => (
                      <option key={order.order_id} value={order.order_id}>
                        {order.order_number || `#${order.order_id?.slice(-6)}`} - {order.client_name || order.customer_name} - {formatCurrency(order.quote?.total || order.total_price)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setCreateModal(null)}
                className="flex-1 px-4 py-2 rounded-lg border text-slate-300 hover:bg-slate-700 transition"
                style={{ borderColor: '#334155' }}
              >
                {t('common.cancel') || 'Cancel'}
              </button>
              <button
                onClick={handleCreateInvoice}
                className="flex-1 px-4 py-2 rounded-lg font-medium text-white transition"
                style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
              >
                📄 {t('invoices.create') || 'Create Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Details Modal */}
      {detailsModal && (() => {
        // Get full client info for display
        const clientInfo = findClient(detailsModal);
        // ALWAYS recalculate totals with 24% VAT (stored values might be wrong)
        const subtotal = detailsModal.subtotal || 0;
        const vatAmount = subtotal * 0.24; // Always use 24% Estonian VAT
        const calculatedTotal = subtotal + vatAmount;
        // Check if stored values differ
        const storedTotal = detailsModal.total || 0;
        const hasMismatch = Math.abs(storedTotal - calculatedTotal) > 0.01;
        
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70" onClick={() => setDetailsModal(null)} />
            <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
              {/* Header */}
              <div className="p-6 border-b sticky top-0 z-10" style={{ borderColor: '#334155', backgroundColor: '#1e293b' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-white">{detailsModal.invoice_number}</h3>
                    <p className="text-slate-400">{sanitizeText(clientInfo?.company || clientInfo?.name || detailsModal.client_name)}</p>
                  </div>
                  <span className={`px-3 py-1.5 rounded-full text-sm border ${getStatusColor(detailsModal)}`}>
                    {getStatusLabel(detailsModal)}
                  </span>
                </div>
              </div>
              
              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Client Info + Dates Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Client Details */}
                  <div className="p-4 rounded-lg" style={{ backgroundColor: '#0f172a' }}>
                    <p className="text-sm text-slate-400 mb-2 font-medium">👤 {t('invoices.clientDetails') || 'Client Details'}</p>
                    <div className="space-y-1">
                      <p className="text-white font-medium">{clientInfo?.company || clientInfo?.name || detailsModal.client_name}</p>
                      {clientInfo?.address && <p className="text-sm text-slate-300">{clientInfo.address}</p>}
                      {(clientInfo?.city || clientInfo?.postal_code || clientInfo?.county) && (
                        <p className="text-sm text-slate-300">
                          {[clientInfo?.postal_code, clientInfo?.city, clientInfo?.county].filter(Boolean).join(', ')}
                        </p>
                      )}
                      {clientInfo?.reg_number && (
                        <p className="text-xs text-slate-400 mt-2">Rg-kood: {clientInfo.reg_number}</p>
                      )}
                      {clientInfo?.vat_number && (
                        <p className="text-xs text-slate-400">KMKR: {clientInfo.vat_number}</p>
                      )}
                      {clientInfo?.email && (
                        <p className="text-xs text-slate-500 mt-1">📧 {clientInfo.email}</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Dates */}
                  <div className="p-4 rounded-lg" style={{ backgroundColor: '#0f172a' }}>
                    <p className="text-sm text-slate-400 mb-2 font-medium">📅 {t('invoices.dates') || 'Dates'}</p>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">{t('invoices.invoiceDate') || 'Invoice Date'}</span>
                        <span className="text-white">{formatDate(detailsModal.invoice_date || detailsModal.date || detailsModal.created_at)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">{t('invoices.dueDate') || 'Due Date'}</span>
                        <span className="text-white">{formatDate(detailsModal.due_date)}</span>
                      </div>
                      {(detailsModal.paid_at || detailsModal.payment_date) && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">{t('invoices.paidDate') || 'Paid Date'}</span>
                          <span className="text-green-400">{formatDate(detailsModal.paid_at || detailsModal.payment_date)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Items */}
                {detailsModal.items && detailsModal.items.length > 0 && (
                  <div>
                    <p className="text-sm text-slate-400 mb-2 font-medium">📦 {t('invoices.items') || 'Items'}</p>
                    <div className="rounded-lg overflow-hidden" style={{ backgroundColor: '#0f172a' }}>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b" style={{ borderColor: '#334155' }}>
                            <th className="text-left p-3 text-slate-400">Kirjeldus</th>
                            <th className="text-right p-3 text-slate-400">Kogus</th>
                            <th className="text-right p-3 text-slate-400">Hind</th>
                            <th className="text-right p-3 text-slate-400">Summa</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailsModal.items.map((item, idx) => (
                            <tr key={idx} className="border-b" style={{ borderColor: '#334155' }}>
                              <td className="p-3 text-white">{item.description || item.name}</td>
                              <td className="p-3 text-right text-slate-300">{item.quantity || 1}</td>
                              <td className="p-3 text-right text-slate-300">{formatCurrency(item.unit_price)}</td>
                              <td className="p-3 text-right text-white">{formatCurrency(item.subtotal || ((item.quantity || 1) * (item.unit_price || 0)))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                {/* Totals */}
                <div className="flex justify-end">
                  <div className="w-72 p-4 rounded-lg" style={{ backgroundColor: '#0f172a' }}>
                    <div className="space-y-2">
                      <div className="flex justify-between text-slate-400">
                        <span>Summa km-ta</span>
                        <span>{formatCurrency(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Käibemaks 24%</span>
                        <span>{formatCurrency(vatAmount)}</span>
                      </div>
                      <div className="flex justify-between text-xl font-bold text-white pt-2 border-t" style={{ borderColor: '#334155' }}>
                        <span>Kokku</span>
                        <span>{formatCurrency(calculatedTotal)}</span>
                      </div>
                      {/* Show warning if stored total differs from calculated */}
                      {hasMismatch && (
                        <p className="text-xs text-yellow-400 mt-2">
                          ⚠️ Vana summa (vale KM): {formatCurrency(storedTotal)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Payment Info */}
                {(detailsModal.payment_method || detailsModal.payment_status === 'paid') && (
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                    <p className="text-green-400 font-medium mb-1">✅ {t('invoices.paymentReceived') || 'Payment Received'}</p>
                    <p className="text-sm text-green-300">
                      {detailsModal.payment_method && `${t('invoices.method') || 'Method'}: ${detailsModal.payment_method}`}
                      {detailsModal.payment_reference && ` • Viide: ${detailsModal.payment_reference}`}
                    </p>
                  </div>
                )}
              </div>
              
              {/* Footer */}
              <div className="p-4 border-t flex justify-between sticky bottom-0" style={{ borderColor: '#334155', backgroundColor: '#1e293b' }}>
                <button
                  onClick={() => setDetailsModal(null)}
                  className="px-4 py-2 rounded-lg border text-slate-300 hover:bg-slate-700 transition"
                  style={{ borderColor: '#334155' }}
                >
                  {t('common.close') || 'Close'}
                </button>
                
                <div className="flex gap-2">
                  {detailsModal.status !== 'paid' && detailsModal.payment_status !== 'paid' && (
                    <button
                      onClick={() => {
                        setDetailsModal(null);
                        setPaymentModal(detailsModal);
                      }}
                      className="px-4 py-2 rounded-lg font-medium text-green-400 border border-green-500/30 hover:bg-green-500/20 transition"
                    >
                      💰 {t('invoices.markPaid') || 'Mark Paid'}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      openPdfPreview(detailsModal);
                    }}
                    className="px-4 py-2 rounded-lg font-medium text-white transition"
                    style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
                  >
                    📥 {t('invoices.download') || 'Download'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PDF Preview Modal */}
      <InvoicePDFPreview
        invoice={pdfPreviewModal}
        client={pdfPreviewClient}
        company={DEFAULT_COMPANY}
        isOpen={!!pdfPreviewModal}
        onClose={() => {
          setPdfPreviewModal(null);
          setPdfPreviewClient(null);
        }}
      />
    </div>
  );
};

export default InvoiceManagement;
