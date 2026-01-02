import React, { useState, useEffect } from 'react';
import { api, unwrap } from '../services/api';

const PrinterHealth = () => {
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const fetchData = async () => {
      try {
        const res = await api.getPrinters();
        const data = unwrap(res) || {};
        const list = Array.isArray(data.printers) ? data.printers : (Array.isArray(res?.data?.printers) ? res.data.printers : []);
        if (alive) setPrinters(list);
      } catch (err) {
        console.error('Error fetching printers:', err);
        if (alive) setPrinters([]);
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  const getStatusStyle = (statusRaw) => {
    const status = String(statusRaw || '').toLowerCase();
    const styles = {
      printing: 'bg-blue-100 text-blue-800 border-blue-300',
      idle: 'bg-green-100 text-green-800 border-green-300',
      online: 'bg-green-100 text-green-800 border-green-300',
      offline: 'bg-gray-100 text-gray-600 border-gray-300',
      error: 'bg-red-100 text-red-800 border-red-300',
      paused: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    };
    return styles[status] || 'bg-gray-100 text-gray-600 border-gray-300';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">Loading printers...</p>
      </div>
    );
  }

  if (printers.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">🖨️ Printer Status</h2>
        <p className="text-center text-gray-500 py-4">No printers configured</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">🖨️ Printer Status</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {printers.map((printer, idx) => {
          const status = printer.status || printer.state || (printer.connected ? 'online' : 'offline');
          return (
            <div
              key={printer.id || printer.name || idx}
              className={`p-4 rounded-lg border-2 ${getStatusStyle(status)}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{printer.name || `Printer ${idx + 1}`}</h3>
                  <p className="text-sm opacity-75">{printer.printer_type || printer.type || 'unknown'}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded bg-white bg-opacity-50 font-medium">
                  {status || 'unknown'}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="opacity-75">IP:</span>
                  <span className="ml-1 font-medium">{printer.ip_address || 'N/A'}</span>
                </div>
                <div>
                  <span className="opacity-75">Location:</span>
                  <span className="ml-1 font-medium">{printer.location || 'N/A'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PrinterHealth;
