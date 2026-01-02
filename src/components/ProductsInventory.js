import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

/**
 * ProductsInventory - Items for sale (e-commerce)
 * Full filament spools, finished products, etc.
 * Separate from production inventory!
 */
function ProductsInventory() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const saved = localStorage.getItem('polywerk_products_for_sale');
      const data = saved ? JSON.parse(saved) : getDefaultProducts();
      setProducts(data);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveProducts = (newProducts) => {
    localStorage.setItem('polywerk_products_for_sale', JSON.stringify(newProducts));
    setProducts(newProducts);
  };

  const getDefaultProducts = () => [
    {
      id: 'prod-001',
      name: 'Bambu Lab PLA Basic - Black',
      category: 'filaments',
      sku: 'BL-PLA-BLK-1KG',
      quantity: 15,
      min_quantity: 5,
      purchase_price: 18.00,
      sell_price: 25.00,
      brand: 'Bambu Lab',
      weight_g: 1000,
      description: 'High quality PLA filament, 1kg spool',
      status: 'active',
      created_at: '2024-12-01',
    },
    {
      id: 'prod-002',
      name: 'Bambu Lab PLA Basic - White',
      category: 'filaments',
      sku: 'BL-PLA-WHT-1KG',
      quantity: 12,
      min_quantity: 5,
      purchase_price: 18.00,
      sell_price: 25.00,
      brand: 'Bambu Lab',
      weight_g: 1000,
      description: 'High quality PLA filament, 1kg spool',
      status: 'active',
      created_at: '2024-12-01',
    },
    {
      id: 'prod-003',
      name: 'Custom Keychain (Per Piece)',
      category: 'printed',
      sku: 'PRINT-KEY-001',
      quantity: 50,
      min_quantity: 10,
      purchase_price: 0.50,
      sell_price: 5.00,
      brand: 'Polywerk',
      description: 'Custom 3D printed keychain',
      status: 'active',
      created_at: '2024-11-15',
    },
  ];

  const handleSaveProduct = (product) => {
    if (editingProduct) {
      const updated = products.map(p => p.id === editingProduct.id ? { ...product, id: editingProduct.id } : p);
      saveProducts(updated);
    } else {
      const newProduct = {
        ...product,
        id: `prod-${Date.now()}`,
        created_at: new Date().toISOString().split('T')[0],
      };
      saveProducts([newProduct, ...products]);
    }
    setShowAddModal(false);
    setEditingProduct(null);
  };

  const handleDeleteProduct = (id) => {
    if (window.confirm('Delete this product?')) {
      saveProducts(products.filter(p => p.id !== id));
    }
  };

  const handleUpdateQuantity = (id, delta) => {
    const updated = products.map(p => {
      if (p.id === id) {
        return { ...p, quantity: Math.max(0, p.quantity + delta) };
      }
      return p;
    });
    saveProducts(updated);
  };

  const categories = [
    { id: 'all', name: 'All Products', icon: '📦' },
    { id: 'filaments', name: 'Filaments', icon: '🧵' },
    { id: 'printed', name: 'Printed Items', icon: '🎨' },
    { id: 'accessories', name: 'Accessories', icon: '🔧' },
    { id: 'kits', name: 'Kits & Bundles', icon: '📦' },
  ];

  // Filter products
  const filteredProducts = products
    .filter(p => filter === 'all' || p.category === filter)
    .filter(p => 
      !searchTerm || 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    );

  // Stats
  const totalValue = products.reduce((sum, p) => sum + (p.quantity * p.sell_price), 0);
  const totalItems = products.reduce((sum, p) => sum + p.quantity, 0);
  const lowStockProducts = products.filter(p => p.quantity <= p.min_quantity && p.status === 'active');

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('et-EE', { style: 'currency', currency: 'EUR' }).format(amount || 0);
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
      {/* Info Banner */}
      <div className="p-4 rounded-xl border bg-blue-500/10 border-blue-500/30">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🛒</span>
          <div>
            <p className="font-medium text-blue-400">Products for Sale</p>
            <p className="text-sm text-blue-400/80 mt-1">
              These are items available for e-commerce. Full sealed spools go here, not production spools.
            </p>
          </div>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <div className="p-4 rounded-xl border bg-yellow-500/10 border-yellow-500/30">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-medium text-yellow-400">Low Stock</p>
              <p className="text-sm text-yellow-400/80 mt-1">
                {lowStockProducts.map(p => p.name).join(', ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            🛒 Products for Sale
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            E-commerce inventory • {totalItems} items • {formatCurrency(totalValue)} value
          </p>
        </div>

        <button
          onClick={() => { setEditingProduct(null); setShowAddModal(true); }}
          className="px-4 py-2 rounded-lg font-medium text-white"
          style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
        >
          ➕ Add Product
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-sm text-slate-400">Products</p>
          <p className="text-2xl font-bold text-white">{products.length}</p>
        </div>
        <div className="p-4 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-sm text-slate-400">Total Units</p>
          <p className="text-2xl font-bold text-white">{totalItems}</p>
        </div>
        <div className="p-4 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-sm text-slate-400">Inventory Value</p>
          <p className="text-2xl font-bold text-green-400">{formatCurrency(totalValue)}</p>
        </div>
        <div className="p-4 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-sm text-slate-400">Low Stock</p>
          <p className="text-2xl font-bold text-yellow-400">{lowStockProducts.length}</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search products..."
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

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.length === 0 ? (
          <div className="col-span-full p-8 text-center rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
            <p className="text-4xl mb-2">📭</p>
            <p className="text-slate-400">No products found</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 text-purple-400 hover:text-purple-300"
            >
              Add your first product →
            </button>
          </div>
        ) : (
          filteredProducts.map(product => {
            const isLow = product.quantity <= product.min_quantity;
            const margin = product.sell_price - product.purchase_price;
            const marginPercent = ((margin / product.purchase_price) * 100).toFixed(0);
            
            return (
              <div
                key={product.id}
                className="rounded-xl border p-4 transition hover:border-purple-500/50"
                style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {categories.find(c => c.id === product.category)?.icon || '📦'}
                    </span>
                    <div>
                      <p className="font-medium text-white">{product.name}</p>
                      <p className="text-xs text-slate-500">{product.sku}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    product.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-slate-600 text-slate-400'
                  }`}>
                    {product.status}
                  </span>
                </div>

                {/* Pricing */}
                <div className="grid grid-cols-3 gap-2 mb-3 text-sm">
                  <div>
                    <p className="text-slate-500">Buy</p>
                    <p className="text-white">{formatCurrency(product.purchase_price)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Sell</p>
                    <p className="text-green-400 font-medium">{formatCurrency(product.sell_price)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Margin</p>
                    <p className="text-cyan-400">{marginPercent}%</p>
                  </div>
                </div>

                {/* Stock */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800 mb-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUpdateQuantity(product.id, -1)}
                      className="w-8 h-8 rounded-lg bg-slate-700 text-white hover:bg-slate-600 text-lg"
                    >
                      -
                    </button>
                    <div className="text-center min-w-[4rem]">
                      <p className={`text-2xl font-bold ${isLow ? 'text-red-400' : 'text-white'}`}>
                        {product.quantity}
                      </p>
                      <p className="text-xs text-slate-500">in stock</p>
                    </div>
                    <button
                      onClick={() => handleUpdateQuantity(product.id, 1)}
                      className="w-8 h-8 rounded-lg bg-slate-700 text-white hover:bg-slate-600 text-lg"
                    >
                      +
                    </button>
                  </div>
                  {isLow && (
                    <span className="px-2 py-1 rounded-full text-xs bg-red-500/20 text-red-400">
                      Low!
                    </span>
                  )}
                </div>

                {/* Description */}
                {product.description && (
                  <p className="text-sm text-slate-400 mb-3 line-clamp-2">{product.description}</p>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditingProduct(product); setShowAddModal(true); }}
                    className="flex-1 py-1.5 rounded-lg text-sm text-slate-400 border border-slate-600 hover:bg-slate-700"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(product.id)}
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
        <ProductFormModal
          product={editingProduct}
          categories={categories.filter(c => c.id !== 'all')}
          onSave={handleSaveProduct}
          onClose={() => { setShowAddModal(false); setEditingProduct(null); }}
        />
      )}
    </div>
  );
}

/**
 * ProductFormModal - Add or edit a product
 */
function ProductFormModal({ product, categories, onSave, onClose }) {
  const [form, setForm] = useState({
    name: product?.name || '',
    category: product?.category || 'filaments',
    sku: product?.sku || '',
    quantity: product?.quantity || 0,
    min_quantity: product?.min_quantity || 1,
    purchase_price: product?.purchase_price || 0,
    sell_price: product?.sell_price || 0,
    brand: product?.brand || '',
    weight_g: product?.weight_g || '',
    description: product?.description || '',
    status: product?.status || 'active',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name) {
      alert('Please enter product name');
      return;
    }
    if (form.sell_price < form.purchase_price) {
      if (!window.confirm('Sell price is lower than purchase price. Continue?')) {
        return;
      }
    }
    onSave(form);
  };

  const margin = form.sell_price - form.purchase_price;
  const marginPercent = form.purchase_price > 0 ? ((margin / form.purchase_price) * 100).toFixed(0) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <div className="sticky top-0 px-6 py-4 border-b flex items-center justify-between z-10" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <h2 className="text-lg font-bold text-white">
            {product ? 'Edit Product' : 'Add Product'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Product Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Bambu Lab PLA Basic - Black"
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
                placeholder="BL-PLA-BLK-1KG"
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Brand</label>
              <input
                type="text"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                placeholder="Bambu Lab"
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Weight (g)</label>
              <input
                type="number"
                value={form.weight_g}
                onChange={(e) => setForm({ ...form, weight_g: parseInt(e.target.value) || '' })}
                placeholder="1000"
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
          </div>

          {/* Pricing */}
          <div className="p-4 rounded-lg bg-slate-800">
            <p className="text-sm font-medium text-slate-400 mb-3">Pricing</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Purchase (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.purchase_price}
                  onChange={(e) => setForm({ ...form, purchase_price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg text-white"
                  style={{ backgroundColor: '#1e293b' }}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Sell (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.sell_price}
                  onChange={(e) => setForm({ ...form, sell_price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg text-white"
                  style={{ backgroundColor: '#1e293b' }}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Margin</label>
                <div className={`px-3 py-2 rounded-lg text-center font-bold ${
                  margin > 0 ? 'text-green-400 bg-green-500/10' : 
                  margin < 0 ? 'text-red-400 bg-red-500/10' : 'text-slate-400 bg-slate-700'
                }`}>
                  {marginPercent}%
                </div>
              </div>
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
              <label className="block text-sm font-medium text-slate-400 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="discontinued">Discontinued</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="Product description for e-commerce..."
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
              {product ? 'Update' : 'Add'} Product
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ProductsInventory;
