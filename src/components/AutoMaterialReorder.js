import React, { useState, useEffect, useMemo } from 'react';
import { api, unwrap } from '../services/api';
import toast from 'react-hot-toast';

/**
 * AutoMaterialReorder - Predict when to reorder, generate PO
 * Features: Usage tracking, prediction, low stock alerts, PO generation
 */

const STORAGE_KEY = 'polywerk_material_reorder';

// Default suppliers
const DEFAULT_SUPPLIERS = [
  { id: 'bambu', name: 'Bambu Lab Store', website: 'https://store.bambulab.com', leadTimeDays: 5 },
  { id: '3djake', name: '3DJake', website: 'https://www.3djake.com', leadTimeDays: 3 },
  { id: 'amazon', name: 'Amazon', website: 'https://amazon.de', leadTimeDays: 2 },
];

// Default materials with suppliers
const DEFAULT_MATERIALS = [
  { id: 'pla-black', name: 'PLA Black', brand: 'Bambu', supplierId: 'bambu', pricePerKg: 25, currentStock: 2500, minStock: 1000, avgUsagePerWeek: 800, lastOrdered: null, sku: 'BL-PLA-BK' },
  { id: 'pla-white', name: 'PLA White', brand: 'Bambu', supplierId: 'bambu', pricePerKg: 25, currentStock: 1800, minStock: 1000, avgUsagePerWeek: 600, lastOrdered: null, sku: 'BL-PLA-WH' },
  { id: 'petg-clear', name: 'PETG Clear', brand: 'Bambu', supplierId: 'bambu', pricePerKg: 30, currentStock: 1200, minStock: 500, avgUsagePerWeek: 300, lastOrdered: null, sku: 'BL-PETG-CL' },
  { id: 'petg-black', name: 'PETG Black', brand: 'Bambu', supplierId: 'bambu', pricePerKg: 30, currentStock: 400, minStock: 500, avgUsagePerWeek: 250, lastOrdered: null, sku: 'BL-PETG-BK' },
  { id: 'abs-gray', name: 'ABS Gray', brand: 'Bambu', supplierId: 'bambu', pricePerKg: 28, currentStock: 800, minStock: 500, avgUsagePerWeek: 150, lastOrdered: null, sku: 'BL-ABS-GR' },
  { id: 'tpu-white', name: 'TPU 95A White', brand: 'Bambu', supplierId: 'bambu', pricePerKg: 45, currentStock: 500, minStock: 250, avgUsagePerWeek: 100, lastOrdered: null, sku: 'BL-TPU-WH' },
];

