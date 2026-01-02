import React, { useState, useEffect, useMemo } from 'react';
import { api, unwrap } from '../services/api';
import { useLanguage } from '../i18n';
import toast from '../utils/toast';

/**
 * PaymentTracker - Comprehensive payment management for orders
 * Features: Payment recording, partial payments, payment history, overdue tracking
 */
const PaymentTracker = ({ order, onPaymentRecorded, onClose }) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [newPayment, setNewPayment] = useState({
    amount: 0,
    method: 'bank_transfer',
    reference: '',
    notes: '',
    date: new Date().toISOString().split('T')[0]
  });

  const orderTotal = order?.quote?.total || order?.total_price || 0;
  const paidAmount = paymentHistory.reduce((sum, p) => sum + (p.amount || 0), 0);
  const remainingAmount = Math.max(0, orderTotal - paidAmount);
  const paymentStatus = paidAmount >= orderTotal ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

  useEffect(() => {
    loadPaymentHistory();
    // Set default amount to remaining
    setNewPayment(prev => ({ ...prev, amount: remainingAmount }));
  }, [order]);

  const loadPaymentHistory = async () => {
    if (!order?.order_id) return;
    try {
      const res = await api.getOrderPayments?.(order.order_id).catch(() => null);
      const payments = unwrap(res) || res?.payments || [];
      setPaymentHistory(Array.isArray(payments) ? payments : []);
    } catch (err) {
      // If no API, check order for payment info
      if (order.payments) {
        setPaymentHistory(order.payments);
      } else if (order.payment_status === 'paid' && order.paid_at) {
        setPaymentHistory([{
          id: 'initial',
          amount: orderTotal,
          method: order.payment_method || 'unknown',
          date: order.paid_at,
          reference: order.payment_reference || ''
        }]);
      }
    }
  };

  const handleRecordPayment = async () => {
    if (newPayment.amount <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }
    
    setLoading(true);
    try {
      const payment = {
        ...newPayment,
        order_id: order.order_id,
        recorded_at: new Date().toISOString()
      };

      // Try to record via API
      try {
        await api.recordPayment?.(order.order_id, payment);
      } catch (e) {
        // Fallback: update order directly
        const newTotal = paidAmount + newPayment.amount;
        const newStatus = newTotal >= orderTotal ? 'paid' : 'partial';
        await api.updateOrder(order.order_id, {
          payment_status: newStatus,
          payment_method: newPayment.method,
          payment_reference: newPayment.reference,
          paid_amount: newTotal,
          paid_at: newStatus === 'paid' ? new Date().toISOString() : undefined
        });
      }

      toast.success(`€${newPayment.amount.toFixed(2)} ${t('common.payment')} recorded!`);
      
      // Add to local history
      setPaymentHistory(prev => [...prev, { ...payment, id: `pay-${Date.now()}` }]);
      
      // Reset form
      const newRemaining = remainingAmount - newPayment.amount;
      setNewPayment({
        amount: Math.max(0, newRemaining),
        method: 'bank_transfer',
        reference: '',
        notes: '',
        date: new Date().toISOString().split('T')[0]
      });
      
      onPaymentRecorded?.();
    } catch (err) {
      toast.error('Failed to record payment');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPay = async (method) => {
    setNewPayment(prev => ({ ...prev, amount: remainingAmount, method }));
  };

  const paymentMethods = [
    { id: 'bank_transfer', label: '🏦 Bank Transfer', icon: '🏦' },
    { id: 'cash', label: '💵 Cash', icon: '💵' },
    { id: 'card', label: '💳 Card', icon: '💳' },
    { id: 'paypal', label: '🅿️ PayPal', icon: '🅿️' },
    { id: 'invoice', label: '📄 Invoice (Net 14)', icon: '📄' },
    { id: 'crypto', label: '₿ Crypto', icon: '₿' },
  ];

  const getStatusBadge = () => {
    const badges = {
      paid: { bg: 'bg-green-900/50', text: 'text-green-400', border: 'border-green-700', icon: '✓', label: 'Paid in Full' },
      partial: { bg: 'bg-yellow-900/50', text: 'text-yellow-400', border: 'border-yellow-700', icon: '◐', label: 'Partial Payment' },
      unpaid: { bg: 'bg-red-900/50', text: 'text-red-400', border: 'border-red-700', icon: '○', label: 'Unpaid' },
    };
    return badges[paymentStatus] || badges.unpaid;
  };

  const badge = getStatusBadge();

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 sticky top-0 bg-gray-900">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                💳 {t('orders.recordPayment')}
              </h3>
              <p className="text-sm text-zinc-400">{order?.item_name}</p>
            </div>
            <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl">×</button>
          </div>
        </div>

        {/* Summary */}
        <div className="p-4 border-b border-gray-700">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-zinc-500">Order Total</p>
              <p className="text-xl font-bold text-white">€{orderTotal.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Paid</p>
              <p className="text-xl font-bold text-green-400">€{paidAmount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Remaining</p>
              <p className={`text-xl font-bold ${remainingAmount > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                €{remainingAmount.toFixed(2)}
              </p>
            </div>
          </div>
          
          {/* Status Badge */}
          <div className="mt-3 flex justify-center">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${badge.bg} ${badge.text} border ${badge.border}`}>
              {badge.icon} {badge.label}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="mt-3">
            <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${Math.min(100, (paidAmount / orderTotal) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-zinc-500 text-center mt-1">
              {Math.round((paidAmount / orderTotal) * 100)}% paid
            </p>
          </div>
        </div>

        {/* Quick Pay Buttons */}
        {remainingAmount > 0 && (
          <div className="p-4 border-b border-gray-700">
            <p className="text-xs text-zinc-500 mb-2">Quick Pay Full Amount:</p>
            <div className="grid grid-cols-3 gap-2">
              {paymentMethods.slice(0, 3).map(method => (
                <button
                  key={method.id}
                  onClick={() => handleQuickPay(method.id)}
                  className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-center transition"
                >
                  <span className="text-xl">{method.icon}</span>
                  <p className="text-xs text-zinc-400 mt-1">{method.id.replace('_', ' ')}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Payment Form */}
        {remainingAmount > 0 && (
          <div className="p-4 border-b border-gray-700">
            <h4 className="font-medium text-white mb-3">Record Payment</h4>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Amount (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={remainingAmount}
                    value={newPayment.amount}
                    onChange={(e) => setNewPayment({ ...newPayment, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Date</label>
                  <input
                    type="date"
                    value={newPayment.date}
                    onChange={(e) => setNewPayment({ ...newPayment, date: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Payment Method</label>
                <select
                  value={newPayment.method}
                  onChange={(e) => setNewPayment({ ...newPayment, method: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                >
                  {paymentMethods.map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Reference / Transaction ID</label>
                <input
                  type="text"
                  value={newPayment.reference}
                  onChange={(e) => setNewPayment({ ...newPayment, reference: e.target.value })}
                  placeholder="Optional: bank ref, receipt #, etc."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-zinc-600"
                />
              </div>
              
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Notes</label>
                <textarea
                  value={newPayment.notes}
                  onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })}
                  placeholder="Optional notes"
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-zinc-600"
                />
              </div>
              
              <button
                onClick={handleRecordPayment}
                disabled={loading || newPayment.amount <= 0}
                className="w-full py-3 rounded-lg font-medium text-white disabled:opacity-50 transition"
                style={{ background: 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)' }}
              >
                {loading ? '⏳ Recording...' : `✓ Record €${newPayment.amount.toFixed(2)} Payment`}
              </button>
            </div>
          </div>
        )}

        {/* Payment History */}
        <div className="p-4">
          <h4 className="font-medium text-white mb-3 flex items-center gap-2">
            📋 Payment History
            <span className="text-xs text-zinc-500">({paymentHistory.length} payments)</span>
          </h4>
          
          {paymentHistory.length === 0 ? (
            <div className="text-center py-6 text-zinc-500">
              <p className="text-2xl mb-2">💸</p>
              <p className="text-sm">No payments recorded yet</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {paymentHistory.map((payment, idx) => (
                <div key={payment.id || idx} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {paymentMethods.find(m => m.id === payment.method)?.icon || '💰'}
                    </span>
                    <div>
                      <p className="font-medium text-green-400">€{(payment.amount || 0).toFixed(2)}</p>
                      <p className="text-xs text-zinc-500">
                        {payment.method?.replace('_', ' ')} 
                        {payment.reference && ` • ${payment.reference}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-400">
                      {payment.date ? new Date(payment.date).toLocaleDateString() : '--'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-800/30">
          <button
            onClick={onClose}
            className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentTracker;
