import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../i18n';
import {
  DEFAULT_COMPANY,
  createQuoteData,
  generateQuoteHTML,
  printQuote,
  downloadQuoteHTML,
} from '../utils/estonianQuote';

/**
 * QuotePDFPreview - Preview and print Estonian quotes
 * 
 * Displays quote in standard Estonian format (Hinnapakkumine) with options to:
 * - Preview in modal
 * - Print (opens browser print dialog for PDF save)
 * - Download as HTML
 */

function QuotePDFPreview({ 
  quote, 
  client, 
  company = DEFAULT_COMPANY,
  isOpen, 
  onClose,
  onPrint,
}) {
  const { t } = useLanguage();
  const iframeRef = useRef(null);
  const [quoteData, setQuoteData] = useState(null);

  useEffect(() => {
    if (quote && isOpen) {
      // Build quote data from props
      const data = createQuoteData({
        quoteNumber: quote.quote_number || quote.order_number || `HP-${Date.now().toString().slice(-6)}`,
        quoteDate: quote.date || quote.created_at || new Date(),
        validUntil: quote.valid_until,
        validDays: 30,
        recipient: {
          name: client?.name || client?.company || quote.client_name || '',
          address: client?.address || '',
          city: client?.city || '',
          postal_code: client?.postal_code || '',
          county: client?.county || '',
          reg_number: client?.reg_number || '',
          vat_number: client?.vat_number || '',
          email: client?.email || quote.client_email || '',
          phone: client?.phone || '',
        },
        items: quote.items || [{
          description: quote.item_name || quote.description || 'Teenus / Service',
          quantity: quote.quantity || 1,
          unit: 'tk',
          unit_price: quote.subtotal || (quote.total / 1.24) || 0,
        }],
        vatRate: 0.24,
        notes: quote.notes || '',
        company,
      });
      
      setQuoteData(data);
    }
  }, [quote, client, company, isOpen]);

  useEffect(() => {
    if (quoteData && iframeRef.current) {
      const html = generateQuoteHTML(quoteData);
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
      }
    }
  }, [quoteData]);

  const handlePrint = () => {
    if (quoteData) {
      printQuote(quoteData);
      onPrint?.();
    }
  };

  const handleDownload = () => {
    if (quoteData) {
      downloadQuoteHTML(quoteData);
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
              📋 Hinnapakkumine {quoteData?.quote_number || ''}
            </h3>
            <p className="text-sm text-slate-400">
              {t('quote.preview') || 'Quote Preview'} • {t('quote.estonianFormat') || 'Estonian Format'}
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
              title="Quote Preview"
              className="w-full h-full border-0"
              style={{ minHeight: '800px' }}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t flex items-center justify-between" style={{ borderColor: '#334155' }}>
          <div className="text-sm text-slate-400">
            💡 {t('quote.printTip') || 'Use "Save as PDF" in print dialog to create PDF file'}
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
              🖨️ {t('quote.print') || 'Print / PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * QuotePreviewButton - Simple button to trigger quote preview
 */
export function QuotePreviewButton({ quote, client, company, className = '' }) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowPreview(true)}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 transition ${className}`}
      >
        👁️ Preview
      </button>
      
      <QuotePDFPreview
        quote={quote}
        client={client}
        company={company}
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
      />
    </>
  );
}

export default QuotePDFPreview;