function AutoMaterialReorder() {
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState(DEFAULT_SUPPLIERS);
  const [showPOGenerator, setShowPOGenerator] = useState(false);
  const [selectedMaterials, setSelectedMaterials] = useState([]);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [usageHistory, setUsageHistory] = useState([]);

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Try to load from localStorage first
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setMaterials(data.materials || DEFAULT_MATERIALS);
        setSuppliers(data.suppliers || DEFAULT_SUPPLIERS);
        setUsageHistory(data.usageHistory || []);
        return;
      } catch (e) {
        console.error('Failed to load saved data:', e);
      }
    }

    // Try API
    try {
      const res = await api.getMaterials?.();
      const data = unwrap(res);
      if (data?.materials?.length > 0) {
        setMaterials(data.materials.map(m => ({
          ...m,
          avgUsagePerWeek: m.avgUsagePerWeek || 200,
          minStock: m.minStock || 500,
        })));
      } else {
        setMaterials(DEFAULT_MATERIALS);
      }
    } catch (err) {
      console.error('Failed to load materials:', err);
      setMaterials(DEFAULT_MATERIALS);
    }
  };

  const saveData = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      materials,
      suppliers,
      usageHistory,
    }));
    toast.success('Data saved');
  };

  // Calculate predictions for each material
  const predictions = useMemo(() => {
    return materials.map(mat => {
      const supplier = suppliers.find(s => s.id === mat.supplierId);
      const leadTime = supplier?.leadTimeDays || 5;
      
      // Days until stockout
      const daysUntilStockout = mat.avgUsagePerWeek > 0 
        ? Math.floor((mat.currentStock / mat.avgUsagePerWeek) * 7)
        : 999;
      
      // When to reorder (stockout date minus lead time minus safety buffer)
      const safetyBuffer = 3; // days
      const daysUntilReorder = Math.max(0, daysUntilStockout - leadTime - safetyBuffer);
      
      // Stock status
      let status = 'ok';
      let urgency = 0;
      if (mat.currentStock <= 0) {
        status = 'out';
        urgency = 100;
      } else if (mat.currentStock < mat.minStock * 0.5) {
        status = 'critical';
        urgency = 90;
      } else if (mat.currentStock < mat.minStock) {
        status = 'low';
        urgency = 70;
      } else if (daysUntilReorder <= 0) {
        status = 'reorder';
        urgency = 50;
      } else if (daysUntilReorder <= 7) {
        status = 'soon';
        urgency = 30;
      }

      // Recommended order quantity (4 weeks supply + safety)
      const recommendedQty = Math.ceil((mat.avgUsagePerWeek * 4) / 1000) * 1000; // Round to nearest kg

      // Weeks of stock remaining
      const weeksRemaining = mat.avgUsagePerWeek > 0 
        ? (mat.currentStock / mat.avgUsagePerWeek).toFixed(1)
        : '∞';

      return {
        ...mat,
        supplier,
        daysUntilStockout,
        daysUntilReorder,
        status,
        urgency,
        recommendedQty,
        weeksRemaining,
        reorderDate: new Date(Date.now() + daysUntilReorder * 24 * 60 * 60 * 1000),
        stockoutDate: new Date(Date.now() + daysUntilStockout * 24 * 60 * 60 * 1000),
      };
    }).sort((a, b) => b.urgency - a.urgency);
  }, [materials, suppliers]);

  // Summary stats
  const summary = useMemo(() => {
    const needsReorder = predictions.filter(p => ['critical', 'low', 'reorder', 'out'].includes(p.status));
    const totalValue = materials.reduce((sum, m) => sum + (m.currentStock / 1000) * m.pricePerKg, 0);
    
    return {
      totalMaterials: materials.length,
      needsReorderCount: needsReorder.length,
      criticalCount: predictions.filter(p => p.status === 'critical' || p.status === 'out').length,
      totalStockValue: totalValue,
      avgWeeksSupply: predictions.length > 0 
        ? (predictions.reduce((sum, p) => sum + parseFloat(p.weeksRemaining) || 0, 0) / predictions.length).toFixed(1)
        : 0,
    };
  }, [predictions, materials]);

  // Update stock
  const updateStock = (materialId, newStock) => {
    setMaterials(prev => prev.map(m => 
      m.id === materialId ? { ...m, currentStock: newStock } : m
    ));
  };

  // Record usage
  const recordUsage = (materialId, usedGrams) => {
    const mat = materials.find(m => m.id === materialId);
    if (!mat) return;

    const newStock = Math.max(0, mat.currentStock - usedGrams);
    updateStock(materialId, newStock);

    setUsageHistory(prev => [{
      id: `usage-${Date.now()}`,
      materialId,
      usedGrams,
      timestamp: new Date().toISOString(),
    }, ...prev].slice(0, 100));

    toast.success(`Recorded ${usedGrams}g usage`);
  };

  // Generate PO
  const generatePO = () => {
    const items = selectedMaterials.map(id => {
      const pred = predictions.find(p => p.id === id);
      return pred;
    }).filter(Boolean);

    if (items.length === 0) {
      toast.error('Select materials first');
      return;
    }

    setShowPOGenerator(true);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('et-EE', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const getStatusBadge = (status) => {
    const styles = {
      out: 'bg-red-500 text-white',
      critical: 'bg-red-500/20 text-red-400',
      low: 'bg-orange-500/20 text-orange-400',
      reorder: 'bg-yellow-500/20 text-yellow-400',
      soon: 'bg-cyan-500/20 text-cyan-400',
      ok: 'bg-green-500/20 text-green-400',
    };
    const labels = {
      out: 'OUT OF STOCK',
      critical: 'CRITICAL',
      low: 'LOW STOCK',
      reorder: 'REORDER NOW',
      soon: 'REORDER SOON',
      ok: 'OK',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            📦 Auto Material Reorder
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Predict when to reorder and generate purchase orders
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddMaterial(true)}
            className="px-4 py-2 rounded-lg text-sm text-slate-300 border border-slate-600 hover:bg-slate-700"
          >
            + Add Material
          </button>
          <button
            onClick={saveData}
            className="px-4 py-2 rounded-lg text-sm bg-green-500/20 text-green-400 hover:bg-green-500/30"
          >
            💾 Save
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-slate-400 text-sm">Total Materials</p>
          <p className="text-2xl font-bold text-white">{summary.totalMaterials}</p>
        </div>
        <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: summary.criticalCount > 0 ? '#ef4444' : '#334155' }}>
          <p className="text-slate-400 text-sm">Needs Reorder</p>
          <p className={`text-2xl font-bold ${summary.needsReorderCount > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
            {summary.needsReorderCount}
          </p>
        </div>
        <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-slate-400 text-sm">Stock Value</p>
          <p className="text-2xl font-bold text-cyan-400">{formatCurrency(summary.totalStockValue)}</p>
        </div>
        <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-slate-400 text-sm">Avg Supply</p>
          <p className="text-2xl font-bold text-white">{summary.avgWeeksSupply} weeks</p>
        </div>
      </div>

      {/* Critical Alerts */}
      {summary.criticalCount > 0 && (
        <div className="rounded-xl border p-4 bg-red-500/10 border-red-500/50">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚨</span>
            <div>
              <p className="text-red-400 font-medium">
                {summary.criticalCount} material{summary.criticalCount > 1 ? 's' : ''} critically low!
              </p>
              <p className="text-sm text-slate-400">
                {predictions.filter(p => p.status === 'critical' || p.status === 'out').map(p => p.name).join(', ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Materials Table */}
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: '#334155' }}>
          <h3 className="font-medium text-white">Material Inventory</h3>
          {selectedMaterials.length > 0 && (
            <button
              onClick={generatePO}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
            >
              📋 Generate PO ({selectedMaterials.length})
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: '#334155' }}>
                <th className="p-3 text-left text-xs text-slate-400 font-medium">
                  <input
                    type="checkbox"
                    checked={selectedMaterials.length === predictions.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedMaterials(predictions.map(p => p.id));
                      } else {
                        setSelectedMaterials([]);
                      }
                    }}
                    className="w-4 h-4 rounded"
                  />
                </th>
                <th className="p-3 text-left text-xs text-slate-400 font-medium">Material</th>
                <th className="p-3 text-left text-xs text-slate-400 font-medium">Status</th>
                <th className="p-3 text-left text-xs text-slate-400 font-medium">Stock</th>
                <th className="p-3 text-left text-xs text-slate-400 font-medium">Usage/Week</th>
                <th className="p-3 text-left text-xs text-slate-400 font-medium">Weeks Left</th>
                <th className="p-3 text-left text-xs text-slate-400 font-medium">Reorder By</th>
                <th className="p-3 text-left text-xs text-slate-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {predictions.map(pred => (
                <tr 
                  key={pred.id} 
                  className={`border-b hover:bg-slate-800/50 ${pred.status === 'critical' || pred.status === 'out' ? 'bg-red-500/5' : ''}`}
                  style={{ borderColor: '#334155' }}
                >
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selectedMaterials.includes(pred.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMaterials(prev => [...prev, pred.id]);
                        } else {
                          setSelectedMaterials(prev => prev.filter(id => id !== pred.id));
                        }
                      }}
                      className="w-4 h-4 rounded"
                    />
                  </td>
                  <td className="p-3">
                    <div>
                      <p className="text-white font-medium">{pred.name}</p>
                      <p className="text-xs text-slate-500">{pred.brand} • {pred.sku}</p>
                    </div>
                  </td>
                  <td className="p-3">{getStatusBadge(pred.status)}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16">
                        <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                          <div 
                            className={`h-full ${pred.status === 'ok' ? 'bg-green-500' : pred.status === 'soon' ? 'bg-cyan-500' : pred.status === 'reorder' ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(100, (pred.currentStock / pred.minStock) * 50)}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-white text-sm">{(pred.currentStock / 1000).toFixed(1)}kg</span>
                    </div>
                  </td>
                  <td className="p-3 text-slate-300">{pred.avgUsagePerWeek}g</td>
                  <td className="p-3">
                    <span className={pred.weeksRemaining < 2 ? 'text-red-400' : pred.weeksRemaining < 4 ? 'text-yellow-400' : 'text-white'}>
                      {pred.weeksRemaining}
                    </span>
                  </td>
                  <td className="p-3">
                    {pred.daysUntilReorder <= 0 ? (
                      <span className="text-red-400 font-medium">NOW</span>
                    ) : pred.daysUntilReorder <= 7 ? (
                      <span className="text-yellow-400">{pred.daysUntilReorder}d</span>
                    ) : (
                      <span className="text-slate-400">{pred.reorderDate.toLocaleDateString()}</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          const used = prompt('Enter grams used:', '100');
                          if (used) recordUsage(pred.id, parseInt(used));
                        }}
                        className="px-2 py-1 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600"
                        title="Record usage"
                      >
                        -
                      </button>
                      <button
                        onClick={() => {
                          const stock = prompt('Enter new stock (grams):', pred.currentStock.toString());
                          if (stock) updateStock(pred.id, parseInt(stock));
                        }}
                        className="px-2 py-1 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600"
                        title="Update stock"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => setEditingMaterial(pred)}
                        className="px-2 py-1 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600"
                        title="Edit settings"
                      >
                        ⚙️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PO Generator Modal */}
      {showPOGenerator && (
        <POGeneratorModal
          materials={predictions.filter(p => selectedMaterials.includes(p.id))}
          suppliers={suppliers}
          onClose={() => setShowPOGenerator(false)}
          formatCurrency={formatCurrency}
        />
      )}

      {/* Add/Edit Material Modal */}
      {(showAddMaterial || editingMaterial) && (
        <MaterialEditorModal
          material={editingMaterial}
          suppliers={suppliers}
          onSave={(mat) => {
            if (editingMaterial) {
              setMaterials(prev => prev.map(m => m.id === editingMaterial.id ? { ...m, ...mat } : m));
            } else {
              setMaterials(prev => [...prev, { ...mat, id: `mat-${Date.now()}` }]);
            }
            setShowAddMaterial(false);
            setEditingMaterial(null);
          }}
          onClose={() => { setShowAddMaterial(false); setEditingMaterial(null); }}
        />
      )}
    </div>
  );
}

