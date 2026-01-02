import React, { useState, useEffect } from 'react';
import { api, unwrap } from '../services/api';

/**
 * InventoryDashboard - Comprehensive inventory management
 */
function InventoryDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  
  // Data
  const [summary, setSummary] = useState(null);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [movements, setMovements] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [reorderSuggestions, setReorderSuggestions] = useState([]);
  
  // Filters
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [showProductModal, setShowProductModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [movementType, setMovementType] = useState('receive');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [
        summaryRes,
        productsRes,
        locationsRes,
        suppliersRes,
        categoriesRes,
        movementsRes,
        alertsRes,
        reorderRes,
      ] = await Promise.all([
        api.getInventoryStockSummary(),
        api.getInventoryProducts(),
        api.getInventoryLocations(),
        api.getSuppliers(),
        api.getInventoryCategories(),
        api.getInventoryMovements({ days: 30 }),
        api.getInventoryAlerts(),
        api.getReorderSuggestions(),
      ]);

      setSummary(unwrap(summaryRes)?.data || {});
      setProducts(unwrap(productsRes)?.data || []);
      setLocations(unwrap(locationsRes)?.data || []);
      setSuppliers(unwrap(suppliersRes)?.data || []);
      setCategories(unwrap(categoriesRes)?.data || []);
      setMovements(unwrap(movementsRes)?.data || []);
      setAlerts(unwrap(alertsRes)?.data || []);
      setReorderSuggestions(unwrap(reorderRes)?.data || []);
    } catch (err) {
      console.error('Failed to load inventory data:', err);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'overview', name: 'Overview', icon: '📊' },
    { id: 'products', name: 'Products', icon: '📦' },
    { id: 'stock', name: 'Stock Levels', icon: '🏭' },
    { id: 'movements', name: 'Movements', icon: '🔄' },
    { id: 'suppliers', name: 'Suppliers', icon: '🚚' },
    { id: 'locations', name: 'Locations', icon: '📍' },
  ];

  // Filter products
  const filteredProducts = products.filter(p => {
    if (categoryFilter !== 'all' && p.category_id !== categoryFilter) return false;
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !p.sku.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('et-EE', { style: 'currency', currency: 'EUR' }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            📦 Inventory Management
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Products, stock levels, and movements
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => { setMovementType('receive'); setShowMovementModal(true); }}
            className="px-4 py-2 rounded-lg font-medium text-green-400 border border-green-500/30 hover:bg-green-500/10"
          >
            📥 Receive
          </button>
          <button
            onClick={() => { setEditingItem(null); setShowProductModal(true); }}
            className="px-4 py-2 rounded-lg font-medium text-white"
            style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
          >
            ➕ Add Product
          </button>
        </div>
      </div>

      {/* Alerts Banner */}
      {alerts.length > 0 && (
        <div className="p-4 rounded-xl border bg-yellow-500/10 border-yellow-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-medium text-yellow-400">
                  {alerts.length} Stock Alert{alerts.length !== 1 ? 's' : ''}
                </p>
                <p className="text-sm text-yellow-400/70">
                  {alerts.filter(a => a.alert_type === 'out_of_stock').length} out of stock, {' '}
                  {alerts.filter(a => a.alert_type === 'low_stock').length} low stock
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('stock')}
              className="text-sm text-yellow-400 hover:underline"
            >
              View Details →
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 p-1 rounded-lg overflow-x-auto" style={{ backgroundColor: '#1e293b' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.name}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="rounded-xl border p-6" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
                <p className="text-sm text-slate-400">Total Products</p>
                <p className="text-2xl font-bold text-white">{summary?.total_products || 0}</p>
              </div>
              <div className="p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
                <p className="text-sm text-slate-400">Total Items</p>
                <p className="text-2xl font-bold text-white">{summary?.total_items || 0}</p>
              </div>
              <div className="p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
                <p className="text-sm text-slate-400">Stock Value</p>
                <p className="text-2xl font-bold text-green-400">{formatCurrency(summary?.total_value)}</p>
              </div>
              <div className="p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
                <p className="text-sm text-slate-400">Low Stock Items</p>
                <p className="text-2xl font-bold text-yellow-400">{summary?.low_stock_count || 0}</p>
              </div>
            </div>

            {/* By Category */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">By Category</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(summary?.by_category || {}).map(([catId, cat]) => (
                  <div key={catId} className="p-4 rounded-lg border" style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{cat.icon}</span>
                      <span className="font-medium text-white">{cat.name}</span>
                    </div>
                    <p className="text-sm text-slate-400">{cat.product_count} products</p>
                    <p className="text-sm text-slate-400">{cat.total_stock} items</p>
                    <p className="text-sm text-green-400">{formatCurrency(cat.total_value)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Reorder Suggestions */}
            {reorderSuggestions.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">🛒 Reorder Suggestions</h3>
                <div className="space-y-2">
                  {reorderSuggestions.slice(0, 5).map(item => (
                    <div 
                      key={item.product_id}
                      className="flex items-center justify-between p-3 rounded-lg"
                      style={{ backgroundColor: '#334155' }}
                    >
                      <div>
                        <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                          item.urgency === 'critical' ? 'bg-red-500' :
                          item.urgency === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                        }`}></span>
                        <span className="font-medium text-white">{item.product_name}</span>
                        <span className="text-slate-400 ml-2">({item.sku})</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-400">
                          Current: {item.current_stock} / Reorder: {item.reorder_quantity}
                        </p>
                        <p className="text-sm text-green-400">{formatCurrency(item.estimated_cost)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Movements */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">📋 Recent Movements</h3>
              <div className="space-y-2">
                {movements.slice(0, 5).map(mov => (
                  <div 
                    key={mov.movement_id}
                    className="flex items-center justify-between p-3 rounded-lg"
                    style={{ backgroundColor: '#334155' }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">
                        {mov.movement_type === 'receive' ? '📥' :
                         mov.movement_type === 'produce' ? '🏭' :
                         mov.movement_type === 'sell' ? '📤' :
                         mov.movement_type === 'transfer' ? '🔄' :
                         mov.movement_type === 'adjust' ? '✏️' : '🗑️'}
                      </span>
                      <div>
                        <p className="font-medium text-white">{mov.product_name}</p>
                        <p className="text-xs text-slate-400">{formatDate(mov.created_at)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium ${mov.quantity > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {mov.quantity > 0 ? '+' : ''}{mov.quantity}
                      </p>
                      <p className="text-xs text-slate-400 capitalize">{mov.movement_type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PRODUCTS TAB */}
        {activeTab === 'products' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-4 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.category_id} value={cat.category_id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map(product => {
                const cat = categories.find(c => c.category_id === product.category_id);
                const isLowStock = product.total_stock <= product.reorder_point;
                const isOutOfStock = product.total_stock === 0;
                
                return (
                  <div 
                    key={product.product_id}
                    className="p-4 rounded-lg border transition hover:border-purple-500/50 cursor-pointer"
                    style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                    onClick={() => { setEditingItem(product); setShowProductModal(true); }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-medium text-white">{product.name}</p>
                        <p className="text-xs text-slate-400 font-mono">{product.sku}</p>
                      </div>
                      <span className="text-lg">{cat?.icon || '📦'}</span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Stock</span>
                        <span className={`font-medium ${
                          isOutOfStock ? 'text-red-400' :
                          isLowStock ? 'text-yellow-400' : 'text-green-400'
                        }`}>
                          {product.total_stock} {product.unit}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Cost</span>
                        <span className="text-white">{formatCurrency(product.cost_price)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Selling</span>
                        <span className="text-green-400">{formatCurrency(product.selling_price)}</span>
                      </div>
                      {product.profit_margin > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Margin</span>
                          <span className="text-cyan-400">{product.profit_margin.toFixed(1)}%</span>
                        </div>
                      )}
                    </div>

                    {(isOutOfStock || isLowStock) && (
                      <div className={`mt-3 px-2 py-1 rounded text-xs font-medium text-center ${
                        isOutOfStock ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {isOutOfStock ? '⚠️ Out of Stock' : '⚠️ Low Stock'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <p className="text-4xl mb-2">📭</p>
                <p>No products found</p>
                <button
                  onClick={() => { setEditingItem(null); setShowProductModal(true); }}
                  className="mt-4 text-purple-400 hover:underline"
                >
                  Add your first product →
                </button>
              </div>
            )}
          </div>
        )}

        {/* STOCK LEVELS TAB */}
        {activeTab === 'stock' && (
          <div className="space-y-4">
            <div className="flex gap-3 mb-4">
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="px-4 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              >
                <option value="all">All Locations</option>
                {locations.map(loc => (
                  <option key={loc.location_id} value={loc.location_id}>
                    📍 {loc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Stock Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-slate-400 border-b" style={{ borderColor: '#334155' }}>
                    <th className="pb-3 pr-4">Product</th>
                    <th className="pb-3 px-4">SKU</th>
                    {locations.filter(l => locationFilter === 'all' || l.location_id === locationFilter).map(loc => (
                      <th key={loc.location_id} className="pb-3 px-4 text-center">{loc.name}</th>
                    ))}
                    <th className="pb-3 px-4 text-center">Total</th>
                    <th className="pb-3 px-4 text-center">Reorder Point</th>
                    <th className="pb-3 pl-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(product => {
                    const isLowStock = product.total_stock <= product.reorder_point;
                    const isOutOfStock = product.total_stock === 0;
                    
                    return (
                      <tr key={product.product_id} className="border-b hover:bg-slate-800/50" style={{ borderColor: '#334155' }}>
                        <td className="py-3 pr-4">
                          <p className="font-medium text-white">{product.name}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-slate-400 font-mono text-sm">{product.sku}</span>
                        </td>
                        {locations.filter(l => locationFilter === 'all' || l.location_id === locationFilter).map(loc => {
                          const stockItem = product.stock_by_location?.find(s => s.location_id === loc.location_id);
                          return (
                            <td key={loc.location_id} className="py-3 px-4 text-center text-white">
                              {stockItem?.quantity || 0}
                            </td>
                          );
                        })}
                        <td className="py-3 px-4 text-center font-medium text-white">
                          {product.total_stock}
                        </td>
                        <td className="py-3 px-4 text-center text-slate-400">
                          {product.reorder_point}
                        </td>
                        <td className="py-3 pl-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            isOutOfStock ? 'bg-red-500/20 text-red-400' :
                            isLowStock ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-green-500/20 text-green-400'
                          }`}>
                            {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MOVEMENTS TAB */}
        {activeTab === 'movements' && (
          <div className="space-y-4">
            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              {[
                { type: 'receive', label: '📥 Receive', color: 'green' },
                { type: 'produce', label: '🏭 Produce', color: 'blue' },
                { type: 'sell', label: '📤 Sell/Ship', color: 'purple' },
                { type: 'transfer', label: '🔄 Transfer', color: 'cyan' },
                { type: 'adjust', label: '✏️ Adjust', color: 'yellow' },
                { type: 'waste', label: '🗑️ Waste', color: 'red' },
              ].map(action => (
                <button
                  key={action.type}
                  onClick={() => { setMovementType(action.type); setShowMovementModal(true); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition hover:opacity-80`}
                  style={{
                    borderColor: `var(--${action.color}-500, #6b7280)`,
                    color: `var(--${action.color}-400, #9ca3af)`,
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>

            {/* Movements List */}
            <div className="space-y-2">
              {movements.map(mov => (
                <div 
                  key={mov.movement_id}
                  className="flex items-center justify-between p-4 rounded-lg"
                  style={{ backgroundColor: '#0f172a' }}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">
                      {mov.movement_type === 'receive' ? '📥' :
                       mov.movement_type === 'produce' ? '🏭' :
                       mov.movement_type === 'sell' ? '📤' :
                       mov.movement_type === 'transfer' ? '🔄' :
                       mov.movement_type === 'adjust' ? '✏️' : '🗑️'}
                    </span>
                    <div>
                      <p className="font-medium text-white">{mov.product_name}</p>
                      <p className="text-sm text-slate-400">
                        <span className="capitalize">{mov.movement_type}</span>
                        {mov.location_id && ` at ${locations.find(l => l.location_id === mov.location_id)?.name || mov.location_id}`}
                        {mov.from_location_id && mov.to_location_id && (
                          <span>
                            {' '}from {locations.find(l => l.location_id === mov.from_location_id)?.name || 'Unknown'}
                            {' '}to {locations.find(l => l.location_id === mov.to_location_id)?.name || 'Unknown'}
                          </span>
                        )}
                      </p>
                      {mov.notes && <p className="text-xs text-slate-500 mt-1">{mov.notes}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${mov.quantity > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {mov.quantity > 0 ? '+' : ''}{mov.quantity}
                    </p>
                    <p className="text-xs text-slate-400">{formatDate(mov.created_at)}</p>
                    {mov.created_by && <p className="text-xs text-slate-500">by {mov.created_by}</p>}
                  </div>
                </div>
              ))}
            </div>

            {movements.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <p className="text-4xl mb-2">📋</p>
                <p>No movements recorded yet</p>
              </div>
            )}
          </div>
        )}

        {/* SUPPLIERS TAB */}
        {activeTab === 'suppliers' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => { setEditingItem(null); setShowSupplierModal(true); }}
                className="px-4 py-2 rounded-lg font-medium text-white"
                style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
              >
                ➕ Add Supplier
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {suppliers.map(supplier => (
                <div 
                  key={supplier.supplier_id}
                  className="p-4 rounded-lg border cursor-pointer hover:border-purple-500/50 transition"
                  style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                  onClick={() => { setEditingItem(supplier); setShowSupplierModal(true); }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-medium text-white text-lg">{supplier.name}</p>
                      {supplier.website && (
                        <a 
                          href={supplier.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-purple-400 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {supplier.website}
                        </a>
                      )}
                    </div>
                    <span className="text-2xl">🚚</span>
                  </div>
                  
                  <div className="space-y-1 text-sm">
                    {supplier.contact_email && (
                      <p className="text-slate-400">📧 {supplier.contact_email}</p>
                    )}
                    {supplier.contact_phone && (
                      <p className="text-slate-400">📞 {supplier.contact_phone}</p>
                    )}
                    <p className="text-slate-400">⏱️ Lead time: {supplier.lead_time_days} days</p>
                  </div>

                  <div className="mt-3 pt-3 border-t flex justify-between text-sm" style={{ borderColor: '#334155' }}>
                    <span className="text-slate-400">{supplier.total_orders || 0} orders</span>
                    <span className="text-green-400">{formatCurrency(supplier.total_spent || 0)} spent</span>
                  </div>
                </div>
              ))}
            </div>

            {suppliers.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <p className="text-4xl mb-2">🚚</p>
                <p>No suppliers added yet</p>
                <button
                  onClick={() => { setEditingItem(null); setShowSupplierModal(true); }}
                  className="mt-4 text-purple-400 hover:underline"
                >
                  Add your first supplier →
                </button>
              </div>
            )}
          </div>
        )}

        {/* LOCATIONS TAB */}
        {activeTab === 'locations' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => { setEditingItem(null); setShowLocationModal(true); }}
                className="px-4 py-2 rounded-lg font-medium text-white"
                style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
              >
                ➕ Add Location
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {locations.map(location => {
                const locSummary = summary?.by_location?.[location.location_id] || {};
                
                return (
                  <div 
                    key={location.location_id}
                    className="p-4 rounded-lg border cursor-pointer hover:border-purple-500/50 transition"
                    style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                    onClick={() => { setEditingItem(location); setShowLocationModal(true); }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-medium text-white text-lg flex items-center gap-2">
                          {location.name}
                          {location.is_default && (
                            <span className="px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400">
                              Default
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-slate-400 capitalize">{location.type}</p>
                      </div>
                      <span className="text-2xl">📍</span>
                    </div>
                    
                    {location.address && (
                      <p className="text-sm text-slate-400 mb-3">{location.address}</p>
                    )}

                    <div className="pt-3 border-t flex justify-between text-sm" style={{ borderColor: '#334155' }}>
                      <span className="text-slate-400">{locSummary.product_count || 0} products</span>
                      <span className="text-white">{locSummary.total_items || 0} items</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {showProductModal && (
        <ProductModal
          product={editingItem}
          categories={categories}
          suppliers={suppliers}
          onClose={() => { setShowProductModal(false); setEditingItem(null); }}
          onSave={() => { loadData(); setShowProductModal(false); setEditingItem(null); }}
        />
      )}

      {showMovementModal && (
        <MovementModal
          type={movementType}
          products={products}
          locations={locations}
          suppliers={suppliers}
          onClose={() => setShowMovementModal(false)}
          onSave={() => { loadData(); setShowMovementModal(false); }}
        />
      )}

      {showSupplierModal && (
        <SupplierModal
          supplier={editingItem}
          onClose={() => { setShowSupplierModal(false); setEditingItem(null); }}
          onSave={() => { loadData(); setShowSupplierModal(false); setEditingItem(null); }}
        />
      )}

      {showLocationModal && (
        <LocationModal
          location={editingItem}
          onClose={() => { setShowLocationModal(false); setEditingItem(null); }}
          onSave={() => { loadData(); setShowLocationModal(false); setEditingItem(null); }}
        />
      )}
    </div>
  );
}


// ============================================================================
// PRODUCT MODAL
// ============================================================================
function ProductModal({ product, categories, suppliers, onClose, onSave }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    name: product?.name || '',
    sku: product?.sku || '',
    category_id: product?.category_id || categories[0]?.category_id || '',
    product_type: product?.product_type || 'product',
    description: product?.description || '',
    unit: product?.unit || 'pcs',
    cost_price: product?.cost_price || 0,
    selling_price: product?.selling_price || 0,
    reorder_point: product?.reorder_point || 5,
    reorder_quantity: product?.reorder_quantity || 10,
    supplier_id: product?.supplier_id || '',
    production_time_minutes: product?.production_time_minutes || 0,
    weight_g: product?.weight_g || 0,
    barcode: product?.barcode || '',
    notes: product?.notes || '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (product) {
        await api.updateInventoryProduct(product.product_id, formData);
      } else {
        await api.createInventoryProduct(formData);
      }
      onSave();
    } catch (err) {
      setError(err.message || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!product || !window.confirm('Delete this product?')) return;
    
    try {
      await api.deleteInventoryProduct(product.product_id);
      onSave();
    } catch (err) {
      setError(err.message || 'Failed to delete product');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <h2 className="text-lg font-bold text-white">
            {product ? 'Edit Product' : 'New Product'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">SKU *</label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                required
                disabled={!!product}
                className="w-full px-3 py-2 rounded-lg text-white disabled:opacity-50"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Category *</label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              >
                {categories.map(cat => (
                  <option key={cat.category_id} value={cat.category_id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Unit</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              >
                <option value="pcs">Pieces (pcs)</option>
                <option value="kg">Kilograms (kg)</option>
                <option value="g">Grams (g)</option>
                <option value="m">Meters (m)</option>
                <option value="ml">Milliliters (ml)</option>
                <option value="roll">Rolls</option>
                <option value="box">Boxes</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Cost Price (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.cost_price}
                onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Selling Price (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.selling_price}
                onChange={(e) => setFormData({ ...formData, selling_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Reorder Point</label>
              <input
                type="number"
                min="0"
                value={formData.reorder_point}
                onChange={(e) => setFormData({ ...formData, reorder_point: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Reorder Quantity</label>
              <input
                type="number"
                min="0"
                value={formData.reorder_quantity}
                onChange={(e) => setFormData({ ...formData, reorder_quantity: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Supplier</label>
            <select
              value={formData.supplier_id}
              onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-white"
              style={{ backgroundColor: '#334155' }}
            >
              <option value="">No supplier</option>
              {suppliers.map(sup => (
                <option key={sup.supplier_id} value={sup.supplier_id}>{sup.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-white resize-none"
              style={{ backgroundColor: '#334155' }}
            />
          </div>

          <div className="flex gap-3 pt-4">
            {product && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg font-medium text-red-400 border border-red-500/30 hover:bg-red-500/10"
              >
                Delete
              </button>
            )}
            <div className="flex-1"></div>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-medium text-slate-300 border border-slate-600 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 rounded-lg font-medium text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
            >
              {loading ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ============================================================================
// MOVEMENT MODAL
// ============================================================================
function MovementModal({ type, products, locations, suppliers, onClose, onSave }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    product_id: products[0]?.product_id || '',
    location_id: locations[0]?.location_id || '',
    from_location_id: locations[0]?.location_id || '',
    to_location_id: locations[1]?.location_id || locations[0]?.location_id || '',
    quantity: 1,
    unit_cost: 0,
    unit_price: 0,
    supplier_id: '',
    reference: '',
    reason: '',
    notes: '',
  });

  const typeConfig = {
    receive: { title: '📥 Receive Stock', color: 'green', action: 'receiveStock' },
    produce: { title: '🏭 Record Production', color: 'blue', action: 'produceStock' },
    sell: { title: '📤 Record Sale/Shipment', color: 'purple', action: 'sellStock' },
    transfer: { title: '🔄 Transfer Stock', color: 'cyan', action: 'transferStock' },
    adjust: { title: '✏️ Adjust Stock', color: 'yellow', action: 'adjustStock' },
    waste: { title: '🗑️ Record Waste', color: 'red', action: 'recordWaste' },
  };

  const config = typeConfig[type] || typeConfig.receive;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = { ...formData };
      await api[config.action](data);
      onSave();
    } catch (err) {
      setError(err.message || 'Failed to record movement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        className="relative w-full max-w-lg rounded-2xl border shadow-2xl"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#334155' }}>
          <h2 className="text-lg font-bold text-white">{config.title}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Product *</label>
            <select
              value={formData.product_id}
              onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-lg text-white"
              style={{ backgroundColor: '#334155' }}
            >
              {products.map(p => (
                <option key={p.product_id} value={p.product_id}>
                  {p.name} ({p.sku}) - Stock: {p.total_stock}
                </option>
              ))}
            </select>
          </div>

          {type === 'transfer' ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">From Location *</label>
                <select
                  value={formData.from_location_id}
                  onChange={(e) => setFormData({ ...formData, from_location_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-lg text-white"
                  style={{ backgroundColor: '#334155' }}
                >
                  {locations.map(l => (
                    <option key={l.location_id} value={l.location_id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">To Location *</label>
                <select
                  value={formData.to_location_id}
                  onChange={(e) => setFormData({ ...formData, to_location_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-lg text-white"
                  style={{ backgroundColor: '#334155' }}
                >
                  {locations.map(l => (
                    <option key={l.location_id} value={l.location_id}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Location *</label>
              <select
                value={formData.location_id}
                onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              >
                {locations.map(l => (
                  <option key={l.location_id} value={l.location_id}>{l.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Quantity *</label>
            <input
              type="number"
              min="1"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
              required
              className="w-full px-3 py-2 rounded-lg text-white"
              style={{ backgroundColor: '#334155' }}
            />
          </div>

          {type === 'receive' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Unit Cost (€)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.unit_cost}
                  onChange={(e) => setFormData({ ...formData, unit_cost: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg text-white"
                  style={{ backgroundColor: '#334155' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Supplier</label>
                <select
                  value={formData.supplier_id}
                  onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-white"
                  style={{ backgroundColor: '#334155' }}
                >
                  <option value="">Select supplier</option>
                  {suppliers.map(s => (
                    <option key={s.supplier_id} value={s.supplier_id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {type === 'sell' && (
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Unit Price (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.unit_price}
                onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
          )}

          {(type === 'adjust' || type === 'waste') && (
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Reason</label>
              <select
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              >
                <option value="">Select reason</option>
                {type === 'adjust' ? (
                  <>
                    <option value="inventory_count">Inventory Count</option>
                    <option value="correction">Correction</option>
                    <option value="damage">Damage</option>
                    <option value="other">Other</option>
                  </>
                ) : (
                  <>
                    <option value="failed_print">Failed Print</option>
                    <option value="expired">Expired</option>
                    <option value="damaged">Damaged</option>
                    <option value="quality_issue">Quality Issue</option>
                    <option value="other">Other</option>
                  </>
                )}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              placeholder="Optional notes..."
              className="w-full px-3 py-2 rounded-lg text-white resize-none"
              style={{ backgroundColor: '#334155' }}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg font-medium text-slate-300 border border-slate-600 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg font-medium text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
            >
              {loading ? 'Saving...' : 'Record Movement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ============================================================================
// SUPPLIER MODAL
// ============================================================================
function SupplierModal({ supplier, onClose, onSave }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    name: supplier?.name || '',
    contact_email: supplier?.contact_email || '',
    contact_phone: supplier?.contact_phone || '',
    website: supplier?.website || '',
    address: supplier?.address || '',
    lead_time_days: supplier?.lead_time_days || 7,
    payment_terms: supplier?.payment_terms || '',
    notes: supplier?.notes || '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (supplier) {
        await api.updateSupplier(supplier.supplier_id, formData);
      } else {
        await api.createSupplier(formData);
      }
      onSave();
    } catch (err) {
      setError(err.message || 'Failed to save supplier');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!supplier || !window.confirm('Delete this supplier?')) return;
    
    try {
      await api.deleteSupplier(supplier.supplier_id);
      onSave();
    } catch (err) {
      setError(err.message || 'Failed to delete supplier');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        className="relative w-full max-w-lg rounded-2xl border shadow-2xl"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#334155' }}>
          <h2 className="text-lg font-bold text-white">
            {supplier ? 'Edit Supplier' : 'New Supplier'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-lg text-white"
              style={{ backgroundColor: '#334155' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Email</label>
              <input
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Phone</label>
              <input
                type="text"
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Website</label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              placeholder="https://"
              className="w-full px-3 py-2 rounded-lg text-white"
              style={{ backgroundColor: '#334155' }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-white"
              style={{ backgroundColor: '#334155' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Lead Time (days)</label>
              <input
                type="number"
                min="0"
                value={formData.lead_time_days}
                onChange={(e) => setFormData({ ...formData, lead_time_days: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Payment Terms</label>
              <input
                type="text"
                value={formData.payment_terms}
                onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                placeholder="e.g., Net 30"
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-white resize-none"
              style={{ backgroundColor: '#334155' }}
            />
          </div>

          <div className="flex gap-3 pt-4">
            {supplier && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg font-medium text-red-400 border border-red-500/30 hover:bg-red-500/10"
              >
                Delete
              </button>
            )}
            <div className="flex-1"></div>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-medium text-slate-300 border border-slate-600 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 rounded-lg font-medium text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
            >
              {loading ? 'Saving...' : 'Save Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ============================================================================
// LOCATION MODAL
// ============================================================================
function LocationModal({ location, onClose, onSave }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    name: location?.name || '',
    type: location?.type || 'warehouse',
    address: location?.address || '',
    is_default: location?.is_default || false,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (location) {
        await api.updateInventoryLocation(location.location_id, formData);
      } else {
        await api.createInventoryLocation(formData);
      }
      onSave();
    } catch (err) {
      setError(err.message || 'Failed to save location');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!location || !window.confirm('Delete this location?')) return;
    
    try {
      await api.deleteInventoryLocation(location.location_id);
      onSave();
    } catch (err) {
      setError(err.message || 'Failed to delete location');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        className="relative w-full max-w-md rounded-2xl border shadow-2xl"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#334155' }}>
          <h2 className="text-lg font-bold text-white">
            {location ? 'Edit Location' : 'New Location'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="e.g., Home Workshop"
              className="w-full px-3 py-2 rounded-lg text-white"
              style={{ backgroundColor: '#334155' }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-white"
              style={{ backgroundColor: '#334155' }}
            >
              <option value="warehouse">Warehouse</option>
              <option value="store">Store</option>
              <option value="workshop">Workshop</option>
              <option value="office">Office</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Optional address"
              className="w-full px-3 py-2 rounded-lg text-white"
              style={{ backgroundColor: '#334155' }}
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_default"
              checked={formData.is_default}
              onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="is_default" className="text-sm text-slate-400">
              Set as default location
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            {location && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg font-medium text-red-400 border border-red-500/30 hover:bg-red-500/10"
              >
                Delete
              </button>
            )}
            <div className="flex-1"></div>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-medium text-slate-300 border border-slate-600 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 rounded-lg font-medium text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
            >
              {loading ? 'Saving...' : 'Save Location'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


export default InventoryDashboard;
