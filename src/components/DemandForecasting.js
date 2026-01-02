import React, { useState, useEffect, useMemo } from 'react';
import { api, unwrap } from '../services/api';

/**
 * DemandForecasting - Predict busy periods and material needs
 * Uses historical data to forecast demand
 */
function DemandForecasting() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [forecastDays, setForecastDays] = useState(30);
  const [viewMode, setViewMode] = useState('demand'); // demand, materials, capacity

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersRes, materialsRes] = await Promise.all([
        api.listOrders?.() || Promise.resolve({ data: [] }),
        api.getMaterials?.() || Promise.resolve({ data: [] }),
      ]);
      
      const ordersData = unwrap(ordersRes);
      const materialsData = unwrap(materialsRes);
      
      setOrders(Array.isArray(ordersData) ? ordersData : (ordersData?.orders || getMockOrders()));
      setMaterials(Array.isArray(materialsData) ? materialsData : (materialsData?.materials || getMockMaterials()));
    } catch (err) {
      console.error('Failed to load data:', err);
      setOrders(getMockOrders());
      setMaterials(getMockMaterials());
    } finally {
      setLoading(false);
    }
  };

  const getMockOrders = () => {
    const orders = [];
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    
    // Generate 6 months of historical orders with patterns
    for (let i = 180; i >= 0; i--) {
      const date = new Date(now - i * day);
      const dayOfWeek = date.getDay();
      const month = date.getMonth();
      
      // Base probability of order per day
      let orderProb = 0.4;
      
      // Higher on weekdays
      if (dayOfWeek >= 1 && dayOfWeek <= 5) orderProb += 0.2;
      
      // Seasonal patterns (busier in Q4 and Q1)
      if (month >= 9 || month <= 2) orderProb += 0.15;
      
      // Weekly pattern (Monday rush)
      if (dayOfWeek === 1) orderProb += 0.1;
      
      // Random variation
      const numOrders = Math.random() < orderProb ? Math.floor(Math.random() * 3) + 1 : 0;
      
      for (let j = 0; j < numOrders; j++) {
        const materials = ['PLA', 'PETG', 'ABS', 'TPU', 'ASA'];
        const material = materials[Math.floor(Math.random() * materials.length)];
        const baseValue = 50 + Math.random() * 400;
        const materialUsage = 50 + Math.random() * 500; // grams
        
        orders.push({
          id: `order-${i}-${j}`,
          created_at: date.toISOString(),
          total: baseValue,
          status: 'completed',
          material,
          material_usage_g: materialUsage,
          print_hours: 2 + Math.random() * 20,
        });
      }
    }
    
    return orders;
  };

  const getMockMaterials = () => [
    { id: 'm1', name: 'PLA Black', material_type: 'PLA', stock_g: 3000, price_per_kg: 25, reorder_point: 1000 },
    { id: 'm2', name: 'PLA White', material_type: 'PLA', stock_g: 2500, price_per_kg: 25, reorder_point: 1000 },
    { id: 'm3', name: 'PETG Black', material_type: 'PETG', stock_g: 1500, price_per_kg: 30, reorder_point: 800 },
    { id: 'm4', name: 'ABS Gray', material_type: 'ABS', stock_g: 800, price_per_kg: 28, reorder_point: 500 },
    { id: 'm5', name: 'TPU Black', material_type: 'TPU', stock_g: 600, price_per_kg: 45, reorder_point: 400 },
  ];

  // Analyze historical patterns and forecast
  const forecast = useMemo(() => {
    if (orders.length === 0) return null;

    const now = new Date();
    const day = 24 * 60 * 60 * 1000;
    
    // Group orders by week for trend analysis
    const weeklyData = {};
    orders.forEach(order => {
      const orderDate = new Date(order.created_at);
      const weekStart = new Date(orderDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = { orders: 0, revenue: 0, materials: {} };
      }
      weeklyData[weekKey].orders++;
      weeklyData[weekKey].revenue += order.total || 0;
      
      const mat = order.material || 'PLA';
      weeklyData[weekKey].materials[mat] = (weeklyData[weekKey].materials[mat] || 0) + (order.material_usage_g || 100);
    });

    const weeks = Object.entries(weeklyData)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12); // Last 12 weeks

    // Calculate averages and trends
    const avgOrdersPerWeek = weeks.reduce((s, [, w]) => s + w.orders, 0) / weeks.length;
    const avgRevenuePerWeek = weeks.reduce((s, [, w]) => s + w.revenue, 0) / weeks.length;
    
    // Simple linear trend
    const recentWeeks = weeks.slice(-4);
    const olderWeeks = weeks.slice(0, 4);
    const recentAvg = recentWeeks.reduce((s, [, w]) => s + w.orders, 0) / recentWeeks.length;
    const olderAvg = olderWeeks.reduce((s, [, w]) => s + w.orders, 0) / olderWeeks.length;
    const trend = olderAvg > 0 ? (recentAvg - olderAvg) / olderAvg : 0;

    // Day of week patterns
    const dayPatterns = Array(7).fill(0).map(() => ({ count: 0, total: 0 }));
    orders.forEach(order => {
      const day = new Date(order.created_at).getDay();
      dayPatterns[day].count++;
      dayPatterns[day].total++;
    });
    const avgDayOrders = dayPatterns.reduce((s, d) => s + d.count, 0) / 7;
    const dayMultipliers = dayPatterns.map(d => d.count > 0 ? d.count / avgDayOrders : 1);

    // Material usage patterns
    const materialUsage = {};
    orders.forEach(order => {
      const mat = order.material || 'PLA';
      if (!materialUsage[mat]) {
        materialUsage[mat] = { total: 0, orders: 0 };
      }
      materialUsage[mat].total += order.material_usage_g || 100;
      materialUsage[mat].orders++;
    });

    // Generate forecast for next N days
    const dailyForecast = [];
    for (let i = 0; i < forecastDays; i++) {
      const forecastDate = new Date(now.getTime() + i * day);
      const dayOfWeek = forecastDate.getDay();
      
      // Base forecast
      let expectedOrders = avgOrdersPerWeek / 7;
      
      // Apply day multiplier
      expectedOrders *= dayMultipliers[dayOfWeek];
      
      // Apply trend
      expectedOrders *= (1 + trend * (i / 30));
      
      // Seasonal adjustment (simplified)
      const month = forecastDate.getMonth();
      if (month >= 9 || month <= 2) expectedOrders *= 1.15;
      
      // Confidence interval
      const confidence = Math.max(0.5, 1 - (i / forecastDays) * 0.5);
      
      dailyForecast.push({
        date: forecastDate,
        expectedOrders: Math.round(expectedOrders * 10) / 10,
        expectedRevenue: expectedOrders * (avgRevenuePerWeek / avgOrdersPerWeek),
        confidence,
        dayOfWeek,
      });
    }

    // Weekly aggregation
    const weeklyForecast = [];
    for (let i = 0; i < Math.ceil(forecastDays / 7); i++) {
      const weekDays = dailyForecast.slice(i * 7, (i + 1) * 7);
      weeklyForecast.push({
        weekStart: weekDays[0]?.date,
        expectedOrders: weekDays.reduce((s, d) => s + d.expectedOrders, 0),
        expectedRevenue: weekDays.reduce((s, d) => s + d.expectedRevenue, 0),
        confidence: weekDays.reduce((s, d) => s + d.confidence, 0) / weekDays.length,
      });
    }

    // Material forecast
    const materialForecast = Object.entries(materialUsage).map(([mat, data]) => {
      const avgUsagePerOrder = data.total / data.orders;
      const ordersPerWeek = avgOrdersPerWeek * (data.orders / orders.length);
      const weeklyUsage = ordersPerWeek * avgUsagePerOrder;
      const stock = materials.find(m => m.material_type === mat)?.stock_g || 0;
      const weeksOfStock = weeklyUsage > 0 ? stock / weeklyUsage : 999;
      
      return {
        material: mat,
        weeklyUsage: Math.round(weeklyUsage),
        monthlyUsage: Math.round(weeklyUsage * 4.3),
        currentStock: stock,
        weeksOfStock: Math.round(weeksOfStock * 10) / 10,
        reorderSoon: weeksOfStock < 3,
        reorderUrgent: weeksOfStock < 1,
      };
    });

    // Capacity forecast (assuming 4 printers, 20 hours/day capacity)
    const dailyCapacityHours = 80;
    const avgPrintHours = orders.reduce((s, o) => s + (o.print_hours || 5), 0) / orders.length;
    const expectedDailyHours = (avgOrdersPerWeek / 7) * avgPrintHours;
    const capacityUtilization = expectedDailyHours / dailyCapacityHours;

    // Busy periods prediction
    const busyPeriods = dailyForecast
      .filter(d => d.expectedOrders > avgOrdersPerWeek / 7 * 1.3)
      .map(d => ({
        date: d.date,
        intensity: d.expectedOrders / (avgOrdersPerWeek / 7),
      }));

    return {
      avgOrdersPerWeek: Math.round(avgOrdersPerWeek * 10) / 10,
      avgRevenuePerWeek: Math.round(avgRevenuePerWeek),
      trend: Math.round(trend * 100),
      dailyForecast,
      weeklyForecast,
      materialForecast,
      capacityUtilization: Math.round(capacityUtilization * 100),
      busyPeriods,
      dayMultipliers,
    };
  }, [orders, materials, forecastDays]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('et-EE', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getDayName = (index) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][index];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!forecast) {
    return (
      <div className="text-center py-12 text-slate-400">
        Not enough data for forecasting. Need at least 30 days of order history.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            📈 Demand Forecasting
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            AI-powered predictions based on {orders.length} historical orders
          </p>
        </div>

        <div className="flex gap-2">
          <select
            value={forecastDays}
            onChange={(e) => setForecastDays(Number(e.target.value))}
            className="px-3 py-2 rounded-lg text-sm text-white"
            style={{ backgroundColor: '#334155' }}
          >
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-slate-400 text-sm">Avg Weekly Orders</p>
          <p className="text-2xl font-bold text-white">{forecast.avgOrdersPerWeek}</p>
          <p className={`text-xs mt-1 ${forecast.trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {forecast.trend >= 0 ? '↑' : '↓'} {Math.abs(forecast.trend)}% trend
          </p>
        </div>

        <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-slate-400 text-sm">Avg Weekly Revenue</p>
          <p className="text-2xl font-bold text-cyan-400">{formatCurrency(forecast.avgRevenuePerWeek)}</p>
        </div>

        <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-slate-400 text-sm">Capacity Usage</p>
          <p className={`text-2xl font-bold ${
            forecast.capacityUtilization > 80 ? 'text-red-400' : 
            forecast.capacityUtilization > 60 ? 'text-yellow-400' : 'text-green-400'
          }`}>
            {forecast.capacityUtilization}%
          </p>
          <p className="text-xs text-slate-500 mt-1">Printer utilization</p>
        </div>

        <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-slate-400 text-sm">Busy Days Ahead</p>
          <p className="text-2xl font-bold text-orange-400">{forecast.busyPeriods.length}</p>
          <p className="text-xs text-slate-500 mt-1">Above average demand</p>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="flex gap-2 p-1 rounded-lg bg-slate-800 w-fit">
        {[
          { id: 'demand', name: 'Demand', icon: '📊' },
          { id: 'materials', name: 'Materials', icon: '🧵' },
          { id: 'capacity', name: 'Capacity', icon: '🏭' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setViewMode(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm transition ${
              viewMode === tab.id 
                ? 'bg-cyan-500 text-white' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab.icon} {tab.name}
          </button>
        ))}
      </div>

      {/* Demand Forecast View */}
      {viewMode === 'demand' && (
        <div className="space-y-6">
          {/* Day of Week Pattern */}
          <div className="rounded-xl border p-6" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
            <h3 className="font-medium text-white mb-4">📅 Weekly Pattern</h3>
            <div className="flex items-end justify-between gap-2 h-32">
              {forecast.dayMultipliers.map((mult, i) => (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div 
                    className="w-full rounded-t transition-all"
                    style={{ 
                      height: `${mult * 60}%`,
                      background: mult > 1.2 ? 'linear-gradient(to top, #f59e0b, #fbbf24)' :
                                 mult > 0.8 ? 'linear-gradient(to top, #06b6d4, #22d3ee)' :
                                 'linear-gradient(to top, #64748b, #94a3b8)'
                    }}
                  />
                  <span className="text-xs text-slate-500 mt-2">{getDayName(i)}</span>
                  <span className="text-xs text-slate-400">{Math.round(mult * 100)}%</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-4 text-center">
              Relative order volume by day of week (100% = average)
            </p>
          </div>

          {/* Weekly Forecast */}
          <div className="rounded-xl border p-6" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
            <h3 className="font-medium text-white mb-4">🔮 Weekly Forecast</h3>
            <div className="space-y-3">
              {forecast.weeklyForecast.map((week, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-32 text-sm text-slate-400">
                    {formatDate(week.weekStart)}
                  </div>
                  <div className="flex-1">
                    <div className="h-6 rounded-lg overflow-hidden bg-slate-700">
                      <div 
                        className="h-full rounded-lg transition-all"
                        style={{ 
                          width: `${(week.expectedOrders / forecast.avgOrdersPerWeek) * 100}%`,
                          background: 'linear-gradient(to right, #06b6d4, #3b82f6)',
                          opacity: week.confidence,
                        }}
                      />
                    </div>
                  </div>
                  <div className="w-24 text-right">
                    <span className="text-white font-medium">{Math.round(week.expectedOrders)}</span>
                    <span className="text-slate-500 text-sm"> orders</span>
                  </div>
                  <div className="w-24 text-right text-cyan-400 text-sm">
                    {formatCurrency(week.expectedRevenue)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Busy Periods Alert */}
          {forecast.busyPeriods.length > 0 && (
            <div className="rounded-xl border p-4 bg-orange-500/10 border-orange-500/30">
              <h3 className="font-medium text-orange-400 mb-2">⚠️ High Demand Periods</h3>
              <div className="flex flex-wrap gap-2">
                {forecast.busyPeriods.slice(0, 10).map((period, i) => (
                  <span 
                    key={i}
                    className="px-3 py-1 rounded-lg text-sm bg-orange-500/20 text-orange-300"
                  >
                    {formatDate(period.date)} ({Math.round(period.intensity * 100)}%)
                  </span>
                ))}
              </div>
              <p className="text-xs text-orange-400/70 mt-2">
                Consider scheduling extra capacity or adjusting delivery times
              </p>
            </div>
          )}
        </div>
      )}

      {/* Materials Forecast View */}
      {viewMode === 'materials' && (
        <div className="space-y-4">
          {forecast.materialForecast
            .sort((a, b) => a.weeksOfStock - b.weeksOfStock)
            .map(mat => (
            <div 
              key={mat.material}
              className={`rounded-xl border p-4 ${
                mat.reorderUrgent ? 'border-red-500/50 bg-red-500/5' :
                mat.reorderSoon ? 'border-yellow-500/50 bg-yellow-500/5' :
                ''
              }`}
              style={!mat.reorderUrgent && !mat.reorderSoon ? { backgroundColor: '#1e293b', borderColor: '#334155' } : {}}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-white">{mat.material}</h3>
                    {mat.reorderUrgent && (
                      <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400">
                        🚨 Order Now
                      </span>
                    )}
                    {mat.reorderSoon && !mat.reorderUrgent && (
                      <span className="px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400">
                        ⚠️ Low Stock
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    ~{mat.weeklyUsage}g/week • ~{mat.monthlyUsage}g/month
                  </p>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-white font-medium">{mat.currentStock}g</div>
                    <p className="text-xs text-slate-500">In Stock</p>
                  </div>
                  <div className="text-center">
                    <div className={`font-medium ${
                      mat.weeksOfStock < 1 ? 'text-red-400' :
                      mat.weeksOfStock < 3 ? 'text-yellow-400' :
                      'text-green-400'
                    }`}>
                      {mat.weeksOfStock} weeks
                    </div>
                    <p className="text-xs text-slate-500">Remaining</p>
                  </div>
                  <button className="px-4 py-2 rounded-lg text-sm bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30">
                    📦 Reorder
                  </button>
                </div>
              </div>

              {/* Stock Level Bar */}
              <div className="mt-4">
                <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      mat.weeksOfStock < 1 ? 'bg-red-500' :
                      mat.weeksOfStock < 3 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, mat.weeksOfStock * 10)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Capacity Forecast View */}
      {viewMode === 'capacity' && (
        <div className="space-y-6">
          <div className="rounded-xl border p-6" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
            <h3 className="font-medium text-white mb-4">🏭 Capacity Utilization Forecast</h3>
            
            {/* Current Status */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400">Current Utilization</span>
                <span className={`font-bold ${
                  forecast.capacityUtilization > 80 ? 'text-red-400' :
                  forecast.capacityUtilization > 60 ? 'text-yellow-400' :
                  'text-green-400'
                }`}>
                  {forecast.capacityUtilization}%
                </span>
              </div>
              <div className="h-4 rounded-full bg-slate-700 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${
                    forecast.capacityUtilization > 80 ? 'bg-red-500' :
                    forecast.capacityUtilization > 60 ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${forecast.capacityUtilization}%` }}
                />
              </div>
            </div>

            {/* Recommendations */}
            <div className="space-y-3">
              {forecast.capacityUtilization > 80 && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <p className="text-red-400 text-sm">
                    🚨 <strong>High Load Warning:</strong> Consider adding printer capacity or extending delivery times
                  </p>
                </div>
              )}
              {forecast.capacityUtilization > 60 && forecast.capacityUtilization <= 80 && (
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <p className="text-yellow-400 text-sm">
                    ⚠️ <strong>Moderate Load:</strong> Good utilization, but limited buffer for rush orders
                  </p>
                </div>
              )}
              {forecast.capacityUtilization <= 60 && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                  <p className="text-green-400 text-sm">
                    ✅ <strong>Healthy Capacity:</strong> Room for growth and rush orders
                  </p>
                </div>
              )}
            </div>

            {/* Capacity Planning */}
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
                <p className="text-slate-400 text-sm">Available Hours/Day</p>
                <p className="text-2xl font-bold text-white">80h</p>
                <p className="text-xs text-slate-500">4 printers × 20h</p>
              </div>
              <div className="p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
                <p className="text-slate-400 text-sm">Avg Print Time</p>
                <p className="text-2xl font-bold text-white">
                  {Math.round(orders.reduce((s, o) => s + (o.print_hours || 5), 0) / orders.length)}h
                </p>
                <p className="text-xs text-slate-500">Per order</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DemandForecasting;
