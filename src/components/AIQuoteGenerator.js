import React, { useState, useCallback, useRef, useEffect } from 'react';
import { api, unwrap } from '../services/api';
import toast from 'react-hot-toast';

/**
 * AIQuoteGenerator - Instant quotes from STL analysis
 * Features: STL analysis, quote generation, save, history, convert to order
 */
function AIQuoteGenerator() {
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState(null);
  const [quoteHistory, setQuoteHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [settings, setSettings] = useState({
    material: 'PLA',
    quality: 'standard',
    infill: 20,
    quantity: 1,
    isRush: false,
    finishing: 'none',
  });
  const fileInputRef = useRef(null);

  // Load quote history and customers on mount
  useEffect(() => {
    loadQuoteHistory();
    loadCustomers();
  }, []);

  const loadQuoteHistory = () => {
    const saved = localStorage.getItem('polywerk_quote_history');
    if (saved) {
      try {
        setQuoteHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load quote history:', e);
      }
    }
  };

  const loadCustomers = async () => {
    try {
      const res = await api.getClients?.();
      const data = unwrap(res);
      setCustomers(Array.isArray(data) ? data : (data?.clients || []));
    } catch (err) {
      console.error('Failed to load customers:', err);
    }
  };

  // Material properties
  const materials = {
    PLA: { density: 1.24, pricePerKg: 25, printSpeedMult: 1.0, color: '#3b82f6' },
    PETG: { density: 1.27, pricePerKg: 30, printSpeedMult: 0.9, color: '#06b6d4' },
    ABS: { density: 1.04, pricePerKg: 28, printSpeedMult: 0.85, color: '#ef4444' },
    TPU: { density: 1.21, pricePerKg: 45, printSpeedMult: 0.6, color: '#a855f7' },
    ASA: { density: 1.07, pricePerKg: 35, printSpeedMult: 0.85, color: '#f59e0b' },
    Nylon: { density: 1.15, pricePerKg: 50, printSpeedMult: 0.75, color: '#64748b' },
  };

  const qualityProfiles = {
    draft: { layerHeight: 0.3, infillMult: 0.8, timeMult: 0.6, name: 'Draft (0.3mm)' },
    standard: { layerHeight: 0.2, infillMult: 1.0, timeMult: 1.0, name: 'Standard (0.2mm)' },
    high: { layerHeight: 0.12, infillMult: 1.2, timeMult: 1.8, name: 'High (0.12mm)' },
  };

  const finishingOptions = {
    none: { price: 0, timeMins: 0, name: 'None' },
    sanding: { price: 5, timeMins: 15, name: 'Sanding (+€5)' },
    painting: { price: 15, timeMins: 45, name: 'Painting (+€15)' },
  };

  const handleFileSelect = useCallback(async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validExtensions = ['.stl', '.obj', '.3mf'];
    const ext = selectedFile.name.toLowerCase().slice(selectedFile.name.lastIndexOf('.'));
    
    if (!validExtensions.includes(ext)) {
      toast.error('Please select an STL, OBJ, or 3MF file');
      return;
    }

    setFile(selectedFile);
    setAnalysis(null);
    setQuote(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await api.analyzeSTL?.(formData);
      const data = unwrap(res);

      if (data?.volume || data?.dimensions) {
        setAnalysis(data);
      } else {
        const estimatedVolume = selectedFile.size / 50;
        setAnalysis({
          volume: estimatedVolume,
          surfaceArea: Math.pow(estimatedVolume, 2/3) * 6,
          dimensions: {
            x: Math.pow(estimatedVolume, 1/3),
            y: Math.pow(estimatedVolume, 1/3),
            z: Math.pow(estimatedVolume, 1/3),
          },
          triangles: Math.floor(selectedFile.size / 50),
          isEstimate: true,
        });
      }
    } catch (err) {
      console.error('Analysis failed:', err);
      const estimatedVolume = selectedFile.size / 50;
      setAnalysis({
        volume: estimatedVolume,
        surfaceArea: Math.pow(estimatedVolume, 2/3) * 6,
        dimensions: {
          x: Math.pow(estimatedVolume, 1/3),
          y: Math.pow(estimatedVolume, 1/3),
          z: Math.pow(estimatedVolume, 1/3),
        },
        triangles: Math.floor(selectedFile.size / 50),
        isEstimate: true,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const calculatePrice = useCallback((params, analysisData) => {
    if (!analysisData) return null;

    const { quantity, material, printHours, isRush, complexity } = params;
    const mat = materials[material];
    const quality = qualityProfiles[params.quality || 'standard'];
    const finishing = finishingOptions[params.finishing || 'none'];

    const volumeCm3 = analysisData.volume / 1000;
    const shellThickness = 1.2;
    const shellVolume = analysisData.surfaceArea * shellThickness / 1000;
    const innerVolume = Math.max(0, volumeCm3 - shellVolume);
    const effectiveVolume = shellVolume + (innerVolume * (params.infill / 100));
    const weightGrams = effectiveVolume * mat.density;

    const baseSpeed = 25;
    const effectiveSpeed = baseSpeed * mat.printSpeedMult / quality.timeMult;
    const printTimeHours = weightGrams / effectiveSpeed;

    const materialCost = (weightGrams / 1000) * mat.pricePerKg;
    const machineCost = printTimeHours * 8;
    const setupCost = 5;
    const finishingCost = finishing.price;

    let subtotal = materialCost + machineCost + setupCost + finishingCost;

    let quantityDiscount = 0;
    if (quantity >= 100) quantityDiscount = 0.15;
    else if (quantity >= 50) quantityDiscount = 0.10;
    else if (quantity >= 20) quantityDiscount = 0.07;
    else if (quantity >= 10) quantityDiscount = 0.05;

    const rushMultiplier = isRush ? 1.5 : 1.0;
    const unitPrice = subtotal * (1 - quantityDiscount) * rushMultiplier;
    const totalPrice = unitPrice * quantity;
    const totalPrintTime = printTimeHours * quantity;
    let deliveryDays = Math.ceil(totalPrintTime / 20) + 1;
    if (isRush) deliveryDays = Math.max(1, Math.ceil(deliveryDays / 2));

    const rawCost = materialCost + (printTimeHours * 2);
    const margin = ((unitPrice - rawCost) / unitPrice) * 100;

    return {
      unitPrice: Math.round(unitPrice * 100) / 100,
      totalPrice: Math.round(totalPrice * 100) / 100,
      breakdown: {
        materialCost: Math.round(materialCost * 100) / 100,
        machineCost: Math.round(machineCost * 100) / 100,
        setupCost,
        finishingCost,
        quantityDiscount: Math.round(quantityDiscount * 100),
        rushMultiplier: isRush ? 50 : 0,
      },
      estimates: {
        weightGrams: Math.round(weightGrams),
        printTimeHours: Math.round(printTimeHours * 10) / 10,
        totalPrintTime: Math.round(totalPrintTime * 10) / 10,
        deliveryDays,
      },
      margin: Math.round(margin),
    };
  }, []);

  useEffect(() => {
    if (analysis) {
      setQuote(calculatePrice(settings, analysis));
    }
  }, [analysis, settings, calculatePrice]);

  const saveQuote = () => {
    if (!quote || !file) return;

    const savedQuote = {
      id: `quote-${Date.now()}`,
      fileName: file.name,
      customer: selectedCustomer,
      settings: { ...settings },
      quote: { ...quote },
      analysis: { ...analysis },
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    const updated = [savedQuote, ...quoteHistory].slice(0, 50);
    setQuoteHistory(updated);
    localStorage.setItem('polywerk_quote_history', JSON.stringify(updated));
    toast.success('Quote saved!');
  };

  const convertToOrder = async (savedQuote) => {
    try {
      const orderData = {
        client_id: savedQuote.customer?.id,
        client_name: savedQuote.customer?.name || 'Walk-in',
        items: [{
          name: savedQuote.fileName,
          quantity: savedQuote.settings.quantity,
          unit_price: savedQuote.quote.unitPrice,
          material: savedQuote.settings.material,
          print_hours: savedQuote.quote.estimates.printTimeHours,
        }],
        total: savedQuote.quote.totalPrice,
        status: 'pending',
        notes: `AI Quote: ${savedQuote.settings.quality} quality, ${savedQuote.settings.infill}% infill${savedQuote.settings.isRush ? ', RUSH' : ''}`,
        quote_id: savedQuote.id,
      };

      // Try to create order via API
      const res = await api.createOrder?.(orderData);
      if (res) {
        toast.success('Order created successfully!');
        
        // Update quote status
        const updated = quoteHistory.map(q => 
          q.id === savedQuote.id ? { ...q, status: 'converted', orderId: res.data?.id } : q
        );
        setQuoteHistory(updated);
        localStorage.setItem('polywerk_quote_history', JSON.stringify(updated));
      }
    } catch (err) {
      console.error('Failed to create order:', err);
      toast.error('Failed to create order. Quote saved for manual conversion.');
    }
  };

  const copyQuoteToClipboard = () => {
    if (!quote || !file) return;

    const text = `
═══════════════════════════════════════
       POLYWERK 3D PRINTING QUOTE
═══════════════════════════════════════

File: ${file.name}
${selectedCustomer ? `Customer: ${selectedCustomer.name}` : ''}
Date: ${new Date().toLocaleDateString()}

─────────────────────────────────────
SPECIFICATIONS
─────────────────────────────────────
• Quantity: ${settings.quantity} units
• Material: ${settings.material}
• Quality: ${qualityProfiles[settings.quality].name}
• Infill: ${settings.infill}%
${settings.finishing !== 'none' ? `• Finishing: ${finishingOptions[settings.finishing].name}\n` : ''}${settings.isRush ? '• ⚡ RUSH ORDER\n' : ''}
─────────────────────────────────────
PRICING
─────────────────────────────────────
Unit Price: ${formatCurrency(quote.unitPrice)}
TOTAL: ${formatCurrency(quote.totalPrice)}

─────────────────────────────────────
ESTIMATES
─────────────────────────────────────
• Weight: ${quote.estimates.weightGrams}g per unit
• Print Time: ${quote.estimates.printTimeHours}h per unit
• Delivery: ${quote.estimates.deliveryDays} business days

═══════════════════════════════════════
Valid for 30 days | Polywerk OÜ
═══════════════════════════════════════
    `.trim();

    navigator.clipboard.writeText(text);
    toast.success('Quote copied to clipboard!');
  };

  const deleteQuote = (quoteId) => {
    const updated = quoteHistory.filter(q => q.id !== quoteId);
    setQuoteHistory(updated);
    localStorage.setItem('polywerk_quote_history', JSON.stringify(updated));
    toast.success('Quote deleted');
  };

  const loadQuote = (savedQuote) => {
    setSettings(savedQuote.settings);
    setAnalysis(savedQuote.analysis);
    setSelectedCustomer(savedQuote.customer);
    setFile({ name: savedQuote.fileName });
    setShowHistory(false);
    toast.success('Quote loaded');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('et-EE', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            🤖 AI Quote Generator
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Upload a 3D file for instant pricing
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowHistory(true)}
            className="px-4 py-2 rounded-lg text-slate-300 border border-slate-600 hover:bg-slate-700 flex items-center gap-2"
          >
            📋 History ({quoteHistory.length})
          </button>
        </div>
      </div>

      {/* Customer Selection */}
      <div className="flex items-center gap-4">
        <span className="text-slate-400 text-sm">Customer:</span>
        {selectedCustomer ? (
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-lg bg-purple-500/20 text-purple-400">
              {selectedCustomer.name}
            </span>
            <button 
              onClick={() => setSelectedCustomer(null)}
              className="text-slate-500 hover:text-white"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowCustomerModal(true)}
            className="px-3 py-1 rounded-lg border border-dashed border-slate-600 text-slate-400 hover:border-purple-500 hover:text-purple-400"
          >
            + Select Customer
          </button>
        )}
      </div>

      {/* File Upload */}
      <div 
        className={`rounded-xl border-2 border-dashed p-8 text-center transition cursor-pointer ${
          file ? 'border-green-500/50 bg-green-500/5' : 'border-slate-600 hover:border-purple-500/50'
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".stl,.obj,.3mf"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        {loading ? (
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-400">Analyzing file...</p>
          </div>
        ) : file ? (
          <div className="flex flex-col items-center">
            <p className="text-4xl mb-4">📦</p>
            <p className="text-white font-medium">{file.name}</p>
            <p className="text-slate-500 text-sm">
              {file.size ? `${(file.size / 1024).toFixed(1)} KB • ` : ''}Click to change
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <p className="text-4xl mb-4">📤</p>
            <p className="text-white font-medium">Drop STL file here</p>
            <p className="text-slate-500 text-sm">or click to browse</p>
          </div>
        )}
      </div>

      {/* Analysis Results */}
      {analysis && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
            <p className="text-slate-400 text-sm">Volume</p>
            <p className="text-white text-xl font-bold">{(analysis.volume / 1000).toFixed(1)} cm³</p>
          </div>
          <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
            <p className="text-slate-400 text-sm">Dimensions</p>
            <p className="text-white text-sm font-medium">
              {analysis.dimensions?.x?.toFixed(0) || '?'} × {analysis.dimensions?.y?.toFixed(0) || '?'} × {analysis.dimensions?.z?.toFixed(0) || '?'} mm
            </p>
          </div>
          <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
            <p className="text-slate-400 text-sm">Surface Area</p>
            <p className="text-white text-xl font-bold">{(analysis.surfaceArea / 100).toFixed(0)} cm²</p>
          </div>
          <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
            <p className="text-slate-400 text-sm">Complexity</p>
            <p className="text-white text-xl font-bold">
              {analysis.triangles > 50000 ? 'High' : analysis.triangles > 10000 ? 'Medium' : 'Low'}
            </p>
          </div>
        </div>
      )}

      {/* Configuration & Quote */}
      {analysis && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Settings Panel */}
          <div className="rounded-xl border p-6" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
            <h3 className="font-medium text-white mb-4">⚙️ Print Settings</h3>
            
            <div className="space-y-4">
              {/* Material Selection */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Material</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(materials).map(([mat, props]) => (
                    <button
                      key={mat}
                      onClick={() => setSettings(prev => ({ ...prev, material: mat }))}
                      className={`p-3 rounded-lg text-sm font-medium transition ${
                        settings.material === mat ? 'ring-2 ring-offset-2 ring-offset-slate-800' : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: props.color + '20', color: props.color }}
                    >
                      {mat}
                      <p className="text-xs opacity-70">{formatCurrency(props.pricePerKg)}/kg</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Print Quality</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(qualityProfiles).map(([key, profile]) => (
                    <button
                      key={key}
                      onClick={() => setSettings(prev => ({ ...prev, quality: key }))}
                      className={`p-3 rounded-lg text-sm transition ${
                        settings.quality === key ? 'bg-purple-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {profile.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Infill */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-slate-400">Infill</label>
                  <span className="text-white font-mono">{settings.infill}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={settings.infill}
                  onChange={(e) => setSettings(prev => ({ ...prev, infill: Number(e.target.value) }))}
                  className="w-full"
                />
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Quantity</label>
                <div className="flex gap-2">
                  {[1, 5, 10, 25, 50, 100].map(qty => (
                    <button
                      key={qty}
                      onClick={() => setSettings(prev => ({ ...prev, quantity: qty }))}
                      className={`flex-1 py-2 rounded-lg text-sm ${
                        settings.quantity === qty ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {qty}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={settings.quantity}
                  onChange={(e) => setSettings(prev => ({ ...prev, quantity: Math.max(1, Number(e.target.value)) }))}
                  min="1"
                  className="w-full px-3 py-2 rounded-lg text-white mt-2"
                  style={{ backgroundColor: '#334155' }}
                />
              </div>

              {/* Finishing */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Finishing</label>
                <select
                  value={settings.finishing}
                  onChange={(e) => setSettings(prev => ({ ...prev, finishing: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-white"
                  style={{ backgroundColor: '#334155' }}
                >
                  {Object.entries(finishingOptions).map(([key, opt]) => (
                    <option key={key} value={key}>{opt.name}</option>
                  ))}
                </select>
              </div>

              {/* Rush Order */}
              <label className="flex items-center justify-between cursor-pointer p-3 rounded-lg bg-slate-700/50">
                <div>
                  <span className="text-white">🚀 Rush Order</span>
                  <p className="text-xs text-slate-500">+50% for expedited delivery</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.isRush}
                  onChange={(e) => setSettings(prev => ({ ...prev, isRush: e.target.checked }))}
                  className="w-5 h-5 rounded"
                />
              </label>
            </div>
          </div>

          {/* Quote Result */}
          <div className="rounded-xl border p-6" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
            <h3 className="font-medium text-white mb-4">💰 Quote</h3>
            
            {quote && (
              <div className="space-y-6">
                {/* Price Display */}
                <div className="text-center p-6 rounded-xl" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' }}>
                  <p className="text-slate-400 text-sm mb-1">Total Price</p>
                  <p className="text-4xl font-bold text-white">{formatCurrency(quote.totalPrice)}</p>
                  <p className="text-cyan-400 mt-2">
                    {formatCurrency(quote.unitPrice)} per unit × {settings.quantity}
                  </p>
                </div>

                {/* Estimates */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg text-center" style={{ backgroundColor: '#334155' }}>
                    <p className="text-xs text-slate-500">Weight/unit</p>
                    <p className="text-white font-medium">{quote.estimates.weightGrams}g</p>
                  </div>
                  <div className="p-3 rounded-lg text-center" style={{ backgroundColor: '#334155' }}>
                    <p className="text-xs text-slate-500">Delivery</p>
                    <p className={`font-medium ${settings.isRush ? 'text-yellow-400' : 'text-white'}`}>
                      {quote.estimates.deliveryDays} days
                    </p>
                  </div>
                </div>

                {/* Margin */}
                <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: '#334155' }}>
                  <span className="text-sm text-slate-500">Est. Margin</span>
                  <span className={`font-bold ${
                    quote.margin >= 50 ? 'text-green-400' : quote.margin >= 30 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {quote.margin}%
                  </span>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={copyQuoteToClipboard}
                    className="py-2.5 rounded-lg text-slate-300 border border-slate-600 hover:bg-slate-700"
                  >
                    📋 Copy
                  </button>
                  <button
                    onClick={saveQuote}
                    className="py-2.5 rounded-lg text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/10"
                  >
                    💾 Save Quote
                  </button>
                </div>
                <button
                  onClick={() => convertToOrder({ 
                    id: `quote-${Date.now()}`, 
                    fileName: file?.name, 
                    customer: selectedCustomer, 
                    settings, 
                    quote, 
                    analysis 
                  })}
                  className="w-full py-3 rounded-lg font-medium text-white"
                  style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
                >
                  🛒 Convert to Order
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quote History Modal */}
      {showHistory && (
        <QuoteHistoryModal
          quotes={quoteHistory}
          onClose={() => setShowHistory(false)}
          onLoad={loadQuote}
          onDelete={deleteQuote}
          onConvert={convertToOrder}
          formatCurrency={formatCurrency}
        />
      )}

      {/* Customer Selection Modal */}
      {showCustomerModal && (
        <CustomerSelectModal
          customers={customers}
          onSelect={(customer) => {
            setSelectedCustomer(customer);
            setShowCustomerModal(false);
          }}
          onClose={() => setShowCustomerModal(false)}
        />
      )}
    </div>
  );
}

// Quote History Modal
function QuoteHistoryModal({ quotes, onClose, onLoad, onDelete, onConvert, formatCurrency }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        className="relative w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl border shadow-2xl"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <div className="sticky top-0 px-6 py-4 border-b flex items-center justify-between z-10" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <h2 className="font-bold text-white">📋 Quote History</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400">✕</button>
        </div>

        <div className="p-6 space-y-3">
          {quotes.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No saved quotes yet</p>
          ) : (
            quotes.map(q => (
              <div 
                key={q.id}
                className="rounded-xl border p-4"
                style={{ backgroundColor: '#334155', borderColor: '#475569' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-white font-medium">{q.fileName}</p>
                    <p className="text-sm text-slate-500">
                      {q.customer?.name || 'No customer'} • {new Date(q.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-cyan-400 font-bold">{formatCurrency(q.quote.totalPrice)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      q.status === 'converted' ? 'bg-green-500/20 text-green-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {q.status === 'converted' ? 'Converted' : 'Pending'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button 
                    onClick={() => onLoad(q)}
                    className="flex-1 py-1.5 rounded text-sm text-slate-300 border border-slate-600 hover:bg-slate-600"
                  >
                    Load
                  </button>
                  {q.status !== 'converted' && (
                    <button 
                      onClick={() => onConvert(q)}
                      className="flex-1 py-1.5 rounded text-sm bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                    >
                      Convert to Order
                    </button>
                  )}
                  <button 
                    onClick={() => onDelete(q.id)}
                    className="px-3 py-1.5 rounded text-sm text-red-400 hover:bg-red-500/10"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Customer Selection Modal
function CustomerSelectModal({ customers, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  
  const filtered = customers.filter(c => 
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        className="relative w-full max-w-md max-h-[60vh] overflow-y-auto rounded-2xl border shadow-2xl"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <div className="sticky top-0 px-6 py-4 border-b z-10" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <h2 className="font-bold text-white mb-3">Select Customer</h2>
          <input
            type="text"
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-white text-sm"
            style={{ backgroundColor: '#334155' }}
            autoFocus
          />
        </div>

        <div className="p-4 space-y-2">
          {filtered.map(customer => (
            <button
              key={customer.id}
              onClick={() => onSelect(customer)}
              className="w-full p-3 rounded-lg text-left hover:bg-slate-700 transition"
              style={{ backgroundColor: '#334155' }}
            >
              <p className="text-white font-medium">{customer.name}</p>
              <p className="text-sm text-slate-500">{customer.email}</p>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-slate-500 text-center py-4">No customers found</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default AIQuoteGenerator;
