import React, { useState, useEffect } from 'react';
import { api, unwrap } from '../services/api';
import { sanitizeText } from '../utils/sanitization';

/**
 * FeedbackReporter - Floating bug/feedback reporting widget
 * 
 * Users can report:
 * - Missing translations
 * - UI issues
 * - Feature requests
 * - Bugs/problems
 */
function FeedbackReporter({ currentUser }) {
  const [isOpen, setIsOpen] = useState(false);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('new'); // 'new' or 'list'
  const [submitStatus, setSubmitStatus] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    type: 'bug',
    title: '',
    description: '',
    page: window.location.pathname,
    priority: 'medium',
  });

  const issueTypes = [
    { id: 'bug', label: 'Bug / Problem', icon: '🐛', color: 'red' },
    { id: 'translation', label: 'Missing Translation', icon: '🌐', color: 'blue' },
    { id: 'ui', label: 'UI Issue', icon: '🎨', color: 'purple' },
    { id: 'feature', label: 'Feature Request', icon: '💡', color: 'yellow' },
    { id: 'other', label: 'Other', icon: '📝', color: 'gray' },
  ];

  const priorities = [
    { id: 'low', label: 'Low', color: 'text-gray-400' },
    { id: 'medium', label: 'Medium', color: 'text-yellow-400' },
    { id: 'high', label: 'High', color: 'text-orange-400' },
    { id: 'critical', label: 'Critical', color: 'text-red-400' },
  ];

  useEffect(() => {
    if (isOpen && viewMode === 'list') {
      loadIssues();
    }
  }, [isOpen, viewMode]);

  const loadIssues = async () => {
    setLoading(true);
    try {
      const res = await api.getFeedbackIssues();
      const data = unwrap(res);
      setIssues(Array.isArray(data) ? data : (data?.issues || []));
    } catch (err) {
      console.error('Failed to load issues:', err);
      setIssues([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      setSubmitStatus({ type: 'error', message: 'Title is required' });
      return;
    }

    setLoading(true);
    setSubmitStatus(null);

    try {
      await api.submitFeedback({
        ...formData,
        reported_by: currentUser?.username || 'anonymous',
        reported_by_name: currentUser?.full_name || 'Anonymous',
        user_agent: navigator.userAgent,
        screen_size: `${window.innerWidth}x${window.innerHeight}`,
        timestamp: new Date().toISOString(),
      });

      setSubmitStatus({ type: 'success', message: 'Feedback submitted! Thank you.' });
      setFormData({
        type: 'bug',
        title: '',
        description: '',
        page: window.location.pathname,
        priority: 'medium',
      });

      // Switch to list view after short delay
      setTimeout(() => {
        setViewMode('list');
        loadIssues();
      }, 1500);
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      setSubmitStatus({ type: 'error', message: 'Failed to submit. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (issueId, newStatus) => {
    try {
      await api.updateFeedbackStatus(issueId, newStatus);
      loadIssues();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const getTypeInfo = (type) => issueTypes.find(t => t.id === type) || issueTypes[4];

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-24 right-6 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
        style={{
          background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
        }}
        title="Report Issue / Feedback"
      >
        <span className="text-xl">{isOpen ? '✕' : '🐛'}</span>
      </button>

      {/* Panel */}
      {isOpen && (
        <div 
          className="fixed bottom-40 right-6 z-50 w-96 max-h-[70vh] rounded-xl shadow-2xl border overflow-hidden flex flex-col"
          style={{ 
            backgroundColor: '#1e293b',
            borderColor: '#334155',
          }}
        >
          {/* Header */}
          <div 
            className="p-4 border-b flex items-center justify-between"
            style={{ borderColor: '#334155' }}
          >
            <div>
              <h3 className="font-bold text-white flex items-center gap-2">
                🐛 Feedback & Issues
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Report problems or suggestions</p>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setViewMode('new')}
                className={`px-3 py-1 rounded text-xs font-medium transition ${
                  viewMode === 'new' 
                    ? 'bg-amber-500 text-white' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                + New
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 rounded text-xs font-medium transition ${
                  viewMode === 'list' 
                    ? 'bg-amber-500 text-white' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                List ({issues.length})
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {viewMode === 'new' ? (
              /* New Issue Form */
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Type Selection */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">Issue Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {issueTypes.map(type => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, type: type.id })}
                        className={`p-2 rounded-lg border text-left text-sm transition ${
                          formData.type === type.id
                            ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                            : 'border-slate-600 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        <span className="mr-2">{type.icon}</span>
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Brief description of the issue"
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: '#334155', borderColor: '#475569', color: '#f1f5f9' }}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Details</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Steps to reproduce, expected behavior, etc."
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                    style={{ backgroundColor: '#334155', borderColor: '#475569', color: '#f1f5f9' }}
                  />
                </div>

                {/* Priority & Page */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Priority</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{ backgroundColor: '#334155', borderColor: '#475569', color: '#f1f5f9' }}
                    >
                      {priorities.map(p => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Page</label>
                    <input
                      type="text"
                      value={formData.page}
                      onChange={(e) => setFormData({ ...formData, page: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{ backgroundColor: '#334155', borderColor: '#475569', color: '#f1f5f9' }}
                    />
                  </div>
                </div>

                {/* Status Message */}
                {submitStatus && (
                  <div className={`p-3 rounded-lg text-sm ${
                    submitStatus.type === 'success' 
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}>
                    {submitStatus.message}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg font-medium text-white disabled:opacity-50 transition"
                  style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' }}
                >
                  {loading ? 'Submitting...' : '📤 Submit Feedback'}
                </button>
              </form>
            ) : (
              /* Issues List */
              <div className="space-y-3">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full mx-auto"></div>
                    <p className="text-slate-400 text-sm mt-2">Loading...</p>
                  </div>
                ) : issues.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-4xl mb-2">✨</p>
                    <p className="text-slate-400">No issues reported yet</p>
                    <button
                      onClick={() => setViewMode('new')}
                      className="mt-3 text-amber-400 text-sm hover:underline"
                    >
                      Report the first one →
                    </button>
                  </div>
                ) : (
                  issues.map(issue => {
                    const typeInfo = getTypeInfo(issue.type);
                    return (
                      <div
                        key={issue.id}
                        className="p-3 rounded-lg border"
                        style={{ backgroundColor: '#334155', borderColor: '#475569' }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span>{typeInfo.icon}</span>
                              {/* FIXED: Sanitize issue title to prevent XSS */}
                              <span className="font-medium text-white text-sm truncate">
                                {sanitizeText(issue.title)}
                              </span>
                            </div>
                            {issue.description && (
                              <p className="text-xs text-slate-400 line-clamp-2 mb-2">
                                {sanitizeText(issue.description)}
                              </p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span>{issue.reported_by_name || issue.reported_by}</span>
                              <span>•</span>
                              <span>{new Date(issue.timestamp).toLocaleDateString()}</span>
                              {issue.page && (
                                <>
                                  <span>•</span>
                                  <span className="truncate max-w-20">{issue.page}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              issue.status === 'open' ? 'bg-amber-500/20 text-amber-400' :
                              issue.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                              issue.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                              'bg-slate-600 text-slate-400'
                            }`}>
                              {issue.status || 'open'}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              issue.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                              issue.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                              issue.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-slate-600 text-slate-400'
                            }`}>
                              {issue.priority}
                            </span>
                          </div>
                        </div>
                        
                        {/* Quick Actions for owner/partner */}
                        {(currentUser?.role === 'owner' || currentUser?.role === 'partner') && (
                          <div className="mt-2 pt-2 border-t border-slate-600 flex gap-2">
                            <button
                              onClick={() => handleStatusUpdate(issue.id, 'in_progress')}
                              className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                            >
                              In Progress
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(issue.id, 'resolved')}
                              className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30"
                            >
                              Resolved
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(issue.id, 'closed')}
                              className="text-xs px-2 py-1 rounded bg-slate-600 text-slate-400 hover:bg-slate-500"
                            >
                              Close
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default FeedbackReporter;
