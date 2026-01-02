import React, { useEffect, useState } from 'react';
import { api, unwrap } from '../services/api';

const MLAnomalies = () => {
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.getAllAnomalies();
        const data = unwrap(res) || {};
        setAnomalies(Array.isArray(data.anomalous_printers) ? data.anomalous_printers : []);
      } catch (err) {
        console.error('Error fetching anomalies:', err);
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
          <div className="space-y-2">
            <div className="h-12 bg-gray-800 rounded"></div>
            <div className="h-12 bg-gray-800 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <h2 className="text-xl font-bold text-white mb-4">🔍 Anomalies</h2>

      {anomalies.length === 0 ? (
        <div className="text-center py-6 bg-green-900/20 border border-green-700/30 rounded-lg">
          <p className="text-3xl mb-2">✅</p>
          <p className="text-green-400 font-medium">No anomalies detected</p>
        </div>
      ) : (
        <div className="space-y-2">
          {anomalies.slice(0, 5).map((anomaly, idx) => (
            <div 
              key={anomaly.printer_id || idx} 
              className={`p-3 rounded-lg border-l-4 ${
                anomaly.severity === 'critical' 
                  ? 'border-red-500 bg-red-900/20' 
                  : anomaly.severity === 'high' 
                  ? 'border-orange-500 bg-orange-900/20' 
                  : 'border-yellow-500 bg-yellow-900/20'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-medium text-sm text-zinc-200">{anomaly.printer_id}</span>
                <span className={`text-xs px-2 py-1 rounded-full border ${
                  anomaly.severity === 'critical' 
                    ? 'bg-red-900/50 text-red-400 border-red-700/50' 
                    : anomaly.severity === 'high' 
                    ? 'bg-orange-900/50 text-orange-400 border-orange-700/50' 
                    : 'bg-yellow-900/50 text-yellow-400 border-yellow-700/50'
                }`}>
                  {(anomaly.anomaly_score * 100).toFixed(0)}%
                </span>
              </div>
              {anomaly.anomaly_types?.length > 0 && (
                <p className="text-xs text-zinc-400 mt-1">
                  {anomaly.anomaly_types.join(', ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MLAnomalies;
