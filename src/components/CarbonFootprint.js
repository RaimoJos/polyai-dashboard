import React, { useEffect, useState } from 'react';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { api, unwrap } from '../services/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const CarbonFootprint = () => {
  const [summary, setSummary] = useState(null);
  const [dailyStats, setDailyStats] = useState([]);
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryRes, dailyRes, targetsRes] = await Promise.all([
          api.getCarbonSummary(30),
          api.getCarbonDailyStats(30),
          api.getCarbonTargets(true),
        ]);

        const summaryData = unwrap(summaryRes) || {};
        const dailyData = unwrap(dailyRes) || {};
        const targetsData = unwrap(targetsRes) || {};

        setSummary(summaryData.summary || summaryData);
        setDailyStats(dailyData.daily_stats || []);
        setTargets(targetsData.targets || []);
      } catch (err) {
        console.error('Error fetching carbon data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading carbon footprint data...</div>
      </div>
    );
  }

  const totalCO2 = summary?.total_co2_kg || 0;
  const scope2 = summary?.scope2_co2_kg || 0;
  const scope3 = summary?.scope3_co2_kg || 0;
  const breakdown = summary?.breakdown || {};
  const equivalents = summary?.equivalents || {};

  // Prepare chart data
  const trendChartData = {
    labels: dailyStats.map((d) =>
      new Date(d.date || d.timestamp || Date.now()).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    ),
    datasets: [
      {
        label: 'Total CO2 (kg)',
        data: dailyStats.map((d) => d.total_co2_kg || 0),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const scopeChartData = {
    labels: ['Scope 2 (Electricity)', 'Scope 3 (Materials, Transport, Waste)'],
    datasets: [
      {
        data: [scope2, scope3],
        backgroundColor: ['rgba(59, 130, 246, 0.8)', 'rgba(16, 185, 129, 0.8)'],
        borderColor: ['rgb(59, 130, 246)', 'rgb(16, 185, 129)'],
        borderWidth: 2,
      },
    ],
  };

  const sourceLabels = Object.keys(breakdown);
  const sourceValues = Object.values(breakdown);
  const sourceColors = [
    'rgba(239, 68, 68, 0.8)',
    'rgba(59, 130, 246, 0.8)',
    'rgba(16, 185, 129, 0.8)',
    'rgba(245, 158, 11, 0.8)',
    'rgba(139, 92, 246, 0.8)',
  ];

  const sourceChartData = {
    labels: sourceLabels.map((s) => s.charAt(0).toUpperCase() + s.slice(1)),
    datasets: [
      {
        label: 'CO2 by Source (kg)',
        data: sourceValues,
        backgroundColor: sourceColors.slice(0, sourceLabels.length),
        borderColor: sourceColors.slice(0, sourceLabels.length).map((c) => c.replace('0.8', '1')),
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Carbon Footprint Dashboard</h2>
          <span className="text-sm text-gray-500">Last 30 days</span>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex space-x-8">
            {['overview', 'breakdown', 'equivalents', 'targets'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                <p className="text-sm text-gray-600">Total CO2 Emissions</p>
                <p className="text-2xl font-bold text-red-600">{totalCO2.toFixed(2)} kg</p>
                <p className="text-xs text-gray-500 mt-1">All scopes combined</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <p className="text-sm text-gray-600">Scope 2 (Electricity)</p>
                <p className="text-2xl font-bold text-blue-600">{scope2.toFixed(2)} kg</p>
                <p className="text-xs text-gray-500 mt-1">Purchased electricity</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                <p className="text-sm text-gray-600">Scope 3 (Indirect)</p>
                <p className="text-2xl font-bold text-green-600">{scope3.toFixed(2)} kg</p>
                <p className="text-xs text-gray-500 mt-1">Materials, transport, waste</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                <p className="text-sm text-gray-600">Offset Cost Est.</p>
                <p className="text-2xl font-bold text-purple-600">
                  ${summary?.offset_cost_usd?.toFixed(2) || '0.00'}
                </p>
                <p className="text-xs text-gray-500 mt-1">Carbon credit estimate</p>
              </div>
            </div>

            {/* Trend Chart */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Daily Emissions Trend</h3>
              <div className="h-64">
                <Line
                  data={trendChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        title: { display: true, text: 'kg CO2' },
                      },
                    },
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Breakdown Tab */}
        {activeTab === 'breakdown' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Emissions by Scope</h3>
              <div className="h-64 flex items-center justify-center">
                <Doughnut
                  data={scopeChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'bottom' },
                    },
                  }}
                />
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Emissions by Source</h3>
              <div className="h-64">
                <Bar
                  data={sourceChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        title: { display: true, text: 'kg CO2' },
                      },
                    },
                  }}
                />
              </div>
            </div>

            {/* Source Details Table */}
            <div className="md:col-span-2 bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Emission Sources</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Source
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        CO2 (kg)
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Percentage
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {sourceLabels.map((source, idx) => (
                      <tr key={source}>
                        <td className="px-4 py-2 text-sm text-gray-900 capitalize">{source}</td>
                        <td className="px-4 py-2 text-sm text-right text-gray-600">
                          {sourceValues[idx].toFixed(3)}
                        </td>
                        <td className="px-4 py-2 text-sm text-right text-gray-600">
                          {totalCO2 > 0 ? ((sourceValues[idx] / totalCO2) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Equivalents Tab */}
        {activeTab === 'equivalents' && (
          <div className="space-y-6">
            <p className="text-gray-600">
              Your carbon footprint of <span className="font-bold">{totalCO2.toFixed(2)} kg CO2</span> is
              equivalent to:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                <div className="text-3xl mb-2">&#128663;</div>
                <p className="text-2xl font-bold text-amber-600">
                  {equivalents.miles_driven_car?.toFixed(1) || 0}
                </p>
                <p className="text-sm text-gray-600">Miles driven by car</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                <div className="text-3xl mb-2">&#127794;</div>
                <p className="text-2xl font-bold text-green-600">
                  {equivalents.trees_annual_offset?.toFixed(2) || 0}
                </p>
                <p className="text-sm text-gray-600">Trees needed to offset (1 year)</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div className="text-3xl mb-2">&#128241;</div>
                <p className="text-2xl font-bold text-blue-600">
                  {Math.round(equivalents.smartphones_charged || 0).toLocaleString()}
                </p>
                <p className="text-sm text-gray-600">Smartphones fully charged</p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                <div className="text-3xl mb-2">&#9981;</div>
                <p className="text-2xl font-bold text-yellow-600">
                  {equivalents.gallons_gasoline?.toFixed(2) || 0}
                </p>
                <p className="text-sm text-gray-600">Gallons of gasoline burned</p>
              </div>
              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                <div className="text-3xl mb-2">&#128161;</div>
                <p className="text-2xl font-bold text-indigo-600">
                  {Math.round(equivalents.led_bulb_hours || 0).toLocaleString()}
                </p>
                <p className="text-sm text-gray-600">Hours of LED bulb usage</p>
              </div>
              <div className="bg-rose-50 p-4 rounded-lg border border-rose-100">
                <div className="text-3xl mb-2">&#9992;</div>
                <p className="text-2xl font-bold text-rose-600">
                  {equivalents.flights_km?.toFixed(1) || 0}
                </p>
                <p className="text-sm text-gray-600">Kilometers of air travel</p>
              </div>
            </div>

            <div className="bg-gray-100 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Carbon Offset Options</h4>
              <p className="text-sm text-gray-600 mb-4">
                To offset your emissions, you could invest in verified carbon credit projects:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-3 rounded border">
                  <p className="font-medium">Verified Carbon Standard</p>
                  <p className="text-xl font-bold text-green-600">
                    ${((totalCO2 / 1000) * 15).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500">~$15/ton CO2</p>
                </div>
                <div className="bg-white p-3 rounded border">
                  <p className="font-medium">Gold Standard</p>
                  <p className="text-xl font-bold text-green-600">
                    ${((totalCO2 / 1000) * 25).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500">~$25/ton CO2</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Targets Tab */}
        {activeTab === 'targets' && (
          <div className="space-y-6">
            {targets.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">&#127919;</div>
                <p className="text-gray-600">No carbon reduction targets set.</p>
                <p className="text-sm text-gray-500 mt-2">
                  Create targets to track your progress toward sustainability goals.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {targets.map((target, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border ${
                      target.achieved ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">{target.name}</h4>
                      {target.achieved && (
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                          Achieved
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Target</p>
                        <p className="font-medium">{target.target_co2_kg} kg CO2</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Current</p>
                        <p className="font-medium">{target.current_co2_kg?.toFixed(2) || 0} kg CO2</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Progress</p>
                        <p className="font-medium">{target.progress_percent?.toFixed(1) || 0}%</p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            target.achieved ? 'bg-green-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${Math.min(target.progress_percent || 0, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CarbonFootprint;
