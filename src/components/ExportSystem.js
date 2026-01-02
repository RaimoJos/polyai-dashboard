// Export System - PDF/CSV Reports
import React, { useState } from 'react';

class ExportManager {
  static generateCSV(data, filename) {
    if (data.length === 0) {
      console.warn('No data to export');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header];
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    this.downloadFile(csvContent, `${filename}.csv`, 'text/csv');
  }

  static generatePDF(title, sections, filename) {
    let content = `${title}\n`;
    content += `Generated: ${new Date().toLocaleString()}\n`;
    content += '='.repeat(80) + '\n\n';

    sections.forEach(section => {
      content += `\n${section.title}\n`;
      content += '-'.repeat(40) + '\n';
      
      if (Array.isArray(section.content)) {
        section.content.forEach(row => {
          content += Object.values(row).join('\t') + '\n';
        });
      } else {
        content += section.content + '\n';
      }
    });

    this.downloadFile(content, `${filename}.txt`, 'text/plain');
  }

  static async exportPrintHistory(prints, format = 'csv') {
    if (prints.length === 0) {
      console.warn('No prints to export');
      return;
    }

    const exportData = prints.map(p => ({
      'Date': new Date(p.created_at || p.start_time).toLocaleDateString(),
      'Time': new Date(p.created_at || p.start_time).toLocaleTimeString(),
      'Model': p.model_name || p.filename || '—',
      'Printer': p.printer_name || '—',
      'Material': p.material || '—',
      'Print Time (min)': Math.round(p.print_time_minutes || 0),
      'Filament (g)': (p.filament_used_g || 0).toFixed(1),
      'Infill %': p.infill || '—',
      'Layer Height (mm)': p.layer_height || '—',
      'Status': p.status === 'success' ? 'Success' : 'Failed',
      'Cost (€)': p.estimated_cost?.toFixed(2) || '—',
    }));

    if (format === 'csv') {
      this.generateCSV(exportData, `print-history-${new Date().toISOString().split('T')[0]}`);
    } else if (format === 'json') {
      this.downloadFile(
        JSON.stringify(exportData, null, 2),
        `print-history-${new Date().toISOString().split('T')[0]}.json`,
        'application/json'
      );
    }
  }

  static async exportCostReport(stats, timeRange = 7) {
    const sections = [
      {
        title: 'COST SUMMARY',
        content: [
          { label: 'Period', value: `Last ${timeRange} days` },
          { label: 'Total Prints', value: stats.totalPrints || 0 },
          { label: 'Successful', value: stats.successfulPrints || 0 },
          { label: 'Success Rate', value: `${stats.successRate || 0}%` },
          { label: 'Total Energy Cost', value: `€${stats.totalCost?.toFixed(2) || '0.00'}` },
          { label: 'Avg Cost per Print', value: `€${stats.totalPrints > 0 ? (stats.totalCost / stats.totalPrints).toFixed(2) : '0.00'}` },
          { label: 'Energy Saved', value: `€${stats.energySaved?.toFixed(2) || '0.00'}` },
        ]
      },
      {
        title: 'MATERIAL USAGE',
        content: [
          { label: 'Total Filament', value: `${stats.totalFilament || 0}g` },
          { label: 'Material Cost', value: `€${(stats.totalFilament / 1000 * 18).toFixed(2)}` },
        ]
      },
      {
        title: 'TIME SUMMARY',
        content: [
          { label: 'Total Print Time', value: `${Math.floor((stats.totalTime || 0) / 60)}h ${Math.round((stats.totalTime || 0) % 60)}m` },
          { label: 'Avg Print Time', value: `${stats.totalPrints > 0 ? Math.round((stats.totalTime || 0) / stats.totalPrints) : 0}m` },
        ]
      },
    ];

    this.generatePDF(
      '📊 PRINTING COST REPORT',
      sections,
      `cost-report-${new Date().toISOString().split('T')[0]}`
    );
  }

  static downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}

function ExportPanel({ stats, prints = [], onClose }) {
  const [exporting, setExporting] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState('csv');
  const [selectedType, setSelectedType] = useState('prints');

  const handleExport = async () => {
    setExporting(true);
    try {
      if (selectedType === 'prints') {
        await ExportManager.exportPrintHistory(prints, selectedFormat);
      } else if (selectedType === 'costs') {
        await ExportManager.exportCostReport(stats);
      }
      console.log('Export complete!');
      onClose();
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-md">
      <h3 className="font-bold text-white text-lg mb-4">📥 Export Data</h3>

      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-300 mb-2">What to Export</label>
        <div className="space-y-2">
          {[
            { value: 'prints', label: '🖨️ Print History', desc: 'All print records' },
            { value: 'costs', label: '💵 Cost Report', desc: 'Financial summary' },
          ].map(opt => (
            <label key={opt.value} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
              <input
                type="radio"
                name="export-type"
                value={opt.value}
                checked={selectedType === opt.value}
                onChange={e => setSelectedType(e.target.value)}
                className="w-4 h-4"
              />
              <div>
                <div className="text-white font-medium text-sm">{opt.label}</div>
                <div className="text-slate-400 text-xs">{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {selectedType !== 'costs' && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">Format</label>
          <div className="flex gap-2">
            {[
              { value: 'csv', label: 'CSV', icon: '📊' },
              { value: 'json', label: 'JSON', icon: '{ }' },
            ].map(fmt => (
              <button
                key={fmt.value}
                onClick={() => setSelectedFormat(fmt.value)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedFormat === fmt.value
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {fmt.icon} {fmt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-slate-800/50 rounded-lg p-3 mb-6 text-xs text-slate-400">
        {selectedType === 'prints' && 'Exports all print records with timestamps, materials, and status.'}
        {selectedType === 'costs' && 'Generates a summary report of costs, materials, and time.'}
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
        >
          {exporting ? (
            <>
              <span className="animate-spin">⏳</span>
              Exporting...
            </>
          ) : (
            <>
              <span>⬇️</span>
              Export
            </>
          )}
        </button>
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export { ExportPanel, ExportManager };
export default ExportPanel;
