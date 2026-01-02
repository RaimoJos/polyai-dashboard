import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

/**
 * QuickPOS - Point of Sale for walk-in customers
 */
function QuickPOS({ currentUser, onComplete }) {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('products'); // products, custom, services
  const [showPayment, setShowPayment] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({ name: '', email: '', phone: '' });
  const searchRef = useRef(null);

  // Custom item for quick add
  const [customItem, setCustomItem] = useState({
    name: '',
    quantity: 1,
    price: 0,
    notes: '',
  });

  // Preset services
  const services = [
    { id: 'modeling', name: '3D Modeling', icon: '🎨', price: 25, unit: 'hour' },
    { id: 'scanning', name: '3D Scanning', icon: '📷', price: 15, unit: 'scan' },
    { id: 'printing', name: 'Print Service', icon: '🖨️', price: 0.10, unit: 'gram' },
    { id: 'post_processing', name: 'Post Processing', icon: '✨', price: 10, unit: 'item' },
    { id: 'rush', name: 'Rush Order (+50%)', icon: '⚡', price: 0, unit: 'order', isModifier: true },
    { id: 'delivery', name: 'Delivery', icon: '🚚', price: 5, unit: 'order' },
  ];

  useEffect(() => {
    loadProducts();
    // Focus search on mount
    searchRef.current?.focus();
  }, []);

  // Helper to safely extract array from various response formats
  const extractArray = (response) => {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (response.data && Array.isArray(response.data)) return response.data;
    if (response.products && Array.isArray(response.products)) return response.products;
    if (response.materials && Array.isArray(response.materials)) return response.materials;
    return [];
  };

  const loadProducts = async () => {
    try {
      const [productsRes, materialsRes] = await Promise.all([
        api.getInventoryProducts({ type: 'product' }),
        api.getMaterials(),
      ]);
      setProducts(extractArray(productsRes));
      setMaterials(extractArray(materialsRes));
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  };

  const addToCart = (item, type = 'product') => {
    const cartItem = {
      id: `${type}-${item.product_id || item.id || Date.now()}`,
      type,
      name: item.name,
      sku: item.sku || '',
      price: item.selling_price || item.price || 0,
      quantity: item.quantity || 1,
      unit: item.unit || 'pcs',
      notes: item.notes || '',
    };

    setCart(prev => {
      // Check if item already in cart
      const existing = prev.find(i => i.id === cartItem.id);
      if (existing) {
        return prev.map(i => 
          i.id === cartItem.id 
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, cartItem];
    });
  };

  const updateCartItem = (id, updates) => {
    setCart(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const clearCart = () => {
    if (cart.length === 0 || window.confirm('Clear entire cart?')) {
      setCart([]);
      setCustomerInfo({ name: '', email: '', phone: '' });
    }
  };

  const addCustomItem = () => {
    if (!customItem.name || customItem.price <= 0) return;
    
    addToCart({
      ...customItem,
      id: `custom-${Date.now()}`,
    }, 'custom');

    setCustomItem({ name: '', quantity: 1, price: 0, notes: '' });
  };

  const addService = (service) => {
    const quantity = service.unit === 'gram' ? 100 : 1;
    addToCart({
      ...service,
      quantity,
      price: service.price,
    }, 'service');
  };

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const vatRate = 0.24; // Estonian VAT 24%
  const vat = subtotal * vatRate;
  const total = subtotal + vat;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('et-EE', { style: 'currency', currency: 'EUR' }).format(amount || 0);
  };

  const handleCheckout = async (paymentMethod) => {
    setLoading(true);
    
    try {
      // Create order
      const orderData = {
        client_name: customerInfo.name || 'Walk-in Customer',
        client_email: customerInfo.email || null,
        client_phone: customerInfo.phone || null,
        order_type: 'walk_in',
        status: 'completed',
        items: cart.map(item => ({
          name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          total: item.price * item.quantity,
          notes: item.notes,
        })),
        subtotal: subtotal,
        vat_rate: vatRate,
        vat_amount: vat,
        total_price: total,
        payment_method: paymentMethod,
        payment_status: 'paid',
        paid_at: new Date().toISOString(),
        notes: `Walk-in sale. Payment: ${paymentMethod}`,
        created_by: currentUser?.username,
      };

      await api.createOrder(orderData);
      
      // Clear and close
      setCart([]);
      setCustomerInfo({ name: '', email: '', phone: '' });
      setShowPayment(false);
      
      if (onComplete) {
        onComplete();
      }

      alert('Sale completed! 🎉');
    } catch (err) {
      console.error('Failed to create order:', err);
      alert('Failed to complete sale. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Filter products
  const filteredProducts = searchQuery
    ? products.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : products;

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4">
      {/* Left Side - Product Selection */}
      <div className="flex-1 flex flex-col" style={{ minHeight: '70vh' }}>
        {/* Search & Tabs */}
        <div className="mb-4 space-y-3">
          <input
            ref={searchRef}
            type="text"
            placeholder="🔍 Search products, scan barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-white text-lg"
            style={{ backgroundColor: '#334155' }}
          />
          
          <div className="flex gap-2">
            {[
              { id: 'products', name: 'Products', icon: '📦' },
              { id: 'services', name: 'Services', icon: '🛠️' },
              { id: 'custom', name: 'Custom', icon: '✏️' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                  activeTab === tab.id
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div 
          className="flex-1 overflow-y-auto rounded-xl border p-4"
          style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
        >
          {/* Products Grid */}
          {activeTab === 'products' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredProducts.map(product => (
                <button
                  key={product.product_id}
                  onClick={() => addToCart(product)}
                  className="p-4 rounded-xl border text-left hover:border-purple-500 transition"
                  style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                >
                  <p className="font-medium text-white truncate">{product.name}</p>
                  <p className="text-xs text-slate-400 truncate">{product.sku}</p>
                  <p className="text-lg font-bold text-green-400 mt-2">
                    {formatCurrency(product.selling_price)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Stock: {product.total_stock || 0}
                  </p>
                </button>
              ))}
              
              {filteredProducts.length === 0 && (
                <div className="col-span-full text-center py-8 text-slate-400">
                  <p className="text-4xl mb-2">📦</p>
                  <p>No products found</p>
                  <p className="text-sm mt-1">Try a different search or add a custom item</p>
                </div>
              )}
            </div>
          )}

          {/* Services */}
          {activeTab === 'services' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {services.map(service => (
                <button
                  key={service.id}
                  onClick={() => addService(service)}
                  className="p-4 rounded-xl border text-left hover:border-purple-500 transition"
                  style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                >
                  <span className="text-2xl block mb-2">{service.icon}</span>
                  <p className="font-medium text-white">{service.name}</p>
                  <p className="text-green-400 font-bold mt-1">
                    {service.price > 0 ? formatCurrency(service.price) : 'Variable'}
                    <span className="text-xs text-slate-500 font-normal">/{service.unit}</span>
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Custom Item */}
          {activeTab === 'custom' && (
            <div className="max-w-md space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Item Name</label>
                <input
                  type="text"
                  value={customItem.name}
                  onChange={(e) => setCustomItem({ ...customItem, name: e.target.value })}
                  placeholder="e.g., Custom Print Job"
                  className="w-full px-4 py-2 rounded-lg text-white"
                  style={{ backgroundColor: '#334155' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Price (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={customItem.price}
                    onChange={(e) => setCustomItem({ ...customItem, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 rounded-lg text-white"
                    style={{ backgroundColor: '#334155' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={customItem.quantity}
                    onChange={(e) => setCustomItem({ ...customItem, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-2 rounded-lg text-white"
                    style={{ backgroundColor: '#334155' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Notes</label>
                <input
                  type="text"
                  value={customItem.notes}
                  onChange={(e) => setCustomItem({ ...customItem, notes: e.target.value })}
                  placeholder="Optional notes..."
                  className="w-full px-4 py-2 rounded-lg text-white"
                  style={{ backgroundColor: '#334155' }}
                />
              </div>

              <button
                onClick={addCustomItem}
                disabled={!customItem.name || customItem.price <= 0}
                className="w-full py-3 rounded-lg font-medium text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
              >
                ➕ Add to Cart
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Side - Cart */}
      <div 
        className="w-full lg:w-96 flex flex-col rounded-xl border"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        {/* Cart Header */}
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: '#334155' }}>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            🛒 Cart
            {cart.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-400">
                {cart.length}
              </span>
            )}
          </h3>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-sm text-red-400 hover:underline"
            >
              Clear
            </button>
          )}
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ maxHeight: '40vh' }}>
          {cart.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p className="text-4xl mb-2">🛒</p>
              <p>Cart is empty</p>
              <p className="text-sm mt-1">Add items to start a sale</p>
            </div>
          ) : (
            cart.map(item => (
              <div 
                key={item.id}
                className="flex items-start gap-3 p-3 rounded-lg"
                style={{ backgroundColor: '#0f172a' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm truncate">{item.name}</p>
                  {item.sku && <p className="text-xs text-slate-500">{item.sku}</p>}
                  <p className="text-xs text-green-400 mt-1">
                    {formatCurrency(item.price)} × {item.quantity} = {formatCurrency(item.price * item.quantity)}
                  </p>
                </div>
                
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateCartItem(item.id, { quantity: Math.max(1, item.quantity - 1) })}
                    className="w-6 h-6 rounded bg-slate-700 text-white hover:bg-slate-600"
                  >
                    -
                  </button>
                  <span className="w-8 text-center text-white text-sm">{item.quantity}</span>
                  <button
                    onClick={() => updateCartItem(item.id, { quantity: item.quantity + 1 })}
                    className="w-6 h-6 rounded bg-slate-700 text-white hover:bg-slate-600"
                  >
                    +
                  </button>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="w-6 h-6 rounded text-red-400 hover:bg-red-500/20 ml-1"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Customer Info (optional) */}
        <div className="p-4 border-t space-y-2" style={{ borderColor: '#334155' }}>
          <input
            type="text"
            placeholder="Customer name (optional)"
            value={customerInfo.name}
            onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
            className="w-full px-3 py-2 rounded-lg text-white text-sm"
            style={{ backgroundColor: '#334155' }}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="email"
              placeholder="Email"
              value={customerInfo.email}
              onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
              className="px-3 py-2 rounded-lg text-white text-sm"
              style={{ backgroundColor: '#334155' }}
            />
            <input
              type="tel"
              placeholder="Phone"
              value={customerInfo.phone}
              onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
              className="px-3 py-2 rounded-lg text-white text-sm"
              style={{ backgroundColor: '#334155' }}
            />
          </div>
        </div>

        {/* Totals */}
        <div className="p-4 border-t space-y-2" style={{ borderColor: '#334155' }}>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Subtotal</span>
            <span className="text-white">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">VAT (24%)</span>
            <span className="text-white">{formatCurrency(vat)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold pt-2 border-t" style={{ borderColor: '#334155' }}>
            <span className="text-white">Total</span>
            <span className="text-green-400">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Payment Buttons */}
        <div className="p-4 border-t space-y-2" style={{ borderColor: '#334155' }}>
          {!showPayment ? (
            <button
              onClick={() => setShowPayment(true)}
              disabled={cart.length === 0}
              className="w-full py-4 rounded-xl font-bold text-white text-lg disabled:opacity-50 transition"
              style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
            >
              💳 Pay {formatCurrency(total)}
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-center text-slate-400 text-sm mb-3">Select payment method</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleCheckout('card')}
                  disabled={loading}
                  className="py-4 rounded-xl font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50"
                >
                  💳 Card
                </button>
                <button
                  onClick={() => handleCheckout('cash')}
                  disabled={loading}
                  className="py-4 rounded-xl font-medium text-white bg-green-500 hover:bg-green-600 disabled:opacity-50"
                >
                  💵 Cash
                </button>
                <button
                  onClick={() => handleCheckout('transfer')}
                  disabled={loading}
                  className="py-4 rounded-xl font-medium text-white bg-purple-500 hover:bg-purple-600 disabled:opacity-50"
                >
                  🏦 Transfer
                </button>
                <button
                  onClick={() => setShowPayment(false)}
                  disabled={loading}
                  className="py-4 rounded-xl font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 disabled:opacity-50"
                >
                  ← Back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default QuickPOS;
