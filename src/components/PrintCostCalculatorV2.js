import React, { useState, useEffect, useMemo } from 'react';
import { api, unwrap } from '../services/api';
import toast from 'react-hot-toast';

/**
 * PrintCostCalculatorV2 - Real-time margin calculator with material database
 * Features: Material DB, labor costs, overhead, margin targets, price suggestions
 */

const STORAGE_KEY = 'polywerk_cost_calculator_settings';

// Default material database
const DEFAULT_MATERIALS = [
  { id: 'pla', name: 'PLA', brand: 'Bambu', pricePerKg: 25, density: 1.24, color: '#3b82f6' },
  { id: 'pla-basic', name: 'PLA Basic', brand: 'eSUN', pricePerKg: 18, density: 1.24, color: '#22c55e' },
  { id: 'petg', name: 'PETG', brand: 'Bambu', pricePerKg: 30, density: 1.27, color: '#06b6d4' },
  { id: 'petg-cf', name: 'PETG-CF', brand: 'Bambu', pricePerKg: 45, density: 1.30, color: '#334155' },
  { id: 'abs', name: 'ABS', brand: 'Bambu', pricePerKg: 28, density: 1.04, color: '#ef4444' },
  { id: 'asa', name: 'ASA', brand: 'Bambu', pricePerKg: 35, density: 1.07, color: '#f59e0b' },
  { id: 'tpu', name: 'TPU 95A', brand: 'Bambu', pricePerKg: 45, density: 1.21, color: '#a855f7' },
  { id: 'pa', name: 'PA (Nylon)', brand: 'Bambu', pricePerKg: 50, density: 1.15, color: '#64748b' },
  { id: 'pa-cf', name: 'PA-CF', brand: 'Bambu', pricePerKg: 70, density: 1.20, color: '#1e293b' },
  { id: 'pla-silk', name: 'PLA Silk', brand: 'Eryone', pricePerKg: 22, density: 1.24, color: '#fbbf24' },
];

// Default overhead settings
const DEFAULT_SETTINGS = {
  electricityCostPerKwh: 0.15,
  printerPowerWatts: 150,
  laborCostPerHour: 15,
  setupTimeMinutes: 10,
  packagingCost: 1.5,
  failureRate: 5, // percentage
  targetMargin: 40, // percentage
  minimumPrice: 10,
  printerDepreciationPerHour: 0.50,
};

