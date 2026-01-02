import React, { useEffect, useState } from 'react';
import { Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { api, unwrap } from '../services/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const CostAnalytics = () => {
  const [summary, setSummary] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [pieData, setPieData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [laborInfo, setLaborInfo] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [showExpenses, setShowExpenses] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryRes, laborRes, expensesRes] = await Promise.all([
          api.getCostSummary(days),
          api.getLaborConfig?.() || Promise.resolve({ data: null }),
          api.getExpenses?.() || Promise.resolve({ data: { expenses: [] } }),
        ]);

        const data = unwrap(summaryRes) || {};
        setSummary(data);
        setLaborInfo(laborRes.data);
        setExpenses(expensesRes.data?.expenses || []);

        // Bar chart - Cost over time
        if (data.daily_breakdown) {
          setChartData({
            labels: data.daily_breakdown.map(d => new Date(d.date).toLocaleDateString()),
            datasets: [
              {
                label: 'Energy Cost (€)',
                data: data.daily_breakdown.map(d => d.energy_cost),
                backgroundColor: 'rgba(59, 130, 246, 0.7)',
              },
              {
                label: 'Material Cost (€)',
                data: data.daily_breakdown.map(d => d.material_cost),
                backgroundColor: 'rgba(16, 185, 129, 0.7)',
              },
              {
                label: 'Maintenance (€)',
                data: data.daily_breakdown.map(d => d.maintenance_cost || 0),
                backgroundColor: 'rgba(245, 158, 11, 0.7)',
              },
              {
                label: 'Overhead (€)',
                data: data.daily_breakdown.map(d => d.overhead_cost || 0),
                backgroundColor: 'rgba(139, 92, 246, 0.7)',
              }
            ]
          });
        }

        // Pie chart - Cost breakdown
        setPieData({
          labels: ['Energy', 'Materials', 'Maintenance', 'Overhead'],
          datasets: [{
            data: [
              data.total_energy_cost || 0,
              data.total_material_cost || 0,
              data.total_maintenance_cost || 0,
              data.total_overhead_cost || 0
            ],
            backgroundColor: [
              'rgba(59, 130, 246, 0.7)',
              'rgba(16, 185, 129, 0.7)',
              'rgba(245, 158, 11, 0.7)',
              'rgba(139, 92, 246, 0.7)'
            ],
            borderWidth: 2,
            borderColor: '#fff'
          }]
        });

      } catch (err) {
        console.error('Error fetching cost data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [days]);

  const formatCurrency = (amount) => {
    return `${(amount || 0).toFixed(2)}€`;
  };

  const totalCost = (summary?.total_energy_cost || 0) + 
                   (summary?.total_material_cost || 0) + 
                   (summary?.total_maintenance_cost || 0) +
                   (summary?.total_overhead_cost || 0);

  if (loading) return <div className="text-gray-500">Loading cost analytics...</div>;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Cost Analytics</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setDays(7)}
            className={`px-3 py-1 rounded text-sm ${days === 7 ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            7 Days
          </button>
          <button
            onClick={() => setDays(30)}
            className={`px-3 py-1 rounded text-sm ${days === 30 ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            30 Days
          </button>
          <button
            onClick={() => setDays(90)}
            className={`px-3 py-1 rounded text-sm ${days === 90 ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            90 Days
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Total Cost</p>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalCost)}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Material</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(summary?.total_material_cost)}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Energy</p>
          <p className="text-2xl font-bold text-purple-600">{formatCurrency(summary?.total_energy_cost)}</p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Maintenance</p>
          <p className="text-2xl font-bold text-yellow-600">{formatCurrency(summary?.total_maintenance_cost)}</p>
        </div>
        <div className="bg-violet-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Overhead</p>
          <p className="text-2xl font-bold text-violet-600">{formatCurrency(summary?.total_overhead_cost)}</p>
        </div>
      </div>

      {/* Labor Info */}
      {laborInfo && (
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">Labor Costs (Estonian Tax)</h3>
            <button 
              onClick={() => setShowExpenses(!showExpenses)}
              className="text-sm text-blue-500 hover:underline"
            >
              {showExpenses ? 'Hide' : 'Show'} Expenses
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Net/hour:</span>
              <span className="ml-2 font-medium">{formatCurrency(laborInfo.net_hourly_rate)}</span>
            </div>
            <div>
              <span className="text-gray-500">Employer cost/hour:</span>
              <span className="ml-2 font-medium text-red-600">{formatCurrency(laborInfo.employer_hourly_cost)}</span>
            </div>
            <div>
              <span className="text-gray-500">Cost multiplier:</span>
              <span className="ml-2 font-medium">{laborInfo.cost_multiplier}x</span>
            </div>
          </div>
        </div>
      )}

      {/* Expenses List */}
      {showExpenses && expenses.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <h3 className="font-semibold mb-3">Business Expenses</h3>
          <div className="space-y-2">
            {expenses.map((exp) => (
              <div key={exp.id} className="flex justify-between items-center text-sm bg-white p-2 rounded">
                <div>
                  <span className="font-medium">{exp.name}</span>
                  <span className="text-gray-400 ml-2">({exp.category})</span>
                </div>
                <div>
                  <span className="font-medium">{formatCurrency(exp.amount)}</span>
                  <span className="text-gray-400 ml-1">/{exp.frequency}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart - 2/3 width */}
        <div className="lg:col-span-2">
          <h3 className="font-semibold mb-3">Daily Cost Breakdown</h3>
          {chartData && (
            <Bar
              data={chartData}
              options={{
                responsive: true,
                plugins: {
                  legend: { position: 'top' }
                },
                scales: {
                  x: { stacked: true },
                  y: { stacked: true, beginAtZero: true }
                }
              }}
            />
          )}
        </div>

        {/* Pie Chart - 1/3 width */}
        <div>
          <h3 className="font-semibold mb-3">Cost Distribution</h3>
          {pieData && (
            <Pie
              data={pieData}
              options={{
                responsive: true,
                plugins: {
                  legend: { position: 'bottom' }
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default CostAnalytics;
