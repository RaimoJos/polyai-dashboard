import React, { useEffect, useMemo, useState } from 'react';
import { api, SERVER_ROOT, unwrap } from '../services/api';

const REPORT_TYPES = [
  { key: 'daily', label: 'Daily', icon: '📅' },
  { key: 'weekly', label: 'Weekly', icon: '📊' },
  { key: 'monthly', label: 'Monthly', icon: '📈' },
  { key: 'custom', label: 'Custom', icon: '⚙️' }
];

const EXPORT_FORMATS = [
  { key: 'pdf', label: 'PDF Report', icon: '📄' },
  { key: 'xlsx', label: 'Excel Spreadsheet', icon: '📊' },
  { key: 'json', label: 'JSON Data', icon: '🔧' }
];

const normalizeUrl = (u) => {
  if (!u) return null;
  if (String(u).startsWith('http://') || String(u).startsWith('https://')) return u;
  return `${SERVER_ROOT}${u.startsWith('/') ? '' : '/'}${u}`;
};

const ReportsGenerator = () => {
  const [selectedType, setSelectedType] = useState('daily');
  const [selectedFormat, setSelectedFormat] = useState('pdf');
  const [customDateRange, setCustomDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState(null);

  const [emailConfig, setEmailConfig] = useState({ to: '', subject: '', includeCharts: true, includeRawData: false });
  const [showEmailForm, setShowEmailForm] = useState(false);

  const loadHistory = async () => {
    try {
      const res = await api.getReportHistory();
      const data = unwrap(res) || {};
      const d = (data && data.data && typeof data.data === 'object') ? data.data : data;
      setHistory(d.reports || d.history || d.items || []);
    } catch (err) {
      console.error('Failed to load report history:', err);
      setHistory([]);
    }
  };

  useEffect(() => { loadHistory(); }, []);

  const generateReport = async () => {
    setGenerating(true);
    setMessage(null);

    try {
      let response;
      if (selectedType === 'daily') response = await api.generateDailyReport();
      else if (selectedType === 'weekly') response = await api.generateWeeklyReport();
      else if (selectedType === 'monthly') response = await api.generateMonthlyReport();
      else response = await api.generateCustomReport(customDateRange.start, customDateRange.end);

      const payload = response?.data || {};
      setMessage({ type: 'success', text: 'Report generated successfully!' });

      const url = normalizeUrl(payload.download_url || payload.url || payload.file_url) ||
        (payload.file_path ? normalizeUrl(payload.file_path) : null);

      if (url) {
        window.open(url, '_blank');
      }

      await loadHistory();
    } catch (err) {
      console.error('Failed to generate report:', err);
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to generate report' });
    } finally {
      setGenerating(false);
    }
  };

  const exportData = async () => {
    setGenerating(true);
    setMessage(null);
    try {
      const start = selectedType === 'custom' ? customDateRange.start : null;
      const end = selectedType === 'custom' ? customDateRange.end : null;

      const responseType = selectedFormat === 'json' ? 'json' : 'blob';
      const res = await api.exportReport(selectedFormat, start, end, responseType);

      if (responseType === 'json') {
        const data = unwrap(res) || res?.data || {};
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `polyai-export-${selectedType}-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([res.data], { type: selectedFormat === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `polyai-export-${selectedType}-${new Date().toISOString().split('T')[0]}.${selectedFormat}`;
        a.click();
        URL.revokeObjectURL(url);
      }

      setMessage({ type: 'success', text: 'Export created!' });
    } catch (err) {
      console.error('Export failed:', err);
      setMessage({ type: 'error', text: 'Export failed (backend). You can still use the UI data tables.' });
    } finally {
      setGenerating(false);
    }
  };

  const sendReportEmail = async () => {
    if (!emailConfig.to) {
      setMessage({ type: 'error', text: 'Email recipient required' });
      return;
    }

    setGenerating(true);
    setMessage(null);
    try {
      const start = selectedType === 'custom' ? customDateRange.start : null;
      const end = selectedType === 'custom' ? customDateRange.end : null;

      await api.emailReport(emailConfig.to, start, end, selectedFormat);
      setMessage({ type: 'success', text: `Report sent to ${emailConfig.to}` });
      setShowEmailForm(false);
      setEmailConfig((prev) => ({ ...prev, to: '' }));
    } catch (err) {
      console.error('Email failed:', err);
      setMessage({ type: 'error', text: 'Failed to send email' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          📑 Reports Generator
        </h2>
        <p className="text-sm text-zinc-400 mt-1">Generate, export, and share performance reports</p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg border ${
          message.type === 'success' ? 'bg-green-900/30 text-green-400 border-green-700' : 'bg-red-900/30 text-red-400 border-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* Report Configuration */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span>🎛️</span>
          <span>Report Settings</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Report Type Selection */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Report Type</label>
            <div className="grid grid-cols-2 gap-2">
              {REPORT_TYPES.map((type) => (
                <button
                  key={type.key}
                  onClick={() => setSelectedType(type.key)}
                  className={`p-3 rounded-lg border text-left transition ${
                    selectedType === type.key
                      ? 'border-purple-500 bg-purple-900/30 text-purple-300'
                      : 'border-gray-700 hover:bg-gray-800 text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{type.icon}</span>
                    <span className="font-medium">{type.label}</span>
                  </div>
                </button>
              ))}
            </div>

            {selectedType === 'custom' && (
              <div className="mt-4 space-y-2">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={customDateRange.start}
                    onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-zinc-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">End Date</label>
                  <input
                    type="date"
                    value={customDateRange.end}
                    onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-zinc-200"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Export Format */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Export Format</label>
            <div className="space-y-2">
              {EXPORT_FORMATS.map((format) => (
                <button
                  key={format.key}
                  onClick={() => setSelectedFormat(format.key)}
                  className={`w-full p-3 rounded-lg border text-left transition ${
                    selectedFormat === format.key
                      ? 'border-purple-500 bg-purple-900/30 text-purple-300'
                      : 'border-gray-700 hover:bg-gray-800 text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{format.icon}</span>
                    <span className="font-medium">{format.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 mt-6 pt-6 border-t border-gray-800">
          <button
            onClick={generateReport}
            disabled={generating}
            className="px-6 py-3 rounded-lg font-medium text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
          >
            {generating ? 'Generating...' : '🚀 Generate Report'}
          </button>

          <button
            onClick={exportData}
            disabled={generating}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50"
          >
            {generating ? 'Exporting...' : '💾 Export Data'}
          </button>

          <button
            onClick={() => setShowEmailForm(!showEmailForm)}
            disabled={generating}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium disabled:opacity-50"
          >
            📧 Email Report
          </button>
        </div>

        {/* Email Form */}
        {showEmailForm && (
          <div className="mt-6 p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
            <h4 className="font-bold text-white mb-3">📧 Email Configuration</h4>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">To</label>
                <input
                  type="email"
                  value={emailConfig.to}
                  onChange={(e) => setEmailConfig({ ...emailConfig, to: e.target.value })}
                  placeholder="client@example.com"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-zinc-200"
                />
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-zinc-300">
                  <input
                    type="checkbox"
                    checked={emailConfig.includeCharts}
                    onChange={(e) => setEmailConfig({ ...emailConfig, includeCharts: e.target.checked })}
                    className="accent-purple-500"
                  />
                  <span className="text-sm">Include Charts</span>
                </label>

                <label className="flex items-center gap-2 text-zinc-300">
                  <input
                    type="checkbox"
                    checked={emailConfig.includeRawData}
                    onChange={(e) => setEmailConfig({ ...emailConfig, includeRawData: e.target.checked })}
                    className="accent-purple-500"
                  />
                  <span className="text-sm">Include Raw Data</span>
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={sendReportEmail}
                  disabled={generating}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50"
                >
                  Send
                </button>
                <button
                  onClick={() => setShowEmailForm(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Report History */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span>📚</span>
            <span>Report History</span>
          </h3>
          <button
            onClick={loadHistory}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-zinc-300 rounded-lg"
          >
            🔄 Refresh
          </button>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-2">📭</p>
            <p className="text-zinc-400">No reports generated yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.slice(0, 10).map((report, index) => (
              <div key={report.id || index} className="flex justify-between items-center p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
                <div>
                  <div className="font-medium text-white">{report.type || report.report_type || 'Report'}</div>
                  <div className="text-sm text-zinc-400">
                    Generated: {new Date(report.generated_at || report.created_at || Date.now()).toLocaleString()}
                  </div>
                </div>
                <div className="flex gap-2">
                  {(report.download_url || report.file_path) && (
                    <button
                      onClick={() => window.open(normalizeUrl(report.download_url || report.file_path), '_blank')}
                      className="px-3 py-1 rounded text-sm font-medium text-white"
                      style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
                    >
                      View
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsGenerator;
