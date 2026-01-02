/**
 * PrintersTabContent - Fixed Printer Loading
 * 
 * This component replaces the inline PrintersTabContent in App.js
 * with improved printer loading and error handling.
 */

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n';
import { api } from '../services/api';
import PrinterDashboard from './PrinterDashboard';
import PrinterTools from './PrinterTools';
import PrinterCameraGrid from './BambuCameraView';

export default function PrintersTabContent() {
  const { t } = useLanguage();
  const [printersSubTab, setPrintersSubTab] = useState('dashboard');
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load printers for tools with improved error handling
  useEffect(() => {
    const loadPrinters = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const data = await api.getPrinters();
        
        // Normalize printer data - handle various response formats from backend
        let printerList = [];
        
        if (Array.isArray(data)) {
          printerList = data;
        } else if (data?.printers && Array.isArray(data.printers)) {
          printerList = data.printers;
        } else if (data?.data) {
          if (Array.isArray(data.data)) {
            printerList = data.data;
          } else if (data.data?.printers && Array.isArray(data.data.printers)) {
            printerList = data.data.printers;
          }
        }
        
        console.log(`[PrintersTab] Loaded ${printerList.length} printers from API`);
        
        // Transform and normalize each printer
        const normalized = printerList.map(p => {
          // Handle various field names from different backend responses
          const name = p.name || p.printer_name || 'Unknown';
          const state = p.state || p.status || p.printer_status || 'unknown';
          const connected = p.connected ?? p.is_online ?? p.is_connected ?? false;
          const nozzle_temp = p.nozzle_temp ?? p.temperatures?.nozzle?.actual ?? p.nozzle ?? 0;
          const bed_temp = p.bed_temp ?? p.temperatures?.bed?.actual ?? p.bed ?? 0;
          const job = p.job || p.current_job || {};
          
          return {
            name,
            state,
            connected,
            nozzle_temp: Number(nozzle_temp) || 0,
            bed_temp: Number(bed_temp) || 0,
            job,
            ...p // Keep original data as fallback
          };
        });
        
        console.log('[PrintersTab] Normalized printers:', normalized);
        setPrinters(normalized);
        setLoading(false);
      } catch (err) {
        console.error('[PrintersTab] Failed to load printers:', err);
        setError(err.message || 'Failed to load printers');
        setPrinters([]);
        setLoading(false);
      }
    };
    
    // Load immediately
    loadPrinters();
    
    // Then refresh every 5 seconds
    const interval = setInterval(loadPrinters, 5000);
    return () => clearInterval(interval);
  }, []);

  const subTabs = [
    { id: 'dashboard', nameKey: 'nav.dashboard', icon: '🖨️' },
    { id: 'tools', label: 'Tools', icon: '🔧' },
    { id: 'cameras', nameKey: 'nav.cameras', icon: '📷' },
  ];

  return (
    <>
      <div className="sub-nav mb-4">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setPrintersSubTab(tab.id)}
            className={`sub-nav-tab ${printersSubTab === tab.id ? 'active' : ''}`}
          >
            <span className="mr-2 opacity-70">{tab.icon}</span>
            {tab.nameKey ? t(tab.nameKey) : tab.label}
          </button>
        ))}
      </div>

      {/* Error message if loading failed */}
      {error && (
        <div className="mb-4 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300">
          <p className="font-medium">⚠️ Error loading printers</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-white"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && printersSubTab === 'dashboard' && (
        <div className="text-center py-8 text-slate-400">
          <div className="animate-spin inline-block">⏳</div>
          <p className="mt-2">Loading printers...</p>
        </div>
      )}

      {/* Dashboard Tab */}
      {printersSubTab === 'dashboard' && !loading && (
        <PrinterDashboard />
      )}

      {/* Tools Tab */}
      {printersSubTab === 'tools' && (
        <PrinterTools 
          printers={printers}
          onRefresh={() => {
            console.log('[PrintersTab] Manual refresh triggered');
            // Trigger reload
            window.dispatchEvent(new CustomEvent('refreshPrinters'));
          }}
        />
      )}

      {/* Cameras Tab */}
      {printersSubTab === 'cameras' && (
        <PrinterCameraGrid />
      )}

      {/* Empty state */}
      {printers.length === 0 && !loading && printersSubTab !== 'dashboard' && (
        <div className="text-center py-8 text-slate-400">
          <div className="text-3xl mb-2">📡</div>
          <p>No printers registered</p>
          <p className="text-sm">Register a printer to use {subTabs.find(t => t.id === printersSubTab)?.label || 'this'} features</p>
        </div>
      )}

      {/* Debug info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-6 p-4 bg-slate-800 rounded text-slate-400 text-xs font-mono max-h-32 overflow-auto">
          <details>
            <summary className="cursor-pointer font-bold">Debug Info</summary>
            <pre className="mt-2">
              {JSON.stringify({
                printersLoaded: printers.length,
                loading,
                error,
                printers: printers.slice(0, 2) // Show first 2 for brevity
              }, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </>
  );
}
