import React, { useCallback, useEffect, useState } from 'react';
import { api, unwrap, API_BASE } from '../services/api';
import toast from '../utils/toast';

/**
 * FeedbackReviewQueue - Review and approve/reject AI-generated 3D models
 * Integrates with /api/ai/feedback/* endpoints
 */
export default function FeedbackReviewQueue() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState('pending'); // pending | accepted | rejected | all
  const [processing, setProcessing] = useState(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [entriesRes, statsRes] = await Promise.all([
        api.getFeedbackEntries?.({ status: filter === 'all' ? undefined : filter }) 
          || Promise.resolve({ data: { entries: [] } }),
        api.getFeedbackStatistics?.() || Promise.resolve({ data: {} }),
      ]);

      const entriesData = unwrap(entriesRes);
      const statsData = unwrap(statsRes);

      setEntries(Array.isArray(entriesData?.entries) ? entriesData.entries : 
                 Array.isArray(entriesData) ? entriesData : []);
      setStats(statsData || {});
    } catch (e) {
      console.error('Failed to load feedback entries:', e);
      setError(e?.message || 'Failed to load entries');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleAccept = async (entryId) => {
    setProcessing(entryId);
    try {
      await api.acceptFeedbackEntry?.(entryId);
      await loadEntries();
    } catch (e) {
      setError(e?.message || 'Failed to accept entry');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (entryId, reason = '') => {
    setProcessing(entryId);
    try {
      await api.rejectFeedbackEntry?.(entryId, { reason });
      await loadEntries();
    } catch (e) {
      setError(e?.message || 'Failed to reject entry');
    } finally {
      setProcessing(null);
    }
  };

  const handleExportTraining = async () => {
    try {
      const res = await api.exportFeedbackTraining?.();
      const data = unwrap(res);
      toast.success(`Exported ${data?.exported_count || 0} entries for training`);
    } catch (e) {
      toast.error(e?.message || 'Failed to export training data');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">🔍 Feedback Review Queue</h2>
          <p className="text-sm text-gray-500">Review AI-generated 3D models for training</p>
        </div>
        <button
          onClick={handleExportTraining}
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
        >
          📤 Export for Training
        </button>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.total || 0}</div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-yellow-700">{stats.pending || 0}</div>
            <div className="text-xs text-gray-500">Pending</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-700">{stats.accepted || 0}</div>
            <div className="text-xs text-gray-500">Accepted</div>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-700">{stats.rejected || 0}</div>
            <div className="text-xs text-gray-500">Rejected</div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4">
        {['all', 'pending', 'accepted', 'rejected'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded text-sm ${
              filter === f
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <button
          onClick={loadEntries}
          className="ml-auto px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
        >
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading entries...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-2">📭</div>
          <p className="text-gray-500">No entries found</p>
          <p className="text-sm text-gray-400">Generate some 3D models to review them here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {entries.map((entry) => (
            <div
              key={entry.id || entry.generation_id}
              className="border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              {/* Preview Images */}
              <div className="flex gap-2 mb-3">
                {entry.input_image && (
                  <div className="flex-1">
                    <img
                      src={entry.input_image.startsWith('http') 
                        ? entry.input_image 
                        : `${API_BASE}${entry.input_image}`}
                      alt="Input"
                      className="w-full h-24 object-cover rounded bg-gray-100"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div className="text-xs text-gray-400 text-center mt-1">Input</div>
                  </div>
                )}
                {entry.output_preview && (
                  <div className="flex-1">
                    <img
                      src={entry.output_preview.startsWith('http')
                        ? entry.output_preview
                        : `${API_BASE}${entry.output_preview}`}
                      alt="Output"
                      className="w-full h-24 object-cover rounded bg-gray-100"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div className="text-xs text-gray-400 text-center mt-1">Output</div>
                  </div>
                )}
              </div>

              {/* Entry Info */}
              <div className="space-y-1 mb-3">
                <div className="flex justify-between items-center">
                  <span className={`px-2 py-0.5 rounded text-xs ${getStatusBadge(entry.status)}`}>
                    {entry.status || 'unknown'}
                  </span>
                  {entry.quality_score !== undefined && (
                    <span className="text-xs text-gray-500">
                      Score: {(entry.quality_score * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {entry.backend && <span>Backend: {entry.backend}</span>}
                </div>
                <div className="text-xs text-gray-400">
                  {entry.created_at && new Date(entry.created_at).toLocaleString()}
                </div>
              </div>

              {/* Actions */}
              {entry.status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAccept(entry.id || entry.generation_id)}
                    disabled={processing === (entry.id || entry.generation_id)}
                    className="flex-1 px-3 py-1.5 bg-green-500 text-white rounded text-sm hover:bg-green-600 disabled:opacity-50"
                  >
                    ✓ Accept
                  </button>
                  <button
                    onClick={() => handleReject(entry.id || entry.generation_id)}
                    disabled={processing === (entry.id || entry.generation_id)}
                    className="flex-1 px-3 py-1.5 bg-red-500 text-white rounded text-sm hover:bg-red-600 disabled:opacity-50"
                  >
                    ✗ Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
