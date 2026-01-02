import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

/**
 * CustomerCommunicationLog - Track all interactions with customers
 * Supports notes, calls, emails, meetings
 */
function CustomerCommunicationLog({ customerId, customerName }) {
  const [logs, setLogs] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLog, setNewLog] = useState({
    type: 'note',
    subject: '',
    content: '',
    outcome: '',
    followUpDate: '',
  });

  useEffect(() => {
    loadLogs();
  }, [customerId]);

  const loadLogs = () => {
    const saved = localStorage.getItem(`polywerk_comm_log_${customerId}`);
    if (saved) {
      try {
        setLogs(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load communication logs:', e);
      }
    }
  };

  const saveLogs = (updatedLogs) => {
    localStorage.setItem(`polywerk_comm_log_${customerId}`, JSON.stringify(updatedLogs));
    setLogs(updatedLogs);
  };

  const addLog = () => {
    if (!newLog.subject.trim()) {
      toast.error('Please add a subject');
      return;
    }

    const log = {
      id: `log-${Date.now()}`,
      ...newLog,
      createdAt: new Date().toISOString(),
      createdBy: 'Current User', // Would come from auth
    };

    const updated = [log, ...logs];
    saveLogs(updated);
    
    setNewLog({
      type: 'note',
      subject: '',
      content: '',
      outcome: '',
      followUpDate: '',
    });
    setShowAddForm(false);
    toast.success('Log added');
  };

  const deleteLog = (logId) => {
    if (!window.confirm('Delete this log entry?')) return;
    const updated = logs.filter(l => l.id !== logId);
    saveLogs(updated);
    toast.success('Log deleted');
  };

  const logTypes = {
    note: { icon: '📝', label: 'Note', color: 'text-slate-400' },
    call: { icon: '📞', label: 'Call', color: 'text-green-400' },
    email: { icon: '📧', label: 'Email', color: 'text-cyan-400' },
    meeting: { icon: '👥', label: 'Meeting', color: 'text-purple-400' },
    quote: { icon: '💰', label: 'Quote', color: 'text-yellow-400' },
    order: { icon: '📦', label: 'Order', color: 'text-blue-400' },
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    
    if (days === 0) {
      return 'Today ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-white flex items-center gap-2">
          💬 Communication Log
          <span className="text-xs text-slate-500">({logs.length})</span>
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-3 py-1 rounded-lg text-sm bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
        >
          {showAddForm ? 'Cancel' : '+ Add Entry'}
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="rounded-xl border p-4 space-y-4" style={{ backgroundColor: '#334155', borderColor: '#475569' }}>
          {/* Type Selection */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Type</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(logTypes).map(([key, { icon, label }]) => (
                <button
                  key={key}
                  onClick={() => setNewLog(prev => ({ ...prev, type: key }))}
                  className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 ${
                    newLog.type === key 
                      ? 'bg-purple-500 text-white' 
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Subject *</label>
            <input
              type="text"
              value={newLog.subject}
              onChange={(e) => setNewLog(prev => ({ ...prev, subject: e.target.value }))}
              placeholder="Brief summary..."
              className="w-full px-3 py-2 rounded-lg text-white text-sm"
              style={{ backgroundColor: '#1e293b' }}
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Details</label>
            <textarea
              value={newLog.content}
              onChange={(e) => setNewLog(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Full details of the interaction..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-white text-sm"
              style={{ backgroundColor: '#1e293b' }}
            />
          </div>

          {/* Outcome */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Outcome</label>
            <select
              value={newLog.outcome}
              onChange={(e) => setNewLog(prev => ({ ...prev, outcome: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-white text-sm"
              style={{ backgroundColor: '#1e293b' }}
            >
              <option value="">Select outcome...</option>
              <option value="positive">✅ Positive - Moving forward</option>
              <option value="neutral">➖ Neutral - No change</option>
              <option value="negative">❌ Negative - Lost interest</option>
              <option value="followup">📅 Needs follow-up</option>
            </select>
          </div>

          {/* Follow-up Date */}
          {newLog.outcome === 'followup' && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">Follow-up Date</label>
              <input
                type="date"
                value={newLog.followUpDate}
                onChange={(e) => setNewLog(prev => ({ ...prev, followUpDate: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-white text-sm"
                style={{ backgroundColor: '#1e293b' }}
              />
            </div>
          )}

          {/* Save Button */}
          <button
            onClick={addLog}
            className="w-full py-2 rounded-lg font-medium text-white"
            style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
          >
            Save Entry
          </button>
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-3">
        {logs.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">
            No communication history yet
          </p>
        ) : (
          logs.map((log, index) => {
            const typeInfo = logTypes[log.type] || logTypes.note;
            return (
              <div
                key={log.id}
                className="relative pl-8 pb-4"
              >
                {/* Timeline line */}
                {index < logs.length - 1 && (
                  <div 
                    className="absolute left-3 top-8 bottom-0 w-0.5 bg-slate-700"
                  />
                )}
                
                {/* Icon */}
                <div 
                  className={`absolute left-0 top-0 w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                    log.outcome === 'positive' ? 'bg-green-500/20' :
                    log.outcome === 'negative' ? 'bg-red-500/20' :
                    'bg-slate-700'
                  }`}
                >
                  {typeInfo.icon}
                </div>

                {/* Content */}
                <div 
                  className="rounded-lg border p-3"
                  style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className={`text-sm font-medium ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                      <span className="text-slate-500 text-sm ml-2">
                        {formatDate(log.createdAt)}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteLog(log.id)}
                      className="text-slate-500 hover:text-red-400 text-xs"
                    >
                      🗑️
                    </button>
                  </div>
                  
                  <p className="text-white font-medium mt-1">{log.subject}</p>
                  
                  {log.content && (
                    <p className="text-slate-400 text-sm mt-1">{log.content}</p>
                  )}

                  {log.outcome && (
                    <div className="mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        log.outcome === 'positive' ? 'bg-green-500/20 text-green-400' :
                        log.outcome === 'negative' ? 'bg-red-500/20 text-red-400' :
                        log.outcome === 'followup' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-slate-600 text-slate-400'
                      }`}>
                        {log.outcome === 'positive' && '✅ Positive'}
                        {log.outcome === 'negative' && '❌ Negative'}
                        {log.outcome === 'neutral' && '➖ Neutral'}
                        {log.outcome === 'followup' && `📅 Follow-up: ${log.followUpDate}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Actions */}
      {logs.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t" style={{ borderColor: '#334155' }}>
          <button 
            onClick={() => setNewLog(prev => ({ ...prev, type: 'call' })) || setShowAddForm(true)}
            className="px-3 py-1 rounded-lg text-xs bg-green-500/20 text-green-400 hover:bg-green-500/30"
          >
            📞 Log Call
          </button>
          <button 
            onClick={() => setNewLog(prev => ({ ...prev, type: 'email' })) || setShowAddForm(true)}
            className="px-3 py-1 rounded-lg text-xs bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
          >
            📧 Log Email
          </button>
          <button 
            onClick={() => setNewLog(prev => ({ ...prev, type: 'meeting' })) || setShowAddForm(true)}
            className="px-3 py-1 rounded-lg text-xs bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
          >
            👥 Log Meeting
          </button>
        </div>
      )}
    </div>
  );
}

export default CustomerCommunicationLog;