// PO Generator Modal
function POGeneratorModal({ materials, suppliers, onClose, formatCurrency }) {
  const [quantities, setQuantities] = useState(() => {
    const initial = {};
    materials.forEach(m => {
      initial[m.id] = m.recommendedQty;
    });
    return initial;
  });

  const groupedBySupplier = useMemo(() => {
    const groups = {};
    materials.forEach(m => {
      const supplierId = m.supplierId || 'unknown';
      if (!groups[supplierId]) {
        groups[supplierId] = {
          supplier: suppliers.find(s => s.id === supplierId) || { name: 'Unknown', leadTimeDays: 5 },
          items: [],
        };
      }
      groups[supplierId].items.push(m);
    });
    return groups;
  }, [materials, suppliers]);

  const totalCost = materials.reduce((sum, m) => {
    return sum + ((quantities[m.id] || 0) / 1000) * m.pricePerKg;
  }, 0);

  const copyPO = (supplierId) => {
    const group = groupedBySupplier[supplierId];
    const lines = group.items.map(m => 
      `• ${m.name} (${m.sku}) - ${(quantities[m.id] / 1000).toFixed(1)}kg - ${formatCurrency((quantities[m.id] / 1000) * m.pricePerKg)}`
    );
    
    const po = `PURCHASE ORDER - Polywerk OÜ
Date: ${new Date().toLocaleDateString()}
Supplier: ${group.supplier.name}

Items:
${lines.join('\n')}

Subtotal: ${formatCurrency(group.items.reduce((s, m) => s + (quantities[m.id] / 1000) * m.pricePerKg, 0))}

Please confirm availability and delivery date.

Thank you,
Polywerk Team`;

    navigator.clipboard.writeText(po);
    toast.success('PO copied to clipboard!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div 
        className="relative w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl border shadow-2xl"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <div className="sticky top-0 px-6 py-4 border-b flex items-center justify-between z-10" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <h2 className="font-bold text-white">📋 Generate Purchase Order</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400">✕</button>
        </div>

        <div className="p-6 space-y-6">
          {Object.entries(groupedBySupplier).map(([supplierId, group]) => (
            <div key={supplierId} className="rounded-xl border p-4" style={{ backgroundColor: '#334155', borderColor: '#475569' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-medium text-white">{group.supplier.name}</h3>
                  <p className="text-xs text-slate-400">Lead time: {group.supplier.leadTimeDays} days</p>
                </div>
                <button
                  onClick={() => copyPO(supplierId)}
                  className="px-3 py-1 rounded-lg text-sm bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                >
                  📋 Copy PO
                </button>
              </div>

              <div className="space-y-3">
                {group.items.map(item => (
                  <div key={item.id} className="flex items-center justify-between gap-4 p-2 rounded-lg bg-slate-800/50">
                    <div className="flex-1">
                      <p className="text-white text-sm">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.sku} • {formatCurrency(item.pricePerKg)}/kg</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="500"
                        value={quantities[item.id]}
                        onChange={(e) => setQuantities(prev => ({ ...prev, [item.id]: parseInt(e.target.value) || 0 }))}
                        className="w-24 px-2 py-1 rounded text-white text-sm text-right"
                        style={{ backgroundColor: '#1e293b' }}
                      />
                      <span className="text-slate-400 text-sm">g</span>
                    </div>
                    <div className="w-20 text-right">
                      <p className="text-cyan-400 font-medium">
                        {formatCurrency((quantities[item.id] / 1000) * item.pricePerKg)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t flex justify-between" style={{ borderColor: '#475569' }}>
                <span className="text-slate-400">Subtotal</span>
                <span className="text-white font-bold">
                  {formatCurrency(group.items.reduce((s, m) => s + (quantities[m.id] / 1000) * m.pricePerKg, 0))}
                </span>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-cyan-500/10">
            <span className="text-white font-medium">Total Order Value</span>
            <span className="text-2xl font-bold text-white">{formatCurrency(totalCost)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Material Editor Modal  
function MaterialEditorModal({ material, suppliers, onSave, onClose }) {
  const [form, setForm] = useState({
    name: material?.name || '',
    brand: material?.brand || '',
    sku: material?.sku || '',
    supplierId: material?.supplierId || suppliers[0]?.id || '',
    pricePerKg: material?.pricePerKg || 25,
    currentStock: material?.currentStock || 1000,
    minStock: material?.minStock || 500,
    avgUsagePerWeek: material?.avgUsagePerWeek || 200,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative rounded-xl border p-6 w-full max-w-md" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        <h2 className="font-bold text-white mb-4">{material ? 'Edit Material' : 'Add Material'}</h2>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
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
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">SKU</label>
              <input
                type="text"
                value={form.sku}
                onChange={(e) => setForm(prev => ({ ...prev, sku: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Supplier</label>
              <select
                value={form.supplierId}
                onChange={(e) => setForm(prev => ({ ...prev, supplierId: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              >
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
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
              <label className="block text-xs text-slate-400 mb-1">Current Stock (g)</label>
              <input
                type="number"
                value={form.currentStock}
                onChange={(e) => setForm(prev => ({ ...prev, currentStock: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Min Stock (g)</label>
              <input
                type="number"
                value={form.minStock}
                onChange={(e) => setForm(prev => ({ ...prev, minStock: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Avg Usage/Week (g)</label>
              <input
                type="number"
                value={form.avgUsagePerWeek}
                onChange={(e) => setForm(prev => ({ ...prev, avgUsagePerWeek: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700">
            Cancel
          </button>
          <button onClick={() => onSave(form)} className="flex-1 py-2 rounded-lg bg-purple-500 text-white hover:bg-purple-600">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default AutoMaterialReorder;
