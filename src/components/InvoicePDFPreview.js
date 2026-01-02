import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../i18n';
import {
  DEFAULT_COMPANY,
  createInvoiceData,
  generateInvoiceHTML,
  printInvoice,
  downloadInvoiceHTML,
} from '../utils/estonianInvoice';

/**
 * InvoicePDFPreview - Preview and print Estonian invoices
 * 
 * Displays invoice in standard Estonian format with options to:
 * - Preview in modal
 * - Print (opens browser print dialog for PDF save)
 * - Download as HTML
 */

function InvoicePDFPreview({ 
  invoice, 
  client, 
  company = DEFAULT_COMPANY,
  isOpen, 
  onClose,
  onPrint,
}) {
  const { t } = useLanguage();
  const iframeRef = useRef(null);
  const [invoiceData, setInvoiceData] = useState(null);

  useEffect(() => {
    if (invoice && isOpen) {
      // Map client fields - handle both new Estonian fields and legacy fields
      // Prefer company name for business clients, otherwise use client name
      const clientName = client?.company || client?.name || invoice.client_name || '';
      
      // Build items array from invoice data
      let items = [];
      if (invoice.items && Array.isArray(invoice.items) && invoice.items.length > 0) {
        items = invoice.items.map(item => ({
          description: item.description || item.name || 'Teenus',
          quantity: item.quantity || 1,
          unit: item.unit || 'tk',
          unit_price: item.unit_price || item.price || 0,
        }));
      } else {
        // Fallback: create single item from invoice total
        const subtotal = invoice.subtotal || (invoice.total ? invoice.total / 1.24 : 0);
        items = [{
          description: invoice.item_name || invoice.description || 'Teenus / Service',
          quantity: invoice.quantity || 1,
          unit: 'tk',
          unit_price: subtotal,
        }];
      }
      
      // Build invoice data from props
      const data = createInvoiceData({
        invoiceNumber: invoice.invoice_number || invoice.order_number || `INV-${Date.now()}`,
        invoiceDate: invoice.date || invoice.created_at || new Date(),
        dueDate: invoice.due_date,
        dueDays: 7,
        recipient: {
          // Use company name for business clients
          name: clientName,
          // Estonian address fields
          address: client?.address || '',
          city: client?.city || '',
          postal_code: client?.postal_code || client?.zip || '',
          county: client?.county || client?.region || '',
          // Estonian business registration fields
          reg_number: client?.reg_number || client?.registry_code || '',
          vat_number: client?.vat_number || client?.kmkr || '',
          // Contact info (for reference)
          email: client?.email || '',
          phone: client?.phone || '',
        },
        items: items,
        vatRate: 0.24,
        notes: invoice.notes || '',
        company,
      });
      
      setInvoiceData(data);
    }
  }, [invoice, client, company, isOpen]);

  useEffect(() => {
    if (invoiceData && iframeRef.current) {
      const html = generateInvoiceHTML(invoiceData);
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
      }
    }
  }, [invoiceData]);

  const handlePrint = () => {
    if (invoiceData) {
      printInvoice(invoiceData);
      onPrint?.();
    }
  };

  const handleDownload = () => {
    if (invoiceData) {
      downloadInvoiceHTML(invoiceData);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className="relative w-full max-w-4xl max-h-[95vh] overflow-hidden rounded-xl border shadow-2xl flex flex-col"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#334155' }}>
          <div>
            <h3 className="font-bold text-white text-lg">
              📄 Arve {invoiceData?.invoice_number || ''}
            </h3>
            <p className="text-sm text-slate-400">
              {t('invoice.preview') || 'Invoice Preview'} • {t('invoice.estonianFormat') || 'Estonian Format'}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            ✕
          </button>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-auto bg-gray-100 p-4">
          <div 
            className="bg-white shadow-lg mx-auto"
            style={{ 
              width: '210mm', 
              minHeight: '297mm',
              maxWidth: '100%',
            }}
          >
            <iframe
              ref={iframeRef}
              title="Invoice Preview"
              className="w-full h-full border-0"
              style={{ minHeight: '800px' }}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t flex items-center justify-between" style={{ borderColor: '#334155' }}>
          <div className="text-sm text-slate-400">
            💡 {t('invoice.printTip') || 'Use "Save as PDF" in print dialog to create PDF file'}
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-300 border border-slate-600 hover:bg-slate-700 transition"
            >
              {t('common.close') || 'Close'}
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-2 rounded-lg text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/10 transition"
            >
              ⬇️ HTML
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-lg font-medium text-white transition"
              style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
            >
              🖨️ {t('invoice.print') || 'Print / PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * InvoicePreviewButton - Simple button to trigger invoice preview
 */
export function InvoicePreviewButton({ invoice, client, company, className = '' }) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowPreview(true)}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium text-purple-400 border border-purple-500/30 hover:bg-purple-500/20 transition ${className}`}
      >
        👁️ Preview
      </button>
      
      <InvoicePDFPreview
        invoice={invoice}
        client={client}
        company={company}
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
      />
    </>
  );
}

/**
 * QuickInvoicePreview - Generate invoice directly from order data
 */
export function QuickInvoicePreview({ 
  order, 
  client, 
  company,
  invoiceNumber,
  isOpen, 
  onClose 
}) {
  // Convert order to invoice format
  const invoice = order ? {
    invoice_number: invoiceNumber || `${order.order_number || order.order_id?.slice(-6)}`,
    date: new Date(),
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    client_name: order.client_name || order.customer_name,
    items: order.items || [{
      description: order.item_name || order.description || `Tellimus ${order.order_number || ''}`,
      quantity: order.quantity || 1,
      unit: 'tk',
      unit_price: (order.quote?.subtotal || order.total_price / 1.24 || 0),
    }],
    subtotal: order.quote?.subtotal || order.total_price / 1.24 || 0,
    notes: order.notes || '',
  } : null;

  return (
    <InvoicePDFPreview
      invoice={invoice}
      client={client}
      company={company}
      isOpen={isOpen}
      onClose={onClose}
    />
  );
}

export default InvoicePDFPreview;
