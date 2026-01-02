import React, { useEffect, useState } from 'react';
import { api, unwrap } from '../services/api';

const MLPredictiveInsights = () => {
  const [mlData, setMLData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.getMLDashboard();
        setMLData(unwrap(res) || null);
      } catch (err) {
        console.error('Error fetching ML data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-20 bg-gray-800 rounded-lg"></div>
            <div className="h-20 bg-gray-800 rounded-lg"></div>
            <div className="h-20 bg-gray-800 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!mlData) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <p className="text-zinc-400">No ML data available</p>
      </div>
    );
  }

  const atRisk = mlData.fleet_summary?.at_risk_count || 0;

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <h2 className="text-xl font-bold text-white mb-4">🧠 Predictive Insights</h2>

      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Printers Stat */}
        <div 
          className="text-center p-4 rounded-lg border"
          style={{ 
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)',
            borderColor: 'rgba(59, 130, 246, 0.3)'
          }}
        >
          <p className="text-2xl font-bold text-blue-400">{mlData.fleet_summary?.total_printers || 0}</p>
          <p className="text-xs text-zinc-400">Printers</p>
        </div>
        
        {/* At Risk Stat */}
        <div 
          className="text-center p-4 rounded-lg border"
          style={{ 
            background: atRisk > 0 
              ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%)'
              : 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)',
            borderColor: atRisk > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'
          }}
        >
          <p className={`text-2xl font-bold ${atRisk > 0 ? 'text-red-400' : 'text-green-400'}`}>{atRisk}</p>
          <p className="text-xs text-zinc-400">At Risk</p>
        </div>
        
        {/* Avg Risk Stat */}
        <div 
          className="text-center p-4 rounded-lg border"
          style={{ 
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(168, 85, 247, 0.05) 100%)',
            borderColor: 'rgba(168, 85, 247, 0.3)'
          }}
        >
          <p className="text-2xl font-bold text-purple-400">
            {((mlData.fleet_summary?.average_risk_score || 0) * 100).toFixed(0)}%
          </p>
          <p className="text-xs text-zinc-400">Avg Risk</p>
        </div>
      </div>

      {mlData.top_at_risk_printers?.length > 0 ? (
        <div className="space-y-2">
          {mlData.top_at_risk_printers.slice(0, 3).map((printer, idx) => (
            <div 
              key={printer.printer_id || idx} 
              className="flex justify-between items-center p-3 bg-gray-800/50 border border-gray-700 rounded-lg"
            >
              <span className="font-medium text-sm text-zinc-200">{printer.printer_id}</span>
              <span className={`text-xs px-2 py-1 rounded-full border ${
                printer.risk_score >= 0.5 
                  ? 'bg-red-900/50 text-red-400 border-red-700/50' 
                  : 'bg-yellow-900/50 text-yellow-400 border-yellow-700/50'
              }`}>
                {(printer.risk_score * 100).toFixed(0)}% risk
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 bg-green-900/20 border border-green-700/30 rounded-lg">
          <p className="text-green-400 font-medium">✅ All printers healthy</p>
        </div>
      )}
    </div>
  );
};

export default MLPredictiveInsights;
