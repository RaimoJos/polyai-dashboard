import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

/**
 * Temperature Graphs - Live temp charts with history
 */
function TemperatureGraph({ printerName, nozzleTemp, nozzleTarget, bedTemp, bedTarget }) {
  const [history, setHistory] = useState({
    labels: [],
    nozzle: [],
    nozzleTarget: [],
    bed: [],
    bedTarget: []
  });
  const maxPoints = 60; // 5 minutes at 5s intervals

  // Update history when temps change
  useEffect(() => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    setHistory(prev => {
      const newLabels = [...prev.labels, now].slice(-maxPoints);
      const newNozzle = [...prev.nozzle, nozzleTemp || 0].slice(-maxPoints);
      const newNozzleTarget = [...prev.nozzleTarget, nozzleTarget || 0].slice(-maxPoints);
      const newBed = [...prev.bed, bedTemp || 0].slice(-maxPoints);
      const newBedTarget = [...prev.bedTarget, bedTarget || 0].slice(-maxPoints);

      return {
        labels: newLabels,
        nozzle: newNozzle,
        nozzleTarget: newNozzleTarget,
        bed: newBed,
        bedTarget: newBedTarget
      };
    });
  }, [nozzleTemp, bedTemp, nozzleTarget, bedTarget]);

  const chartData = {
    labels: history.labels,
    datasets: [
      {
        label: 'Nozzle',
        data: history.nozzle,
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      },
      {
        label: 'Nozzle Target',
        data: history.nozzleTarget,
        borderColor: 'rgb(239, 68, 68)',
        borderDash: [5, 5],
        fill: false,
        tension: 0,
        pointRadius: 0,
        borderWidth: 1,
      },
      {
        label: 'Bed',
        data: history.bed,
        borderColor: 'rgb(249, 115, 22)',
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      },
      {
        label: 'Bed Target',
        data: history.bedTarget,
        borderColor: 'rgb(249, 115, 22)',
        borderDash: [5, 5],
        fill: false,
        tension: 0,
        pointRadius: 0,
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 0 // Disable animation for real-time updates
    },
    interaction: {
      intersect: false,
      mode: 'index',
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          boxWidth: 6,
          font: { size: 11 }
        }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.raw.toFixed(1)}°C`
        }
      }
    },
    scales: {
      x: {
        display: true,
        grid: { display: false },
        ticks: {
          maxTicksLimit: 6,
          font: { size: 10 }
        }
      },
      y: {
        display: true,
        min: 0,
        max: 300,
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: {
          callback: (val) => `${val}°C`,
          font: { size: 10 }
        }
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold">{printerName} - Temperature</h3>
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-red-500 rounded-full"></span>
            Nozzle: <strong>{nozzleTemp?.toFixed(1) || 0}°C</strong>
            {nozzleTarget > 0 && <span className="text-gray-400">/ {nozzleTarget}°C</span>}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
            Bed: <strong>{bedTemp?.toFixed(1) || 0}°C</strong>
            {bedTarget > 0 && <span className="text-gray-400">/ {bedTarget}°C</span>}
          </span>
        </div>
      </div>
      <div className="h-48">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}

/**
 * Multi-printer temperature overview
 */
function TemperatureOverview({ printers = [] }) {
  const connectedPrinters = printers.filter(p => p.connected);

  if (connectedPrinters.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <p className="text-4xl mb-4">🌡️</p>
        <p className="text-gray-500">No printers connected</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-xl font-bold mb-4">🌡️ Temperature Monitor</h2>
        
        {/* Quick overview table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Printer</th>
                <th className="text-center py-2">State</th>
                <th className="text-right py-2">🔥 Nozzle</th>
                <th className="text-right py-2">🛏️ Bed</th>
                <th className="text-right py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {connectedPrinters.map(printer => {
                const nozzleDiff = printer.nozzle_target > 0 
                  ? Math.abs(printer.nozzle_temp - printer.nozzle_target) 
                  : 0;
                const bedDiff = printer.bed_target > 0 
                  ? Math.abs(printer.bed_temp - printer.bed_target) 
                  : 0;
                const isHeating = nozzleDiff > 5 || bedDiff > 5;
                const isStable = nozzleDiff <= 2 && bedDiff <= 2 && (printer.nozzle_target > 0 || printer.bed_target > 0);

                return (
                  <tr key={printer.name} className="border-b hover:bg-gray-50">
                    <td className="py-2 font-medium">{printer.name}</td>
                    <td className="py-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        printer.state === 'printing' ? 'bg-blue-100 text-blue-700' :
                        printer.state === 'idle' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {printer.state}
                      </span>
                    </td>
                    <td className="py-2 text-right font-mono">
                      <span className={nozzleDiff > 10 ? 'text-red-600' : ''}>
                        {printer.nozzle_temp?.toFixed(0) || 0}°C
                      </span>
                      {printer.nozzle_target > 0 && (
                        <span className="text-gray-400 text-xs ml-1">
                          /{printer.nozzle_target}°C
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right font-mono">
                      <span className={bedDiff > 10 ? 'text-orange-600' : ''}>
                        {printer.bed_temp?.toFixed(0) || 0}°C
                      </span>
                      {printer.bed_target > 0 && (
                        <span className="text-gray-400 text-xs ml-1">
                          /{printer.bed_target}°C
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {isHeating && <span className="text-orange-500">🔄 Heating</span>}
                      {isStable && <span className="text-green-500">✅ Stable</span>}
                      {!isHeating && !isStable && printer.nozzle_temp < 40 && (
                        <span className="text-gray-400">💤 Cold</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Individual graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {connectedPrinters.map(printer => (
          <TemperatureGraph
            key={printer.name}
            printerName={printer.name}
            nozzleTemp={printer.nozzle_temp}
            nozzleTarget={printer.nozzle_target}
            bedTemp={printer.bed_temp}
            bedTarget={printer.bed_target}
          />
        ))}
      </div>
    </div>
  );
}

TemperatureGraph.propTypes = {
  printerName: PropTypes.string,
  nozzleTemp: PropTypes.number,
  nozzleTarget: PropTypes.number,
  bedTemp: PropTypes.number,
  bedTarget: PropTypes.number
};

TemperatureOverview.propTypes = {
  printers: PropTypes.arrayOf(PropTypes.shape({
    name: PropTypes.string,
    connected: PropTypes.bool,
    state: PropTypes.string,
    nozzle_temp: PropTypes.number,
    nozzle_target: PropTypes.number,
    bed_temp: PropTypes.number,
    bed_target: PropTypes.number
  }))
};

export { TemperatureGraph, TemperatureOverview };
export default TemperatureOverview;
