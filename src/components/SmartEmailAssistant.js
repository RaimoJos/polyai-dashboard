import React, { useState, useEffect } from 'react';
import { api, unwrap } from '../services/api';
import toast from 'react-hot-toast';

/**
 * SmartEmailAssistant - AI-powered email drafting
 * Templates: Follow-ups, Quotes, Win-back, Order updates, Thank you
 */

const EMAIL_TEMPLATES = {
  quote: {
    name: 'Quote Email',
    icon: '💰',
    description: 'Send a price quote to customer',
    fields: ['customerName', 'projectDescription', 'price', 'deliveryDays'],
    generate: (data) => ({
      subject: `Quote for ${data.projectDescription || 'your 3D printing project'}`,
      body: `Hi ${data.customerName || 'there'},

Thank you for your inquiry about ${data.projectDescription || 'your 3D printing project'}.

Based on your requirements, here's our quote:

📦 Project: ${data.projectDescription || 'Custom 3D Print'}
💰 Price: ${data.price || '€XX.XX'}
⏱️ Estimated delivery: ${data.deliveryDays || 'X'} business days

This quote is valid for 30 days. The price includes:
• High-quality FDM printing
• Material costs
• Basic post-processing
• Secure packaging

To proceed, simply reply to this email with your approval, and we'll get started right away.

If you have any questions or need adjustments, don't hesitate to ask!

Best regards,
Polywerk Team`
    }),
  },
  
  followUp: {
    name: 'Follow-up',
    icon: '📧',
    description: 'Check in after sending a quote',
    fields: ['customerName', 'daysSinceQuote', 'projectDescription'],
    generate: (data) => ({
      subject: `Following up on your 3D printing quote`,
      body: `Hi ${data.customerName || 'there'},

I wanted to follow up on the quote we sent ${data.daysSinceQuote || 'a few days'} ago for ${data.projectDescription || 'your project'}.

I'm reaching out to see if you had any questions or if there's anything we can adjust to better meet your needs.

A few things I can help with:
• Adjusting quantities or materials
• Discussing alternative finishing options
• Providing samples before a larger order
• Flexible delivery scheduling

If timing isn't right at the moment, no problem at all – just let me know when would be better to revisit this.

Looking forward to hearing from you!

Best regards,
Polywerk Team`
    }),
  },

  winBack: {
    name: 'Win-back',
    icon: '🎁',
    description: 'Re-engage inactive customers',
    fields: ['customerName', 'lastOrderDays', 'discountPercent'],
    generate: (data) => ({
      subject: `We miss you! Here's ${data.discountPercent || '15'}% off your next order`,
      body: `Hi ${data.customerName || 'there'},

It's been ${data.lastOrderDays || 'a while'} since your last order with us, and we wanted to check in!

We've been busy improving our services:
✨ Faster turnaround times
✨ New materials available (PETG-CF, PA-CF)
✨ Enhanced quality control process

As a thank you for being a valued customer, we'd like to offer you ${data.discountPercent || '15'}% off your next order.

Use code: WELCOME${data.discountPercent || '15'}

This offer is valid for the next 14 days.

Have a project in mind? Reply to this email or upload your files directly – we'd love to help!

Best regards,
Polywerk Team`
    }),
  },

  orderConfirmation: {
    name: 'Order Confirmation',
    icon: '✅',
    description: 'Confirm a new order',
    fields: ['customerName', 'orderId', 'orderTotal', 'estimatedDelivery'],
    generate: (data) => ({
      subject: `Order Confirmed #${data.orderId || 'XXXX'} - Polywerk`,
      body: `Hi ${data.customerName || 'there'},

Great news! Your order has been confirmed and is being prepared.

📋 Order Details:
• Order ID: #${data.orderId || 'XXXX'}
• Total: ${data.orderTotal || '€XX.XX'}
• Estimated delivery: ${data.estimatedDelivery || 'X-X business days'}

What happens next:
1. ✅ Order confirmed (you are here)
2. 🖨️ Printing begins
3. 📦 Quality check & packaging
4. 🚚 Shipping notification sent

You'll receive updates at each step. If you have any questions, just reply to this email.

Thank you for choosing Polywerk!

Best regards,
Polywerk Team`
    }),
  },

  orderShipped: {
    name: 'Shipping Update',
    icon: '🚚',
    description: 'Notify customer of shipping',
    fields: ['customerName', 'orderId', 'trackingNumber', 'carrier'],
    generate: (data) => ({
      subject: `Your order #${data.orderId || 'XXXX'} has shipped! 🚚`,
      body: `Hi ${data.customerName || 'there'},

Your order is on its way!

📦 Order #${data.orderId || 'XXXX'}
🚚 Carrier: ${data.carrier || 'Omniva/DPD'}
📍 Tracking: ${data.trackingNumber || 'Will be updated shortly'}

Track your package: [Tracking Link]

Estimated delivery: 1-3 business days within Estonia

Once you receive your order, we'd love to hear your feedback. Your reviews help us improve and help other customers make informed decisions.

Thank you for your business!

Best regards,
Polywerk Team`
    }),
  },

  thankYou: {
    name: 'Thank You',
    icon: '🙏',
    description: 'Post-delivery thank you',
    fields: ['customerName', 'orderId'],
    generate: (data) => ({
      subject: `Thank you for your order! 🙏`,
      body: `Hi ${data.customerName || 'there'},

We hope you're happy with your order #${data.orderId || 'XXXX'}!

Your feedback means the world to us. If you have a moment, we'd appreciate:
⭐ A quick review of your experience
📸 Photos of your prints in action (we love seeing these!)

If there's anything that didn't meet your expectations, please let us know – we'll make it right.

For your next order, use code THANKYOU10 for 10% off.

Need more prints? We're always here to help!

Best regards,
Polywerk Team`
    }),
  },

  custom: {
    name: 'Custom Email',
    icon: '✍️',
    description: 'Write from scratch',
    fields: ['customerName', 'subject', 'customContent'],
    generate: (data) => ({
      subject: data.subject || 'Message from Polywerk',
      body: `Hi ${data.customerName || 'there'},

${data.customContent || '[Your message here]'}

Best regards,
Polywerk Team`
    }),
  },
};

