import React, { useState, useEffect, useMemo } from 'react';
import { api, unwrap } from '../services/api';

/**
 * Cost Analysis Dashboard - Material Pricing Focus
 * Uses ACTUAL purchase prices from inventory
 */
function CostDashboard() {
  const [materials, setMaterials] = useState([]);
  const [pricingConfig, setPricingConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [materialsRes, pricingRes] = await Promise.all([
        api.getMaterialInventory({ active_only: true }).catch(() => ({ spools: [] })),
        api.getPricingConfig().catch(() => null),
      ]);

      const spools = unwrap(materialsRes)?.spools || [];
      setMaterials(Array.isArray(spools) ? spools : []);
      
      const pricing = unwrap(pricingRes);
      setPricingConfig(pricing);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate material costs from ACTUAL purchase prices
  const materialStats = useMemo(() => {
    const byType = {};

    materials.forEach(spool => {
      const type = spool.material_type || 'Unknown';
      const purchasePrice = spool.purchase_price || 0;
      const totalWeight = spool.weight_g || 1000;
      const remainingWeight = spool.remaining_g || totalWeight;

      if (!byType[type]) {
        byType[type] = {
          type,
          spoolCount: 0,
          totalPurchaseCost: 0,
          totalWeight: 0,
          remainingWeight: 0,
          avgPurchasePrice: 0,
          avgCostPerKg: 0,
        };
      }

      byType[type].spoolCount++;
      byType[type].totalPurchaseCost += purchasePrice;
      byType[type].totalWeight += totalWeight;
      byType[type].remainingWeight += remainingWeight;
    });

    // Calculate averages
    Object.values(byType).forEach(mat => {
      mat.avgPurchasePrice = mat.spoolCount > 0 ? mat.totalPurchaseCost / mat.spoolCount : 0;
      mat.avgCostPerKg = mat.totalWeight > 0 ? (mat.totalPurchaseCost / (mat.totalWeight / 1000)) : 0;
    });

    return byType;
  }, [materials]);

  // Totals
  const totals = useMemo(() => {
    const stats = Object.values(materialStats);
    return {
      spoolCount: stats.reduce((sum, m) => sum + m.spoolCount, 0),
      totalPurchaseCost: stats.reduce((sum, m) => sum + m.totalPurchaseCost, 0),
      totalWeight: stats.reduce((sum, m) => sum + m.totalWeight, 0),
      remainingWeight: stats.reduce((sum, m) => sum + m.remainingWeight, 0),
    };
  }, [materialStats]);

  const avgCostPerKg = totals.totalWeight > 0 
    ? (totals.totalPurchaseCost / (totals.totalWeight / 1000)) 
    : 0;

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
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              📊 Cost Analysis
            </h2>
            <p className="text-sm text-zinc-400 mt-1">Material purchase costs and inventory value</p>
          </div>
          <button
            onClick={fetchData}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-zinc-300 hover:bg-gray-700"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div 
            className="p-4 rounded-lg border"
            style={{ 
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)',
              borderColor: 'rgba(59, 130, 246, 0.3)'
            }}
          >
            <p className="text-sm text-zinc-400">Inventory Value</p>
            <p className="text-2xl font-bold text-blue-400">€{totals.totalPurchaseCost.toFixed(2)}</p>
            <p className="text-xs text-zinc-500 mt-1">Total purchase cost</p>
          </div>
          
          <div 
            className="p-4 rounded-lg border"
            style={{ 
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(168, 85, 247, 0.05) 100%)',
              borderColor: 'rgba(168, 85, 247, 0.3)'
            }}
          >
            <p className="text-sm text-zinc-400">Spools in Stock</p>
            <p className="text-2xl font-bold text-purple-400">{totals.spoolCount}</p>
            <p className="text-xs text-zinc-500 mt-1">{Object.keys(materialStats).length} material types</p>
          </div>
          
          <div 
            className="p-4 rounded-lg border"
            style={{ 
              background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.1) 0%, rgba(249, 115, 22, 0.05) 100%)',
              borderColor: 'rgba(249, 115, 22, 0.3)'
            }}
          >
            <p className="text-sm text-zinc-400">Remaining Material</p>
            <p className="text-2xl font-bold text-orange-400">{(totals.remainingWeight / 1000).toFixed(1)} kg</p>
            <p className="text-xs text-zinc-500 mt-1">of {(totals.totalWeight / 1000).toFixed(1)} kg total</p>
          </div>
          
          <div 
            className="p-4 rounded-lg border"
            style={{ 
              background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)',
              borderColor: 'rgba(34, 197, 94, 0.3)'
            }}
          >
            <p className="text-sm text-zinc-400">Avg Cost per kg</p>
            <p className="text-2xl font-bold text-green-400">€{avgCostPerKg.toFixed(2)}</p>
            <p className="text-xs text-zinc-500 mt-1">Across all materials</p>
          </div>
        </div>
      </div>

      {/* Pricing Config Info */}
      {pricingConfig && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2">
            <span>⚙️</span>
            <span>Current Pricing Settings</span>
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
              <p className="text-xs text-zinc-400">Labor Rate</p>
              <p className="text-lg font-bold text-white">€{pricingConfig.labor_hourly_rate || 0}/hr</p>
            </div>
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
              <p className="text-xs text-zinc-400">Machine Rate</p>
              <p className="text-lg font-bold text-white">€{pricingConfig.machine_hourly_rate || 0}/hr</p>
            </div>
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
              <p className="text-xs text-zinc-400">Profit Margin</p>
              <p className="text-lg font-bold text-white">{((pricingConfig.default_profit_margin || 0) * 100).toFixed(0)}%</p>
            </div>
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
              <p className="text-xs text-zinc-400">Tax Rate (VAT)</p>
              <p className="text-lg font-bold text-white">{((pricingConfig.tax_rate || 0) * 100).toFixed(0)}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Material Costs Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
          <span>🧵</span>
          <span>Material Costs (Actual Purchase Prices)</span>
        </h3>
        
        {Object.keys(materialStats).length === 0 ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-2">📦</p>
            <p className="text-zinc-400">No materials in inventory</p>
            <p className="text-sm text-zinc-500">Add spools in Inventory tab to track costs</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="px-4 py-3 text-left text-zinc-400 font-medium">Material</th>
                  <th className="px-4 py-3 text-right text-zinc-400 font-medium">Spools</th>
                  <th className="px-4 py-3 text-right text-zinc-400 font-medium">Remaining</th>
                  <th className="px-4 py-3 text-right text-zinc-400 font-medium">Total Purchased</th>
                  <th className="px-4 py-3 text-right text-zinc-400 font-medium">Avg Spool Price</th>
                  <th className="px-4 py-3 text-right text-zinc-400 font-medium">Cost per kg</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {Object.values(materialStats)
                  .sort((a, b) => b.totalPurchaseCost - a.totalPurchaseCost)
                  .map(mat => (
                    <tr key={mat.type} className="hover:bg-gray-800/50">
                      <td className="px-4 py-3 font-medium text-white">
                        <span className="inline-flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${
                            mat.type === 'PLA' ? 'bg-green-500' :
                            mat.type === 'PETG' ? 'bg-blue-500' :
                            mat.type === 'ABS' ? 'bg-orange-500' :
                            mat.type === 'TPU' ? 'bg-purple-500' :
                            mat.type === 'ASA' ? 'bg-yellow-500' :
                            mat.type === 'Nylon' ? 'bg-cyan-500' :
                            'bg-gray-400'
                          }`} />
                          {mat.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-300">{mat.spoolCount}</td>
                      <td className="px-4 py-3 text-right text-zinc-300">{(mat.remainingWeight / 1000).toFixed(2)} kg</td>
                      <td className="px-4 py-3 text-right font-mono text-blue-400 font-bold">
                        €{mat.totalPurchaseCost.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-300">
                        €{mat.avgPurchasePrice.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-green-400">
                        €{mat.avgCostPerKg.toFixed(2)}
                      </td>
                    </tr>
                  ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-700 bg-gray-800/30">
                <tr className="font-bold">
                  <td className="px-4 py-3 text-white">TOTAL</td>
                  <td className="px-4 py-3 text-right text-zinc-300">{totals.spoolCount}</td>
                  <td className="px-4 py-3 text-right text-zinc-300">{(totals.remainingWeight / 1000).toFixed(2)} kg</td>
                  <td className="px-4 py-3 text-right font-mono text-blue-400">
                    €{totals.totalPurchaseCost.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-500">-</td>
                  <td className="px-4 py-3 text-right font-mono text-green-400">
                    €{avgCostPerKg.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Individual Spools Detail */}
      {materials.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2">
            <span>📋</span>
            <span>Individual Spool Details</span>
          </h3>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-900">
                <tr className="border-b border-gray-700">
                  <th className="px-3 py-2 text-left text-zinc-400">Brand / Name</th>
                  <th className="px-3 py-2 text-left text-zinc-400">Type</th>
                  <th className="px-3 py-2 text-left text-zinc-400">Color</th>
                  <th className="px-3 py-2 text-right text-zinc-400">Weight</th>
                  <th className="px-3 py-2 text-right text-zinc-400">Remaining</th>
                  <th className="px-3 py-2 text-right text-zinc-400">Purchase Price</th>
                  <th className="px-3 py-2 text-right text-zinc-400">€/kg</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {materials.slice(0, 50).map((spool, idx) => {
                  const weight = spool.weight_g || 1000;
                  const remaining = spool.remaining_g || weight;
                  const purchasePrice = spool.purchase_price || 0;
                  const costPerKg = weight > 0 ? (purchasePrice / (weight / 1000)) : 0;
                  const usedPercent = weight > 0 ? ((weight - remaining) / weight) * 100 : 0;

                  return (
                    <tr key={spool.spool_id || idx} className="hover:bg-gray-800/50">
                      <td className="px-3 py-2 text-white">
                        {spool.brand || spool.name || 'Unknown'}
                      </td>
                      <td className="px-3 py-2 text-zinc-300">{spool.material_type || '-'}</td>
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-2">
                          <span 
                            className="w-4 h-4 rounded-full border border-gray-600"
                            style={{ backgroundColor: spool.color_hex || '#888' }}
                          />
                          <span className="text-zinc-300">{spool.color || '-'}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-300">{(weight / 1000).toFixed(2)} kg</td>
                      <td className="px-3 py-2 text-right">
                        <span className="flex items-center justify-end gap-2">
                          <span className="text-zinc-300">{(remaining / 1000).toFixed(2)} kg</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            usedPercent > 80 ? 'bg-red-900/50 text-red-400' :
                            usedPercent > 50 ? 'bg-yellow-900/50 text-yellow-400' :
                            'bg-green-900/50 text-green-400'
                          }`}>
                            {(100 - usedPercent).toFixed(0)}%
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-blue-400">
                        €{purchasePrice.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-400">
                        €{costPerKg.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {materials.length > 50 && (
              <p className="text-center text-zinc-500 text-sm py-2">
                Showing 50 of {materials.length} spools
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tip */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
        <p className="text-sm text-zinc-400">
          💡 <strong className="text-white">Tip:</strong> All costs shown are from actual purchase prices entered when adding spools. 
          For accurate profit tracking, make sure to enter the correct purchase price for each spool in the Inventory tab.
        </p>
      </div>
    </div>
  );
}

export default CostDashboard;
