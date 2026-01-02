import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useLanguage } from '../i18n';

/**
 * TimeTracker - Track time spent on jobs and orders
 * Includes break tracking, weekly view, and export
 */
function TimeTracker({ currentUser }) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [activeTimer, setActiveTimer] = useState(null);
  const [timeEntries, setTimeEntries] = useState([]);
  const [orders, setOrders] = useState([]);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [filter, setFilter] = useState('today');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'weekly'
  const [breakActive, setBreakActive] = useState(false);
  const [breakStart, setBreakStart] = useState(null);
  const [totalBreakTime, setTotalBreakTime] = useState(0);
  const timerRef = useRef(null);
  const breakRef = useRef(null);

  // Daily target in hours (configurable)
  const dailyTargetHours = currentUser?.hourly_target || 8;

  useEffect(() => {
    loadData();
    loadSavedTimer();
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (breakRef.current) clearInterval(breakRef.current);
    };
  }, []);

  // Update elapsed time every second when timer is active
  useEffect(() => {
    if (activeTimer && !breakActive) {
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - new Date(activeTimer.started_at).getTime()) / 1000) - totalBreakTime);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeTimer, breakActive, totalBreakTime]);

  // Update break time every second
  useEffect(() => {
    if (breakActive && breakStart) {
      breakRef.current = setInterval(() => {
        const breakDuration = Math.floor((Date.now() - breakStart) / 1000);
        // Visual update only - total is calculated when break ends
      }, 1000);
    } else {
      if (breakRef.current) clearInterval(breakRef.current);
    }

    return () => {
      if (breakRef.current) clearInterval(breakRef.current);
    };
  }, [breakActive, breakStart]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersRes, entriesData] = await Promise.all([
        api.getOrders().catch(() => []),
        loadTimeEntries(),
      ]);
      
      const ordersData = extractArray(ordersRes);
      setOrders(ordersData.filter(o => o.status !== 'completed' && o.status !== 'cancelled'));
      setTimeEntries(entriesData);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const extractArray = (response) => {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (response.data && Array.isArray(response.data)) return response.data;
    return [];
  };

  const loadTimeEntries = async () => {
    const saved = localStorage.getItem('polywerk_time_entries');
    return saved ? JSON.parse(saved) : [];
  };

  const saveTimeEntries = (entries) => {
    localStorage.setItem('polywerk_time_entries', JSON.stringify(entries));
    setTimeEntries(entries);
  };

  const loadSavedTimer = () => {
    const saved = localStorage.getItem('polywerk_active_timer');
    if (saved) {
      const timer = JSON.parse(saved);
      setActiveTimer(timer);
      setTotalBreakTime(timer.total_break_time || 0);
    }
  };

  const startTimer = (order) => {
    const timer = {
      order_id: order?.order_id || order?.id || null,
      order_number: order?.order_number || null,
      order_name: order?.client_name || order?.customer_name || t('time.generalWork') || 'General Work',
      started_at: new Date().toISOString(),
      user: currentUser?.username || 'Unknown',
      task_type: 'general',
      notes: '',
      total_break_time: 0,
    };
    
    setActiveTimer(timer);
    setTotalBreakTime(0);
    setElapsedTime(0);
    localStorage.setItem('polywerk_active_timer', JSON.stringify(timer));
  };

  const stopTimer = () => {
    if (!activeTimer) return;

    // End any active break first
    if (breakActive) {
      endBreak();
    }

    const entry = {
      id: `time-${Date.now()}`,
      ...activeTimer,
      ended_at: new Date().toISOString(),
      duration_seconds: elapsedTime,
      duration_minutes: Math.round(elapsedTime / 60),
      break_time_seconds: totalBreakTime,
    };

    const newEntries = [entry, ...timeEntries];
    saveTimeEntries(newEntries);
    
    setActiveTimer(null);
    setTotalBreakTime(0);
    localStorage.removeItem('polywerk_active_timer');
  };

  const startBreak = () => {
    setBreakActive(true);
    setBreakStart(Date.now());
  };

  const endBreak = () => {
    if (breakStart) {
      const breakDuration = Math.floor((Date.now() - breakStart) / 1000);
      const newTotalBreak = totalBreakTime + breakDuration;
      setTotalBreakTime(newTotalBreak);
      
      // Update saved timer with break time
      if (activeTimer) {
        const updated = { ...activeTimer, total_break_time: newTotalBreak };
        setActiveTimer(updated);
        localStorage.setItem('polywerk_active_timer', JSON.stringify(updated));
      }
    }
    setBreakActive(false);
    setBreakStart(null);
  };

  const updateTimerNotes = (notes) => {
    if (!activeTimer) return;
    const updated = { ...activeTimer, notes };
    setActiveTimer(updated);
    localStorage.setItem('polywerk_active_timer', JSON.stringify(updated));
  };

  const updateTimerTaskType = (taskType) => {
    if (!activeTimer) return;
    const updated = { ...activeTimer, task_type: taskType };
    setActiveTimer(updated);
    localStorage.setItem('polywerk_active_timer', JSON.stringify(updated));
  };

  const deleteEntry = (id) => {
    if (window.confirm(t('time.deleteConfirm') || 'Delete this time entry?')) {
      const newEntries = timeEntries.filter(e => e.id !== id);
      saveTimeEntries(newEntries);
    }
  };

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  // Filter entries
  const getFilteredEntries = () => {
    const today = new Date().toDateString();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    return timeEntries.filter(entry => {
      // Filter by user
      if (entry.user !== currentUser?.username) return false;
      
      const entryDate = new Date(entry.started_at);
      
      if (filter === 'today') {
        return entryDate.toDateString() === today;
      } else if (filter === 'week') {
        return entryDate >= weekAgo;
      } else if (filter === 'date') {
        return entryDate.toISOString().split('T')[0] === selectedDate;
      }
      return true;
    });
  };

  // Weekly view data
  const getWeeklyData = () => {
    const days = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toDateString();
      
      const dayEntries = timeEntries.filter(e => 
        e.user === currentUser?.username && 
        new Date(e.started_at).toDateString() === dateStr
      );
      
      const totalSeconds = dayEntries.reduce((sum, e) => sum + (e.duration_seconds || 0), 0);
      const breakSeconds = dayEntries.reduce((sum, e) => sum + (e.break_time_seconds || 0), 0);
      
      days.push({
        date,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: date.getDate(),
        entries: dayEntries,
        totalHours: totalSeconds / 3600,
        breakHours: breakSeconds / 3600,
        isToday: date.toDateString() === now.toDateString(),
      });
    }
    
    return days;
  };

  // Export entries
  const exportEntries = () => {
    const filtered = getFilteredEntries();
    const csv = [
      ['Date', 'Start', 'End', 'Duration (min)', 'Break (min)', 'Task Type', 'Order', 'Notes'].join(','),
      ...filtered.map(e => [
        formatDate(e.started_at),
        formatTime(e.started_at),
        formatTime(e.ended_at),
        e.duration_minutes || 0,
        Math.round((e.break_time_seconds || 0) / 60),
        e.task_type || 'general',
        e.order_name || 'General',
        `"${(e.notes || '').replace(/"/g, '""')}"`,
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time_entries_${selectedDate || 'all'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calculate totals
  const filteredEntries = getFilteredEntries();
  const totalSeconds = filteredEntries.reduce((sum, e) => sum + (e.duration_seconds || 0), 0);
  const totalHours = (totalSeconds / 3600).toFixed(1);
  const totalBreakSeconds = filteredEntries.reduce((sum, e) => sum + (e.break_time_seconds || 0), 0);
  const weeklyData = getWeeklyData();
  const weeklyTotal = weeklyData.reduce((sum, d) => sum + d.totalHours, 0);

  const taskTypes = [
    { id: 'general', name: t('time.general') || 'General', icon: '📋' },
    { id: 'printing', name: t('time.printing') || 'Printing', icon: '🖨️' },
    { id: 'post_processing', name: t('time.postProcessing') || 'Post Processing', icon: '✨' },
    { id: 'modeling', name: t('time.modeling') || '3D Modeling', icon: '🎨' },
    { id: 'customer_service', name: t('time.customerService') || 'Customer Service', icon: '💬' },
    { id: 'maintenance', name: t('time.maintenance') || 'Maintenance', icon: '🔧' },
    { id: 'packing', name: t('time.packing') || 'Packing/Shipping', icon: '📦' },
    { id: 'admin', name: t('time.admin') || 'Admin', icon: '📊' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Timer */}
      <div 
        className={`rounded-xl border p-6 ${activeTimer ? 'bg-green-500/10 border-green-500/30' : ''}`}
        style={!activeTimer ? { backgroundColor: '#1e293b', borderColor: '#334155' } : {}}
      >
        {activeTimer ? (
          <div className="space-y-4">
            {/* Timer Display */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${breakActive ? 'bg-yellow-500' : 'bg-green-500'} animate-pulse`}></span>
                  <p className={`text-sm ${breakActive ? 'text-yellow-400' : 'text-green-400'}`}>
                    {breakActive ? (t('time.onBreak') || 'On Break') : (t('time.tracking') || 'Currently tracking')}
                  </p>
                </div>
                <p className="text-lg font-medium text-white mt-1">
                  {activeTimer.order_name || t('time.generalWork') || 'General Work'}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-4xl font-mono font-bold ${breakActive ? 'text-yellow-400' : 'text-green-400'}`}>
                  {formatDuration(elapsedTime)}
                </p>
                <div className="flex items-center justify-end gap-2 mt-1">
                  <p className="text-sm text-slate-400">
                    {t('time.started') || 'Started'} {formatTime(activeTimer.started_at)}
                  </p>
                  {totalBreakTime > 0 && (
                    <span className="text-xs text-yellow-400/70">
                      (☕ {Math.round(totalBreakTime / 60)}m)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Task Type */}
            <div>
              <p className="text-sm text-slate-400 mb-2">{t('time.taskType') || 'Task Type'}</p>
              <div className="flex flex-wrap gap-2">
                {taskTypes.map(type => (
                  <button
                    key={type.id}
                    onClick={() => updateTimerTaskType(type.id)}
                    disabled={breakActive}
                    className={`px-3 py-1.5 rounded-lg text-sm transition disabled:opacity-50 ${
                      activeTimer.task_type === type.id
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    {type.icon} {type.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <input
                type="text"
                value={activeTimer.notes}
                onChange={(e) => updateTimerNotes(e.target.value)}
                placeholder={t('time.addNotes') || 'Add notes...'}
                className="w-full px-4 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
                disabled={breakActive}
              />
            </div>

            {/* Timer Controls */}
            <div className="flex gap-2">
              {!breakActive ? (
                <>
                  <button
                    onClick={startBreak}
                    className="flex-1 py-3 rounded-xl font-medium text-white bg-yellow-500 hover:bg-yellow-600 transition flex items-center justify-center gap-2"
                  >
                    ☕ {t('time.startBreak') || 'Start Break'}
                  </button>
                  <button
                    onClick={stopTimer}
                    className="flex-1 py-3 rounded-xl font-medium text-white bg-red-500 hover:bg-red-600 transition flex items-center justify-center gap-2"
                  >
                    ⏹️ {t('time.stop') || 'Stop Timer'}
                  </button>
                </>
              ) : (
                <button
                  onClick={endBreak}
                  className="w-full py-3 rounded-xl font-medium text-white bg-green-500 hover:bg-green-600 transition flex items-center justify-center gap-2"
                >
                  ▶️ {t('time.endBreak') || 'End Break & Continue'}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center py-4">
              <p className="text-4xl mb-2">⏱️</p>
              <p className="text-lg font-medium text-white">{t('time.noTimer') || 'No timer running'}</p>
              <p className="text-sm text-slate-400">{t('time.startPrompt') || 'Start a timer to track your work'}</p>
            </div>

            {/* Quick Start */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                onClick={() => startTimer(null)}
                className="p-3 rounded-lg text-center transition bg-purple-500/20 border border-purple-500/30 hover:bg-purple-500/30"
              >
                <span className="text-2xl block mb-1">📋</span>
                <span className="text-sm text-purple-400">{t('time.generalWork') || 'General Work'}</span>
              </button>
              
              {orders.slice(0, 5).map(order => (
                <button
                  key={order.order_id || order.id}
                  onClick={() => startTimer(order)}
                  className="p-3 rounded-lg text-center transition bg-slate-700 hover:bg-slate-600"
                >
                  <span className="text-2xl block mb-1">📦</span>
                  <span className="text-sm text-white truncate block">
                    {order.order_number || `#${(order.order_id || order.id || '').slice(-6)}`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 rounded-lg bg-slate-800">
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-md text-sm transition ${
              viewMode === 'list' ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            📋 {t('time.listView') || 'List'}
          </button>
          <button
            onClick={() => setViewMode('weekly')}
            className={`px-4 py-2 rounded-md text-sm transition ${
              viewMode === 'weekly' ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            📅 {t('time.weekView') || 'Week'}
          </button>
        </div>
        
        <button
          onClick={exportEntries}
          className="px-3 py-1.5 rounded-lg text-sm text-slate-400 border border-slate-600 hover:text-white hover:border-slate-500"
        >
          📥 {t('common.download') || 'Export'}
        </button>
      </div>

      {/* Weekly View */}
      {viewMode === 'weekly' && (
        <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-white">{t('time.thisWeek') || 'This Week'}</h3>
            <p className="text-sm text-slate-400">
              {t('common.total') || 'Total'}: <span className="text-purple-400 font-medium">{weeklyTotal.toFixed(1)}h</span>
              {' / '}
              <span className="text-slate-500">{dailyTargetHours * 5}h</span>
            </p>
          </div>
          
          <div className="grid grid-cols-7 gap-2">
            {weeklyData.map((day, idx) => {
              const percentage = Math.min(100, (day.totalHours / dailyTargetHours) * 100);
              const isComplete = day.totalHours >= dailyTargetHours;
              return (
                <div 
                  key={idx}
                  className={`p-3 rounded-lg text-center ${day.isToday ? 'ring-2 ring-purple-500' : ''}`}
                  style={{ backgroundColor: '#0f172a' }}
                >
                  <p className={`text-xs ${day.isToday ? 'text-purple-400 font-medium' : 'text-slate-500'}`}>
                    {day.dayName}
                  </p>
                  <p className="text-sm text-white font-medium">{day.dayNum}</p>
                  <div className="mt-2 h-16 bg-slate-800 rounded relative overflow-hidden">
                    <div 
                      className="absolute bottom-0 left-0 right-0 transition-all duration-500"
                      style={{ 
                        height: `${percentage}%`,
                        background: isComplete 
                          ? 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)'
                          : 'linear-gradient(180deg, #a855f7 0%, #06b6d4 100%)'
                      }}
                    />
                  </div>
                  <p className={`text-xs mt-1 ${isComplete ? 'text-green-400' : 'text-slate-400'}`}>
                    {day.totalHours.toFixed(1)}h
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary Stats */}
      {viewMode === 'list' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
              <p className="text-sm text-slate-400">{t('time.totalTime') || 'Total Time'}</p>
              <p className="text-2xl font-bold text-white">{totalHours}h</p>
            </div>
            <div className="p-4 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
              <p className="text-sm text-slate-400">{t('time.entries') || 'Entries'}</p>
              <p className="text-2xl font-bold text-white">{filteredEntries.length}</p>
            </div>
            <div className="p-4 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
              <p className="text-sm text-slate-400">{t('time.breaks') || 'Breaks'}</p>
              <p className="text-2xl font-bold text-yellow-400">{Math.round(totalBreakSeconds / 60)}m</p>
            </div>
            <div className="p-4 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
              <p className="text-sm text-slate-400">{t('time.target') || 'Target'}</p>
              <div className="flex items-baseline gap-1">
                <p className={`text-2xl font-bold ${parseFloat(totalHours) >= dailyTargetHours ? 'text-green-400' : 'text-purple-400'}`}>
                  {dailyTargetHours}h
                </p>
                {parseFloat(totalHours) >= dailyTargetHours && <span className="text-green-400">✓</span>}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex gap-1 p-1 rounded-lg bg-slate-800">
              {[
                { id: 'today', label: t('time.today') || 'Today' },
                { id: 'week', label: t('time.week') || 'Week' },
                { id: 'all', label: t('common.all') || 'All' },
                { id: 'date', label: '📅' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`px-3 py-1.5 rounded-md text-sm transition ${
                    filter === f.id ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            
            {filter === 'date' && (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-white text-sm"
                style={{ backgroundColor: '#334155' }}
              />
            )}

            <button
              onClick={() => setShowManualEntry(true)}
              className="ml-auto px-3 py-1.5 rounded-lg text-sm text-purple-400 border border-purple-500/30 hover:bg-purple-500/10"
            >
              + {t('time.manualEntry') || 'Manual Entry'}
            </button>
          </div>

          {/* Time Entries List */}
          <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: '#334155' }}>
              <h3 className="font-medium text-white">{t('time.timeEntries') || 'Time Entries'}</h3>
            </div>
            
            <div className="divide-y" style={{ borderColor: '#334155' }}>
              {filteredEntries.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <p className="text-4xl mb-2">📭</p>
                  <p>{t('time.noEntries') || 'No time entries for this period'}</p>
                </div>
              ) : (
                filteredEntries.map(entry => {
                  const taskType = taskTypes.find(t => t.id === entry.task_type);
                  return (
                    <div 
                      key={entry.id}
                      className="p-4 flex items-center gap-4 hover:bg-slate-800/50 transition"
                    >
                      <div className="text-2xl">{taskType?.icon || '📋'}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white">
                          {entry.order_name || t('time.generalWork') || 'General Work'}
                        </p>
                        <p className="text-sm text-slate-400">
                          {formatDate(entry.started_at)} • {formatTime(entry.started_at)} - {formatTime(entry.ended_at)}
                        </p>
                        {entry.notes && (
                          <p className="text-sm text-slate-500 truncate">{entry.notes}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold text-white">
                          {entry.duration_minutes}m
                        </p>
                        {entry.break_time_seconds > 0 && (
                          <p className="text-xs text-yellow-400/70">☕ {Math.round(entry.break_time_seconds / 60)}m</p>
                        )}
                      </div>
                      <button
                        onClick={() => deleteEntry(entry.id)}
                        className="p-1 text-slate-500 hover:text-red-400"
                      >
                        🗑️
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* Manual Entry Modal */}
      {showManualEntry && (
        <ManualTimeEntryModal
          orders={orders}
          taskTypes={taskTypes}
          currentUser={currentUser}
          t={t}
          onSave={(entry) => {
            const newEntries = [entry, ...timeEntries];
            saveTimeEntries(newEntries);
            setShowManualEntry(false);
          }}
          onClose={() => setShowManualEntry(false)}
        />
      )}
    </div>
  );
}

/**
 * ManualTimeEntryModal - Add a manual time entry
 */
function ManualTimeEntryModal({ orders, taskTypes, currentUser, t, onSave, onClose }) {
  const [entry, setEntry] = useState({
    order_id: '',
    task_type: 'general',
    date: new Date().toISOString().split('T')[0],
    start_time: '09:00',
    end_time: '10:00',
    break_minutes: 0,
    notes: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const order = orders.find(o => (o.order_id || o.id) === entry.order_id);
    const startDateTime = new Date(`${entry.date}T${entry.start_time}`);
    const endDateTime = new Date(`${entry.date}T${entry.end_time}`);
    const breakSeconds = (entry.break_minutes || 0) * 60;
    const durationSeconds = Math.max(0, (endDateTime - startDateTime) / 1000 - breakSeconds);

    const newEntry = {
      id: `time-${Date.now()}`,
      order_id: entry.order_id || null,
      order_number: order?.order_number || null,
      order_name: order?.client_name || order?.customer_name || t('time.generalWork') || 'General Work',
      task_type: entry.task_type,
      started_at: startDateTime.toISOString(),
      ended_at: endDateTime.toISOString(),
      duration_seconds: durationSeconds,
      duration_minutes: Math.round(durationSeconds / 60),
      break_time_seconds: breakSeconds,
      notes: entry.notes,
      user: currentUser?.username || 'Unknown',
      manual: true,
    };

    onSave(newEntry);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        className="relative w-full max-w-md rounded-xl border shadow-2xl"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#334155' }}>
          <h3 className="font-bold text-white">{t('time.addManual') || 'Add Manual Entry'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              {t('time.order') || 'Order'} ({t('common.optional') || 'Optional'})
            </label>
            <select
              value={entry.order_id}
              onChange={(e) => setEntry({ ...entry, order_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-white"
              style={{ backgroundColor: '#334155' }}
            >
              <option value="">{t('time.generalWork') || 'General Work'}</option>
              {orders.map(order => (
                <option key={order.order_id || order.id} value={order.order_id || order.id}>
                  {order.order_number || `#${(order.order_id || order.id || '').slice(-6)}`} - {order.client_name || order.customer_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">{t('time.taskType') || 'Task Type'}</label>
            <select
              value={entry.task_type}
              onChange={(e) => setEntry({ ...entry, task_type: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-white"
              style={{ backgroundColor: '#334155' }}
            >
              {taskTypes.map(type => (
                <option key={type.id} value={type.id}>{type.icon} {type.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">{t('common.date') || 'Date'}</label>
            <input
              type="date"
              value={entry.date}
              onChange={(e) => setEntry({ ...entry, date: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-white"
              style={{ backgroundColor: '#334155' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">{t('time.start') || 'Start Time'}</label>
              <input
                type="time"
                value={entry.start_time}
                onChange={(e) => setEntry({ ...entry, start_time: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">{t('time.end') || 'End Time'}</label>
              <input
                type="time"
                value={entry.end_time}
                onChange={(e) => setEntry({ ...entry, end_time: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              {t('time.breakTime') || 'Break Time'} ({t('common.minutes') || 'minutes'})
            </label>
            <input
              type="number"
              min="0"
              value={entry.break_minutes}
              onChange={(e) => setEntry({ ...entry, break_minutes: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 rounded-lg text-white"
              style={{ backgroundColor: '#334155' }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">{t('common.notes') || 'Notes'}</label>
            <input
              type="text"
              value={entry.notes}
              onChange={(e) => setEntry({ ...entry, notes: e.target.value })}
              placeholder={t('time.notesPlaceholder') || 'What did you work on?'}
              className="w-full px-3 py-2 rounded-lg text-white"
              style={{ backgroundColor: '#334155' }}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg font-medium text-slate-300 border border-slate-600 hover:bg-slate-700"
            >
              {t('common.cancel') || 'Cancel'}
            </button>
            <button
              type="submit"
              className="flex-1 py-2 rounded-lg font-medium text-white"
              style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
            >
              {t('time.addEntry') || 'Add Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TimeTracker;
