import React, { useEffect, useMemo, useState } from "react";
import { api, unwrap } from "../services/api";
import { useLanguage } from "../i18n";

/**
 * MaintenanceCalendar - Manage printer maintenance tasks
 * Includes CRUD, recurring schedules, and completion tracking
 */
export default function MaintenanceCalendar() {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [filter, setFilter] = useState('upcoming'); // 'upcoming' | 'completed' | 'all'

  const [formData, setFormData] = useState({
    title: '',
    printer_id: '',
    due_date: new Date().toISOString().split('T')[0],
    recurring: 'none', // 'none' | 'weekly' | 'monthly' | 'quarterly'
    priority: 'normal', // 'low' | 'normal' | 'high'
    notes: '',
    estimated_minutes: 30,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const [maintResp, printersResp] = await Promise.all([
        api.getUpcomingMaintenance().catch(() => ({ data: [] })),
        api.getPrinters().catch(() => []),
      ]);
      
      // Handle maintenance data
      const maintData = unwrap(maintResp) || maintResp?.data || [];
      const list = Array.isArray(maintData) ? maintData : maintData.items || maintData.events || [];

      const normalized = list.map((x, idx) => ({
        id: x.id || x.event_id || String(idx),
        title: x.title || x.name || "Maintenance",
        printer_id: x.printer_id || x.printer || "",
        printer_name: x.printer_name || x.printer || "",
        due_date: x.dueAt || x.due_at || x.due_date || "",
        status: x.status || "planned",
        notes: x.notes || x.description || "",
        recurring: x.recurring || 'none',
        priority: x.priority || 'normal',
        estimated_minutes: x.estimated_minutes || 30,
        completed_at: x.completed_at || null,
        completed_by: x.completed_by || null,
      }));

      setItems(normalized);
      
      // Handle printers data
      const printersData = unwrap(printersResp) || printersResp?.data || printersResp;
      const printerList = Array.isArray(printersData) ? printersData : printersData?.printers || [];
      setPrinters(printerList);
      
      // Load from localStorage as fallback/additional
      const savedItems = localStorage.getItem('polywerk_maintenance');
      if (savedItems) {
        const localItems = JSON.parse(savedItems);
        const combined = [...normalized, ...localItems.filter(l => !normalized.find(n => n.id === l.id))];
        setItems(combined);
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || "Failed to load maintenance items";
      setError(String(msg));
      
      // Try localStorage fallback
      const savedItems = localStorage.getItem('polywerk_maintenance');
      if (savedItems) {
        setItems(JSON.parse(savedItems));
      }
    } finally {
      setLoading(false);
    }
  };

  const saveToLocalStorage = (newItems) => {
    localStorage.setItem('polywerk_maintenance', JSON.stringify(newItems));
  };

  const resetForm = () => {
    setFormData({
      title: '',
      printer_id: '',
      due_date: new Date().toISOString().split('T')[0],
      recurring: 'none',
      priority: 'normal',
      notes: '',
      estimated_minutes: 30,
    });
    setEditingItem(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const printer = printers.find(p => (p.printer_id || p.id) === formData.printer_id);
    
    const newItem = {
      id: editingItem?.id || `maint-${Date.now()}`,
      ...formData,
      printer_name: printer?.name || formData.printer_id || 'All Printers',
      status: editingItem?.status || 'planned',
      created_at: editingItem?.created_at || new Date().toISOString(),
      completed_at: editingItem?.completed_at || null,
      completed_by: editingItem?.completed_by || null,
    };

    try {
      // Try API first
      if (editingItem) {
        await api.updateMaintenance(editingItem.id, newItem).catch(() => {});
      } else {
        await api.createMaintenance(newItem).catch(() => {});
      }
    } catch (err) {
      // Silently continue - will save locally
    }

    // Update local state
    let updatedItems;
    if (editingItem) {
      updatedItems = items.map(i => i.id === editingItem.id ? newItem : i);
    } else {
      updatedItems = [newItem, ...items];
    }
    
    setItems(updatedItems);
    saveToLocalStorage(updatedItems);
    resetForm();
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      title: item.title || '',
      printer_id: item.printer_id || '',
      due_date: item.due_date?.split('T')[0] || new Date().toISOString().split('T')[0],
      recurring: item.recurring || 'none',
      priority: item.priority || 'normal',
      notes: item.notes || '',
      estimated_minutes: item.estimated_minutes || 30,
    });
    setShowForm(true);
  };

  const handleComplete = async (item) => {
    const completedItem = {
      ...item,
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_by: sessionStorage.getItem('currentUser') ? JSON.parse(sessionStorage.getItem('currentUser')).username : 'Unknown',
    };

    try {
      await api.completeMaintenance(item.id).catch(() => {});
    } catch (err) {
      // Continue anyway
    }

    let updatedItems = items.map(i => i.id === item.id ? completedItem : i);
    
    // If recurring, create next occurrence
    if (item.recurring && item.recurring !== 'none') {
      const nextDate = getNextRecurringDate(item.due_date, item.recurring);
      const nextItem = {
        ...item,
        id: `maint-${Date.now()}`,
        due_date: nextDate,
        status: 'planned',
        completed_at: null,
        completed_by: null,
        created_at: new Date().toISOString(),
      };
      updatedItems = [nextItem, ...updatedItems];
    }

    setItems(updatedItems);
    saveToLocalStorage(updatedItems);
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`${t('maintenance.deleteConfirm') || 'Delete'} "${item.title}"?`)) return;

    try {
      await api.deleteMaintenance(item.id).catch(() => {});
    } catch (err) {
      // Continue anyway
    }

    const updatedItems = items.filter(i => i.id !== item.id);
    setItems(updatedItems);
    saveToLocalStorage(updatedItems);
  };

  const getNextRecurringDate = (dateStr, recurring) => {
    const date = new Date(dateStr);
    switch (recurring) {
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() + 3);
        break;
      default:
        break;
    }
    return date.toISOString().split('T')[0];
  };

  const getStatusInfo = (item) => {
    if (item.status === 'completed') {
      return { 
        style: 'text-green-400 bg-green-500/10 border-green-500/30',
        label: t('maintenance.completed') || 'Completed',
        icon: '✅'
      };
    }
    
    const dueDate = new Date(item.due_date);
    const now = new Date();
    const daysUntil = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 0) {
      return { 
        style: 'text-red-400 bg-red-500/10 border-red-500/30',
        label: t('maintenance.overdue') || 'Overdue',
        icon: '🔴'
      };
    }
    if (daysUntil <= 3) {
      return { 
        style: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
        label: t('maintenance.dueSoon') || 'Due Soon',
        icon: '🟡'
      };
    }
    return { 
      style: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
      label: t('maintenance.planned') || 'Planned',
      icon: '🔵'
    };
  };

  const getPriorityStyle = (priority) => {
    switch (priority) {
      case 'high': return 'text-red-400';
      case 'low': return 'text-slate-500';
      default: return 'text-white';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const filteredItems = useMemo(() => {
    let filtered = [...items];
    
    if (filter === 'upcoming') {
      filtered = filtered.filter(i => i.status !== 'completed');
    } else if (filter === 'completed') {
      filtered = filtered.filter(i => i.status === 'completed');
    }
    
    // Sort: overdue first, then by due date
    return filtered.sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (a.status !== 'completed' && b.status === 'completed') return -1;
      return new Date(a.due_date) - new Date(b.due_date);
    });
  }, [items, filter]);

  // Stats
  const stats = useMemo(() => {
    const now = new Date();
    const overdue = items.filter(i => i.status !== 'completed' && new Date(i.due_date) < now);
    const upcoming = items.filter(i => i.status !== 'completed' && new Date(i.due_date) >= now);
    const completedThisMonth = items.filter(i => {
      if (i.status !== 'completed') return false;
      const completed = new Date(i.completed_at);
      return completed.getMonth() === now.getMonth() && completed.getFullYear() === now.getFullYear();
    });
    
    return {
      overdue: overdue.length,
      upcoming: upcoming.length,
      completedThisMonth: completedThisMonth.length,
      total: items.length,
    };
  }, [items]);

  // Maintenance templates
  const templates = [
    { title: 'Clean print bed', minutes: 15, recurring: 'weekly' },
    { title: 'Lubricate rails', minutes: 20, recurring: 'monthly' },
    { title: 'Check belt tension', minutes: 10, recurring: 'monthly' },
    { title: 'Clean nozzle', minutes: 30, recurring: 'weekly' },
    { title: 'Replace nozzle', minutes: 30, recurring: 'quarterly' },
    { title: 'Calibrate bed level', minutes: 20, recurring: 'monthly' },
    { title: 'Update firmware', minutes: 45, recurring: 'none' },
    { title: 'Full cleaning', minutes: 60, recurring: 'monthly' },
  ];

  const applyTemplate = (template) => {
    setFormData(prev => ({
      ...prev,
      title: template.title,
      estimated_minutes: template.minutes,
      recurring: template.recurring,
    }));
  };

  if (loading) {
    return (
      <div className="rounded-xl border p-6" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-700 rounded w-1/4"></div>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-slate-800 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            🔧 {t('maintenance.title') || 'Maintenance'}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {t('maintenance.subtitle') || 'Schedule and track printer maintenance'}
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="px-4 py-2.5 rounded-lg font-medium text-white"
          style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
        >
          + {t('maintenance.addTask') || 'Add Task'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-sm text-slate-400">{t('maintenance.overdue') || 'Overdue'}</p>
          <p className={`text-2xl font-bold ${stats.overdue > 0 ? 'text-red-400' : 'text-slate-600'}`}>
            {stats.overdue}
          </p>
        </div>
        <div className="p-4 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-sm text-slate-400">{t('maintenance.upcoming') || 'Upcoming'}</p>
          <p className="text-2xl font-bold text-blue-400">{stats.upcoming}</p>
        </div>
        <div className="p-4 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-sm text-slate-400">{t('maintenance.completedThisMonth') || 'Completed (Month)'}</p>
          <p className="text-2xl font-bold text-green-400">{stats.completedThisMonth}</p>
        </div>
        <div className="p-4 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-sm text-slate-400">{t('common.total') || 'Total'}</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="rounded-xl border p-6" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white">
              {editingItem ? (t('maintenance.editTask') || 'Edit Task') : (t('maintenance.addTask') || 'Add Task')}
            </h3>
            <button onClick={resetForm} className="text-slate-400 hover:text-white">✕</button>
          </div>

          {/* Quick Templates */}
          {!editingItem && (
            <div className="mb-4">
              <p className="text-sm text-slate-400 mb-2">{t('maintenance.quickTemplates') || 'Quick Templates'}</p>
              <div className="flex flex-wrap gap-2">
                {templates.map((template, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applyTemplate(template)}
                    className="px-3 py-1.5 rounded-lg text-xs bg-slate-700 text-slate-300 hover:bg-slate-600 transition"
                  >
                    {template.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {t('maintenance.taskName') || 'Task Name'} *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
                placeholder="e.g., Clean print bed"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {t('maintenance.printer') || 'Printer'}
              </label>
              <select
                value={formData.printer_id}
                onChange={(e) => setFormData({ ...formData, printer_id: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              >
                <option value="">{t('maintenance.allPrinters') || 'All Printers'}</option>
                {printers.map(p => (
                  <option key={p.printer_id || p.id} value={p.printer_id || p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {t('maintenance.dueDate') || 'Due Date'} *
              </label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {t('maintenance.recurring') || 'Recurring'}
              </label>
              <select
                value={formData.recurring}
                onChange={(e) => setFormData({ ...formData, recurring: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              >
                <option value="none">{t('maintenance.noRecurring') || 'No Repeat'}</option>
                <option value="weekly">{t('maintenance.weekly') || 'Weekly'}</option>
                <option value="monthly">{t('maintenance.monthly') || 'Monthly'}</option>
                <option value="quarterly">{t('maintenance.quarterly') || 'Quarterly'}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {t('maintenance.priority') || 'Priority'}
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              >
                <option value="low">{t('common.low') || 'Low'}</option>
                <option value="normal">{t('common.normal') || 'Normal'}</option>
                <option value="high">{t('common.high') || 'High'}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {t('maintenance.estimatedTime') || 'Est. Time (min)'}
              </label>
              <input
                type="number"
                min="1"
                value={formData.estimated_minutes}
                onChange={(e) => setFormData({ ...formData, estimated_minutes: parseInt(e.target.value) || 30 })}
                className="w-full px-4 py-2.5 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {t('common.notes') || 'Notes'}
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg text-white resize-none"
                style={{ backgroundColor: '#334155' }}
                rows={2}
                placeholder={t('maintenance.notesPlaceholder') || 'Additional instructions or notes...'}
              />
            </div>

            <div className="sm:col-span-2 flex gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 py-2.5 rounded-lg font-medium text-slate-300 border border-slate-600 hover:bg-slate-700"
              >
                {t('common.cancel') || 'Cancel'}
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-lg font-medium text-white"
                style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
              >
                {editingItem ? (t('common.update') || 'Update') : (t('common.create') || 'Create')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 p-1 rounded-lg w-fit" style={{ backgroundColor: '#1e293b' }}>
        {[
          { id: 'upcoming', label: t('maintenance.upcoming') || 'Upcoming' },
          { id: 'completed', label: t('maintenance.completed') || 'Completed' },
          { id: 'all', label: t('common.all') || 'All' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              filter === f.id ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Maintenance List */}
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        {filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-2">{filter === 'completed' ? '🎉' : '✅'}</p>
            <p className="text-slate-400">
              {filter === 'completed' 
                ? (t('maintenance.noCompletedTasks') || 'No completed tasks')
                : (t('maintenance.noTasks') || 'No maintenance tasks scheduled')
              }
            </p>
            {filter !== 'completed' && (
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 text-purple-400 hover:underline text-sm"
              >
                {t('maintenance.scheduleFirst') || 'Schedule your first maintenance task'} →
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#334155' }}>
            {filteredItems.map((item) => {
              const statusInfo = getStatusInfo(item);
              return (
                <div 
                  key={item.id}
                  className="p-4 hover:bg-slate-800/50 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Status Icon */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-2xl">{statusInfo.icon}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`font-medium ${getPriorityStyle(item.priority)}`}>
                            {item.title}
                          </p>
                          {item.recurring && item.recurring !== 'none' && (
                            <span className="px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400">
                              🔄 {item.recurring}
                            </span>
                          )}
                          {item.priority === 'high' && (
                            <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400">
                              ⚡ {t('common.high') || 'High'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-400 mt-1">
                          <span>🖨️ {item.printer_name || t('maintenance.allPrinters') || 'All'}</span>
                          <span>📅 {formatDate(item.due_date)}</span>
                          <span>⏱️ {item.estimated_minutes}m</span>
                        </div>
                        {item.notes && (
                          <p className="text-xs text-slate-500 mt-1 truncate">{item.notes}</p>
                        )}
                        {item.completed_at && (
                          <p className="text-xs text-green-400/70 mt-1">
                            ✓ {t('maintenance.completedBy') || 'Completed by'} {item.completed_by} • {formatDate(item.completed_at)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className={`px-3 py-1 rounded-lg text-xs font-medium border ${statusInfo.style}`}>
                      {statusInfo.label}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 sm:flex-shrink-0">
                      {item.status !== 'completed' && (
                        <>
                          <button
                            onClick={() => handleComplete(item)}
                            className="px-3 py-1.5 rounded text-sm font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30 transition"
                          >
                            ✓ {t('maintenance.markDone') || 'Done'}
                          </button>
                          <button
                            onClick={() => handleEdit(item)}
                            className="px-3 py-1.5 rounded text-sm font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition"
                          >
                            ✏️
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(item)}
                        className="px-3 py-1.5 rounded text-sm font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
        <p className="text-sm text-blue-400">
          💡 <strong>{t('maintenance.tip') || 'Tip'}:</strong> {t('maintenance.tipText') || 'Regular maintenance extends printer life and improves print quality. Set up recurring tasks to never miss important upkeep.'}
        </p>
      </div>
    </div>
  );
}