function SmartEmailAssistant() {
  const [selectedTemplate, setSelectedTemplate] = useState('quote');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [formData, setFormData] = useState({});
  const [generatedEmail, setGeneratedEmail] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState({ subject: '', body: '' });
  const [emailHistory, setEmailHistory] = useState([]);

  useEffect(() => {
    loadCustomers();
    loadEmailHistory();
  }, []);

  const loadCustomers = async () => {
    try {
      const res = await api.getClients?.();
      const data = unwrap(res);
      setCustomers(Array.isArray(data) ? data : (data?.clients || []));
    } catch (err) {
      console.error('Failed to load customers:', err);
    }
  };

  const loadEmailHistory = () => {
    const saved = localStorage.getItem('polywerk_email_history');
    if (saved) {
      try {
        setEmailHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load email history:', e);
      }
    }
  };

  const saveToHistory = (email) => {
    const entry = {
      id: `email-${Date.now()}`,
      template: selectedTemplate,
      customer: selectedCustomer?.name || formData.customerName,
      subject: email.subject,
      body: email.body,
      createdAt: new Date().toISOString(),
    };
    const updated = [entry, ...emailHistory].slice(0, 50);
    setEmailHistory(updated);
    localStorage.setItem('polywerk_email_history', JSON.stringify(updated));
  };

  const template = EMAIL_TEMPLATES[selectedTemplate];

  // Generate email when template or data changes
  const handleGenerate = () => {
    const data = {
      ...formData,
      customerName: selectedCustomer?.name || formData.customerName,
    };
    const email = template.generate(data);
    setGeneratedEmail(email);
    setEditedContent(email);
    setEditMode(false);
  };

  // Copy to clipboard
  const copyEmail = () => {
    const content = editMode ? editedContent : generatedEmail;
    const text = `Subject: ${content.subject}\n\n${content.body}`;
    navigator.clipboard.writeText(text);
    toast.success('Email copied to clipboard!');
    saveToHistory(content);
  };

  // Open in email client
  const openInEmailClient = () => {
    const content = editMode ? editedContent : generatedEmail;
    const email = selectedCustomer?.email || '';
    const subject = encodeURIComponent(content.subject);
    const body = encodeURIComponent(content.body);
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
    saveToHistory(content);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            📧 Smart Email Assistant
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            AI-powered email templates for customer communication
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template Selection & Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Template Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Object.entries(EMAIL_TEMPLATES).map(([key, tmpl]) => (
              <button
                key={key}
                onClick={() => { setSelectedTemplate(key); setGeneratedEmail(null); }}
                className={`p-4 rounded-xl border text-left transition ${
                  selectedTemplate === key 
                    ? 'border-purple-500 bg-purple-500/10' 
                    : 'border-slate-700 hover:border-slate-600'
                }`}
                style={{ backgroundColor: selectedTemplate === key ? undefined : '#1e293b' }}
              >
                <span className="text-2xl">{tmpl.icon}</span>
                <p className="text-white font-medium mt-2">{tmpl.name}</p>
                <p className="text-xs text-slate-500 mt-1">{tmpl.description}</p>
              </button>
            ))}
          </div>

          {/* Customer Selection */}
          <div className="rounded-xl border p-6" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
            <h3 className="font-medium text-white mb-4">👤 Customer</h3>
            <div className="flex flex-wrap gap-3">
              {selectedCustomer ? (
                <div className="flex items-center gap-3 p-3 rounded-lg flex-1" style={{ backgroundColor: '#334155' }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold" style={{ backgroundColor: '#475569' }}>
                    {selectedCustomer.name?.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">{selectedCustomer.name}</p>
                    <p className="text-sm text-slate-400">{selectedCustomer.email}</p>
                  </div>
                  <button
                    onClick={() => setSelectedCustomer(null)}
                    className="text-slate-500 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <>
                  <select
                    onChange={(e) => {
                      const customer = customers.find(c => c.id === e.target.value);
                      setSelectedCustomer(customer);
                      setFormData(prev => ({ ...prev, customerName: customer?.name }));
                    }}
                    className="flex-1 px-3 py-2 rounded-lg text-white"
                    style={{ backgroundColor: '#334155' }}
                    defaultValue=""
                  >
                    <option value="">Select existing customer...</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <span className="text-slate-500">or</span>
                  <input
                    type="text"
                    placeholder="Enter name..."
                    value={formData.customerName || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                    className="flex-1 px-3 py-2 rounded-lg text-white"
                    style={{ backgroundColor: '#334155' }}
                  />
                </>
              )}
            </div>
          </div>

          {/* Dynamic Form Fields */}
          <div className="rounded-xl border p-6" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
            <h3 className="font-medium text-white mb-4">📝 Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {template.fields.filter(f => f !== 'customerName').map(field => (
                <div key={field}>
                  <label className="block text-xs text-slate-400 mb-1 capitalize">
                    {field.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  {field === 'customContent' ? (
                    <textarea
                      value={formData[field] || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, [field]: e.target.value }))}
                      rows={4}
                      className="w-full px-3 py-2 rounded-lg text-white"
                      style={{ backgroundColor: '#334155' }}
                      placeholder={getPlaceholder(field)}
                    />
                  ) : (
                    <input
                      type={field.includes('days') || field.includes('Percent') ? 'number' : 'text'}
                      value={formData[field] || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, [field]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg text-white"
                      style={{ backgroundColor: '#334155' }}
                      placeholder={getPlaceholder(field)}
                    />
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={handleGenerate}
              className="mt-4 w-full py-3 rounded-lg font-medium text-white"
              style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
            >
              ✨ Generate Email
            </button>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="space-y-6">
          {generatedEmail ? (
            <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
              {/* Email Header */}
              <div className="p-4 border-b" style={{ borderColor: '#334155' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">To:</span>
                  <span className="text-sm text-white">{selectedCustomer?.email || 'customer@email.com'}</span>
                </div>
                {editMode ? (
                  <input
                    type="text"
                    value={editedContent.subject}
                    onChange={(e) => setEditedContent(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full px-2 py-1 rounded text-white text-sm"
                    style={{ backgroundColor: '#334155' }}
                  />
                ) : (
                  <p className="text-white font-medium">{generatedEmail.subject}</p>
                )}
              </div>

              {/* Email Body */}
              <div className="p-4">
                {editMode ? (
                  <textarea
                    value={editedContent.body}
                    onChange={(e) => setEditedContent(prev => ({ ...prev, body: e.target.value }))}
                    rows={15}
                    className="w-full px-2 py-1 rounded text-white text-sm resize-none"
                    style={{ backgroundColor: '#334155' }}
                  />
                ) : (
                  <pre className="text-slate-300 text-sm whitespace-pre-wrap font-sans">
                    {generatedEmail.body}
                  </pre>
                )}
              </div>

              {/* Actions */}
              <div className="p-4 border-t space-y-2" style={{ borderColor: '#334155' }}>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditMode(!editMode)}
                    className={`flex-1 py-2 rounded-lg text-sm ${editMode ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-700 text-slate-300'}`}
                  >
                    {editMode ? '✓ Done Editing' : '✏️ Edit'}
                  </button>
                  <button
                    onClick={copyEmail}
                    className="flex-1 py-2 rounded-lg text-sm bg-slate-700 text-slate-300 hover:bg-slate-600"
                  >
                    📋 Copy
                  </button>
                </div>
                <button
                  onClick={openInEmailClient}
                  className="w-full py-2.5 rounded-lg font-medium text-white"
                  style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
                >
                  📧 Open in Email Client
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border p-8 text-center" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
              <span className="text-4xl">📧</span>
              <p className="text-slate-400 mt-4">Fill in the details and click Generate</p>
            </div>
          )}

          {/* Recent Emails */}
          {emailHistory.length > 0 && (
            <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
              <h3 className="font-medium text-white mb-3">📋 Recent Emails</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {emailHistory.slice(0, 5).map(email => (
                  <div
                    key={email.id}
                    className="p-2 rounded-lg text-sm cursor-pointer hover:bg-slate-700"
                    style={{ backgroundColor: '#334155' }}
                    onClick={() => {
                      setGeneratedEmail({ subject: email.subject, body: email.body });
                      setEditedContent({ subject: email.subject, body: email.body });
                    }}
                  >
                    <p className="text-white truncate">{email.subject}</p>
                    <p className="text-xs text-slate-500">
                      {email.customer} • {new Date(email.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getPlaceholder(field) {
  const placeholders = {
    projectDescription: 'Custom enclosure, prototype parts, etc.',
    price: '€150.00',
    deliveryDays: '5',
    daysSinceQuote: '3 days',
    lastOrderDays: '60 days',
    discountPercent: '15',
    orderId: 'PW-2024-001',
    orderTotal: '€250.00',
    estimatedDelivery: '3-5 business days',
    trackingNumber: 'EE123456789',
    carrier: 'Omniva',
    subject: 'Your subject line',
    customContent: 'Write your custom message here...',
  };
  return placeholders[field] || '';
}

export default SmartEmailAssistant;
