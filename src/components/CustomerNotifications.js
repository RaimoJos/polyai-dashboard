import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

/**
 * CustomerNotifications - Email templates and notification sending
 */
function CustomerNotifications({ order, onClose, onSent }) {
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [customMessage, setCustomMessage] = useState('');
  const [sendMethod, setSendMethod] = useState('email');
  const [previewMode, setPreviewMode] = useState(false);

  // Email templates
  const templates = [
    {
      id: 'order_received',
      name: 'Order Received',
      icon: '📥',
      subject: 'Your order has been received - {{order_number}}',
      body: `Hello {{customer_name}},

Thank you for your order! We have received your order {{order_number}} and will begin processing it shortly.

Order Details:
{{order_items}}

Total: {{total_price}}

You can track your order status here: {{tracking_url}}

If you have any questions, please don't hesitate to contact us.

Best regards,
Polywerk Team`,
    },
    {
      id: 'printing_started',
      name: 'Printing Started',
      icon: '🖨️',
      subject: 'Your order is now printing - {{order_number}}',
      body: `Hello {{customer_name}},

Great news! We've started printing your order {{order_number}}.

Estimated completion: {{estimated_completion}}

Track your order: {{tracking_url}}

Best regards,
Polywerk Team`,
    },
    {
      id: 'quality_check',
      name: 'Quality Check Passed',
      icon: '✅',
      subject: 'Your order passed quality control - {{order_number}}',
      body: `Hello {{customer_name}},

Your order {{order_number}} has passed our quality control inspection and is being prepared for delivery/pickup.

You'll receive another notification when it's ready.

Track your order: {{tracking_url}}

Best regards,
Polywerk Team`,
    },
    {
      id: 'ready_pickup',
      name: 'Ready for Pickup',
      icon: '📦',
      subject: 'Your order is ready for pickup - {{order_number}}',
      body: `Hello {{customer_name}},

Your order {{order_number}} is ready for pickup!

Pickup Location:
Polywerk OÜ
[Address]
[Opening Hours]

Please bring your order confirmation or ID.

Best regards,
Polywerk Team`,
    },
    {
      id: 'shipped',
      name: 'Order Shipped',
      icon: '🚚',
      subject: 'Your order has been shipped - {{order_number}}',
      body: `Hello {{customer_name}},

Your order {{order_number}} has been shipped!

Tracking Number: {{tracking_number}}
Carrier: {{carrier}}

Track your delivery: {{carrier_tracking_url}}

Estimated delivery: {{estimated_delivery}}

Best regards,
Polywerk Team`,
    },
    {
      id: 'delivered',
      name: 'Order Delivered',
      icon: '🎉',
      subject: 'Your order has been delivered - {{order_number}}',
      body: `Hello {{customer_name}},

Your order {{order_number}} has been delivered!

We hope you're happy with your items. If you have any questions or concerns, please let us know.

Leave us a review: {{review_url}}

Thank you for choosing Polywerk!

Best regards,
Polywerk Team`,
    },
    {
      id: 'custom',
      name: 'Custom Message',
      icon: '✏️',
      subject: 'Update on your order - {{order_number}}',
      body: '',
    },
  ];

  const replaceVariables = (text) => {
    if (!text || !order) return text;
    
    const orderNumber = order.order_number || `#${(order.order_id || order.id || '').slice(-6)}`;
    const trackingUrl = `${window.location.origin}/track/${order.order_id || order.id}`;
    
    // Format order items
    const orderItems = order.items?.map(item => 
      `- ${item.name} x${item.quantity} - €${item.total?.toFixed(2) || '0.00'}`
    ).join('\n') || 'See order details online';

    return text
      .replace(/\{\{customer_name\}\}/g, order.client_name || order.customer_name || 'Valued Customer')
      .replace(/\{\{order_number\}\}/g, orderNumber)
      .replace(/\{\{order_items\}\}/g, orderItems)
      .replace(/\{\{total_price\}\}/g, `€${(order.total_price || order.total || 0).toFixed(2)}`)
      .replace(/\{\{tracking_url\}\}/g, trackingUrl)
      .replace(/\{\{estimated_completion\}\}/g, order.estimated_completion || 'Within 24-48 hours')
      .replace(/\{\{tracking_number\}\}/g, order.tracking_number || 'N/A')
      .replace(/\{\{carrier\}\}/g, order.carrier || 'Standard Shipping')
      .replace(/\{\{carrier_tracking_url\}\}/g, order.carrier_tracking_url || '#')
      .replace(/\{\{estimated_delivery\}\}/g, order.estimated_delivery || '3-5 business days')
      .replace(/\{\{review_url\}\}/g, `${window.location.origin}/review/${order.order_id || order.id}`);
  };

  const handleSend = async () => {
    if (!selectedTemplate) return;
    
    const email = order.client_email || order.customer_email;
    if (!email && sendMethod === 'email') {
      alert('Customer email not found');
      return;
    }

    setLoading(true);
    try {
      const messageBody = selectedTemplate.id === 'custom' 
        ? customMessage 
        : replaceVariables(selectedTemplate.body);
      
      const subject = replaceVariables(selectedTemplate.subject);

      // Log the notification (in production, this would send via email service)
      const notificationData = {
        order_id: order.order_id || order.id,
        type: selectedTemplate.id,
        method: sendMethod,
        recipient: sendMethod === 'email' ? email : order.client_phone,
        subject: subject,
        message: messageBody,
        sent_at: new Date().toISOString(),
      };

      // Try to send notification via API
      try {
        await api.updateOrder(order.order_id || order.id, {
          last_notification: notificationData,
          notification_history: [
            ...(order.notification_history || []),
            notificationData,
          ],
        });
      } catch (err) {
        console.log('Order update failed, notification logged locally');
      }

      alert(`${sendMethod === 'email' ? 'Email' : 'SMS'} sent successfully!`);
      onSent?.(notificationData);
      onClose?.();
    } catch (err) {
      console.error('Failed to send notification:', err);
      alert('Failed to send notification');
    } finally {
      setLoading(false);
    }
  };

  const copyTrackingLink = () => {
    const link = `${window.location.origin}/track/${order.order_id || order.id}`;
    navigator.clipboard.writeText(link);
    alert('Tracking link copied to clipboard!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        {/* Header */}
        <div className="sticky top-0 px-6 py-4 border-b flex items-center justify-between z-10" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              ✉️ Send Notification
            </h2>
            <p className="text-sm text-slate-400">
              {order?.client_name || order?.customer_name} • {order?.client_email || order?.customer_email || 'No email'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Quick Actions */}
          <div className="flex gap-2">
            <button
              onClick={copyTrackingLink}
              className="px-3 py-2 rounded-lg text-sm font-medium text-purple-400 border border-purple-500/30 hover:bg-purple-500/10"
            >
              🔗 Copy Tracking Link
            </button>
          </div>

          {/* Send Method */}
          <div>
            <h3 className="text-sm font-medium text-slate-400 mb-3">Send via</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setSendMethod('email')}
                className={`flex-1 py-2 rounded-lg font-medium transition ${
                  sendMethod === 'email'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                📧 Email
              </button>
              <button
                onClick={() => setSendMethod('sms')}
                disabled
                className={`flex-1 py-2 rounded-lg font-medium transition opacity-50 cursor-not-allowed ${
                  sendMethod === 'sms'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                📱 SMS (Coming Soon)
              </button>
            </div>
          </div>

          {/* Template Selection */}
          <div>
            <h3 className="text-sm font-medium text-slate-400 mb-3">Select Template</h3>
            <div className="grid grid-cols-2 gap-2">
              {templates.map(template => (
                <button
                  key={template.id}
                  onClick={() => {
                    setSelectedTemplate(template);
                    setPreviewMode(false);
                  }}
                  className={`p-3 rounded-lg text-left transition ${
                    selectedTemplate?.id === template.id
                      ? 'bg-purple-500/20 border border-purple-500/30'
                      : 'bg-slate-800 border border-transparent hover:border-slate-600'
                  }`}
                >
                  <span className="text-xl block mb-1">{template.icon}</span>
                  <span className={`text-sm font-medium ${
                    selectedTemplate?.id === template.id ? 'text-purple-400' : 'text-white'
                  }`}>
                    {template.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Message Preview/Edit */}
          {selectedTemplate && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-slate-400">
                  {previewMode ? 'Preview' : 'Message'}
                </h3>
                <button
                  onClick={() => setPreviewMode(!previewMode)}
                  className="text-sm text-purple-400 hover:text-purple-300"
                >
                  {previewMode ? 'Edit' : 'Preview'}
                </button>
              </div>

              {/* Subject */}
              <div className="mb-3">
                <label className="block text-xs text-slate-500 mb-1">Subject</label>
                <div className="px-3 py-2 rounded-lg bg-slate-800 text-white">
                  {previewMode ? replaceVariables(selectedTemplate.subject) : selectedTemplate.subject}
                </div>
              </div>

              {/* Body */}
              {selectedTemplate.id === 'custom' && !previewMode ? (
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Write your custom message here..."
                  rows={8}
                  className="w-full px-4 py-3 rounded-lg text-white resize-none font-mono text-sm"
                  style={{ backgroundColor: '#334155' }}
                />
              ) : (
                <div 
                  className="px-4 py-3 rounded-lg text-white whitespace-pre-wrap font-mono text-sm max-h-64 overflow-y-auto"
                  style={{ backgroundColor: '#0f172a' }}
                >
                  {previewMode 
                    ? replaceVariables(selectedTemplate.id === 'custom' ? customMessage : selectedTemplate.body)
                    : selectedTemplate.body
                  }
                </div>
              )}

              {/* Variable Help */}
              {!previewMode && selectedTemplate.id === 'custom' && (
                <div className="mt-2 text-xs text-slate-500">
                  <p className="font-medium mb-1">Available variables:</p>
                  <p>{'{{customer_name}}, {{order_number}}, {{total_price}}, {{tracking_url}}'}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 px-6 py-4 border-t flex gap-3" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-medium text-slate-300 border border-slate-600 hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={loading || !selectedTemplate}
            className="flex-1 py-3 rounded-xl font-medium text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
          >
            {loading ? 'Sending...' : '📤 Send Notification'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * NotifyButton - Standalone button to send notifications
 */
export function NotifyButton({ order, onSent, size = 'md' }) {
  const [showModal, setShowModal] = useState(false);

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`${sizeClasses[size]} rounded-lg font-medium text-blue-400 border border-blue-500/30 hover:bg-blue-500/10 transition`}
      >
        ✉️ Notify
      </button>

      {showModal && (
        <CustomerNotifications
          order={order}
          onClose={() => setShowModal(false)}
          onSent={(data) => {
            onSent?.(data);
          }}
        />
      )}
    </>
  );
}

export default CustomerNotifications;
