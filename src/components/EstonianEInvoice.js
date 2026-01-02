import React, { useState, useEffect } from 'react';
import { api, unwrap } from '../services/api';

/**
 * EstonianEInvoice - Generate Estonian e-arve compliant invoices
 * Supports XML export for e-Arveldaja, banks, and accounting software
 */

// Estonian e-Invoice XML generator
const generateEInvoiceXML = (invoice, company, client) => {
  const now = new Date();
  const dueDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  
  const formatDate = (d) => d.toISOString().split('T')[0];
  const formatAmount = (amount) => (amount || 0).toFixed(2);

  // Calculate totals
  const subtotal = invoice.items?.reduce((sum, item) => 
    sum + (item.quantity || 1) * (item.unit_price || 0), 0) || invoice.subtotal || 0;
  const vatRate = 0.24; // Estonian VAT 24%
  const vatAmount = subtotal * vatRate;
  const total = subtotal + vatAmount;

  // Generate XML following Estonian e-invoice standard (simplified UBL 2.1)
  return `<?xml version="1.0" encoding="UTF-8"?>
<E_Invoice xmlns="http://www.pangaliit.ee/arveldused/e-arve/v1.2">
  <Header>
    <Date>${formatDate(now)}</Date>
    <FileId>${invoice.invoice_number || `INV-${Date.now()}`}</FileId>
    <Version>1.2</Version>
  </Header>
  <Invoice>
    <InvoiceParties>
      <SellerParty>
        <Name>${escapeXml(company.name || 'Polywerk OÜ')}</Name>
        <RegNumber>${escapeXml(company.reg_number || '16XXXXXX')}</RegNumber>
        <VATRegNumber>${escapeXml(company.vat_number || 'EE10XXXXXXX')}</VATRegNumber>
        <ContactData>
          <LegalAddress>
            <PostalAddress1>${escapeXml(company.address || 'Tartu, Estonia')}</PostalAddress1>
            <City>Tartu</City>
            <Country>EE</Country>
          </LegalAddress>
          <E-mailAddress>${escapeXml(company.email || 'info@polywerk.ee')}</E-mailAddress>
          <PhoneNumber>${escapeXml(company.phone || '+372 XXXXXXXX')}</PhoneNumber>
        </ContactData>
        <AccountInfo>
          <AccountNumber>${escapeXml(company.iban || 'EEXX XXXX XXXX XXXX XXXX')}</AccountNumber>
          <BankName>${escapeXml(company.bank || 'SEB Pank')}</BankName>
          <BIC>${escapeXml(company.bic || 'EEUHEE2X')}</BIC>
        </AccountInfo>
      </SellerParty>
      <BuyerParty>
        <Name>${escapeXml(client.name || client.company || 'Client')}</Name>
        <RegNumber>${escapeXml(client.reg_number || '')}</RegNumber>
        <VATRegNumber>${escapeXml(client.vat_number || '')}</VATRegNumber>
        <ContactData>
          <LegalAddress>
            <PostalAddress1>${escapeXml(client.address || '')}</PostalAddress1>
            <City>${escapeXml(client.city || '')}</City>
            <Country>${escapeXml(client.country || 'EE')}</Country>
          </LegalAddress>
          <E-mailAddress>${escapeXml(client.email || '')}</E-mailAddress>
        </ContactData>
      </BuyerParty>
    </InvoiceParties>
    <InvoiceInformation>
      <Type Type="DEB"/>
      <DocumentName>ARVE</DocumentName>
      <InvoiceNumber>${escapeXml(invoice.invoice_number || `INV-${Date.now()}`)}</InvoiceNumber>
      <InvoiceDate>${formatDate(new Date(invoice.date || now))}</InvoiceDate>
      <DueDate>${formatDate(new Date(invoice.due_date || dueDate))}</DueDate>
      <PaymentRefId>${generatePaymentReference(invoice.invoice_number)}</PaymentRefId>
      <Currency>EUR</Currency>
    </InvoiceInformation>
    <InvoiceItems>
      ${(invoice.items || []).map((item, idx) => `
      <InvoiceItem>
        <ItemEntry>
          <RowNo>${idx + 1}</RowNo>
          <Description>${escapeXml(item.description || item.name || 'Service')}</Description>
          <ItemAmount>${formatAmount(item.quantity || 1)}</ItemAmount>
          <ItemUnit>${escapeXml(item.unit || 'tk')}</ItemUnit>
          <ItemPrice>${formatAmount(item.unit_price || 0)}</ItemPrice>
          <ItemSum>${formatAmount((item.quantity || 1) * (item.unit_price || 0))}</ItemSum>
          <VAT>
            <VATRate>${(vatRate * 100).toFixed(0)}</VATRate>
            <VATSum>${formatAmount((item.quantity || 1) * (item.unit_price || 0) * vatRate)}</VATSum>
          </VAT>
          <ItemTotal>${formatAmount((item.quantity || 1) * (item.unit_price || 0) * (1 + vatRate))}</ItemTotal>
        </ItemEntry>
      </InvoiceItem>`).join('')}
    </InvoiceItems>
    <InvoiceSumGroup>
      <TotalSum>${formatAmount(subtotal)}</TotalSum>
      <TotalVATSum>${formatAmount(vatAmount)}</TotalVATSum>
      <TotalToPay>${formatAmount(total)}</TotalToPay>
      <Currency>EUR</Currency>
      <VAT>
        <VATRate>24</VATRate>
        <VATSum>${formatAmount(vatAmount)}</VATSum>
      </VAT>
    </InvoiceSumGroup>
    <PaymentInfo>
      <Currency>EUR</Currency>
      <PaymentDescription>Arve nr ${invoice.invoice_number}</PaymentDescription>
      <PaymentRefId>${generatePaymentReference(invoice.invoice_number)}</PaymentRefId>
      <PaymentDueDate>${formatDate(new Date(invoice.due_date || dueDate))}</PaymentDueDate>
      <PaymentTotalSum>${formatAmount(total)}</PaymentTotalSum>
      <PayeeAccount>${escapeXml(company.iban || 'EEXX XXXX XXXX XXXX XXXX')}</PayeeAccount>
      <PayeeName>${escapeXml(company.name || 'Polywerk OÜ')}</PayeeName>
    </PaymentInfo>
  </Invoice>
</E_Invoice>`;
};

