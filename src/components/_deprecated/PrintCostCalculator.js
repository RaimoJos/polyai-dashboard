import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

/**
 * Print Cost Calculator - Breakdown costs per print
 * This is an internal tool for understanding your own operating costs.
 */
function PrintCostCalculator() {
  const [formData, setFormData] = useState({
    material_type: 'PLA',
    material_weight_g: 50,
    print_time_hours: 2,
    printer_wattage: 200,
    electricity_rate: 0.15, // €/kWh
    failure_rate: 5, // %
  });

  const [costs, setCosts] = useState(null);
  const [pricingConfig, setPricingConfig] = useState(null);

  useEffect(() => {
    // Load pricing config from backend
    api.getPricingConfig()
      .then(res => {
        // Handle both direct response and wrapped response
        const cfg = res?.data || res;
        setPricingConfig(cfg);
      })
      .catch(() => {
        // Use defaults if backend unavailable
        setPricingConfig({
          material_costs: {
            PLA: 18, PETG: 22, ABS: 20, TPU: 32, Nylon: 38
          },
          labor_hourly_rate: 8
        });
      });
  }, []);

  useEffect(() => {
    calculateCosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, pricingConfig]);

  const calculateCosts = () => {
    // Get material prices from config (handle multiple field names for compatibility)
    const materialPrices = pricingConfig?.material_costs || pricingConfig?.materials || {
      PLA: 18,
      PETG: 22,
      ABS: 20,
      TPU: 32,
      Nylon: 38,
    };

    const {
      material_type,
      material_weight_g,
      print_time_hours,
      printer_wattage,
      electricity_rate,
      failure_rate
    } = formData;

    // Material cost
    const pricePerKg = materialPrices[material_type] || 18;
    const materialCost = (material_weight_g / 1000) * pricePerKg;

    // Electricity cost
    const kWh = (printer_wattage / 1000) * print_time_hours;
    const electricityCost = kWh * electricity_rate;

    // Machine depreciation (rough estimate: €1000 printer, 2000 print hours life)
    const depreciationRate = 0.5; // €/hour
    const depreciationCost = print_time_hours * depreciationRate;

    // Wear & tear (nozzle, belts, etc) - ~€0.10/hour
    const wearCost = print_time_hours * 0.10;

    // Labor (setup, monitoring, post-processing) - estimate 10min per print @ config rate
    const laborMinutes = 10 + (print_time_hours * 2); // More time for longer prints
    const laborRate = pricingConfig?.labor_hourly_rate || pricingConfig?.labor_rate_per_hour || 8;
    const laborCost = (laborMinutes / 60) * laborRate;

    // Failure adjustment
    const failureMultiplier = 1 + (failure_rate / 100);

    // Totals
    const directCosts = materialCost + electricityCost;
    const indirectCosts = depreciationCost + wearCost;
    const totalCost = (directCosts + indirectCosts) * failureMultiplier;
    const totalWithLabor = totalCost + laborCost;

    // Suggested prices at different margins
    const margins = [30, 50, 100];
    const suggestedPrices = margins.map(margin => ({
      margin,
      price: totalWithLabor * (1 + margin / 100),
      profit: totalWithLabor * (margin / 100)
    }));

    setCosts({
      material: materialCost,
      electricity: electricityCost,
      depreciation: depreciationCost,
      wear: wearCost,
      labor: laborCost,
      directTotal: directCosts,
      indirectTotal: indirectCosts,
      subtotal: totalCost,
      total: totalWithLabor,
      failureAdjustment: (directCosts + indirectCosts) * (failure_rate / 100),
      suggestedPrices,
      breakdown: {
        materialPct: (materialCost / totalWithLabor) * 100,
        electricityPct: (electricityCost / totalWithLabor) * 100,
        laborPct: (laborCost / totalWithLabor) * 100,
        overheadPct: ((depreciationCost + wearCost) / totalWithLabor) * 100,
      }
    });
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: parseFloat(value) || value }));
  };

  // Get available materials from config
  const availableMaterials = Object.keys(
    pricingConfig?.material_costs || pricingConfig?.materials || { PLA: 18, PETG: 22, ABS: 20, TPU: 32, Nylon: 38 }
  );

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <h2 className="text-xl font-bold mb-6 text-white">💰 Print Cost Calculator</h2>
      <p className="text-sm text-zinc-500 mb-6">Calculate your operating costs per print (internal use)</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Form */}
        <div className="space-y-4">
          <h3 className="font-medium text-zinc-300">Print Parameters</h3>
          
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Material Type</label>
            <select
              value={formData.material_type}
              onChange={(e) => handleChange('material_type', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
            >
              {availableMaterials.map(mat => (
                <option key={mat} value={mat}>{mat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Material Weight (g)</label>
            <input
              type="number"
              value={formData.material_weight_g}
              onChange={(e) => handleChange('material_weight_g', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
              min="1"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Print Time (hours)</label>
            <input
              type="number"
              value={formData.print_time_hours}
              onChange={(e) => handleChange('print_time_hours', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
              min="0.1"
              step="0.5"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Printer Wattage (W)</label>
            <input
              type="number"
              value={formData.printer_wattage}
              onChange={(e) => handleChange('printer_wattage', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
              min="50"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Electricity Rate (€/kWh)</label>
            <input
              type="number"
              value={formData.electricity_rate}
              onChange={(e) => handleChange('electricity_rate', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
              min="0.01"
              step="0.01"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Expected Failure Rate (%)</label>
            <input
              type="number"
              value={formData.failure_rate}
              onChange={(e) => handleChange('failure_rate', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
              min="0"
              max="50"
            />
          </div>
        </div>

        {/* Cost Breakdown */}
        {costs && (
          <div className="space-y-4">
            <h3 className="font-medium text-zinc-300">Cost Breakdown</h3>

            {/* Direct Costs */}
            <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4">
              <h4 className="font-medium text-blue-300 mb-2">Direct Costs</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-zinc-300">
                  <span>🧵 Material ({formData.material_type})</span>
                  <span className="font-mono">€{costs.material.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span>⚡ Electricity</span>
                  <span className="font-mono">€{costs.electricity.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-medium border-t border-blue-800/50 pt-2 mt-2 text-blue-300">
                  <span>Subtotal</span>
                  <span className="font-mono">€{costs.directTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Indirect Costs */}
            <div className="bg-orange-900/20 border border-orange-800/50 rounded-lg p-4">
              <h4 className="font-medium text-orange-300 mb-2">Indirect Costs</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-zinc-300">
                  <span>🔧 Machine Depreciation</span>
                  <span className="font-mono">€{costs.depreciation.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span>⚙️ Wear & Tear</span>
                  <span className="font-mono">€{costs.wear.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span>👷 Labor</span>
                  <span className="font-mono">€{costs.labor.toFixed(2)}</span>
                </div>
                {costs.failureAdjustment > 0 && (
                  <div className="flex justify-between text-red-400">
                    <span>⚠️ Failure Buffer ({formData.failure_rate}%)</span>
                    <span className="font-mono">€{costs.failureAdjustment.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Total */}
            <div 
              className="rounded-lg p-4 border"
              style={{ 
                background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)',
                borderColor: 'rgba(34, 197, 94, 0.3)'
              }}
            >
              <div className="flex justify-between text-lg font-bold text-green-400">
                <span>Total Cost</span>
                <span className="font-mono">€{costs.total.toFixed(2)}</span>
              </div>
            </div>

            {/* Cost Distribution Bar */}
            <div>
              <h4 className="text-sm text-zinc-400 mb-2">Cost Distribution</h4>
              <div className="h-6 rounded-full overflow-hidden flex bg-gray-800">
                <div 
                  className="bg-blue-500" 
                  style={{ width: `${costs.breakdown.materialPct}%` }}
                  title={`Material: ${costs.breakdown.materialPct.toFixed(1)}%`}
                />
                <div 
                  className="bg-yellow-500" 
                  style={{ width: `${costs.breakdown.electricityPct}%` }}
                  title={`Electricity: ${costs.breakdown.electricityPct.toFixed(1)}%`}
                />
                <div 
                  className="bg-purple-500" 
                  style={{ width: `${costs.breakdown.laborPct}%` }}
                  title={`Labor: ${costs.breakdown.laborPct.toFixed(1)}%`}
                />
                <div 
                  className="bg-gray-500" 
                  style={{ width: `${costs.breakdown.overheadPct}%` }}
                  title={`Overhead: ${costs.breakdown.overheadPct.toFixed(1)}%`}
                />
              </div>
              <div className="flex text-xs text-zinc-500 mt-1 gap-4">
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded-full"></span> Material</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-500 rounded-full"></span> Energy</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-purple-500 rounded-full"></span> Labor</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-gray-500 rounded-full"></span> Overhead</span>
              </div>
            </div>

            {/* Suggested Prices */}
            <div>
              <h4 className="text-sm text-zinc-400 mb-2">Suggested Selling Prices</h4>
              <div className="grid grid-cols-3 gap-2">
                {costs.suggestedPrices.map(({ margin, price, profit }) => (
                  <div key={margin} className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-center">
                    <p className="text-xs text-zinc-500">{margin}% margin</p>
                    <p className="text-lg font-bold text-green-400">€{price.toFixed(2)}</p>
                    <p className="text-xs text-zinc-500">+€{profit.toFixed(2)} profit</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PrintCostCalculator;
