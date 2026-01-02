import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

/**
 * ShiftNotes - End-of-day notes and shift handover
 */
function ShiftNotes({ currentUser }) {
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    setLoading(true);
    try {
      // Load from localStorage (in production, this would be an API)
      const saved = localStorage.getItem('polywerk_shift_notes');
      setNotes(saved ? JSON.parse(saved) : []);
    } catch (err) {
      console.error('Failed to load notes:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveNotes = (newNotes) => {
    localStorage.setItem('polywerk_shift_notes', JSON.stringify(newNotes));
    setNotes(newNotes);
  };

  const handleSaveNote = (note) => {
    if (editingNote) {
      // Update existing note
      const updated = notes.map(n => n.id === editingNote.id ? { ...note, id: editingNote.id } : n);
      saveNotes(updated);
    } else {
      // Add new note
      const newNote = {
        id: `note-${Date.now()}`,
        ...note,
        created_at: new Date().toISOString(),
        author: currentUser?.username || 'Unknown',
      };
      saveNotes([newNote, ...notes]);
    }
    setShowEditor(false);
    setEditingNote(null);
  };

  const handleDeleteNote = (id) => {
    if (window.confirm('Delete this note?')) {
      saveNotes(notes.filter(n => n.id !== id));
    }
  };

  const handleAcknowledge = (id) => {
    const updated = notes.map(n => {
      if (n.id === id) {
        const acknowledgedBy = n.acknowledged_by || [];
        if (!acknowledgedBy.includes(currentUser?.username)) {
          return {
            ...n,
            acknowledged_by: [...acknowledgedBy, currentUser?.username],
            acknowledged_at: new Date().toISOString(),
          };
        }
      }
      return n;
    });
    saveNotes(updated);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Filter notes
  const filteredNotes = notes.filter(note => {
    if (filter === 'unread') {
      return !note.acknowledged_by?.includes(currentUser?.username);
    } else if (filter === 'important') {
      return note.priority === 'high' || note.priority === 'urgent';
    }
    return true;
  });

  // Get unread count
  const unreadCount = notes.filter(n => 
    !n.acknowledged_by?.includes(currentUser?.username) && 
    n.author !== currentUser?.username
  ).length;

  const priorityColors = {
    low: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    normal: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const categoryIcons = {
    general: '📋',
    printer_issue: '🖨️',
    order_issue: '📦',
    inventory: '📊',
    customer: '👤',
    maintenance: '🔧',
    safety: '⚠️',
    success: '🎉',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            📝 Shift Notes
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400">
                {unreadCount} new
              </span>
            )}
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Handover notes and important updates for the team
          </p>
        </div>

        <button
          onClick={() => { setEditingNote(null); setShowEditor(true); }}
          className="px-4 py-2 rounded-lg font-medium text-white"
          style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
        >
          ✏️ New Note
        </button>
      </div>

      {/* Quick Templates */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { label: '🖨️ Printer Issue', category: 'printer_issue', priority: 'high' },
          { label: '📦 Order Update', category: 'order_issue', priority: 'normal' },
          { label: '⚠️ Safety Note', category: 'safety', priority: 'urgent' },
          { label: '🎉 Good News', category: 'success', priority: 'low' },
        ].map(template => (
          <button
            key={template.label}
            onClick={() => {
              setEditingNote(null);
              setShowEditor(true);
              // Will be handled by the editor with defaults
            }}
            className="px-3 py-1.5 rounded-lg text-sm text-slate-400 bg-slate-800 hover:bg-slate-700 whitespace-nowrap"
          >
            {template.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'unread', 'important'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize transition ${
              filter === f
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'text-slate-400 hover:text-white bg-slate-800'
            }`}
          >
            {f}
            {f === 'unread' && unreadCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-red-500/30">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notes List */}
      <div className="space-y-4">
        {filteredNotes.length === 0 ? (
          <div 
            className="rounded-xl border p-8 text-center"
            style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
          >
            <p className="text-4xl mb-2">📭</p>
            <p className="text-slate-400">No notes found</p>
            <button
              onClick={() => setShowEditor(true)}
              className="mt-4 text-purple-400 hover:text-purple-300"
            >
              Create the first note →
            </button>
          </div>
        ) : (
          filteredNotes.map(note => {
            const isOwn = note.author === currentUser?.username;
            const isAcknowledged = note.acknowledged_by?.includes(currentUser?.username);
            
            return (
              <div
                key={note.id}
                className={`rounded-xl border p-4 transition ${
                  !isOwn && !isAcknowledged ? 'border-l-4 border-l-purple-500' : ''
                }`}
                style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{categoryIcons[note.category] || '📋'}</span>
                    <div>
                      <h3 className="font-medium text-white">{note.title}</h3>
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <span>{note.author}</span>
                        <span>•</span>
                        <span>{formatDate(note.created_at)}</span>
                        <span>{formatTime(note.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs border ${priorityColors[note.priority] || priorityColors.normal}`}>
                      {note.priority}
                    </span>
                    {isOwn && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setEditingNote(note); setShowEditor(true); }}
                          className="p-1 text-slate-500 hover:text-white"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="p-1 text-slate-500 hover:text-red-400"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="text-slate-300 whitespace-pre-wrap mb-3">
                  {note.content}
                </div>

                {/* Action Items */}
                {note.action_items && note.action_items.length > 0 && (
                  <div className="mb-3 p-3 rounded-lg bg-slate-800">
                    <p className="text-sm font-medium text-slate-400 mb-2">Action Items:</p>
                    <ul className="space-y-1">
                      {note.action_items.map((item, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm text-white">
                          <span className="text-purple-400">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: '#334155' }}>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    {note.acknowledged_by && note.acknowledged_by.length > 0 && (
                      <>
                        <span>✓ Read by:</span>
                        <span>{note.acknowledged_by.join(', ')}</span>
                      </>
                    )}
                  </div>
                  
                  {!isOwn && !isAcknowledged && (
                    <button
                      onClick={() => handleAcknowledge(note.id)}
                      className="px-3 py-1 rounded-lg text-sm text-green-400 border border-green-500/30 hover:bg-green-500/10"
                    >
                      ✓ Mark as Read
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <NoteEditorModal
          note={editingNote}
          currentUser={currentUser}
          onSave={handleSaveNote}
          onClose={() => { setShowEditor(false); setEditingNote(null); }}
        />
      )}
    </div>
  );
}

/**
 * NoteEditorModal - Create or edit a shift note
 */
function NoteEditorModal({ note, currentUser, onSave, onClose }) {
  const [form, setForm] = useState({
    title: note?.title || '',
    content: note?.content || '',
    category: note?.category || 'general',
    priority: note?.priority || 'normal',
    action_items: note?.action_items || [],
  });
  const [newActionItem, setNewActionItem] = useState('');

  const categories = [
    { id: 'general', name: 'General', icon: '📋' },
    { id: 'printer_issue', name: 'Printer Issue', icon: '🖨️' },
    { id: 'order_issue', name: 'Order Issue', icon: '📦' },
    { id: 'inventory', name: 'Inventory', icon: '📊' },
    { id: 'customer', name: 'Customer', icon: '👤' },
    { id: 'maintenance', name: 'Maintenance', icon: '🔧' },
    { id: 'safety', name: 'Safety', icon: '⚠️' },
    { id: 'success', name: 'Good News', icon: '🎉' },
  ];

  const priorities = [
    { id: 'low', name: 'Low', color: 'bg-slate-500' },
    { id: 'normal', name: 'Normal', color: 'bg-blue-500' },
    { id: 'high', name: 'High', color: 'bg-orange-500' },
    { id: 'urgent', name: 'Urgent', color: 'bg-red-500' },
  ];

  const addActionItem = () => {
    if (newActionItem.trim()) {
      setForm({ ...form, action_items: [...form.action_items, newActionItem.trim()] });
      setNewActionItem('');
    }
  };

  const removeActionItem = (index) => {
    setForm({ ...form, action_items: form.action_items.filter((_, i) => i !== index) });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      alert('Please fill in title and content');
      return;
    }
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <div className="sticky top-0 px-6 py-4 border-b flex items-center justify-between z-10" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <h2 className="text-lg font-bold text-white">
            {note ? 'Edit Note' : 'New Shift Note'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="What's the main point?"
              className="w-full px-4 py-2 rounded-lg text-white"
              style={{ backgroundColor: '#334155' }}
              required
            />
          </div>

          {/* Category & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Priority</label>
              <div className="flex gap-1">
                {priorities.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setForm({ ...form, priority: p.id })}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${
                      form.priority === p.id
                        ? `${p.color} text-white`
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Content *</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Describe the situation, what happened, what needs attention..."
              rows={5}
              className="w-full px-4 py-3 rounded-lg text-white resize-none"
              style={{ backgroundColor: '#334155' }}
              required
            />
          </div>

          {/* Action Items */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              Action Items (Optional)
            </label>
            <div className="space-y-2">
              {form.action_items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-slate-800">
                  <span className="text-purple-400">•</span>
                  <span className="flex-1 text-white text-sm">{item}</span>
                  <button
                    type="button"
                    onClick={() => removeActionItem(idx)}
                    className="text-slate-500 hover:text-red-400"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newActionItem}
                  onChange={(e) => setNewActionItem(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addActionItem())}
                  placeholder="Add action item..."
                  className="flex-1 px-3 py-2 rounded-lg text-white text-sm"
                  style={{ backgroundColor: '#334155' }}
                />
                <button
                  type="button"
                  onClick={addActionItem}
                  className="px-3 py-2 rounded-lg text-purple-400 border border-purple-500/30 hover:bg-purple-500/10"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl font-medium text-slate-300 border border-slate-600 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl font-medium text-white"
              style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
            >
              {note ? 'Update Note' : 'Post Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ShiftNotes;
