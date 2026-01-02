/**
 * Estonian Invoice PDF Generator
 * 
 * Generates PDF invoices in the standard Estonian format:
 * - Left: Recipient (Arve saaja)
 * - Right: Invoice details + Sender info
 * - Table: Description, Qty, Unit, Price, Amount
 * - Totals: Subtotal, VAT 24%, Total
 * - Bank: SWIFT, IBAN
 * 
 * Format based on OÜ Polüwerk invoice template.
 */

/**
 * Company configuration - should be loaded from settings/API
 */
export const DEFAULT_COMPANY = {
  name: 'OÜ Polüwerk',
  address: 'Kalevi tn 47',
  city: 'Tartu linn, Tartu linn',
  postal_code: '51010',
  county: 'Tartu maakond',
  reg_number: '14611061',
  vat_number: 'EE102388222',
  bank_name: 'LHV',
  swift: 'LHVBEE22',
  iban: 'EE787700771003408310',
  late_fee: '0,05% päevas', // 0.05% per day
  email: '',
  phone: '',
};

/**
 * Format number as Estonian currency (comma as decimal separator)
 */
export const formatEstonianNumber = (num, decimals = 2) => {
  if (num === null || num === undefined) return '0,00';
  return Number(num).toFixed(decimals).replace('.', ',');
};

/**
 * Format date as Estonian format (DD.MM.YYYY)
 */
export const formatEstonianDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
};

/**
 * Generate Estonian payment reference number (viitenumber)
 * Uses 7-3-1 algorithm
 */
export const generateViitenumber = (invoiceNumber) => {
  if (!invoiceNumber) return '';
  
  // Extract only digits, take up to 18
  const nums = String(invoiceNumber).replace(/\D/g, '').slice(0, 18);
  if (!nums) return String(invoiceNumber);
  
  // Calculate check digit using 7-3-1 algorithm
  const weights = [7, 3, 1];
  let sum = 0;
  const reversed = nums.split('').reverse();
  
  reversed.forEach((digit, i) => {
    sum += parseInt(digit, 10) * weights[i % 3];
  });
  
  const checkDigit = (10 - (sum % 10)) % 10;
  return nums + checkDigit;
};

/**
 * Calculate due date (default: 7 days from invoice date)
 */
export const calculateDueDate = (invoiceDate, days = 7) => {
  const date = new Date(invoiceDate || new Date());
  date.setDate(date.getDate() + days);
  return date;
};

/**
 * Generate invoice data structure
 */
export const createInvoiceData = ({
  invoiceNumber,
  invoiceDate = new Date(),
  dueDate,
  dueDays = 7,
  recipient,
  items = [],
  vatRate = 0.24,
  notes = '',
  company = DEFAULT_COMPANY,
}) => {
  const date = new Date(invoiceDate);
  const due = dueDate ? new Date(dueDate) : calculateDueDate(date, dueDays);
  
  // Calculate item totals (prices are assumed to be without VAT)
  const itemsWithTotals = items.map(item => ({
    description: item.description || '',
    quantity: item.quantity || 1,
    unit: item.unit || 'tk',
    unit_price: item.unit_price || item.price || 0,
    amount: (item.quantity || 1) * (item.unit_price || item.price || 0),
  }));
  
  const subtotal = itemsWithTotals.reduce((sum, item) => sum + item.amount, 0);
  const vatAmount = subtotal * vatRate;
  const total = subtotal + vatAmount;
  
  return {
    invoice_number: invoiceNumber,
    date: date,
    due_date: due,
    reference_number: generateViitenumber(invoiceNumber),
    late_fee: company.late_fee,
    
    recipient: {
      name: recipient?.name || recipient?.company || '',
      address: recipient?.address || '',
      city: recipient?.city || '',
      postal_code: recipient?.postal_code || '',
      county: recipient?.county || '',
      reg_number: recipient?.reg_number || '',
      vat_number: recipient?.vat_number || '',
      email: recipient?.email || '',
      phone: recipient?.phone || '',
    },
    
    sender: company,
    
    items: itemsWithTotals,
    
    subtotal,
    vat_rate: vatRate,
    vat_amount: vatAmount,
    total,
    
    notes,
  };
};

/**
 * Generate HTML for Estonian invoice (for PDF conversion or printing)
 */