function PrintCostCalculatorV2() {
  const [materials, setMaterials] = useState(DEFAULT_MATERIALS);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [showMaterialEditor, setShowMaterialEditor] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  
  // Calculator inputs
  const [calc, setCalc] = useState({
    materialId: 'pla',
    weightGrams: 50,
    printTimeHours: 2,
    quantity: 1,
    complexity: 'medium', // simple, medium, complex
    finishing: 'none', // none, sanding, painting, assembly
    isRush: false,
  });

  // Load saved settings
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.materials) setMaterials(data.materials);
        if (data.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      } catch (e) {
        console.error('Failed to load calculator settings:', e);
      }
    }
  }, []);

  // Save settings
  const saveSettings = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ materials, settings }));
    toast.success('Settings saved');
  };

  // Get selected material
  const selectedMaterial = materials.find(m => m.id === calc.materialId) || materials[0];

  // Calculate all costs
  const costs = useMemo(() => {
    const mat = selectedMaterial;
    const qty = calc.quantity;

    // Material cost
    const materialCostPerUnit = (calc.weightGrams / 1000) * mat.pricePerKg;
    const materialCostTotal = materialCostPerUnit * qty;

    // Electricity cost
    const electricityCostPerUnit = (calc.printTimeHours * settings.printerPowerWatts / 1000) * settings.electricityCostPerKwh;
    const electricityCostTotal = electricityCostPerUnit * qty;

    // Labor cost (setup + post-processing)
    const setupTime = settings.setupTimeMinutes / 60;
    const postProcessTime = calc.finishing === 'none' ? 0 :
                           calc.finishing === 'sanding' ? 0.25 :
                           calc.finishing === 'painting' ? 0.5 :
                           calc.finishing === 'assembly' ? 0.75 : 0;
    const complexityMult = calc.complexity === 'simple' ? 0.8 :
                          calc.complexity === 'complex' ? 1.3 : 1.0;
    const laborHoursPerUnit = (setupTime / qty) + (postProcessTime * complexityMult);
    const laborCostPerUnit = laborHoursPerUnit * settings.laborCostPerHour;
    const laborCostTotal = laborCostPerUnit * qty;

    // Printer depreciation
    const depreciationPerUnit = calc.printTimeHours * settings.printerDepreciationPerHour;
    const depreciationTotal = depreciationPerUnit * qty;

    // Packaging
    const packagingTotal = settings.packagingCost * qty;

    // Failure buffer (adds percentage to cover reprints)
    const subtotalBeforeFailure = materialCostTotal + electricityCostTotal + laborCostTotal + depreciationTotal + packagingTotal;
    const failureBuffer = subtotalBeforeFailure * (settings.failureRate / 100);

    // Total raw cost
    const totalRawCost = subtotalBeforeFailure + failureBuffer;
    const rawCostPerUnit = totalRawCost / qty;

    // Rush multiplier
    const rushMultiplier = calc.isRush ? 1.5 : 1.0;

    // Quantity discount
    let quantityDiscount = 0;
    if (qty >= 100) quantityDiscount = 0.15;
    else if (qty >= 50) quantityDiscount = 0.10;
    else if (qty >= 20) quantityDiscount = 0.07;
    else if (qty >= 10) quantityDiscount = 0.05;

    // Calculate prices at different margins
    const calculatePrice = (margin) => {
      const basePrice = rawCostPerUnit / (1 - margin / 100);
      const adjustedPrice = basePrice * rushMultiplier * (1 - quantityDiscount);
      return Math.max(settings.minimumPrice, adjustedPrice);
    };

    const priceAt30 = calculatePrice(30);
    const priceAt40 = calculatePrice(40);
    const priceAt50 = calculatePrice(50);
    const priceAtTarget = calculatePrice(settings.targetMargin);

    // Suggested price (target margin)
    const suggestedUnitPrice = priceAtTarget;
    const suggestedTotalPrice = suggestedUnitPrice * qty;

    // Actual margin at suggested price
    const actualMargin = ((suggestedUnitPrice - rawCostPerUnit) / suggestedUnitPrice) * 100;

    return {
      // Per unit costs
      materialCostPerUnit: round(materialCostPerUnit),
      electricityCostPerUnit: round(electricityCostPerUnit),
      laborCostPerUnit: round(laborCostPerUnit),
      depreciationPerUnit: round(depreciationPerUnit),
      packagingPerUnit: round(settings.packagingCost),
      failureBufferPerUnit: round(failureBuffer / qty),
      rawCostPerUnit: round(rawCostPerUnit),

      // Totals
      materialCostTotal: round(materialCostTotal),
      electricityCostTotal: round(electricityCostTotal),
      laborCostTotal: round(laborCostTotal),
      depreciationTotal: round(depreciationTotal),
      packagingTotal: round(packagingTotal),
      failureBuffer: round(failureBuffer),
      totalRawCost: round(totalRawCost),

      // Pricing
      priceAt30: round(priceAt30),
      priceAt40: round(priceAt40),
      priceAt50: round(priceAt50),
      suggestedUnitPrice: round(suggestedUnitPrice),
      suggestedTotalPrice: round(suggestedTotalPrice),
      actualMargin: round(actualMargin),
      quantityDiscount: round(quantityDiscount * 100),
      rushMultiplier,

      // Print time
      totalPrintTime: round(calc.printTimeHours * qty),
      totalWeight: round(calc.weightGrams * qty),
    };
  }, [calc, selectedMaterial, settings]);

  const round = (num) => Math.round(num * 100) / 100;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('et-EE', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  // Add/edit material
  const saveMaterial = (material) => {
    if (editingMaterial) {
      setMaterials(prev => prev.map(m => m.id === editingMaterial.id ? material : m));
    } else {
      setMaterials(prev => [...prev, { ...material, id: `custom-${Date.now()}` }]);
    }
    setEditingMaterial(null);
    setShowMaterialEditor(false);
  };

  const deleteMaterial = (id) => {
    if (materials.length <= 1) {
      toast.error('Cannot delete last material');
      return;
    }
    setMaterials(prev => prev.filter(m => m.id !== id));
    if (calc.materialId === id) {
      setCalc(prev => ({ ...prev, materialId: materials[0].id }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            🧮 Print Cost Calculator
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Real-time cost breakdown with margin optimization
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`px-4 py-2 rounded-lg text-sm ${showSettings ? 'bg-purple-500 text-white' : 'text-slate-300 border border-slate-600 hover:bg-slate-700'}`}
          >
            ⚙️ Settings
          </button>
          <button
            onClick={saveSettings}
            className="px-4 py-2 rounded-lg text-sm bg-green-500/20 text-green-400 hover:bg-green-500/30"
          >
            💾 Save
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="rounded-xl border p-6 space-y-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <h3 className="font-medium text-white">Overhead & Cost Settings</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Electricity (€/kWh)</label>
              <input
                type="number"
                step="0.01"
                value={settings.electricityCostPerKwh}
                onChange={(e) => setSettings(prev => ({ ...prev, electricityCostPerKwh: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 rounded-lg text-white text-sm"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Printer Power (W)</label>
              <input
                type="number"
                value={settings.printerPowerWatts}
                onChange={(e) => setSettings(prev => ({ ...prev, printerPowerWatts: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 rounded-lg text-white text-sm"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Labor (€/hour)</label>
              <input
                type="number"
                step="0.5"
                value={settings.laborCostPerHour}
                onChange={(e) => setSettings(prev => ({ ...prev, laborCostPerHour: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 rounded-lg text-white text-sm"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Setup Time (min)</label>
              <input
                type="number"
                value={settings.setupTimeMinutes}
                onChange={(e) => setSettings(prev => ({ ...prev, setupTimeMinutes: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 rounded-lg text-white text-sm"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Packaging (€)</label>
              <input
                type="number"
                step="0.1"
                value={settings.packagingCost}
                onChange={(e) => setSettings(prev => ({ ...prev, packagingCost: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 rounded-lg text-white text-sm"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Failure Rate (%)</label>
              <input
                type="number"
                value={settings.failureRate}
                onChange={(e) => setSettings(prev => ({ ...prev, failureRate: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 rounded-lg text-white text-sm"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Target Margin (%)</label>
              <input
                type="number"
                value={settings.targetMargin}
                onChange={(e) => setSettings(prev => ({ ...prev, targetMargin: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 rounded-lg text-white text-sm"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Min Price (€)</label>
              <input
                type="number"
                value={settings.minimumPrice}
                onChange={(e) => setSettings(prev => ({ ...prev, minimumPrice: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 rounded-lg text-white text-sm"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Material Selection */}
          <div className="rounded-xl border p-6" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-white">📦 Material</h3>
              <button
                onClick={() => { setEditingMaterial(null); setShowMaterialEditor(true); }}
                className="text-xs text-purple-400 hover:text-purple-300"
              >
                + Add Material
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {materials.map(mat => (
                <button
                  key={mat.id}
                  onClick={() => setCalc(prev => ({ ...prev, materialId: mat.id }))}
                  className={`p-3 rounded-lg text-left transition relative group ${
                    calc.materialId === mat.id 
                      ? 'ring-2 ring-purple-500' 
                      : 'hover:bg-slate-700/50'
                  }`}
                  style={{ backgroundColor: mat.color + '20' }}
                >
                  <div className="w-3 h-3 rounded-full mb-2" style={{ backgroundColor: mat.color }} />
                  <p className="text-white text-sm font-medium">{mat.name}</p>
                  <p className="text-xs text-slate-400">{mat.brand}</p>
                  <p className="text-xs text-slate-500">{formatCurrency(mat.pricePerKg)}/kg</p>
                  
                  {/* Edit/Delete buttons */}
                  <div className="absolute top-1 right-1 hidden group-hover:flex gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingMaterial(mat); setShowMaterialEditor(true); }}
                      className="p-1 rounded bg-slate-700 text-xs"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteMaterial(mat.id); }}
                      className="p-1 rounded bg-slate-700 text-xs text-red-400"
                    >
                      🗑️
                    </button>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Print Parameters */}
          <div className="rounded-xl border p-6" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
            <h3 className="font-medium text-white mb-4">🖨️ Print Parameters</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Weight (g)</label>
                <input
                  type="number"
                  value={calc.weightGrams}
                  onChange={(e) => setCalc(prev => ({ ...prev, weightGrams: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 rounded-lg text-white"
                  style={{ backgroundColor: '#334155' }}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Print Time (h)</label>
                <input
                  type="number"
                  step="0.5"
                  value={calc.printTimeHours}
                  onChange={(e) => setCalc(prev => ({ ...prev, printTimeHours: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 rounded-lg text-white"
                  style={{ backgroundColor: '#334155' }}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={calc.quantity}
                  onChange={(e) => setCalc(prev => ({ ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                  className="w-full px-3 py-2 rounded-lg text-white"
                  style={{ backgroundColor: '#334155' }}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Complexity</label>
                <select
                  value={calc.complexity}
                  onChange={(e) => setCalc(prev => ({ ...prev, complexity: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-white"
                  style={{ backgroundColor: '#334155' }}
                >
                  <option value="simple">Simple (-20%)</option>
                  <option value="medium">Medium</option>
                  <option value="complex">Complex (+30%)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Finishing</label>
                <select
                  value={calc.finishing}
                  onChange={(e) => setCalc(prev => ({ ...prev, finishing: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-white"
                  style={{ backgroundColor: '#334155' }}
                >
                  <option value="none">None</option>
                  <option value="sanding">Sanding (+15min)</option>
                  <option value="painting">Painting (+30min)</option>
                  <option value="assembly">Assembly (+45min)</option>
                </select>
              </div>
              <label className="flex items-center gap-3 p-3 rounded-lg cursor-pointer" style={{ backgroundColor: '#334155' }}>
                <input
                  type="checkbox"
                  checked={calc.isRush}
                  onChange={(e) => setCalc(prev => ({ ...prev, isRush: e.target.checked }))}
                  className="w-5 h-5 rounded"
                />
                <div>
                  <p className="text-white">🚀 Rush Order</p>
                  <p className="text-xs text-slate-400">+50% premium</p>
                </div>
              </label>
            </div>
          </div>

          {/* Cost Breakdown */}
          <div className="rounded-xl border p-6" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
            <h3 className="font-medium text-white mb-4">📊 Cost Breakdown (per unit)</h3>
            <div className="space-y-2">
              <CostRow label="Material" value={costs.materialCostPerUnit} icon="📦" />
              <CostRow label="Electricity" value={costs.electricityCostPerUnit} icon="⚡" />
              <CostRow label="Labor" value={costs.laborCostPerUnit} icon="👷" />
              <CostRow label="Depreciation" value={costs.depreciationPerUnit} icon="🔧" />
              <CostRow label="Packaging" value={costs.packagingPerUnit} icon="📬" />
              <CostRow label={`Failure buffer (${settings.failureRate}%)`} value={costs.failureBufferPerUnit} icon="⚠️" />
              <div className="border-t pt-2 mt-2" style={{ borderColor: '#475569' }}>
                <CostRow label="Raw Cost / Unit" value={costs.rawCostPerUnit} icon="💰" bold />
              </div>
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className="space-y-6">
          {/* Suggested Price */}
          <div className="rounded-xl border p-6 bg-gradient-to-br from-purple-500/10 to-cyan-500/10" style={{ borderColor: '#334155' }}>
            <h3 className="text-sm text-slate-400 mb-2">Suggested Price</h3>
            <p className="text-4xl font-bold text-white">{formatCurrency(costs.suggestedUnitPrice)}</p>
            <p className="text-cyan-400">per unit × {calc.quantity}</p>
            
            <div className="mt-4 pt-4 border-t" style={{ borderColor: '#475569' }}>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Total Price</span>
                <span className="text-white font-bold">{formatCurrency(costs.suggestedTotalPrice)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-slate-400">Your Margin</span>
                <span className={`font-bold ${costs.actualMargin >= 40 ? 'text-green-400' : costs.actualMargin >= 30 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {costs.actualMargin}%
                </span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-slate-400">Raw Cost</span>
                <span className="text-slate-300">{formatCurrency(costs.totalRawCost)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-slate-400">Profit</span>
                <span className="text-green-400">{formatCurrency(costs.suggestedTotalPrice - costs.totalRawCost)}</span>
              </div>
            </div>

            {costs.quantityDiscount > 0 && (
              <div className="mt-3 px-2 py-1 rounded bg-green-500/20 text-green-400 text-xs text-center">
                {costs.quantityDiscount}% quantity discount applied
              </div>
            )}
            {costs.rushMultiplier > 1 && (
              <div className="mt-2 px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 text-xs text-center">
                +50% rush premium applied
              </div>
            )}
          </div>

          {/* Price at Different Margins */}
          <div className="rounded-xl border p-6" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
            <h3 className="font-medium text-white mb-4">💹 Price @ Margin</h3>
            <div className="space-y-3">
              <MarginOption margin={30} price={costs.priceAt30} targetMargin={settings.targetMargin} />
              <MarginOption margin={40} price={costs.priceAt40} targetMargin={settings.targetMargin} />
              <MarginOption margin={50} price={costs.priceAt50} targetMargin={settings.targetMargin} />
            </div>
          </div>

          {/* Quick Stats */}
          <div className="rounded-xl border p-6" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
            <h3 className="font-medium text-white mb-4">📈 Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Weight</span>
                <span className="text-white">{costs.totalWeight}g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Print Time</span>
                <span className="text-white">{costs.totalPrintTime}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Material</span>
                <span className="text-white">{selectedMaterial.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">€ per gram</span>
                <span className="text-white">{formatCurrency(costs.suggestedUnitPrice / calc.weightGrams)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">€ per hour</span>
                <span className="text-white">{formatCurrency(costs.suggestedUnitPrice / calc.printTimeHours)}</span>
              </div>
            </div>
          </div>

          {/* Copy Quote */}
          <button
            onClick={() => {
              const quote = `Print Quote:
Material: ${selectedMaterial.name} (${selectedMaterial.brand})
Weight: ${calc.weightGrams}g × ${calc.quantity} = ${costs.totalWeight}g
Print Time: ${calc.printTimeHours}h × ${calc.quantity} = ${costs.totalPrintTime}h
${calc.finishing !== 'none' ? `Finishing: ${calc.finishing}\n` : ''}${calc.isRush ? 'Rush Order: Yes\n' : ''}
Unit Price: ${formatCurrency(costs.suggestedUnitPrice)}
Total: ${formatCurrency(costs.suggestedTotalPrice)}`;
              navigator.clipboard.writeText(quote);
              toast.success('Quote copied!');
            }}
            className="w-full py-3 rounded-lg font-medium text-white"
            style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
          >
            📋 Copy Quote
          </button>
        </div>
      </div>

      {/* Material Editor Modal */}
      {showMaterialEditor && (
        <MaterialEditorModal
          material={editingMaterial}
          onSave={saveMaterial}
          onClose={() => { setShowMaterialEditor(false); setEditingMaterial(null); }}
        />
      )}
    </div>
  );
}

// Helper Components
function CostRow({ label, value, icon, bold = false }) {
  return (
    <div className="flex justify-between items-center">
      <span className={`text-sm ${bold ? 'text-white font-medium' : 'text-slate-400'}`}>
        {icon} {label}
      </span>
      <span className={`${bold ? 'text-white font-bold' : 'text-slate-300'}`}>
        €{value.toFixed(2)}
      </span>
    </div>
  );
}

function MarginOption({ margin, price, targetMargin }) {
  const isTarget = margin === targetMargin;
  return (
    <div className={`flex justify-between items-center p-2 rounded-lg ${isTarget ? 'bg-purple-500/20 ring-1 ring-purple-500' : 'bg-slate-700/50'}`}>
      <span className={`text-sm ${isTarget ? 'text-purple-400 font-medium' : 'text-slate-400'}`}>
        {margin}% margin {isTarget && '(target)'}
      </span>
      <span className={`font-medium ${isTarget ? 'text-purple-400' : 'text-white'}`}>
        €{price.toFixed(2)}
      </span>
    </div>
  );
}

function MaterialEditorModal({ material, onSave, onClose }) {
  const [form, setForm] = useState({
    name: material?.name || '',
    brand: material?.brand || 'Custom',
    pricePerKg: material?.pricePerKg || 25,
    density: material?.density || 1.24,
    color: material?.color || '#3b82f6',
  });

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    onSave({ ...material, ...form, id: material?.id });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative rounded-xl border p-6 w-full max-w-md" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        <h2 className="font-bold text-white mb-4">{material ? 'Edit Material' : 'Add Material'}</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-white"
              style={{ backgroundColor: '#334155' }}
              placeholder="PLA, PETG, etc."
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Brand</label>
            <input
              type="text"
              value={form.brand}
              onChange={(e) => setForm(prev => ({ ...prev, brand: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-white"
              style={{ backgroundColor: '#334155' }}
              placeholder="Bambu, eSUN, etc."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Price (€/kg)</label>
              <input
                type="number"
                value={form.pricePerKg}
                onChange={(e) => setForm(prev => ({ ...prev, pricePerKg: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Density (g/cm³)</label>
              <input
                type="number"
                step="0.01"
                value={form.density}
                onChange={(e) => setForm(prev => ({ ...prev, density: parseFloat(e.target.value) || 1 }))}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Color</label>
            <input
              type="color"
              value={form.color}
              onChange={(e) => setForm(prev => ({ ...prev, color: e.target.value }))}
              className="w-full h-10 rounded-lg cursor-pointer"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-2 rounded-lg bg-purple-500 text-white hover:bg-purple-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default PrintCostCalculatorV2;
