import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

/**
 * SpoolManager - Smart spool tracking with waste reduction suggestions
 */
function SpoolManager({ onSpoolSelect }) {
  const [loading, setLoading] = useState(true);
  const [spools, setSpools] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSpool, setEditingSpool] = useState(null);
  const [filter, setFilter] = useState('active');
  const [sortBy, setSortBy] = useState('remaining');
  const [materialFilter, setMaterialFilter] = useState('all');

  useEffect(() => {
    loadSpools();
  }, []);

  const loadSpools = async () => {
    setLoading(true);
    try {
      // Load from localStorage (in production, this would be an API)
      const saved = localStorage.getItem('polywerk_spools');
      const data = saved ? JSON.parse(saved) : getDefaultSpools();
      setSpools(data);
    } catch (err) {
      console.error('Failed to load spools:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveSpools = (newSpools) => {
    localStorage.setItem('polywerk_spools', JSON.stringify(newSpools));
    setSpools(newSpools);
  };

  const getDefaultSpools = () => [
    // Sample data
    {
      id: 'spool-001',
      name: 'PLA Black #1',
      material: 'PLA',
      color: 'Black',
      color_hex: '#1a1a1a',
      brand: 'Bambu Lab',
      initial_weight_g: 1000,
      current_weight_g: 850,
      empty_spool_weight_g: 200,
      status: 'active',
      location: 'Printer K1-01',
      category: 'production',
      purchase_price: 25.00,
      purchase_date: '2024-12-01',
      opened_at: '2024-12-15',
      notes: '',
    },
    {
      id: 'spool-002',
      name: 'PLA White #1',
      material: 'PLA',
      color: 'White',
      color_hex: '#ffffff',
      brand: 'Bambu Lab',
      initial_weight_g: 1000,
      current_weight_g: 320,
      empty_spool_weight_g: 200,
      status: 'active',
      location: 'Shelf A1',
      category: 'production',
      purchase_price: 25.00,
      purchase_date: '2024-11-15',
      opened_at: '2024-11-20',
      notes: '',
    },
    {
      id: 'spool-003',
      name: 'PETG Blue #1',
      material: 'PETG',
      color: 'Blue',
      color_hex: '#2563eb',
      brand: 'Polymaker',
      initial_weight_g: 1000,
      current_weight_g: 95,
      empty_spool_weight_g: 200,
      status: 'low',
      location: 'Shelf A2',
      category: 'testing',
      purchase_price: 30.00,
      purchase_date: '2024-10-01',
      opened_at: '2024-10-15',
      notes: 'Good for test prints',
    },
  ];

  const handleSaveSpool = (spool) => {
    if (editingSpool) {
      const updated = spools.map(s => s.id === editingSpool.id ? { ...spool, id: editingSpool.id } : s);
      saveSpools(updated);
    } else {
      const newSpool = {
        ...spool,
        id: `spool-${Date.now()}`,
        status: 'active',
      };
      saveSpools([newSpool, ...spools]);
    }
    setShowAddModal(false);
    setEditingSpool(null);
  };

  const handleDeleteSpool = (id) => {
    if (window.confirm('Delete this spool?')) {
      saveSpools(spools.filter(s => s.id !== id));
    }
  };

  const handleUpdateWeight = (id, newWeight) => {
    const updated = spools.map(s => {
      if (s.id === id) {
        const usableWeight = newWeight - s.empty_spool_weight_g;
        let status = s.status;
        if (usableWeight <= 0) status = 'empty';
        else if (usableWeight < 100) status = 'low';
        else if (usableWeight < 200) status = 'low';
        else status = 'active';
        
        return { ...s, current_weight_g: newWeight, status };
      }
      return s;
    });
    saveSpools(updated);
  };

  const getUsableWeight = (spool) => {
    return Math.max(0, spool.current_weight_g - spool.empty_spool_weight_g);
  };

  const getPercentRemaining = (spool) => {
    const usable = getUsableWeight(spool);
    const initial = spool.initial_weight_g - spool.empty_spool_weight_g;
    return Math.round((usable / initial) * 100);
  };

  // Smart suggestions - find spools that match a job's requirements
  const getSuggestionsForJob = (materialNeeded, materialType, color = null) => {
    const matches = spools
      .filter(s => s.status !== 'empty' && s.status !== 'disposed')
      .filter(s => s.material.toLowerCase() === materialType.toLowerCase())
      .filter(s => !color || s.color.toLowerCase() === color.toLowerCase())
      .map(s => ({
        ...s,
        usableWeight: getUsableWeight(s),
        canComplete: getUsableWeight(s) >= materialNeeded,
        wasteIfUsed: getUsableWeight(s) - materialNeeded,
      }))
      .sort((a, b) => {
        // Prioritize spools that would be used up (less waste)
        if (a.canComplete && b.canComplete) {
          return a.wasteIfUsed - b.wasteIfUsed; // Less waste first
        }
        if (a.canComplete) return -1;
        if (b.canComplete) return 1;
        return b.usableWeight - a.usableWeight;
      });

    return matches;
  };

  // Get low spools that need to be used up
  const getLowSpoolSuggestions = () => {
    return spools
      .filter(s => s.status === 'low' || (getUsableWeight(s) < 150 && s.status !== 'empty'))
      .map(s => ({
        ...s,
        usableWeight: getUsableWeight(s),
        suggestedUse: getUsableWeight(s) < 50 ? 'Test prints only' : 
                      getUsableWeight(s) < 100 ? 'Small items' : 'Medium items',
      }));
  };

  // Filter and sort spools
  const filteredSpools = spools
    .filter(s => {
      if (filter === 'active') return s.status === 'active' || s.status === 'low';
      if (filter === 'low') return s.status === 'low' || getUsableWeight(s) < 150;
      if (filter === 'empty') return s.status === 'empty';
      if (filter === 'testing') return s.category === 'testing';
      return true;
    })
    .filter(s => materialFilter === 'all' || s.material === materialFilter)
    .sort((a, b) => {
      if (sortBy === 'remaining') return getUsableWeight(a) - getUsableWeight(b);
      if (sortBy === 'material') return a.material.localeCompare(b.material);
      if (sortBy === 'color') return a.color.localeCompare(b.color);
      if (sortBy === 'location') return (a.location || '').localeCompare(b.location || '');
      return 0;
    });

  // Get unique materials for filter
  const materials = [...new Set(spools.map(s => s.material))];

  const lowSpools = getLowSpoolSuggestions();

  const statusColors = {
    active: 'bg-green-500',
    low: 'bg-yellow-500',
    empty: 'bg-red-500',
    reserved: 'bg-blue-500',
    disposed: 'bg-slate-500',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Low Spool Alert */}
      {lowSpools.length > 0 && (
        <div className="p-4 rounded-xl border bg-yellow-500/10 border-yellow-500/30">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div className="flex-1">
              <p className="font-medium text-yellow-400">Use These Spools First!</p>
              <p className="text-sm text-yellow-400/80 mt-1">
                {lowSpools.length} spool{lowSpools.length !== 1 ? 's' : ''} running low - 
                use for small prints to reduce waste
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {lowSpools.slice(0, 5).map(spool => (
                  <div 
                    key={spool.id}
                    className="px-3 py-1.5 rounded-lg bg-yellow-500/20 border border-yellow-500/30 text-sm"
                  >
                    <span 
                      className="inline-block w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: spool.color_hex }}
                    />
                    <span className="text-yellow-400">{spool.material} {spool.color}</span>
                    <span className="text-yellow-400/60 ml-2">{spool.usableWeight}g left</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            🧵 Spool Manager
            <span className="px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-400">
              {spools.filter(s => s.status !== 'empty' && s.status !== 'disposed').length} active
            </span>
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Track filament usage and reduce waste
          </p>
        </div>

        <button
          onClick={() => { setEditingSpool(null); setShowAddModal(true); }}
          className="px-4 py-2 rounded-lg font-medium text-white"
          style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
        >
          ➕ Add Spool
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 p-1 rounded-lg bg-slate-800">
          {[
            { id: 'all', label: 'All' },
            { id: 'active', label: 'Active' },
            { id: 'low', label: '⚠️ Low' },
            { id: 'testing', label: '🧪 Testing' },
            { id: 'empty', label: 'Empty' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-md text-sm transition ${
                filter === f.id
                  ? 'bg-purple-500 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <select
          value={materialFilter}
          onChange={(e) => setMaterialFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm text-white"
          style={{ backgroundColor: '#334155' }}
        >
          <option value="all">All Materials</option>
          {materials.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm text-white"
          style={{ backgroundColor: '#334155' }}
        >
          <option value="remaining">Sort: Lowest First</option>
          <option value="material">Sort: Material</option>
          <option value="color">Sort: Color</option>
          <option value="location">Sort: Location</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-sm text-slate-400">Total Spools</p>
          <p className="text-2xl font-bold text-white">{spools.length}</p>
        </div>
        <div className="p-4 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-sm text-slate-400">Active</p>
          <p className="text-2xl font-bold text-green-400">
            {spools.filter(s => s.status === 'active').length}
          </p>
        </div>
        <div className="p-4 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-sm text-slate-400">Running Low</p>
          <p className="text-2xl font-bold text-yellow-400">{lowSpools.length}</p>
        </div>
        <div className="p-4 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-sm text-slate-400">Total Stock</p>
          <p className="text-2xl font-bold text-white">
            {Math.round(spools.reduce((sum, s) => sum + getUsableWeight(s), 0) / 1000)}kg
          </p>
        </div>
      </div>

      {/* Spools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSpools.length === 0 ? (
          <div className="col-span-full p-8 text-center rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
            <p className="text-4xl mb-2">📭</p>
            <p className="text-slate-400">No spools found</p>
          </div>
        ) : (
          filteredSpools.map(spool => {
            const usable = getUsableWeight(spool);
            const percent = getPercentRemaining(spool);
            
            return (
              <div
                key={spool.id}
                className="rounded-xl border p-4 transition hover:border-purple-500/50"
                style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-lg border-2"
                      style={{ backgroundColor: spool.color_hex, borderColor: '#334155' }}
                    />
                    <div>
                      <p className="font-medium text-white">{spool.material} {spool.color}</p>
                      <p className="text-xs text-slate-500">{spool.brand}</p>
                    </div>
                  </div>
                  <span className={`w-2 h-2 rounded-full ${statusColors[spool.status]}`}></span>
                </div>

                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">Remaining</span>
                    <span className={`font-medium ${
                      percent < 15 ? 'text-red-400' : percent < 30 ? 'text-yellow-400' : 'text-green-400'
                    }`}>
                      {usable}g ({percent}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all"
                      style={{ 
                        width: `${percent}%`,
                        backgroundColor: percent < 15 ? '#ef4444' : percent < 30 ? '#eab308' : '#22c55e'
                      }}
                    />
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div>
                    <p className="text-slate-500">Location</p>
                    <p className="text-white">{spool.location || 'Not set'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Category</p>
                    <p className="text-white capitalize">{spool.category}</p>
                  </div>
                </div>

                {/* Suggestion for low spools */}
                {usable < 150 && usable > 0 && (
                  <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 mb-3">
                    <p className="text-xs text-yellow-400">
                      💡 {usable < 50 ? 'Use for test prints' : usable < 100 ? 'Good for small items' : 'Use for medium prints'}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const newWeight = prompt(`Current weight (including spool): ${spool.current_weight_g}g\nEnter new weight:`);
                      if (newWeight && !isNaN(newWeight)) {
                        handleUpdateWeight(spool.id, parseFloat(newWeight));
                      }
                    }}
                    className="flex-1 py-1.5 rounded-lg text-sm text-slate-400 border border-slate-600 hover:bg-slate-700"
                  >
                    ⚖️ Update
                  </button>
                  <button
                    onClick={() => { setEditingSpool(spool); setShowAddModal(true); }}
                    className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-700"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDeleteSpool(spool.id)}
                    className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <SpoolFormModal
          spool={editingSpool}
          onSave={handleSaveSpool}
          onClose={() => { setShowAddModal(false); setEditingSpool(null); }}
        />
      )}
    </div>
  );
}

/**
 * SpoolFormModal - Add or edit a spool
 */
function SpoolFormModal({ spool, onSave, onClose }) {
  const [form, setForm] = useState({
    name: spool?.name || '',
    material: spool?.material || 'PLA',
    color: spool?.color || '',
    color_hex: spool?.color_hex || '#000000',
    brand: spool?.brand || 'Bambu Lab',
    initial_weight_g: spool?.initial_weight_g || 1000,
    current_weight_g: spool?.current_weight_g || 1000,
    empty_spool_weight_g: spool?.empty_spool_weight_g || 200,
    location: spool?.location || '',
    category: spool?.category || 'production',
    purchase_price: spool?.purchase_price || 25,
    purchase_date: spool?.purchase_date || new Date().toISOString().split('T')[0],
    opened_at: spool?.opened_at || '',
    notes: spool?.notes || '',
  });

  const materials = ['PLA', 'PETG', 'ABS', 'TPU', 'ASA', 'Nylon', 'PC', 'PVA', 'HIPS', 'Wood', 'Carbon', 'Other'];
  const brands = ['Bambu Lab', 'Polymaker', 'Prusament', 'eSUN', 'Overture', 'Hatchbox', 'Inland', 'Other'];
  const categories = ['production', 'testing', 'samples', 'reserved'];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.material || !form.color) {
      alert('Please fill in material and color');
      return;
    }
    onSave({
      ...form,
      name: form.name || `${form.material} ${form.color}`,
    });
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
            {spool ? 'Edit Spool' : 'Add New Spool'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Material & Brand */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Material *</label>
              <select
                value={form.material}
                onChange={(e) => setForm({ ...form, material: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
                required
              >
                {materials.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Brand</label>
              <select
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              >
                {brands.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Color */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-400 mb-1">Color Name *</label>
              <input
                type="text"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                placeholder="e.g., Black, White, Red"
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Color</label>
              <input
                type="color"
                value={form.color_hex}
                onChange={(e) => setForm({ ...form, color_hex: e.target.value })}
                className="w-full h-10 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Weights */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Initial (g)</label>
              <input
                type="number"
                value={form.initial_weight_g}
                onChange={(e) => setForm({ ...form, initial_weight_g: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Current (g)</label>
              <input
                type="number"
                value={form.current_weight_g}
                onChange={(e) => setForm({ ...form, current_weight_g: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Empty Spool (g)</label>
              <input
                type="number"
                value={form.empty_spool_weight_g}
                onChange={(e) => setForm({ ...form, empty_spool_weight_g: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
          </div>

          {/* Location & Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g., Printer K1-01, Shelf A1"
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Price & Dates */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Price (€)</label>
              <input
                type="number"
                step="0.01"
                value={form.purchase_price}
                onChange={(e) => setForm({ ...form, purchase_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Purchased</label>
              <input
                type="date"
                value={form.purchase_date}
                onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Opened</label>
              <input
                type="date"
                value={form.opened_at}
                onChange={(e) => setForm({ ...form, opened_at: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Any special notes..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-white resize-none"
              style={{ backgroundColor: '#334155' }}
            />
          </div>

          {/* Submit */}
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
              {spool ? 'Update' : 'Add'} Spool
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * SpoolSuggestionWidget - Shows which spool to use for a given job
 */
export function SpoolSuggestionWidget({ materialNeeded, materialType, color }) {
  const [spools, setSpools] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem('polywerk_spools');
    if (saved) {
      const all = JSON.parse(saved);
      const matches = all
        .filter(s => s.status !== 'empty' && s.status !== 'disposed')
        .filter(s => s.material.toLowerCase() === materialType?.toLowerCase())
        .filter(s => !color || s.color.toLowerCase() === color?.toLowerCase())
        .map(s => {
          const usable = Math.max(0, s.current_weight_g - s.empty_spool_weight_g);
          return {
            ...s,
            usableWeight: usable,
            canComplete: usable >= materialNeeded,
            wasteIfUsed: usable - materialNeeded,
          };
        })
        .sort((a, b) => {
          // Prioritize spools with least waste (use up partial spools first)
          if (a.canComplete && b.canComplete) {
            return a.wasteIfUsed - b.wasteIfUsed;
          }
          if (a.canComplete) return -1;
          if (b.canComplete) return 1;
          return b.usableWeight - a.usableWeight;
        });
      setSpools(matches.slice(0, 3));
    }
  }, [materialNeeded, materialType, color]);

  if (!materialNeeded || !materialType || spools.length === 0) return null;

  const best = spools[0];
  const useLowSpool = best.wasteIfUsed < 50 && best.wasteIfUsed >= 0;

  return (
    <div className={`p-3 rounded-lg border ${
      useLowSpool 
        ? 'bg-green-500/10 border-green-500/30' 
        : 'bg-slate-800 border-slate-700'
    }`}>
      <div className="flex items-center gap-3">
        <div 
          className="w-8 h-8 rounded-lg border"
          style={{ backgroundColor: best.color_hex, borderColor: '#334155' }}
        />
        <div className="flex-1">
          <p className="text-sm font-medium text-white">
            {useLowSpool ? '💡 Perfect match!' : 'Suggested spool:'}
          </p>
          <p className="text-xs text-slate-400">
            {best.material} {best.color} • {best.usableWeight}g left
            {useLowSpool && ` (will use up spool!)`}
          </p>
        </div>
        {best.canComplete && (
          <span className="text-green-400 text-sm">✓</span>
        )}
      </div>
    </div>
  );
}

export default SpoolManager;