// Escape special XML characters
const escapeXml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

// Generate Estonian payment reference number (viitenumber)
const generatePaymentReference = (invoiceNumber) => {
  if (!invoiceNumber) return '';
  
  // Extract numbers from invoice number
  const nums = invoiceNumber.replace(/\D/g, '').slice(0, 18);
  if (!nums) return invoiceNumber;
  
  // Calculate check digit using 7-3-1 algorithm
  const weights = [7, 3, 1];
  let sum = 0;
  const reversed = nums.split('').reverse();
  
  reversed.forEach((digit, i) => {
    sum += parseInt(digit) * weights[i % 3];
  });
  
  const checkDigit = (10 - (sum % 10)) % 10;
  return nums + checkDigit;
};

function EstonianEInvoice({ invoice: initialInvoice, onSave }) {
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState({
    name: 'Polywerk OÜ',
    reg_number: '',
    vat_number: '',
    address: 'Tartu, Estonia',
    email: '',
    phone: '',
    iban: '',
    bank: 'SEB Pank',
    bic: 'EEUHEE2X',
  });
  const [client, setClient] = useState({
    name: '',
    company: '',
    reg_number: '',
    vat_number: '',
    address: '',
    city: '',
    country: 'EE',
    email: '',
  });
  const [invoice, setInvoice] = useState({
    invoice_number: `INV-${Date.now().toString().slice(-8)}`,
    date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    items: [{ description: '', quantity: 1, unit_price: 0, unit: 'tk' }],
    notes: '',
    ...initialInvoice,
  });
  const [previewXml, setPreviewXml] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Load company info
  useEffect(() => {
    loadCompanyInfo();
  }, []);

  const loadCompanyInfo = async () => {
    try {
      const res = await api.getCompanyInfo();
      const data = unwrap(res) || {};
      if (data.name) {
        setCompany(prev => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.error('Failed to load company info:', err);
    }
  };

  // Calculate totals
  const subtotal = invoice.items.reduce((sum, item) => 
    sum + (item.quantity || 0) * (item.unit_price || 0), 0);
  const vatAmount = subtotal * 0.24;
  const total = subtotal + vatAmount;

  const addItem = () => {
    setInvoice(prev => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, unit_price: 0, unit: 'tk' }],
    }));
  };

  const removeItem = (index) => {
    setInvoice(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const updateItem = (index, field, value) => {
    setInvoice(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const generateXML = () => {
    const xml = generateEInvoiceXML(invoice, company, client);
    setPreviewXml(xml);
    setShowPreview(true);
  };

  const downloadXML = () => {
    const xml = generateEInvoiceXML(invoice, company, client);
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `e-arve-${invoice.invoice_number}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('et-EE', { 
      style: 'currency', 
      currency: 'EUR' 
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            🇪🇪 Estonian e-Invoice
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Generate XML compliant with Estonian e-arve standard
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={generateXML}
            className="px-4 py-2 rounded-lg text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/10"
          >
            👁️ Preview XML
          </button>
          <button
            onClick={downloadXML}
            className="px-4 py-2 rounded-lg font-medium text-white"
            style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)' }}
          >
            ⬇️ Download e-arve
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Seller Info */}
        <div 
          className="rounded-xl border p-6"
          style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
        >
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            🏢 Seller (Müüja)
          </h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Company Name</label>
              <input
                type="text"
                value={company.name}
                onChange={(e) => setCompany(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-white text-sm"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Reg. Number</label>
                <input
                  type="text"
                  value={company.reg_number}
                  onChange={(e) => setCompany(prev => ({ ...prev, reg_number: e.target.value }))}
                  placeholder="12345678"
                  className="w-full px-3 py-2 rounded-lg text-white text-sm"
                  style={{ backgroundColor: '#334155' }}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">VAT Number (KMKR)</label>
                <input
                  type="text"
                  value={company.vat_number}
                  onChange={(e) => setCompany(prev => ({ ...prev, vat_number: e.target.value }))}
                  placeholder="EE123456789"
                  className="w-full px-3 py-2 rounded-lg text-white text-sm"
                  style={{ backgroundColor: '#334155' }}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Address</label>
              <input
                type="text"
                value={company.address}
                onChange={(e) => setCompany(prev => ({ ...prev, address: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-white text-sm"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1">IBAN</label>
                <input
                  type="text"
                  value={company.iban}
                  onChange={(e) => setCompany(prev => ({ ...prev, iban: e.target.value }))}
                  placeholder="EE00 0000 0000 0000 0000"
                  className="w-full px-3 py-2 rounded-lg text-white text-sm"
                  style={{ backgroundColor: '#334155' }}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Bank</label>
                <select
                  value={company.bank}
                  onChange={(e) => {
                    const banks = {
                      'SEB Pank': 'EEUHEE2X',
                      'Swedbank': 'HABAEE2X',
                      'LHV Pank': 'LHVBEE22',
                      'Luminor': 'RIKOEE22',
                    };
                    setCompany(prev => ({ 
                      ...prev, 
                      bank: e.target.value,
                      bic: banks[e.target.value] || ''
                    }));
                  }}
                  className="w-full px-3 py-2 rounded-lg text-white text-sm"
                  style={{ backgroundColor: '#334155' }}
                >
                  <option value="SEB Pank">SEB Pank</option>
                  <option value="Swedbank">Swedbank</option>
                  <option value="LHV Pank">LHV Pank</option>
                  <option value="Luminor">Luminor</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Buyer Info */}
        <div 
          className="rounded-xl border p-6"
          style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
        >
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            👤 Buyer (Ostja)
          </h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Client/Company Name</label>
              <input
                type="text"
                value={client.name}
                onChange={(e) => setClient(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-white text-sm"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Reg. Number</label>
                <input
                  type="text"
                  value={client.reg_number}
                  onChange={(e) => setClient(prev => ({ ...prev, reg_number: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-white text-sm"
                  style={{ backgroundColor: '#334155' }}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">VAT Number</label>
                <input
                  type="text"
                  value={client.vat_number}
                  onChange={(e) => setClient(prev => ({ ...prev, vat_number: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-white text-sm"
                  style={{ backgroundColor: '#334155' }}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Address</label>
              <input
                type="text"
                value={client.address}
                onChange={(e) => setClient(prev => ({ ...prev, address: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-white text-sm"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1">City</label>
                <input
                  type="text"
                  value={client.city}
                  onChange={(e) => setClient(prev => ({ ...prev, city: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-white text-sm"
                  style={{ backgroundColor: '#334155' }}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Email</label>
                <input
                  type="email"
                  value={client.email}
                  onChange={(e) => setClient(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-white text-sm"
                  style={{ backgroundColor: '#334155' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Details */}
      <div 
        className="rounded-xl border p-6"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          📄 Invoice Details (Arve andmed)
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Invoice Number (Arve nr)</label>
            <input
              type="text"
              value={invoice.invoice_number}
              onChange={(e) => setInvoice(prev => ({ ...prev, invoice_number: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-white text-sm"
              style={{ backgroundColor: '#334155' }}
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Invoice Date (Kuupäev)</label>
            <input
              type="date"
              value={invoice.date}
              onChange={(e) => setInvoice(prev => ({ ...prev, date: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-white text-sm"
              style={{ backgroundColor: '#334155' }}
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Due Date (Maksetähtaeg)</label>
            <input
              type="date"
              value={invoice.due_date}
              onChange={(e) => setInvoice(prev => ({ ...prev, due_date: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-white text-sm"
              style={{ backgroundColor: '#334155' }}
            />
          </div>
        </div>

        {/* Payment Reference */}
        <div className="mb-6 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
          <p className="text-sm text-cyan-400">
            <span className="font-medium">Viitenumber (Payment Reference):</span>{' '}
            <span className="font-mono">{generatePaymentReference(invoice.invoice_number)}</span>
          </p>
        </div>

        {/* Line Items */}
        <div className="space-y-3">
          <div className="hidden sm:grid grid-cols-12 gap-2 text-sm text-slate-400 mb-2">
            <div className="col-span-5">Description</div>
            <div className="col-span-2">Qty</div>
            <div className="col-span-1">Unit</div>
            <div className="col-span-2">Price</div>
            <div className="col-span-2 text-right">Total</div>
          </div>

          {invoice.items.map((item, index) => (
            <div key={index} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-12 sm:col-span-5">
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => updateItem(index, 'description', e.target.value)}
                  placeholder="Service or product..."
                  className="w-full px-3 py-2 rounded-lg text-white text-sm"
                  style={{ backgroundColor: '#334155' }}
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                  min="0"
                  step="1"
                  className="w-full px-3 py-2 rounded-lg text-white text-sm"
                  style={{ backgroundColor: '#334155' }}
                />
              </div>
              <div className="col-span-3 sm:col-span-1">
                <select
                  value={item.unit}
                  onChange={(e) => updateItem(index, 'unit', e.target.value)}
                  className="w-full px-2 py-2 rounded-lg text-white text-sm"
                  style={{ backgroundColor: '#334155' }}
                >
                  <option value="tk">tk</option>
                  <option value="h">h</option>
                  <option value="kg">kg</option>
                  <option value="m">m</option>
                </select>
              </div>
              <div className="col-span-4 sm:col-span-2">
                <input
                  type="number"
                  value={item.unit_price}
                  onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 rounded-lg text-white text-sm"
                  style={{ backgroundColor: '#334155' }}
                />
              </div>
              <div className="col-span-10 sm:col-span-2 flex items-center justify-end gap-2">
                <span className="text-white font-medium">
                  {formatCurrency(item.quantity * item.unit_price)}
                </span>
                <button
                  onClick={() => removeItem(index)}
                  className="p-1 text-red-400 hover:text-red-300"
                  disabled={invoice.items.length <= 1}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={addItem}
            className="w-full py-2 rounded-lg text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/10 text-sm"
          >
            + Add Line Item
          </button>
        </div>

        {/* Totals */}
        <div className="mt-6 pt-6 border-t" style={{ borderColor: '#334155' }}>
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal (Summa):</span>
                <span className="text-white">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>VAT 24% (KM):</span>
                <span className="text-white">{formatCurrency(vatAmount)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t" style={{ borderColor: '#334155' }}>
                <span className="text-white">Total (Kokku):</span>
                <span className="text-cyan-400">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div 
        className="rounded-xl border p-4"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <h4 className="font-medium text-white mb-2">ℹ️ About Estonian e-Invoice</h4>
        <ul className="text-sm text-slate-400 space-y-1">
          <li>• Generated XML follows the Estonian e-invoice (e-arve) standard v1.2</li>
          <li>• Compatible with e-Arveldaja, Estonian banks, and major accounting software</li>
          <li>• Includes automatic payment reference number (viitenumber) calculation</li>
          <li>• VAT is calculated at 24% (Estonian standard rate)</li>
        </ul>
      </div>

      {/* XML Preview Modal */}
      {showPreview && (
        <XMLPreviewModal
          xml={previewXml}
          onClose={() => setShowPreview(false)}
          onDownload={downloadXML}
        />
      )}
    </div>
  );
}

/**
 * XMLPreviewModal - Preview generated XML
 */
function XMLPreviewModal({ xml, onClose, onDownload }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-xl border shadow-2xl flex flex-col"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#334155' }}>
          <h3 className="font-bold text-white">📄 e-arve XML Preview</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <pre 
            className="text-xs text-slate-300 whitespace-pre-wrap font-mono p-4 rounded-lg"
            style={{ backgroundColor: '#0f172a' }}
          >
            {xml}
          </pre>
        </div>

        <div className="px-6 py-4 border-t flex gap-2 justify-end" style={{ borderColor: '#334155' }}>
          <button
            onClick={() => {
              navigator.clipboard.writeText(xml);
            }}
            className="px-4 py-2 rounded-lg text-slate-400 border border-slate-600 hover:bg-slate-700"
          >
            📋 Copy
          </button>
          <button
            onClick={onDownload}
            className="px-4 py-2 rounded-lg font-medium text-white"
            style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)' }}
          >
            ⬇️ Download XML
          </button>
        </div>
      </div>
    </div>
  );
}

export default EstonianEInvoice;
