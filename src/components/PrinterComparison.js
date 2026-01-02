import React, { useState, useEffect } from 'react';
import { api, unwrap } from '../services/api';

/**
 * Printer Comparison View - Side-by-side printer stats
 */
function PrinterComparison() {
  const [printers, setPrinters] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});

  useEffect(() => {
    fetchPrinters();
  }, []);

  const fetchPrinters = async () => {
    setLoading(true);
    try {
      // Get printer health data (or plain printers list fallback)
      let printerData = [];
      try {
        const healthRes = await api.getPrinterHealth();
        const health = unwrap(healthRes) || {};
        printerData = Array.isArray(health.printers) ? health.printers : [];
      } catch (e) {
        // fallback to configured printers list
        const printersRes = await api.getPrinters();
        const p = unwrap(printersRes) || {};
        printerData = Array.isArray(p.printers) ? p.printers : [];
      }

      // Get job queue for stats (active jobs)
      const jobsRes = await api.getJobQueue();
      const jobsData = unwrap(jobsRes) || jobsRes.data?.data || jobsRes.data || {};
      const jobs = Array.isArray(jobsData.jobs) ? jobsData.jobs : (Array.isArray(jobsRes.data?.jobs) ? jobsRes.data.jobs : []);

      // Calculate basic stats per printer
      const printerStats = {};
      printerData.forEach((p) => {
        const pname = p.name;
        const printerJobs = jobs.filter((j) => (j.assigned_printer || j.printer_id) === pname);
        const estMinutes = (j) => (j.estimated_time_minutes ?? j.estimated_duration_minutes ?? 0);
        printerStats[pname] = {
          totalPrints: printerJobs.length,
          queued: printerJobs.filter((j) => j.status === 'queued').length,
          assigned: printerJobs.filter((j) => j.status === 'assigned').length,
          printing: printerJobs.filter((j) => j.status === 'printing').length,
          totalHours: printerJobs.reduce((a, j) => a + estMinutes(j), 0) / 60,
        };
      });

      setPrinters(printerData);
      setStats(printerStats);

      // Auto-select first two printers
      if (printerData.length >= 2) {
        setSelected([printerData[0].name, printerData[1].name]);
      } else if (printerData.length === 1) {
        setSelected([printerData[0].name]);
      }
    } catch (err) {
      console.error('Failed to fetch printers:', err);
    } finally {
      setLoading(false);
    }
  };

  const togglePrinter = (name) => {
    if (selected.includes(name)) {
      setSelected(selected.filter(n => n !== name));
    } else if (selected.length < 4) {
      setSelected([...selected, name]);
    }
  };

  const getSelectedPrinters = () => {
    return printers.filter(p => selected.includes(p.name));
  };

  const getStateColor = (state) => {
    switch (state) {
      case 'printing': return 'text-blue-600';
      case 'idle': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-500';
    }
  };

  const getHealthColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-500">Loading printers...</p>
      </div>
    );
  }

  const selectedPrinters = getSelectedPrinters();

  return (
    <div className="space-y-6">
      {/* Header & Selector */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">⚖️ Printer Comparison</h2>
        <p className="text-gray-500 text-sm mb-4">Select up to 4 printers to compare</p>
        
        <div className="flex flex-wrap gap-2">
          {printers.map(printer => (
            <button
              key={printer.name}
              onClick={() => togglePrinter(printer.name)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selected.includes(printer.name)
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              🖨️ {printer.name}
              {printer.connected && (
                <span className={`ml-2 text-xs ${
                  selected.includes(printer.name) ? 'text-blue-100' : getStateColor(printer.state)
                }`}>
                  ({printer.state})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Comparison Table */}
      {selectedPrinters.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-4 font-medium text-gray-600">Metric</th>
                  {selectedPrinters.map(p => (
                    <th key={p.name} className="text-center p-4 font-medium">
                      <div>🖨️ {p.name}</div>
                      <span className={`text-xs ${getStateColor(p.state)}`}>
                        {p.connected ? p.state : 'offline'}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {/* Status */}
                <tr>
                  <td className="p-4 text-gray-600">Status</td>
                  {selectedPrinters.map(p => (
                    <td key={p.name} className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        p.connected 
                          ? p.state === 'printing' ? 'bg-blue-100 text-blue-700'
                            : p.state === 'idle' ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                          : 'bg-red-100 text-red-600'
                      }`}>
                        {p.connected ? p.state : 'Offline'}
                      </span>
                    </td>
                  ))}
                </tr>

                {/* Health Score */}
                <tr className="bg-gray-50">
                  <td className="p-4 text-gray-600">Health Score</td>
                  {selectedPrinters.map(p => (
                    <td key={p.name} className="p-4 text-center">
                      <span className={`text-2xl font-bold ${getHealthColor(p.health_score || 0)}`}>
                        {p.health_score?.toFixed(0) || '--'}%
                      </span>
                    </td>
                  ))}
                </tr>

                {/* Temperatures */}
                <tr>
                  <td className="p-4 text-gray-600">🔥 Nozzle Temp</td>
                  {selectedPrinters.map(p => (
                    <td key={p.name} className="p-4 text-center font-mono">
                      {p.nozzle_temp?.toFixed(0) || '--'}°C
                      {p.nozzle_target > 0 && (
                        <span className="text-gray-400 text-sm"> / {p.nozzle_target}°C</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-4 text-gray-600">🛏️ Bed Temp</td>
                  {selectedPrinters.map(p => (
                    <td key={p.name} className="p-4 text-center font-mono">
                      {p.bed_temp?.toFixed(0) || '--'}°C
                      {p.bed_target > 0 && (
                        <span className="text-gray-400 text-sm"> / {p.bed_target}°C</span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Progress */}
                <tr>
                  <td className="p-4 text-gray-600">📊 Progress</td>
                  {selectedPrinters.map(p => (
                    <td key={p.name} className="p-4 text-center">
                      {p.state === 'printing' ? (
                        <div>
                          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500"
                              style={{ width: `${p.progress || 0}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{p.progress?.toFixed(1) || 0}%</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">--</span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Print Stats */}
                <tr className="bg-gray-50">
                  <td className="p-4 text-gray-600">📈 Total Prints</td>
                  {selectedPrinters.map(p => (
                    <td key={p.name} className="p-4 text-center font-bold">
                      {stats[p.name]?.totalPrints || 0}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 text-gray-600">✅ Success Rate</td>
                  {selectedPrinters.map(p => {
                    const s = stats[p.name];
                    const rate = s?.totalPrints > 0 
                      ? ((s.successful / s.totalPrints) * 100).toFixed(0)
                      : 0;
                    return (
                      <td key={p.name} className="p-4 text-center">
                        <span className={`font-bold ${
                          rate >= 90 ? 'text-green-600' : 
                          rate >= 70 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {rate}%
                        </span>
                      </td>
                    );
                  })}
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-4 text-gray-600">❌ Failed Prints</td>
                  {selectedPrinters.map(p => (
                    <td key={p.name} className="p-4 text-center text-red-600 font-medium">
                      {stats[p.name]?.failed || 0}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 text-gray-600">⏱️ Total Print Hours</td>
                  {selectedPrinters.map(p => (
                    <td key={p.name} className="p-4 text-center font-medium">
                      {stats[p.name]?.totalHours?.toFixed(1) || 0}h
                    </td>
                  ))}
                </tr>

                {/* Print Hours */}
                <tr className="bg-gray-50">
                  <td className="p-4 text-gray-600">🔧 Print Hours Total</td>
                  {selectedPrinters.map(p => (
                    <td key={p.name} className="p-4 text-center font-medium">
                      {p.print_hours?.toFixed(0) || '--'}h
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedPrinters.length === 0 && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-4xl mb-4">👆</p>
          <p className="text-gray-500">Select printers above to compare</p>
        </div>
      )}
    </div>
  );
}

export default PrinterComparison;