export const generateInvoiceHTML = (invoiceData) => {
  const {
    invoice_number,
    date,
    due_date,
    reference_number,
    late_fee,
    recipient,
    sender,
    items,
    subtotal,
    vat_rate,
    vat_amount,
    total,
    notes,
  } = invoiceData;

  const vatPercent = Math.round(vat_rate * 100);

  return `<!DOCTYPE html>
<html lang="et">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Arve ${invoice_number}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 10pt;
      line-height: 1.4;
      color: #333;
      background: white;
    }
    
    .invoice {
      max-width: 210mm;
      margin: 0 auto;
      padding: 15mm;
      background: white;
    }
    
    @media print {
      .invoice {
        padding: 10mm;
      }
    }
    
    /* Header Section */
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
      gap: 30px;
    }
    
    .recipient {
      flex: 1;
    }
    
    .invoice-meta {
      flex: 1;
      text-align: right;
    }
    
    .section-title {
      font-weight: 600;
      color: #666;
      font-size: 9pt;
      margin-bottom: 8px;
      text-transform: uppercase;
    }
    
    .company-name {
      font-size: 12pt;
      font-weight: 600;
      margin-bottom: 4px;
    }
    
    .address-line {
      margin-bottom: 2px;
    }
    
    .reg-info {
      font-size: 9pt;
      color: #555;
      margin-top: 6px;
    }
    
    /* Invoice Details Table */
    .meta-table {
      border-collapse: collapse;
      margin-left: auto;
      font-size: 9pt;
    }
    
    .meta-table td {
      padding: 3px 0;
    }
    
    .meta-table td:first-child {
      text-align: right;
      padding-right: 12px;
      color: #666;
    }
    
    .meta-table td:last-child {
      text-align: left;
      font-weight: 500;
    }
    
    .invoice-number {
      font-size: 14pt;
      font-weight: 700;
      color: #000;
    }
    
    /* Sender Section */
    .sender {
      margin-top: 25px;
      margin-bottom: 25px;
      padding-top: 15px;
      border-top: 1px solid #ddd;
    }
    
    .sender-content {
      display: flex;
      justify-content: flex-end;
    }
    
    .sender-info {
      text-align: right;
    }
    
    /* Items Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 25px 0;
    }
    
    .items-table th {
      background: #f5f5f5;
      border: 1px solid #ddd;
      padding: 10px 12px;
      text-align: left;
      font-weight: 600;
      font-size: 9pt;
    }
    
    .items-table th.number-col {
      text-align: right;
    }
    
    .items-table td {
      border: 1px solid #ddd;
      padding: 10px 12px;
      vertical-align: top;
    }
    
    .items-table td.number-col {
      text-align: right;
      font-family: 'Consolas', monospace;
    }
    
    .items-table tbody tr:nth-child(even) {
      background: #fafafa;
    }
    
    /* Totals Section */
    .totals {
      margin-top: 20px;
      display: flex;
      justify-content: flex-end;
    }
    
    .totals-table {
      border-collapse: collapse;
      min-width: 280px;
    }
    
    .totals-table td {
      padding: 6px 12px;
    }
    
    .totals-table td:first-child {
      text-align: left;
    }
    
    .totals-table td:last-child {
      text-align: right;
      font-family: 'Consolas', monospace;
      font-weight: 500;
    }
    
    .totals-table .subtotal-row {
      border-bottom: 1px solid #ddd;
    }
    
    .totals-table .total-row {
      font-size: 12pt;
      font-weight: 700;
      background: #f5f5f5;
    }
    
    .totals-table .total-row td {
      padding: 10px 12px;
    }
    
    /* Bank Details */
    .bank-details {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #ddd;
    }
    
    .bank-table {
      border-collapse: collapse;
    }
    
    .bank-table td {
      padding: 3px 0;
    }
    
    .bank-table td:first-child {
      padding-right: 15px;
      color: #666;
      font-weight: 500;
    }
    
    .bank-table td:last-child {
      font-family: 'Consolas', monospace;
      letter-spacing: 0.5px;
    }
    
    /* Notes */
    .notes {
      margin-top: 25px;
      padding: 12px;
      background: #f9f9f9;
      border-radius: 4px;
      font-size: 9pt;
      color: #555;
    }
    
    .notes-title {
      font-weight: 600;
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <div class="invoice">
    <!-- Header: Recipient + Invoice Meta -->
    <div class="header">
      <div class="recipient">
        <div class="section-title">Arve saaja</div>
        <div class="company-name">${escapeHtml(recipient.name)}</div>
        ${recipient.address ? `<div class="address-line">${escapeHtml(recipient.address)}</div>` : ''}
        ${recipient.city ? `<div class="address-line">${escapeHtml(recipient.city)}</div>` : ''}
        ${recipient.postal_code || recipient.county ? `<div class="address-line">${escapeHtml(recipient.postal_code || '')} ${escapeHtml(recipient.county || '')}</div>` : ''}
        ${recipient.reg_number ? `<div class="reg-info">Rg-kood ${escapeHtml(recipient.reg_number)}</div>` : ''}
        ${recipient.vat_number ? `<div class="reg-info">KMKR nr ${escapeHtml(recipient.vat_number)}</div>` : ''}
        ${recipient.email ? `<div class="reg-info">${escapeHtml(recipient.email)}</div>` : ''}
        ${recipient.phone ? `<div class="reg-info">${escapeHtml(recipient.phone)}</div>` : ''}
      </div>
      
      <div class="invoice-meta">
        <table class="meta-table">
          <tr>
            <td>Arve nr</td>
            <td class="invoice-number">${escapeHtml(invoice_number)}</td>
          </tr>
          <tr>
            <td>Kuupäev</td>
            <td>${formatEstonianDate(date)}</td>
          </tr>
          <tr>
            <td>Maksetähtpäev</td>
            <td>${formatEstonianDate(due_date)}</td>
          </tr>
          <tr>
            <td>Viitenumber</td>
            <td>${escapeHtml(reference_number)}</td>
          </tr>
          ${late_fee ? `<tr>
            <td>Viivis</td>
            <td>${escapeHtml(late_fee)}</td>
          </tr>` : ''}
        </table>
      </div>
    </div>
    
    <!-- Sender Info -->
    <div class="sender">
      <div class="sender-content">
        <div class="sender-info">
          <div class="company-name">${escapeHtml(sender.name)}</div>
          <div class="address-line">${escapeHtml(sender.address)}</div>
          <div class="address-line">${escapeHtml(sender.city)}</div>
          <div class="address-line">${escapeHtml(sender.postal_code)} ${escapeHtml(sender.county)}</div>
          <div class="reg-info">Rg-kood ${escapeHtml(sender.reg_number)}</div>
          <div class="reg-info">KMKR nr ${escapeHtml(sender.vat_number)}</div>
        </div>
      </div>
    </div>
    
    <!-- Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 50%">Kirjeldus</th>
          <th class="number-col" style="width: 10%">Kogus</th>
          <th style="width: 10%">Ühik</th>
          <th class="number-col" style="width: 15%">Hind</th>
          <th class="number-col" style="width: 15%">Summa km-ta</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => `
        <tr>
          <td>${escapeHtml(item.description)}</td>
          <td class="number-col">${item.quantity}</td>
          <td>${escapeHtml(item.unit)}</td>
          <td class="number-col">${formatEstonianNumber(item.unit_price)}</td>
          <td class="number-col">${formatEstonianNumber(item.amount)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    
    <!-- Totals -->
    <div class="totals">
      <table class="totals-table">
        <tr class="subtotal-row">
          <td>Summa km-ta ${vatPercent}%</td>
          <td>${formatEstonianNumber(subtotal)}</td>
        </tr>
        <tr>
          <td>Käibemaks ${vatPercent}%</td>
          <td>${formatEstonianNumber(vat_amount)}</td>
        </tr>
        <tr class="total-row">
          <td>Arve kokku (EUR)</td>
          <td>${formatEstonianNumber(total)}</td>
        </tr>
      </table>
    </div>
    
    <!-- Bank Details -->
    <div class="bank-details">
      <table class="bank-table">
        <tr>
          <td>${escapeHtml(sender.bank_name)} SWIFT</td>
          <td>${escapeHtml(sender.swift)}</td>
        </tr>
        <tr>
          <td>IBAN</td>
          <td>${escapeHtml(sender.iban)}</td>
        </tr>
      </table>
    </div>
    
    ${notes ? `
    <div class="notes">
      <div class="notes-title">Märkused:</div>
      <div>${escapeHtml(notes)}</div>
    </div>
    ` : ''}
  </div>
</body>
</html>`;
};

/**
 * Escape HTML special characters
 */
const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Open invoice in new window for printing/saving as PDF
 */
export const printInvoice = (invoiceData) => {
  const html = generateInvoiceHTML(invoiceData);
  const printWindow = window.open('', '_blank');
  
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    
    // Auto-trigger print dialog after load
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  }
  
  return printWindow;
};

/**
 * Download invoice as HTML file
 */
export const downloadInvoiceHTML = (invoiceData) => {
  const html = generateInvoiceHTML(invoiceData);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Arve_${invoiceData.invoice_number}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export default {
  DEFAULT_COMPANY,
  formatEstonianNumber,
  formatEstonianDate,
  generateViitenumber,
  calculateDueDate,
  createInvoiceData,
  generateInvoiceHTML,
  printInvoice,
  downloadInvoiceHTML,
};
