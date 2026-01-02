import React, { useState, useEffect, useMemo } from 'react';
import { api, unwrap } from '../services/api';

/**
 * Financial Reports - Uses ACTUAL data, no guessing
 * 
 * Data sources:
 * - Orders: actual sold prices (quote.total) and costs (quote.material_cost, etc.)
 * - Materials: actual bought prices (purchase_price per spool)
 * - Invoices: actual payment status
 */
function FinancialReports() {
  const [orders, setOrders] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');
  const [viewMode, setViewMode] = useState('summary'); // summary, orders, materials, profit

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [ordersRes, materialsRes, invoicesRes] = await Promise.all([
        api.listOrders({ limit: 500 }).catch(() => []),
        api.getMaterialInventory({}).catch(() => ({ spools: [] })),
        api.listInvoices ? api.listInvoices().catch(() => []) : Promise.resolve([]),
      ]);

      // Process orders
      const ordersList = Array.isArray(ordersRes) ? ordersRes : (unwrap(ordersRes)?.data || []);
      setOrders(Array.isArray(ordersList) ? ordersList : []);

      // Process materials
      const spools = unwrap(materialsRes)?.spools || [];
      setMaterials(Array.isArray(spools) ? spools : []);

      // Process invoices
      const invoicesList = Array.isArray(invoicesRes) ? invoicesRes : (unwrap(invoicesRes)?.data || []);
      setInvoices(Array.isArray(invoicesList) ? invoicesList : []);
    } catch (err) {
      console.error('Failed to fetch financial data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  // Filter orders by date range
  const filteredOrders = useMemo(() => {
    const days = parseInt(dateRange, 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    return orders.filter(order => {
      const orderDate = new Date(order.created_at);
      return orderDate >= cutoff;
    });
  }, [orders, dateRange]);

  // Calculate ACTUAL financial metrics from real order data
  const financials = useMemo(() => {
    const delivered = filteredOrders.filter(o => o.status === 'delivered');
    const pending = filteredOrders.filter(o => !['delivered', 'cancelled'].includes(o.status));
    const cancelled = filteredOrders.filter(o => o.status === 'cancelled');

    // Revenue = sum of all delivered order totals (ACTUAL sold prices)
    let totalRevenue = 0;
    let totalMaterialCost = 0;
    let totalLaborCost = 0;
    let totalMachineCost = 0;
    let pendingRevenue = 0;

    delivered.forEach(order => {
      const quote = order.quote || {};
      const qty = order.quantity || 1;
      
      totalRevenue += (quote.total || 0);
      totalMaterialCost += (quote.material_cost || 0) * qty;
      totalLaborCost += (quote.labor_cost || 0) * qty;
      totalMachineCost += (quote.machine_cost || 0) * qty;
    });

    pending.forEach(order => {
      const quote = order.quote || {};
      pendingRevenue += (quote.total || 0);
    });

    const totalCost = totalMaterialCost + totalLaborCost + totalMachineCost;
    const grossProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // Payment status from invoices or orders
    const paidOrders = delivered.filter(o => o.payment_status === 'paid' || o.paid_at);
    const unpaidOrders = delivered.filter(o => o.payment_status !== 'paid' && !o.paid_at);

    const paidRevenue = paidOrders.reduce((sum, o) => sum + (o.quote?.total || 0), 0);
    const unpaidRevenue = unpaidOrders.reduce((sum, o) => sum + (o.quote?.total || 0), 0);

    return {
      totalRevenue,
      totalCost,
      totalMaterialCost,
      totalLaborCost,
      totalMachineCost,
      grossProfit,
      profitMargin,
      pendingRevenue,
      paidRevenue,
      unpaidRevenue,
      deliveredCount: delivered.length,
      pendingCount: pending.length,
      cancelledCount: cancelled.length,
      avgOrderValue: delivered.length > 0 ? totalRevenue / delivered.length : 0,
    };
  }, [filteredOrders]);

  // Material inventory value (ACTUAL bought prices)
  const materialStats = useMemo(() => {
    let totalPurchaseValue = 0;
    let totalWeight = 0;
    let spoolCount = 0;
    const byType = {};

    materials.forEach(spool => {
      const purchasePrice = spool.purchase_price || 0;
      const weight = spool.weight_g || 1000;
      const remaining = spool.remaining_g || weight;
      const type = spool.material_type || 'Unknown';

      totalPurchaseValue += purchasePrice;
      totalWeight += remaining;
      spoolCount++;

      if (!byType[type]) {
        byType[type] = { count: 0, totalCost: 0, totalWeight: 0 };
      }
      byType[type].count++;
      byType[type].totalCost += purchasePrice;
      byType[type].totalWeight += remaining;
    });

    return {
      totalPurchaseValue,
      totalWeight,
      spoolCount,
      byType,
      avgCostPerKg: totalWeight > 0 ? (totalPurchaseValue / (totalWeight / 1000)) : 0,
    };
  }, [materials]);

  // Profit by material type
  const profitByMaterial = useMemo(() => {
    const stats = {};
    
    filteredOrders.filter(o => o.status === 'delivered').forEach(order => {
      const material = order.material_type || 'Unknown';
      const quote = order.quote || {};
      const qty = order.quantity || 1;

      if (!stats[material]) {
        stats[material] = {
          material,
          orders: 0,
          revenue: 0,
          materialCost: 0,
          laborCost: 0,
          machineCost: 0,
          profit: 0,
        };
      }

      const revenue = quote.total || 0;
      const matCost = (quote.material_cost || 0) * qty;
      const labCost = (quote.labor_cost || 0) * qty;
      const machCost = (quote.machine_cost || 0) * qty;

      stats[material].orders++;
      stats[material].revenue += revenue;
      stats[material].materialCost += matCost;
      stats[material].laborCost += labCost;
      stats[material].machineCost += machCost;
      stats[material].profit += revenue - matCost - labCost - machCost;
    });

    return Object.values(stats).sort((a, b) => b.profit - a.profit);
  }, [filteredOrders]);

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-800 rounded-lg"></div>)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              📊 Financial Reports
            </h2>
            <p className="text-sm text-zinc-400 mt-1">
              Real numbers from actual orders and purchases
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-zinc-200 text-sm"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last year</option>
            </select>
            <button
              onClick={fetchAllData}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-zinc-300 hover:bg-gray-700"
            >
              🔄
            </button>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="flex gap-2 mt-4 border-t border-gray-800 pt-4">
          {[
            { id: 'summary', label: '📈 Summary', icon: '📈' },
            { id: 'orders', label: '📦 Orders', icon: '📦' },
            { id: 'materials', label: '🧵 Materials', icon: '🧵' },
            { id: 'profit', label: '💰 Profit Analysis', icon: '💰' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                viewMode === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-zinc-400 hover:bg-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* SUMMARY VIEW */}
      {viewMode === 'summary' && (
        <>
          {/* Key Metrics - ACTUAL DATA */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Revenue (Delivered)"
              value={`€${financials.totalRevenue.toFixed(2)}`}
              subtext={`${financials.deliveredCount} orders`}
              color="green"
              icon="💵"
            />
            <MetricCard
              label="Total Costs"
              value={`€${financials.totalCost.toFixed(2)}`}
              subtext="Material + Labor + Machine"
              color="red"
              icon="📉"
            />
            <MetricCard
              label="Gross Profit"
              value={`€${financials.grossProfit.toFixed(2)}`}
              subtext={`${financials.profitMargin.toFixed(1)}% margin`}
              color="purple"
              icon="💰"
            />
            <MetricCard
              label="Pending Orders"
              value={`€${financials.pendingRevenue.toFixed(2)}`}
              subtext={`${financials.pendingCount} orders`}
              color="yellow"
              icon="⏳"
            />
          </div>

          {/* Cost Breakdown */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <span>📊</span>
              <span>Cost Breakdown (Actual)</span>
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center">
                <p className="text-sm text-zinc-400">Material Costs</p>
                <p className="text-2xl font-bold text-orange-400">€{financials.totalMaterialCost.toFixed(2)}</p>
                <p className="text-xs text-zinc-500">
                  {financials.totalCost > 0 ? ((financials.totalMaterialCost / financials.totalCost) * 100).toFixed(0) : 0}% of costs
                </p>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center">
                <p className="text-sm text-zinc-400">Labor Costs</p>
                <p className="text-2xl font-bold text-blue-400">€{financials.totalLaborCost.toFixed(2)}</p>
                <p className="text-xs text-zinc-500">
                  {financials.totalCost > 0 ? ((financials.totalLaborCost / financials.totalCost) * 100).toFixed(0) : 0}% of costs
                </p>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center">
                <p className="text-sm text-zinc-400">Machine Costs</p>
                <p className="text-2xl font-bold text-purple-400">€{financials.totalMachineCost.toFixed(2)}</p>
                <p className="text-xs text-zinc-500">
                  {financials.totalCost > 0 ? ((financials.totalMachineCost / financials.totalCost) * 100).toFixed(0) : 0}% of costs
                </p>
              </div>
            </div>
          </div>

          {/* Payment Status */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <span>💳</span>
              <span>Payment Status</span>
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4">
                <p className="text-sm text-green-400">Paid</p>
                <p className="text-2xl font-bold text-green-400">€{financials.paidRevenue.toFixed(2)}</p>
              </div>
              <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
                <p className="text-sm text-yellow-400">Awaiting Payment</p>
                <p className="text-2xl font-bold text-yellow-400">€{financials.unpaidRevenue.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ORDERS VIEW */}
      {viewMode === 'orders' && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="font-bold text-white mb-4">📦 Order Details ({filteredOrders.length} orders)</h3>
          
          {filteredOrders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-4xl mb-2">📭</p>
              <p className="text-zinc-400">No orders in selected period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="px-3 py-2 text-left text-zinc-400">Order ID</th>
                    <th className="px-3 py-2 text-left text-zinc-400">Client</th>
                    <th className="px-3 py-2 text-left text-zinc-400">Status</th>
                    <th className="px-3 py-2 text-right text-zinc-400">Sold Price</th>
                    <th className="px-3 py-2 text-right text-zinc-400">Mat. Cost</th>
                    <th className="px-3 py-2 text-right text-zinc-400">Total Cost</th>
                    <th className="px-3 py-2 text-right text-zinc-400">Profit</th>
                    <th className="px-3 py-2 text-right text-zinc-400">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredOrders.slice(0, 50).map(order => {
                    const quote = order.quote || {};
                    const qty = order.quantity || 1;
                    const revenue = quote.total || 0;
                    const matCost = (quote.material_cost || 0) * qty;
                    const labCost = (quote.labor_cost || 0) * qty;
                    const machCost = (quote.machine_cost || 0) * qty;
                    const totalCost = matCost + labCost + machCost;
                    const profit = revenue - totalCost;
                    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

                    return (
                      <tr key={order.order_id} className="hover:bg-gray-800/50">
                        <td className="px-3 py-2 font-mono text-xs text-zinc-300">{order.order_id}</td>
                        <td className="px-3 py-2 text-white">{order.client_name || 'Walk-in'}</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-green-400">€{revenue.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-mono text-orange-400">€{matCost.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-mono text-red-400">€{totalCost.toFixed(2)}</td>
                        <td className={`px-3 py-2 text-right font-mono font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          €{profit.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            margin >= 40 ? 'bg-green-900/50 text-green-400' :
                            margin >= 20 ? 'bg-yellow-900/50 text-yellow-400' :
                            'bg-red-900/50 text-red-400'
                          }`}>
                            {margin.toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredOrders.length > 50 && (
                <p className="text-zinc-500 text-sm mt-4 text-center">
                  Showing 50 of {filteredOrders.length} orders
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* MATERIALS VIEW */}
      {viewMode === 'materials' && (
        <div className="space-y-6">
          {/* Material Inventory Value */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Inventory Value"
              value={`€${materialStats.totalPurchaseValue.toFixed(2)}`}
              subtext="Total purchase cost"
              color="blue"
              icon="📦"
            />
            <MetricCard
              label="Total Spools"
              value={materialStats.spoolCount}
              subtext={`${(materialStats.totalWeight / 1000).toFixed(1)} kg remaining`}
              color="purple"
              icon="🧵"
            />
            <MetricCard
              label="Avg Cost/kg"
              value={`€${materialStats.avgCostPerKg.toFixed(2)}`}
              subtext="Across all materials"
              color="orange"
              icon="📊"
            />
            <MetricCard
              label="Material Types"
              value={Object.keys(materialStats.byType).length}
              subtext="Different types"
              color="green"
              icon="🎨"
            />
          </div>

          {/* Materials by Type */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h3 className="font-bold text-white mb-4">🧵 Inventory by Material Type</h3>
            
            {Object.keys(materialStats.byType).length === 0 ? (
              <div className="text-center py-8">
                <p className="text-4xl mb-2">📭</p>
                <p className="text-zinc-400">No materials in inventory</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="px-4 py-2 text-left text-zinc-400">Material</th>
                      <th className="px-4 py-2 text-right text-zinc-400">Spools</th>
                      <th className="px-4 py-2 text-right text-zinc-400">Remaining</th>
                      <th className="px-4 py-2 text-right text-zinc-400">Purchase Value</th>
                      <th className="px-4 py-2 text-right text-zinc-400">Avg €/kg</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {Object.entries(materialStats.byType).map(([type, data]) => (
                      <tr key={type} className="hover:bg-gray-800/50">
                        <td className="px-4 py-3 font-medium text-white">
                          <span className="flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-full ${
                              type === 'PLA' ? 'bg-green-500' :
                              type === 'PETG' ? 'bg-blue-500' :
                              type === 'ABS' ? 'bg-orange-500' :
                              type === 'TPU' ? 'bg-purple-500' :
                              'bg-gray-400'
                            }`} />
                            {type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-300">{data.count}</td>
                        <td className="px-4 py-3 text-right text-zinc-300">{(data.totalWeight / 1000).toFixed(2)} kg</td>
                        <td className="px-4 py-3 text-right font-mono text-blue-400">€{data.totalCost.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-mono text-zinc-300">
                          €{data.totalWeight > 0 ? (data.totalCost / (data.totalWeight / 1000)).toFixed(2) : '0.00'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PROFIT ANALYSIS VIEW */}
      {viewMode === 'profit' && (
        <div className="space-y-6">
          {/* Profit by Material */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h3 className="font-bold text-white mb-4">💰 Profit by Material Type</h3>
            
            {profitByMaterial.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-4xl mb-2">📊</p>
                <p className="text-zinc-400">No delivered orders to analyze</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="px-4 py-2 text-left text-zinc-400">Material</th>
                      <th className="px-4 py-2 text-right text-zinc-400">Orders</th>
                      <th className="px-4 py-2 text-right text-zinc-400">Revenue</th>
                      <th className="px-4 py-2 text-right text-zinc-400">Material Cost</th>
                      <th className="px-4 py-2 text-right text-zinc-400">Labor Cost</th>
                      <th className="px-4 py-2 text-right text-zinc-400">Machine Cost</th>
                      <th className="px-4 py-2 text-right text-zinc-400">Profit</th>
                      <th className="px-4 py-2 text-right text-zinc-400">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {profitByMaterial.map(row => {
                      const totalCost = row.materialCost + row.laborCost + row.machineCost;
                      const margin = row.revenue > 0 ? (row.profit / row.revenue) * 100 : 0;

                      return (
                        <tr key={row.material} className="hover:bg-gray-800/50">
                          <td className="px-4 py-3 font-medium text-white">{row.material}</td>
                          <td className="px-4 py-3 text-right text-zinc-300">{row.orders}</td>
                          <td className="px-4 py-3 text-right font-mono text-green-400">€{row.revenue.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-mono text-orange-400">€{row.materialCost.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-mono text-blue-400">€{row.laborCost.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-mono text-purple-400">€{row.machineCost.toFixed(2)}</td>
                          <td className={`px-4 py-3 text-right font-mono font-bold ${row.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            €{row.profit.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                              margin >= 40 ? 'bg-green-900/50 text-green-400 border border-green-700/50' :
                              margin >= 20 ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-700/50' :
                              'bg-red-900/50 text-red-400 border border-red-700/50'
                            }`}>
                              {margin.toFixed(0)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-600 bg-gray-800/30">
                    <tr className="font-bold">
                      <td className="px-4 py-3 text-white">TOTAL</td>
                      <td className="px-4 py-3 text-right text-zinc-300">
                        {profitByMaterial.reduce((s, r) => s + r.orders, 0)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-green-400">
                        €{profitByMaterial.reduce((s, r) => s + r.revenue, 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-orange-400">
                        €{profitByMaterial.reduce((s, r) => s + r.materialCost, 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-blue-400">
                        €{profitByMaterial.reduce((s, r) => s + r.laborCost, 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-purple-400">
                        €{profitByMaterial.reduce((s, r) => s + r.machineCost, 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-green-400">
                        €{profitByMaterial.reduce((s, r) => s + r.profit, 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="px-2 py-0.5 bg-purple-900/50 text-purple-400 rounded text-xs border border-purple-700/50">
                          {financials.profitMargin.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Insights */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h3 className="font-bold text-white mb-4">💡 Insights</h3>
            <div className="space-y-3">
              {profitByMaterial.length > 0 && (
                <>
                  <InsightCard
                    icon="🏆"
                    title="Most Profitable Material"
                    value={profitByMaterial[0].material}
                    detail={`€${profitByMaterial[0].profit.toFixed(2)} profit from ${profitByMaterial[0].orders} orders`}
                    type="success"
                  />
                  {profitByMaterial.length > 1 && profitByMaterial[profitByMaterial.length - 1].profit < profitByMaterial[0].profit * 0.5 && (
                    <InsightCard
                      icon="⚠️"
                      title="Low Performer"
                      value={profitByMaterial[profitByMaterial.length - 1].material}
                      detail={`Only €${profitByMaterial[profitByMaterial.length - 1].profit.toFixed(2)} profit - consider adjusting pricing`}
                      type="warning"
                    />
                  )}
                </>
              )}
              <InsightCard
                icon="📊"
                title="Average Order Value"
                value={`€${financials.avgOrderValue.toFixed(2)}`}
                detail={`Based on ${financials.deliveredCount} delivered orders`}
                type="info"
              />
              {financials.unpaidRevenue > 0 && (
                <InsightCard
                  icon="💳"
                  title="Outstanding Payments"
                  value={`€${financials.unpaidRevenue.toFixed(2)}`}
                  detail="Awaiting payment from delivered orders"
                  type="warning"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper Components
function MetricCard({ label, value, subtext, color, icon }) {
  const colorStyles = {
    green: { bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.3)', text: 'text-green-400' },
    blue: { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)', text: 'text-blue-400' },
    purple: { bg: 'rgba(168, 85, 247, 0.1)', border: 'rgba(168, 85, 247, 0.3)', text: 'text-purple-400' },
    orange: { bg: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.3)', text: 'text-orange-400' },
    yellow: { bg: 'rgba(234, 179, 8, 0.1)', border: 'rgba(234, 179, 8, 0.3)', text: 'text-yellow-400' },
    red: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', text: 'text-red-400' },
  };

  const style = colorStyles[color] || colorStyles.blue;

  return (
    <div
      className="p-4 rounded-lg border"
      style={{ background: `linear-gradient(135deg, ${style.bg} 0%, ${style.bg} 100%)`, borderColor: style.border }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span>{icon}</span>
        <p className="text-sm text-zinc-400">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${style.text}`}>{value}</p>
      {subtext && <p className="text-xs text-zinc-500 mt-1">{subtext}</p>}
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    delivered: 'bg-green-900/50 text-green-400 border-green-700/50',
    printing: 'bg-blue-900/50 text-blue-400 border-blue-700/50',
    queued: 'bg-yellow-900/50 text-yellow-400 border-yellow-700/50',
    cancelled: 'bg-red-900/50 text-red-400 border-red-700/50',
    quoted: 'bg-gray-700 text-zinc-300 border-gray-600',
    accepted: 'bg-purple-900/50 text-purple-400 border-purple-700/50',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs border ${styles[status] || styles.quoted}`}>
      {status}
    </span>
  );
}

function InsightCard({ icon, title, value, detail, type }) {
  const styles = {
    success: 'bg-green-900/20 border-green-700/50',
    warning: 'bg-yellow-900/20 border-yellow-700/50',
    info: 'bg-blue-900/20 border-blue-700/50',
    error: 'bg-red-900/20 border-red-700/50',
  };

  return (
    <div className={`p-4 rounded-lg border ${styles[type] || styles.info}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-sm text-zinc-400">{title}</p>
          <p className="font-bold text-white">{value}</p>
          <p className="text-xs text-zinc-500 mt-1">{detail}</p>
        </div>
      </div>
    </div>
  );
}

export default FinancialReports;
