import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

/**
 * ConsumablesInventory - Track printer parts and consumables
 * (nozzles, hotends, build plates, belts, etc.)
 */
function ConsumablesInventory() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    setLoading(true);
    try {
      const saved = localStorage.getItem('polywerk_consumables');
      const data = saved ? JSON.parse(saved) : getDefaultItems();
      setItems(data);
    } catch (err) {
      console.error('Failed to load consumables:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveItems = (newItems) => {
    localStorage.setItem('polywerk_consumables', JSON.stringify(newItems));
    setItems(newItems);
  };

  const getDefaultItems = () => [
    {
      id: 'cons-001',
      name: 'Hardened Steel Nozzle 0.4mm',
      category: 'nozzles',
      sku: 'NZ-HS-04',
      quantity: 5,
      min_quantity: 2,
      unit_price: 15.00,
      supplier: 'Bambu Lab',
      location: 'Parts Drawer A',
      compatible_printers: ['K1', 'K1 Max', 'P1S'],
      notes: '',
      last_ordered: '2024-12-01',
    },
    {
      id: 'cons-002',
      name: 'Brass Nozzle 0.4mm',
      category: 'nozzles',
      sku: 'NZ-BR-04',
      quantity: 10,
      min_quantity: 5,
      unit_price: 5.00,
      supplier: 'Generic',
      location: 'Parts Drawer A',
      compatible_printers: ['K1', 'K1 Max'],
      notes: 'Standard PLA/PETG only',
      last_ordered: '2024-11-15',
    },
    {
      id: 'cons-003',
      name: 'PEI Build Plate (K1 Max)',
      category: 'build_plates',
      sku: 'BP-PEI-K1M',
      quantity: 2,
      min_quantity: 1,
      unit_price: 45.00,
      supplier: 'Creality',
      location: 'Shelf B2',
      compatible_printers: ['K1 Max'],
      notes: '',
      last_ordered: '2024-10-20',
    },
    {
      id: 'cons-004',
      name: 'Hotend Assembly (K1)',
      category: 'hotends',
      sku: 'HE-K1-STD',
      quantity: 1,
      min_quantity: 1,
      unit_price: 65.00,
      supplier: 'Creality',
      location: 'Parts Drawer B',
      compatible_printers: ['K1'],
      notes: 'Spare for emergencies',
      last_ordered: '2024-09-15',
    },
  ];

  const handleSaveItem = (item) => {
    if (editingItem) {
      const updated = items.map(i => i.id === editingItem.id ? { ...item, id: editingItem.id } : i);
      saveItems(updated);
    } else {
      const newItem = {
        ...item,
        id: `cons-${Date.now()}`,
      };
      saveItems([newItem, ...items]);
    }
    setShowAddModal(false);
    setEditingItem(null);
  };

  const handleDeleteItem = (id) => {
    if (window.confirm('Delete this item?')) {
      saveItems(items.filter(i => i.id !== id));
    }
  };

  const handleUpdateQuantity = (id, delta) => {
    const updated = items.map(i => {
      if (i.id === id) {
        return { ...i, quantity: Math.max(0, i.quantity + delta) };
      }
      return i;
    });
    saveItems(updated);
  };

  const categories = [
    { id: 'all', name: 'All Items', icon: '📦' },
    { id: 'nozzles', name: 'Nozzles', icon: '🔩' },
    { id: 'hotends', name: 'Hotends', icon: '🔥' },
    { id: 'build_plates', name: 'Build Plates', icon: '🛠️' },
    { id: 'belts', name: 'Belts & Motors', icon: '⚙️' },
    { id: 'filters', name: 'Filters', icon: '🌀' },
    { id: 'other', name: 'Other', icon: '📎' },
  ];

  // Filter items
  const filteredItems = items
    .filter(i => filter === 'all' || i.category === filter)
    .filter(i => 
      !searchTerm || 
      i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    );

  // Low stock items
  const lowStockItems = items.filter(i => i.quantity <= i.min_quantity);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <div className="p-4 rounded-xl border bg-red-500/10 border-red-500/30">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-medium text-red-400">Low Stock Alert</p>
              <p className="text-sm text-red-400/80 mt-1">
                {lowStockItems.map(i => i.name).join(', ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            🔧 Consumables
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Printer parts and replacement components
          </p>
        </div>

        <button
          onClick={() => { setEditingItem(null); setShowAddModal(true); }}
          className="px-4 py-2 rounded-lg font-medium text-white"
          style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
        >
          ➕ Add Item
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search items..."
          className="px-4 py-2 rounded-lg text-white flex-1 min-w-[200px]"
          style={{ backgroundColor: '#334155' }}
        />
        <div className="flex gap-1 p-1 rounded-lg bg-slate-800 overflow-x-auto">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setFilter(cat.id)}
              className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition ${
                filter === cat.id
                  ? 'bg-purple-500 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Items List */}
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: '#334155' }}>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Item</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-400 hidden sm:table-cell">SKU</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Qty</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-400 hidden md:table-cell">Location</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: '#334155' }}>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No items found
                </td>
              </tr>
            ) : (
              filteredItems.map(item => {
                const isLow = item.quantity <= item.min_quantity;
                return (
                  <tr key={item.id} className="hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">
                          {categories.find(c => c.id === item.category)?.icon || '📦'}
                        </span>
                        <div>
                          <p className="font-medium text-white">{item.name}</p>
                          <p className="text-xs text-slate-500">{item.supplier}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-sm hidden sm:table-cell">
                      {item.sku || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleUpdateQuantity(item.id, -1)}
                          className="w-6 h-6 rounded bg-slate-700 text-white hover:bg-slate-600"
                        >
                          -
                        </button>
                        <span className={`font-bold min-w-[2rem] ${isLow ? 'text-red-400' : 'text-white'}`}>
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleUpdateQuantity(item.id, 1)}
                          className="w-6 h-6 rounded bg-slate-700 text-white hover:bg-slate-600"
                        >
                          +
                        </button>
                      </div>
                      {isLow && (
                        <p className="text-xs text-red-400 mt-1">Low stock!</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm hidden md:table-cell">
                      {item.location || '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => { setEditingItem(item); setShowAddModal(true); }}
                          className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1.5 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-400"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <ConsumableFormModal
          item={editingItem}
          categories={categories.filter(c => c.id !== 'all')}
          onSave={handleSaveItem}
          onClose={() => { setShowAddModal(false); setEditingItem(null); }}
        />
      )}
    </div>
  );
}

/**
 * ConsumableFormModal - Add or edit a consumable item
 */
function ConsumableFormModal({ item, categories, onSave, onClose }) {
  const [form, setForm] = useState({
    name: item?.name || '',
    category: item?.category || 'nozzles',
    sku: item?.sku || '',
    quantity: item?.quantity || 1,
    min_quantity: item?.min_quantity || 1,
    unit_price: item?.unit_price || 0,
    supplier: item?.supplier || '',
    location: item?.location || '',
    compatible_printers: item?.compatible_printers || [],
    notes: item?.notes || '',
  });

  const [printerInput, setPrinterInput] = useState('');

  const handleAddPrinter = () => {
    if (printerInput.trim() && !form.compatible_printers.includes(printerInput.trim())) {
      setForm({ ...form, compatible_printers: [...form.compatible_printers, printerInput.trim()] });
      setPrinterInput('');
    }
  };

  const handleRemovePrinter = (printer) => {
    setForm({ ...form, compatible_printers: form.compatible_printers.filter(p => p !== printer) });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name) {
      alert('Please enter item name');
      return;
    }
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <div className="sticky top-0 px-6 py-4 border-b flex items-center justify-between z-10" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <h2 className="text-lg font-bold text-white">
            {item ? 'Edit Item' : 'Add Consumable'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Item Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Hardened Steel Nozzle 0.4mm"
              className="w-full px-3 py-2 rounded-lg text-white"
              style={{ backgroundColor: '#334155' }}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">SKU</label>
              <input
                type="text"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                placeholder="NZ-HS-04"
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Quantity</label>
              <input
                type="number"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })}
                min="0"
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Min Stock</label>
              <input
                type="number"
                value={form.min_quantity}
                onChange={(e) => setForm({ ...form, min_quantity: parseInt(e.target.value) || 0 })}
                min="0"
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Price (€)</label>
              <input
                type="number"
                step="0.01"
                value={form.unit_price}
                onChange={(e) => setForm({ ...form, unit_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Supplier</label>
              <input
                type="text"
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                placeholder="Bambu Lab"
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Parts Drawer A"
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Compatible Printers</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={printerInput}
                onChange={(e) => setPrinterInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddPrinter())}
                placeholder="Add printer model..."
                className="flex-1 px-3 py-2 rounded-lg text-white text-sm"
                style={{ backgroundColor: '#334155' }}
              />
              <button
                type="button"
                onClick={handleAddPrinter}
                className="px-3 py-2 rounded-lg text-purple-400 border border-purple-500/30 hover:bg-purple-500/10"
              >
                +
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {form.compatible_printers.map(printer => (
                <span 
                  key={printer}
                  className="px-2 py-1 rounded-full text-xs bg-slate-700 text-slate-300 flex items-center gap-1"
                >
                  {printer}
                  <button type="button" onClick={() => handleRemovePrinter(printer)} className="text-slate-500 hover:text-red-400">✕</button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-white resize-none"
              style={{ backgroundColor: '#334155' }}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl font-medium text-slate-300 border border-slate-600 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl font-medium text-white"
              style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
            >
              {item ? 'Update' : 'Add'} Item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ConsumablesInventory;
