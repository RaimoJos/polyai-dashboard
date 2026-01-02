import React, { useEffect, useMemo, useState } from 'react';
import { api, unwrap } from '../services/api';
import { formatErrorMessage, logError } from '../utils/apiSafety';
import toast from '../utils/toast';
import { useLanguage } from '../i18n';

const QuoteCalculator = () => {
  const { t } = useLanguage();
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [walkInName, setWalkInName] = useState('');
  const [walkInEmail, setWalkInEmail] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [inventory, setInventory] = useState([]);
  const [config, setConfig] = useState(null);
  const [formData, setFormData] = useState({
    material_type: 'PLA',
    material_weight_g: '',
    print_time_hours: '',
    complexity: 'medium',
    rush_order: false,
    client_discount: 0,
    quantity: 1,
    item_name: '',
    notes: '',
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');
  
  // Order creation modal
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [orderItemName, setOrderItemName] = useState('');
  const [orderFilePath, setOrderFilePath] = useState('');
  const [availableFiles, setAvailableFiles] = useState([]);
  const [creatingOrder, setCreatingOrder] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [clientsRes, invRes, cfgRes] = await Promise.all([
        api.getClients(),
        api.getMaterialInventory(),
        api.getPricingConfig(),
      ]);

      // API responses are already safely unwrapped
      const c = clientsRes || [];
      const inv = invRes?.spools || invRes || [];
      const cfg = cfgRes || {};
      
      setClients(Array.isArray(c) ? c : (c?.clients || []));
      const spoolsList = Array.isArray(inv) ? inv : (inv?.spools || inv?.inventory || inv?.materials || inv?.items || []);
      setInventory(spoolsList);
      setConfig(cfg);
    } catch (e) {
      const msg = formatErrorMessage(e, { action: 'load quote data' });
      setError(msg);
      logError(e, { component: 'QuoteCalculator', action: 'loadData' });
    } finally {
      setLoading(false);
    }
  };

  const loadFiles = async () => {
    try {
      const res = await api.listFiles();
      // API returns {files: [...]} or already unwrapped
      const body = res || {};
      setAvailableFiles(Array.isArray(body.files) ? body.files : (Array.isArray(body) ? body : []));
    } catch (e) {
      logError(e, { component: 'QuoteCalculator', action: 'loadFiles' });
      setAvailableFiles([]);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const materialOptions = useMemo(() => {
    const opts = new Map();
    for (const it of inventory || []) {
      const key = it.material_type || it.material || it.type || it.name;
      if (key && typeof key === 'string') {
        opts.set(key.toUpperCase(), key.toUpperCase());
      }
    }
    if (opts.size === 0) {
      return ['PLA', 'PETG', 'ABS', 'TPU', 'ASA', 'Nylon'];
    }
    return Array.from(opts.values()).sort();
  }, [inventory]);

  const complexityOptions = useMemo(() => {
    const multipliers = config?.complexity_multipliers || {
      low: 1.0,
      medium: 1.2,
      high: 1.5,
      extreme: 2.0
    };
    const labels = {
      low: t('quote.complexityLow'),
      medium: t('quote.complexityMedium'),
      high: t('quote.complexityHigh'),
      extreme: t('quote.complexityExtreme')
    };
    return Object.entries(multipliers).map(([key, value]) => ({
      value: key,
      label: `${labels[key] || key} (×${value})`,
      multiplier: value
    }));
  }, [config, t]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleClientChange = (value) => {
    if (value === 'walk-in') {
      setIsWalkIn(true);
      setSelectedClient('');
    } else {
      setIsWalkIn(false);
      setSelectedClient(value);
    }
  };

  const getSelectedClientName = () => {
    if (isWalkIn) return walkInName || t('quote.walkIn');
    const client = clients.find(c => (c.client_id || c.id) === selectedClient);
    return client?.name || client?.client_name || 'Unknown';
  };

  const calculate = async () => {
    setError('');
    setResult(null);
    setCalculating(true);

    try {
      let clientId = selectedClient || null;
      let clientName = getSelectedClientName();
      
      // If walk-in client with a name, create them first
      if (isWalkIn && walkInName.trim()) {
        try {
          const newClient = await api.createClient({
            name: walkInName.trim(),
            email: walkInEmail.trim() || null,
            phone: walkInPhone.trim() || null,
            client_type: 'walk-in',
            notes: 'Walk-in customer'
          });
          // API already unwraps, just get the ID
          clientId = newClient?.client_id || newClient?.id || null;
          clientName = walkInName.trim();
          
          const c = await api.getClients();
          setClients(Array.isArray(c) ? c : (c?.clients || []));
          
          toast.success(`${t('clients.addClient')}: "${walkInName}"!`);
          
          setIsWalkIn(false);
          setSelectedClient(clientId);
        } catch (e) {
          console.warn('Could not create walk-in client:', e);
          logError(e, { component: 'QuoteCalculator', action: 'createWalkInClient', clientName: walkInName });
        }
      }

      const weight_g = Number(formData.material_weight_g);
      const time_h = Number(formData.print_time_hours);

      if (!formData.material_type) throw new Error(t('quote.material') + ' required');
      if (!Number.isFinite(weight_g) || weight_g <= 0) throw new Error(t('quote.weight') + ' > 0');
      if (!Number.isFinite(time_h) || time_h <= 0) throw new Error(t('quote.printTime') + ' > 0');

      const payload = {
        client_id: clientId,
        material_type: formData.material_type,
        material_weight_g: weight_g,
        print_time_hours: time_h,
        complexity: formData.complexity,
        rush_order: formData.rush_order,
        client_discount: Number(formData.client_discount) || 0,
        quantity: Number(formData.quantity) || 1,
        notes: formData.notes,
      };

      // Call backend calculator
      let calcResult;
      try {
        const calcRes = await api.calculateQuote(payload);
        calcResult = unwrap(calcRes);
      } catch (e) {
        // Fallback to client-side calculation
        const materialCostPerKg = config?.material_costs?.[formData.material_type] || 25;
        const machineCostPerHour = config?.machine_hourly_rate || 2.5;
        const laborCostPerHour = config?.labor_hourly_rate || 8;
        const laborHours = config?.labor_hours_per_job || 0.5;
        const profitMargin = config?.default_profit_margin || 0.4;
        const complexityMult = config?.complexity_multipliers?.[formData.complexity] || 1.0;
        const rushMult = formData.rush_order ? (config?.rush_order_multiplier || 1.5) : 1.0;
        const taxRate = config?.tax_rate || 0.20;

        const materialCost = (weight_g / 1000) * materialCostPerKg;
        const machineCost = time_h * machineCostPerHour;
        const laborCost = laborHours * laborCostPerHour;
        const baseCost = materialCost + machineCost + laborCost;
        
        const priceWithMargin = baseCost * (1 + profitMargin);
        const priceWithComplexity = priceWithMargin * complexityMult;
        const rushFee = formData.rush_order ? priceWithComplexity * (rushMult - 1) : 0;
        const priceWithRush = priceWithComplexity + rushFee;
        
        const discountAmount = priceWithRush * (formData.client_discount / 100);
        const unitPrice = priceWithRush - discountAmount;
        const subtotal = unitPrice * formData.quantity;
        const vatAmount = subtotal * taxRate;
        const total = subtotal + vatAmount;

        calcResult = {
          mode: 'client-fallback',
          material_cost: materialCost,
          machine_cost: machineCost,
          labor_cost: laborCost,
          base_cost: baseCost,
          complexity_multiplier: complexityMult,
          rush_fee: rushFee,
          quantity: formData.quantity,
          client_discount_percentage: formData.client_discount,
          discount_amount: discountAmount * formData.quantity,
          unit_price: unitPrice,
          subtotal: subtotal,
          vat_rate: taxRate,
          vat_amount: vatAmount,
          total: total,
          currency: config?.currency || 'EUR',
        };
      }

      // Store result with client info for order creation
      setResult({
        ...calcResult,
        clientId,
        clientName,
        // Store form data for order creation
        _formData: { ...formData, client_id: clientId }
      });
      
    } catch (e) {
      console.error('Quote calculation error:', e);
      setError(e?.message || 'Failed to calculate quote');
    } finally {
      setCalculating(false);
    }
  };

  const openCreateOrderModal = async () => {
    setOrderItemName(formData.item_name || '');
    setOrderFilePath('');
    await loadFiles();
    setShowCreateOrder(true);
  };

  const createOrder = async () => {
    if (!orderItemName.trim()) {
      toast.error(t('quote.jobName') + ' required');
      return;
    }

    setCreatingOrder(true);
    try {
      const orderData = {
        client_id: result.clientId,
        client_name: result.clientName,
        item_name: orderItemName.trim(),
        material_type: formData.material_type,
        quantity: formData.quantity,
        complexity: formData.complexity,
        rush_order: formData.rush_order,
        notes: formData.notes,
        file_path: orderFilePath || null, // Can be empty
        quote: {
          unit_price: result.unit_price,
          subtotal: result.subtotal,
          vat_rate: result.vat_rate,
          vat_amount: result.vat_amount,
          total: result.total,
          material_cost: result.material_cost,
          machine_cost: result.machine_cost,
          labor_cost: result.labor_cost,
          base_cost: result.base_cost,
          complexity_multiplier: result.complexity_multiplier,
          rush_fee: result.rush_fee,
          discount_amount: result.discount_amount,
          estimated_profit: result.estimated_profit || (result.subtotal - result.base_cost * formData.quantity),
        },
        status: 'quoted',
        payment_status: 'pending',
      };

      await api.createOrder(orderData);
      
      toast.success(`${t('common.create')}: "${orderItemName}"!`);
      setShowCreateOrder(false);
      setResult(null);
      
      // Reset form for next quote
      setFormData({
        material_type: 'PLA',
        material_weight_g: '',
        print_time_hours: '',
        complexity: 'medium',
        rush_order: false,
        client_discount: 0,
        quantity: 1,
        item_name: '',
        notes: '',
      });
      setOrderItemName('');
      setOrderFilePath('');
      
      // Emit event so OrderManagement can refresh
      window.dispatchEvent(new CustomEvent('orderCreated'));
      
    } catch (e) {
      console.error('Failed to create order:', e);
      toast.error(e?.message || 'Failed to create order');
    } finally {
      setCreatingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/3"></div>
          <div className="h-64 bg-gray-800 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          💰 {t('quote.title')}
        </h2>
        <p className="text-sm text-zinc-400 mt-1">{t('quote.subtitle')}</p>
      </div>

      {error && (
        <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-400 mb-6">
          {error}
        </div>
      )}

      {/* Client Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-zinc-400 mb-2">{t('quote.client')} *</label>
        <select
          value={isWalkIn ? 'walk-in' : selectedClient}
          onChange={(e) => handleClientChange(e.target.value)}
          className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
        >
          <option value="">{t('quote.selectClient')}</option>
          <option value="walk-in">🚶 {t('quote.newWalkIn')}</option>
          {clients.map((c) => (
            <option key={c.client_id || c.id} value={c.client_id || c.id}>
              {c.name || c.client_name}
            </option>
          ))}
        </select>
        
        {isWalkIn && (
          <div className="mt-3 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="text-sm text-zinc-300 mb-3">{t('quote.newWalkIn')}</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                value={walkInName}
                onChange={(e) => setWalkInName(e.target.value)}
                className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                placeholder={`${t('common.name')} *`}
              />
              <input
                type="email"
                value={walkInEmail}
                onChange={(e) => setWalkInEmail(e.target.value)}
                className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                placeholder={t('common.email')}
              />
              <input
                type="tel"
                value={walkInPhone}
                onChange={(e) => setWalkInPhone(e.target.value)}
                className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                placeholder={t('common.phone')}
              />
            </div>
          </div>
        )}
      </div>

      {/* Item Name */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-zinc-400 mb-2">{t('quote.jobName')}</label>
        <input
          type="text"
          value={formData.item_name}
          onChange={(e) => handleInputChange('item_name', e.target.value)}
          className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
          placeholder="e.g. Phone Stand, Custom Bracket, etc."
        />
      </div>

      {/* Print Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">{t('quote.material')} *</label>
          <select
            value={formData.material_type}
            onChange={(e) => handleInputChange('material_type', e.target.value)}
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
          >
            {materialOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">{t('quote.weight')} *</label>
          <input
            type="number"
            step="1"
            value={formData.material_weight_g}
            onChange={(e) => handleInputChange('material_weight_g', e.target.value)}
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
            placeholder="250"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">{t('quote.printTime')} *</label>
          <input
            type="number"
            step="0.1"
            value={formData.print_time_hours}
            onChange={(e) => handleInputChange('print_time_hours', e.target.value)}
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
            placeholder="6.5"
          />
        </div>
      </div>

      {/* Modifiers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">{t('quote.complexity')}</label>
          <select
            value={formData.complexity}
            onChange={(e) => handleInputChange('complexity', e.target.value)}
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
          >
            {complexityOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">{t('common.quantity')}</label>
          <input
            type="number"
            min="1"
            value={formData.quantity}
            onChange={(e) => handleInputChange('quantity', parseInt(e.target.value) || 1)}
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">{t('quote.discount')}</label>
          <input
            type="number"
            min="0"
            max="100"
            value={formData.client_discount}
            onChange={(e) => handleInputChange('client_discount', parseFloat(e.target.value) || 0)}
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
          />
        </div>

        <div className="flex items-end">
          <label className="flex items-center gap-3 p-3 rounded-lg bg-gray-800 border border-gray-700 cursor-pointer hover:border-gray-600 w-full h-[46px]">
            <input
              type="checkbox"
              checked={formData.rush_order}
              onChange={(e) => handleInputChange('rush_order', e.target.checked)}
              className="w-4 h-4 rounded accent-purple-500"
            />
            <span className="text-sm text-white">⚡ {t('quote.rushOrder')}</span>
          </label>
        </div>
      </div>

      {/* Notes */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-zinc-400 mb-2">{t('common.notes')}</label>
        <textarea
          value={formData.notes}
          onChange={(e) => handleInputChange('notes', e.target.value)}
          className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
          rows={2}
          placeholder={t('common.notes')}
        />
      </div>

      <button
        onClick={calculate}
        disabled={calculating || (!selectedClient && !walkInName.trim())}
        className="px-6 py-3 rounded-lg font-medium text-white transition disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
      >
        {calculating ? `⏳ ${t('common.loading')}` : `🧮 ${t('quote.calculate')}`}
      </button>

      {/* Quote Result */}
      {result && (
        <div className="mt-6 p-6 rounded-xl border border-purple-500/30 bg-purple-900/10">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-bold text-white">{t('quote.preview')}: {result.clientName}</h3>
              {result.mode === 'client-fallback' && (
                <span className="text-xs bg-yellow-600/30 text-yellow-300 px-2 py-1 rounded">Estimated</span>
              )}
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
                €{Number(result.total || 0).toFixed(2)}
              </div>
              <div className="text-sm text-zinc-400">{t('quote.inclVat')} {((result.vat_rate || 0) * 100).toFixed(0)}% {t('quote.vat')}</div>
            </div>
          </div>
          
          {/* Breakdown */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-6 text-sm">
            <div className="bg-gray-800/50 rounded p-2">
              <div className="text-zinc-500 text-xs">{t('quote.materialCost')}</div>
              <div className="text-white">€{Number(result.material_cost || 0).toFixed(2)}</div>
            </div>
            <div className="bg-gray-800/50 rounded p-2">
              <div className="text-zinc-500 text-xs">{t('quote.machineCost')}</div>
              <div className="text-white">€{Number(result.machine_cost || 0).toFixed(2)}</div>
            </div>
            <div className="bg-gray-800/50 rounded p-2">
              <div className="text-zinc-500 text-xs">{t('quote.laborCost')}</div>
              <div className="text-white">€{Number(result.labor_cost || 0).toFixed(2)}</div>
            </div>
            <div className="bg-gray-800/50 rounded p-2">
              <div className="text-zinc-500 text-xs">{t('common.price')}</div>
              <div className="text-white">€{Number(result.unit_price || 0).toFixed(2)}</div>
            </div>
            <div className="bg-gray-800/50 rounded p-2">
              <div className="text-zinc-500 text-xs">{t('quote.subtotal')}</div>
              <div className="text-white">€{Number(result.subtotal || 0).toFixed(2)}</div>
            </div>
            <div className="bg-gray-800/50 rounded p-2">
              <div className="text-zinc-500 text-xs">{t('quote.estProfit')}</div>
              <div className="text-green-400">€{Number(result.estimated_profit || (result.subtotal - result.base_cost * formData.quantity) || 0).toFixed(2)}</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={openCreateOrderModal}
              className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition"
            >
              ✅ {t('quote.createJob')}
            </button>
            <button
              onClick={() => setResult(null)}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
            >
              ✕ {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Create Order Modal */}
      {showCreateOrder && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-white mb-4">📦 {t('quote.createJob')}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">{t('quote.jobName')} *</label>
                <input
                  type="text"
                  value={orderItemName}
                  onChange={(e) => setOrderItemName(e.target.value)}
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  placeholder="e.g. Custom Phone Stand"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  STL/3MF File <span className="text-zinc-600">(optional)</span>
                </label>
                <select
                  value={orderFilePath}
                  onChange={(e) => setOrderFilePath(e.target.value)}
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                >
                  <option value="">No file yet</option>
                  {availableFiles.map(f => (
                    <option key={f.path || f.name} value={f.path || f.name}>
                      {f.name || f.path}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-gray-800/50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">{t('quote.client')}:</span>
                  <span className="text-white">{result?.clientName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">{t('common.total')}:</span>
                  <span className="text-green-400 font-bold">€{Number(result?.total || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateOrder(false)}
                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={createOrder}
                disabled={creatingOrder || !orderItemName.trim()}
                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition disabled:opacity-50"
              >
                {creatingOrder ? `⏳ ${t('common.loading')}` : `✅ ${t('common.create')}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuoteCalculator;
