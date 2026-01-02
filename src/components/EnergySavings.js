import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { api, unwrap } from '../services/api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const EnergySavings = () => {
  const [chartData, setChartData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [historyRes, summaryRes] = await Promise.all([
          api.getEnergyHistory(30),
          api.getEnergySummary()
        ]);

        const historyPayload = unwrap(historyRes) || {};
        const summaryPayload = unwrap(summaryRes) || {};

        const history = Array.isArray(historyPayload?.history)
          ? historyPayload.history
          : (Array.isArray(historyPayload) ? historyPayload : []);

        setSummary(summaryPayload);
        if (!Array.isArray(history)) {
          console.warn('Energy history is not an array:', history);
          return;
        }

        setChartData({
          labels: history.map(d => new Date(d.date || d.ts || d.timestamp || Date.now()).toLocaleDateString()),
          datasets: [
            {
              label: 'Energy Saved (kWh)',
              data: history.map(d => d.energy_saved_kwh),
              borderColor: 'rgb(34, 197, 94)',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              tension: 0.4
            },
            {
              label: 'Cost Saved (€)',
              data: history.map(d => d.cost_saved),
              borderColor: 'rgb(59, 130, 246)',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              tension: 0.4
            }
          ]
        });
      } catch (err) {
        console.error('Error fetching energy data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-800 rounded-lg"></div>)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            🌱 Energy Savings
          </h2>
          <p className="text-sm text-zinc-400 mt-1">Last 30 days performance</p>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div 
          className="p-4 rounded-lg border"
          style={{ 
            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)',
            borderColor: 'rgba(34, 197, 94, 0.3)'
          }}
        >
          <p className="text-sm text-zinc-400">Total Energy Saved</p>
          <p className="text-2xl font-bold text-green-400">{summary?.total_energy_saved_kwh?.toFixed(2) || '0.00'} kWh</p>
        </div>
        
        <div 
          className="p-4 rounded-lg border"
          style={{ 
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)',
            borderColor: 'rgba(59, 130, 246, 0.3)'
          }}
        >
          <p className="text-sm text-zinc-400">Total Cost Saved</p>
          <p className="text-2xl font-bold text-blue-400">€{summary?.total_cost_saved?.toFixed(2) || '0.00'}</p>
        </div>
        
        <div 
          className="p-4 rounded-lg border"
          style={{ 
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(168, 85, 247, 0.05) 100%)',
            borderColor: 'rgba(168, 85, 247, 0.3)'
          }}
        >
          <p className="text-sm text-zinc-400">Cooldown Events</p>
          <p className="text-2xl font-bold text-purple-400">{summary?.total_cooldown_events || 0}</p>
        </div>
      </div>

      {/* Chart */}
      {chartData && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <Line
            data={chartData}
            options={{
              responsive: true,
              plugins: {
                legend: { 
                  position: 'top',
                  labels: {
                    color: '#a1a1aa'
                  }
                },
                title: { display: false }
              },
              scales: {
                y: { 
                  beginAtZero: true,
                  grid: {
                    color: 'rgba(39, 39, 42, 0.8)'
                  },
                  ticks: {
                    color: '#71717a'
                  }
                },
                x: {
                  grid: {
                    color: 'rgba(39, 39, 42, 0.8)'
                  },
                  ticks: {
                    color: '#71717a'
                  }
                }
              }
            }}
          />
        </div>
      )}

      {/* Tip */}
      <div className="mt-4 text-xs text-zinc-500">
        💡 Energy savings are calculated from automatic cooldown events when printers are idle.
      </div>
    </div>
  );
};

export default EnergySavings;
