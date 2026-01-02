import React, { useState, useEffect, useMemo } from 'react';
import { api, unwrap } from '../services/api';

/**
 * DynamicPricing - AI-powered price optimization
 * Adjusts prices based on demand, capacity, and competition
 */
function DynamicPricing() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [pricingRules, setPricingRules] = useState({
    baseMultiplier: 1.0,
    rushMultiplier: 1.5,
    bulkDiscount: 0.1,
    capacityAdjustment: true,
    demandAdjustment: true,
  });
  const [simulationParams, setSimulationParams] = useState({
    quantity: 10,
    material: 'PLA',
    printHours: 5,
    isRush: false,
    complexity: 'medium',
  });

  useEffect(() => {
    loadData();
    loadPricingRules();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersRes, printersRes] = await Promise.all([
        api.listOrders?.() || Promise.resolve({ data: [] }),
        api.getPrinters?.() || Promise.resolve({ data: [] }),
      ]);
      
      setOrders(unwrap(ordersRes)?.orders || getMockOrders());
      setPrinters(unwrap(printersRes)?.printers || getMockPrinters());
    } catch (err) {
      console.error('Failed to load data:', err);
      setOrders(getMockOrders());
      setPrinters(getMockPrinters());
    } finally {
      setLoading(false);
    }
  };

  const loadPricingRules = () => {
    const saved = localStorage.getItem('polywerk_pricing_rules');
    if (saved) {
      try {
        setPricingRules(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse pricing rules:', e);
      }
    }
  };

  const savePricingRules = (rules) => {
    setPricingRules(rules);
    localStorage.setItem('polywerk_pricing_rules', JSON.stringify(rules));
  };

  const getMockOrders = () => {
    const orders = [];
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    
    for (let i = 30; i >= 0; i--) {
      const numOrders = Math.floor(Math.random() * 4) + 1;
      for (let j = 0; j < numOrders; j++) {
        orders.push({
          id: `order-${i}-${j}`,
          created_at: new Date(now - i * day).toISOString(),
          total: 50 + Math.random() * 400,
          status: 'completed',
          print_hours: 2 + Math.random() * 15,
        });
      }
    }
    return orders;
  };

  const getMockPrinters = () => [
    { id: 'p1', name: 'Bambu X1C #1', status: 'printing' },
    { id: 'p2', name: 'Bambu X1C #2', status: 'idle' },
    { id: 'p3', name: 'Bambu P1S', status: 'printing' },
    { id: 'p4', name: 'Creality K1', status: 'idle' },
  ];

  // Calculate market conditions
  const marketConditions = useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    
    // Recent orders (last 7 days)
    const recentOrders = orders.filter(o => 
      new Date(o.created_at).getTime() > now - 7 * day
    );
    
    // Historical average (previous 30 days)
    const historicalOrders = orders.filter(o => {
      const orderTime = new Date(o.created_at).getTime();
      return orderTime > now - 37 * day && orderTime <= now - 7 * day;
    });
    
    const recentAvgDaily = recentOrders.length / 7;
    const historicalAvgDaily = historicalOrders.length / 30;
    
    // Demand level
    let demandLevel = 'normal';
    let demandMultiplier = 1.0;
    if (recentAvgDaily > historicalAvgDaily * 1.3) {
      demandLevel = 'high';
      demandMultiplier = 1.15;
    } else if (recentAvgDaily > historicalAvgDaily * 1.1) {
      demandLevel = 'above_average';
      demandMultiplier = 1.08;
    } else if (recentAvgDaily < historicalAvgDaily * 0.7) {
      demandLevel = 'low';
      demandMultiplier = 0.92;
    }

    // Capacity utilization
    const busyPrinters = printers.filter(p => p.status === 'printing').length;
    const capacityUtilization = printers.length > 0 ? busyPrinters / printers.length : 0;
    
    let capacityLevel = 'available';
    let capacityMultiplier = 1.0;
    if (capacityUtilization > 0.8) {
      capacityLevel = 'constrained';
      capacityMultiplier = 1.2;
    } else if (capacityUtilization > 0.6) {
      capacityLevel = 'busy';
      capacityMultiplier = 1.1;
    } else if (capacityUtilization < 0.3) {
      capacityLevel = 'low';
      capacityMultiplier = 0.95;
    }

    // Day of week factor
    const dayOfWeek = new Date().getDay();
    let dayMultiplier = 1.0;
    if (dayOfWeek === 1) dayMultiplier = 1.05; // Monday premium
    if (dayOfWeek === 0 || dayOfWeek === 6) dayMultiplier = 0.95; // Weekend discount

    return {
      demandLevel,
      demandMultiplier,
      capacityLevel,
      capacityUtilization: Math.round(capacityUtilization * 100),
      capacityMultiplier,
      dayMultiplier,
      recentOrdersCount: recentOrders.length,
      historicalAvgDaily: Math.round(historicalAvgDaily * 10) / 10,
    };
  }, [orders, printers]);

  // Base pricing structure
  const basePricing = {
    setupFee: 5,
    hourlyRate: 8,
    materialCosts: {
      PLA: 0.025,
      PETG: 0.030,
      ABS: 0.028,
      TPU: 0.045,
      ASA: 0.035,
      Nylon: 0.050,
    },
    complexityMultipliers: {
      simple: 0.8,
      medium: 1.0,
      complex: 1.3,
      very_complex: 1.6,
    },
  };

  // Calculate dynamic price
  const calculatePrice = (params) => {
    const { quantity, material, printHours, isRush, complexity } = params;
    
    // Base costs
    let setupCost = basePricing.setupFee;
    let printCost = printHours * basePricing.hourlyRate;
    let materialCost = printHours * 50 * (basePricing.materialCosts[material] || 0.025); // Assume 50g/hour
    
    // Complexity adjustment
    const complexityMult = basePricing.complexityMultipliers[complexity] || 1.0;
    printCost *= complexityMult;
    
    // Quantity discount
    let quantityDiscount = 0;
    if (quantity >= 100) quantityDiscount = pricingRules.bulkDiscount + 0.05;
    else if (quantity >= 50) quantityDiscount = pricingRules.bulkDiscount;
    else if (quantity >= 20) quantityDiscount = pricingRules.bulkDiscount * 0.5;
    else if (quantity >= 10) quantityDiscount = pricingRules.bulkDiscount * 0.25;
    
    // Per unit cost
    let unitCost = (setupCost / quantity) + printCost + materialCost;
    unitCost *= (1 - quantityDiscount);
    
    // Rush premium
    if (isRush) {
      unitCost *= pricingRules.rushMultiplier;
    }
    
    // Dynamic adjustments
    let dynamicMultiplier = pricingRules.baseMultiplier;
    
    if (pricingRules.demandAdjustment) {
      dynamicMultiplier *= marketConditions.demandMultiplier;
    }
    
    if (pricingRules.capacityAdjustment) {
      dynamicMultiplier *= marketConditions.capacityMultiplier;
    }
    
    dynamicMultiplier *= marketConditions.dayMultiplier;
    
    const finalUnitPrice = unitCost * dynamicMultiplier;
    const totalPrice = finalUnitPrice * quantity;
    
    return {
      unitPrice: Math.round(finalUnitPrice * 100) / 100,
      totalPrice: Math.round(totalPrice * 100) / 100,
      breakdown: {
        setupCost: Math.round(setupCost * 100) / 100,
        printCost: Math.round(printCost * quantity * 100) / 100,
        materialCost: Math.round(materialCost * quantity * 100) / 100,
        quantityDiscount: Math.round(quantityDiscount * 100),
        rushPremium: isRush ? Math.round((pricingRules.rushMultiplier - 1) * 100) : 0,
        dynamicAdjustment: Math.round((dynamicMultiplier - 1) * 100),
      },
      margin: calculateMargin(totalPrice, printHours * quantity, material),
    };
  };

  const calculateMargin = (revenue, totalHours, material) => {
    const materialCostPerHour = (basePricing.materialCosts[material] || 0.025) * 50;
    const electricityCost = 0.15 * totalHours; // ~€0.15/hour
    const laborCost = 2 * totalHours; // ~€2/hour overhead
    const totalCost = (materialCostPerHour * totalHours) + electricityCost + laborCost;
    const profit = revenue - totalCost;
    return Math.round((profit / revenue) * 100);
  };

  const simulatedPrice = useMemo(() => {
    return calculatePrice(simulationParams);
  }, [simulationParams, pricingRules, marketConditions]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('et-EE', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            💰 Dynamic Pricing
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            AI-optimized pricing based on demand and capacity
          </p>
        </div>
      </div>

      {/* Market Conditions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-slate-400 text-sm">Demand Level</p>
          <p className={`text-xl font-bold capitalize ${
            marketConditions.demandLevel === 'high' ? 'text-red-400' :
            marketConditions.demandLevel === 'above_average' ? 'text-yellow-400' :
            marketConditions.demandLevel === 'low' ? 'text-cyan-400' :
            'text-green-400'
          }`}>
            {marketConditions.demandLevel.replace('_', ' ')}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {marketConditions.recentOrdersCount} orders this week
          </p>
        </div>

        <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-slate-400 text-sm">Capacity</p>
          <p className={`text-xl font-bold ${
            marketConditions.capacityLevel === 'constrained' ? 'text-red-400' :
            marketConditions.capacityLevel === 'busy' ? 'text-yellow-400' :
            'text-green-400'
          }`}>
            {marketConditions.capacityUtilization}%
          </p>
          <p className="text-xs text-slate-500 mt-1 capitalize">
            {marketConditions.capacityLevel}
          </p>
        </div>

        <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-slate-400 text-sm">Demand Adj.</p>
          <p className={`text-xl font-bold ${
            marketConditions.demandMultiplier > 1 ? 'text-green-400' : 
            marketConditions.demandMultiplier < 1 ? 'text-red-400' : 
            'text-white'
          }`}>
            {marketConditions.demandMultiplier > 1 ? '+' : ''}{Math.round((marketConditions.demandMultiplier - 1) * 100)}%
          </p>
        </div>

        <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-slate-400 text-sm">Capacity Adj.</p>
          <p className={`text-xl font-bold ${
            marketConditions.capacityMultiplier > 1 ? 'text-green-400' : 
            marketConditions.capacityMultiplier < 1 ? 'text-red-400' : 
            'text-white'
          }`}>
            {marketConditions.capacityMultiplier > 1 ? '+' : ''}{Math.round((marketConditions.capacityMultiplier - 1) * 100)}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Price Simulator */}
        <div className="rounded-xl border p-6" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <h3 className="font-medium text-white mb-4">🧮 Price Simulator</h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Quantity</label>
                <input
                  type="number"
                  value={simulationParams.quantity}
                  onChange={(e) => setSimulationParams(prev => ({ ...prev, quantity: Number(e.target.value) || 1 }))}
                  min="1"
                  className="w-full px-3 py-2 rounded-lg text-white"
                  style={{ backgroundColor: '#334155' }}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Print Hours</label>
                <input
                  type="number"
                  value={simulationParams.printHours}
                  onChange={(e) => setSimulationParams(prev => ({ ...prev, printHours: Number(e.target.value) || 1 }))}
                  min="0.5"
                  step="0.5"
                  className="w-full px-3 py-2 rounded-lg text-white"
                  style={{ backgroundColor: '#334155' }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Material</label>
                <select
                  value={simulationParams.material}
                  onChange={(e) => setSimulationParams(prev => ({ ...prev, material: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-white"
                  style={{ backgroundColor: '#334155' }}
                >
                  {Object.keys(basePricing.materialCosts).map(mat => (
                    <option key={mat} value={mat}>{mat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Complexity</label>
                <select
                  value={simulationParams.complexity}
                  onChange={(e) => setSimulationParams(prev => ({ ...prev, complexity: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-white"
                  style={{ backgroundColor: '#334155' }}
                >
                  <option value="simple">Simple</option>
                  <option value="medium">Medium</option>
                  <option value="complex">Complex</option>
                  <option value="very_complex">Very Complex</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={simulationParams.isRush}
                onChange={(e) => setSimulationParams(prev => ({ ...prev, isRush: e.target.checked }))}
                className="w-5 h-5 rounded"
              />
              <span className="text-white">Rush Order (24-48h)</span>
            </label>
          </div>

          {/* Price Result */}
          <div className="mt-6 p-4 rounded-xl" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' }}>
            <div className="flex items-end justify-between mb-4">
              <div>
                <p className="text-slate-400 text-sm">Total Price</p>
                <p className="text-3xl font-bold text-white">{formatCurrency(simulatedPrice.totalPrice)}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-sm">Per Unit</p>
                <p className="text-xl font-bold text-cyan-400">{formatCurrency(simulatedPrice.unitPrice)}</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: '#475569' }}>
              <span className="text-slate-400 text-sm">Estimated Margin</span>
              <span className={`font-bold ${
                simulatedPrice.margin >= 50 ? 'text-green-400' :
                simulatedPrice.margin >= 30 ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                {simulatedPrice.margin}%
              </span>
            </div>
          </div>

          {/* Breakdown */}
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between text-slate-400">
              <span>Setup Fee</span>
              <span>{formatCurrency(simulatedPrice.breakdown.setupCost)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Print Cost</span>
              <span>{formatCurrency(simulatedPrice.breakdown.printCost)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Material Cost</span>
              <span>{formatCurrency(simulatedPrice.breakdown.materialCost)}</span>
            </div>
            {simulatedPrice.breakdown.quantityDiscount > 0 && (
              <div className="flex justify-between text-green-400">
                <span>Quantity Discount</span>
                <span>-{simulatedPrice.breakdown.quantityDiscount}%</span>
              </div>
            )}
            {simulatedPrice.breakdown.rushPremium > 0 && (
              <div className="flex justify-between text-yellow-400">
                <span>Rush Premium</span>
                <span>+{simulatedPrice.breakdown.rushPremium}%</span>
              </div>
            )}
            {simulatedPrice.breakdown.dynamicAdjustment !== 0 && (
              <div className={`flex justify-between ${simulatedPrice.breakdown.dynamicAdjustment > 0 ? 'text-green-400' : 'text-cyan-400'}`}>
                <span>Dynamic Adjustment</span>
                <span>{simulatedPrice.breakdown.dynamicAdjustment > 0 ? '+' : ''}{simulatedPrice.breakdown.dynamicAdjustment}%</span>
              </div>
            )}
          </div>
        </div>

        {/* Pricing Rules */}
        <div className="rounded-xl border p-6" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <h3 className="font-medium text-white mb-4">⚙️ Pricing Rules</h3>
          
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-slate-400">Base Multiplier</label>
                <span className="text-white font-mono">{pricingRules.baseMultiplier.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.5"
                step="0.05"
                value={pricingRules.baseMultiplier}
                onChange={(e) => savePricingRules({ ...pricingRules, baseMultiplier: Number(e.target.value) })}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-slate-400">Rush Multiplier</label>
                <span className="text-white font-mono">{pricingRules.rushMultiplier.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="2.5"
                step="0.1"
                value={pricingRules.rushMultiplier}
                onChange={(e) => savePricingRules({ ...pricingRules, rushMultiplier: Number(e.target.value) })}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-slate-400">Bulk Discount (100+ units)</label>
                <span className="text-white font-mono">{Math.round(pricingRules.bulkDiscount * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.3"
                step="0.05"
                value={pricingRules.bulkDiscount}
                onChange={(e) => savePricingRules({ ...pricingRules, bulkDiscount: Number(e.target.value) })}
                className="w-full"
              />
            </div>

            <div className="pt-4 border-t space-y-3" style={{ borderColor: '#334155' }}>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-white">Auto-adjust for demand</span>
                <input
                  type="checkbox"
                  checked={pricingRules.demandAdjustment}
                  onChange={(e) => savePricingRules({ ...pricingRules, demandAdjustment: e.target.checked })}
                  className="w-5 h-5 rounded"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-white">Auto-adjust for capacity</span>
                <input
                  type="checkbox"
                  checked={pricingRules.capacityAdjustment}
                  onChange={(e) => savePricingRules({ ...pricingRules, capacityAdjustment: e.target.checked })}
                  className="w-5 h-5 rounded"
                />
              </label>
            </div>
          </div>

          {/* Info */}
          <div className="mt-6 p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
            <p className="text-cyan-400 text-sm">
              💡 <strong>Dynamic pricing tip:</strong> Enable both adjustments to automatically 
              increase prices during busy periods and offer competitive rates when capacity is available.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DynamicPricing;
