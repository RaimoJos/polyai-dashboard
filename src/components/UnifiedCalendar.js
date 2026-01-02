import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

/**
 * UnifiedCalendar - Calendar for everything: jobs, orders, maintenance, emails
 * Mobile-optimized with swipe gestures
 */
function UnifiedCalendar({ currentUser, importedEvents = [] }) {
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month'); // month, week, day, agenda
  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [filterTypes, setFilterTypes] = useState(['orders', 'jobs', 'maintenance', 'meetings', 'emails']);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [emails, setEmails] = useState([]);
  const [touchStart, setTouchStart] = useState(null);

  useEffect(() => {
    loadEvents();
    checkGmailConnection();
  }, [currentDate]);

  // Merge imported events from Google Calendar
  useEffect(() => {
    if (importedEvents.length > 0) {
      setEvents(prev => {
        // Filter out existing google events and add new ones
        const nonGoogleEvents = prev.filter(e => e.source !== 'google');
        return [...nonGoogleEvents, ...importedEvents];
      });
    }
  }, [importedEvents]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      // Load from localStorage (would be API in production)
      const savedEvents = localStorage.getItem('polywerk_calendar_events');
      const data = savedEvents ? JSON.parse(savedEvents) : getDefaultEvents();
      setEvents(data);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveEvents = (newEvents) => {
    localStorage.setItem('polywerk_calendar_events', JSON.stringify(newEvents));
    setEvents(newEvents);
  };

  const checkGmailConnection = () => {
    const connected = localStorage.getItem('polywerk_gmail_connected') === 'true';
    setGmailConnected(connected);
    if (connected) {
      loadEmails();
    }
  };

  const loadEmails = () => {
    // Mock email data - would come from Gmail API
    const mockEmails = [
      {
        id: 'email-1',
        from: 'client@company.com',
        subject: 'Quote Request - 500 keychains',
        date: new Date().toISOString(),
        category: 'quote',
        read: false,
        starred: true,
      },
      {
        id: 'email-2',
        from: 'supplier@materials.com',
        subject: 'Your filament order has shipped',
        date: new Date(Date.now() - 86400000).toISOString(),
        category: 'order',
        read: true,
        starred: false,
      },
    ];
    setEmails(mockEmails);
  };

  const getDefaultEvents = () => {
    const today = new Date();
    return [
      {
        id: 'evt-001',
        title: 'Order #1234 Due',
        type: 'orders',
        date: today.toISOString().split('T')[0],
        time: '14:00',
        duration: 60,
        color: '#a855f7',
        description: 'Phone stands for TechCorp',
        status: 'pending',
        linked_id: 'order-1234',
      },
      {
        id: 'evt-002',
        title: 'Printer K1 Maintenance',
        type: 'maintenance',
        date: new Date(today.getTime() + 2 * 86400000).toISOString().split('T')[0],
        time: '10:00',
        duration: 120,
        color: '#f59e0b',
        description: 'Monthly nozzle check and cleaning',
        status: 'scheduled',
        linked_id: 'printer-k1',
      },
      {
        id: 'evt-003',
        title: 'Client Meeting - Design Review',
        type: 'meetings',
        date: new Date(today.getTime() + 1 * 86400000).toISOString().split('T')[0],
        time: '15:30',
        duration: 45,
        color: '#06b6d4',
        description: 'Review prototype designs with StartupXYZ',
        status: 'confirmed',
        attendees: ['john@startupxyz.com'],
      },
      {
        id: 'evt-004',
        title: 'Print Job: Gear Assembly',
        type: 'jobs',
        date: today.toISOString().split('T')[0],
        time: '08:00',
        duration: 180,
        color: '#22c55e',
        description: 'Estimated 3h print time',
        status: 'in_progress',
        linked_id: 'job-gear-001',
        progress: 45,
      },
    ];
  };

  // Calendar navigation
  const navigateMonth = (delta) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentDate(newDate);
  };

  const navigateWeek = (delta) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (delta * 7));
    setCurrentDate(newDate);
  };

  const navigateDay = (delta) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + delta);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  // Touch handlers for swipe
  const handleTouchStart = (e) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    if (!touchStart) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    
    if (Math.abs(diff) > 50) {
      if (view === 'month') navigateMonth(diff > 0 ? 1 : -1);
      else if (view === 'week') navigateWeek(diff > 0 ? 1 : -1);
      else navigateDay(diff > 0 ? 1 : -1);
    }
    setTouchStart(null);
  };

  // Get calendar days
  const getMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    
    const days = [];
    
    // Previous month days
    const prevMonth = new Date(year, month, 0);
    for (let i = startOffset - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonth.getDate() - i),
        isCurrentMonth: false,
      });
    }
    
    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }
    
    // Next month days
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }
    
    return days;
  };

  const getWeekDays = () => {
    const days = [];
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      days.push({ date, isCurrentMonth: true });
    }
    return days;
  };

  // Get events for a specific date
  const getEventsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return events
      .filter(e => e.date === dateStr)
      .filter(e => filterTypes.includes(e.type))
      .sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
  };

  // Event handlers
  const handleAddEvent = (date) => {
    setSelectedDate(date);
    setEditingEvent(null);
    setShowEventModal(true);
  };

  const handleEditEvent = (event) => {
    setEditingEvent(event);
    setShowEventModal(true);
  };

  const handleSaveEvent = (eventData) => {
    if (editingEvent) {
      const updated = events.map(e => 
        e.id === editingEvent.id ? { ...eventData, id: editingEvent.id } : e
      );
      saveEvents(updated);
    } else {
      const newEvent = {
        ...eventData,
        id: `evt-${Date.now()}`,
      };
      saveEvents([...events, newEvent]);
    }
    setShowEventModal(false);
    setEditingEvent(null);
  };

  const handleDeleteEvent = (eventId) => {
    if (window.confirm('Delete this event?')) {
      saveEvents(events.filter(e => e.id !== eventId));
      setShowEventModal(false);
    }
  };

  // Gmail connection
  const connectGmail = () => {
    // In production, this would trigger OAuth flow
    // For now, mock the connection
    localStorage.setItem('polywerk_gmail_connected', 'true');
    setGmailConnected(true);
    loadEmails();
  };

  const disconnectGmail = () => {
    localStorage.setItem('polywerk_gmail_connected', 'false');
    setGmailConnected(false);
    setEmails([]);
  };

  const typeColors = {
    orders: { bg: 'bg-purple-500/20', text: 'text-purple-400', dot: 'bg-purple-500' },
    jobs: { bg: 'bg-green-500/20', text: 'text-green-400', dot: 'bg-green-500' },
    maintenance: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', dot: 'bg-yellow-500' },
    meetings: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', dot: 'bg-cyan-500' },
    emails: { bg: 'bg-blue-500/20', text: 'text-blue-400', dot: 'bg-blue-500' },
  };

  const formatTime = (time) => {
    if (!time) return '';
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    return `${hour > 12 ? hour - 12 : hour}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">📅 Calendar</h2>
          <p className="text-slate-400 text-sm">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* View Toggle */}
          <div className="flex p-1 rounded-lg bg-slate-800">
            {['month', 'week', 'day', 'agenda'].map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-md text-sm capitalize transition ${
                  view === v ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          <button
            onClick={goToToday}
            className="px-3 py-1.5 rounded-lg text-sm text-slate-400 border border-slate-600 hover:bg-slate-700"
          >
            Today
          </button>

          <button
            onClick={() => handleAddEvent(new Date().toISOString().split('T')[0])}
            className="px-4 py-1.5 rounded-lg text-sm font-medium text-white"
            style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
          >
            + Event
          </button>
        </div>
      </div>

      {/* Filters & Gmail */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Type Filters */}
        <div className="flex flex-wrap gap-2 flex-1">
          {Object.entries(typeColors).map(([type, colors]) => (
            <button
              key={type}
              onClick={() => {
                setFilterTypes(prev => 
                  prev.includes(type) 
                    ? prev.filter(t => t !== type)
                    : [...prev, type]
                );
              }}
              className={`px-3 py-1.5 rounded-lg text-sm capitalize transition flex items-center gap-2 ${
                filterTypes.includes(type)
                  ? `${colors.bg} ${colors.text}`
                  : 'bg-slate-800 text-slate-500'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${colors.dot}`}></span>
              {type}
            </button>
          ))}
        </div>

        {/* Gmail Integration */}
        <div className="flex-shrink-0">
          {gmailConnected ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-green-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                Gmail Connected
              </span>
              <button
                onClick={disconnectGmail}
                className="text-xs text-slate-500 hover:text-red-400"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={connectGmail}
              className="px-3 py-1.5 rounded-lg text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center gap-2"
            >
              📧 Connect Gmail
            </button>
          )}
        </div>
      </div>

      {/* Calendar Grid */}
      <div 
        className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Navigation */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#334155' }}>
          <button
            onClick={() => view === 'month' ? navigateMonth(-1) : view === 'week' ? navigateWeek(-1) : navigateDay(-1)}
            className="p-2 rounded-lg hover:bg-slate-700 text-slate-400"
          >
            ←
          </button>
          <h3 className="font-semibold text-white">
            {view === 'day' 
              ? currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
              : currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            }
          </h3>
          <button
            onClick={() => view === 'month' ? navigateMonth(1) : view === 'week' ? navigateWeek(1) : navigateDay(1)}
            className="p-2 rounded-lg hover:bg-slate-700 text-slate-400"
          >
            →
          </button>
        </div>

        {/* Month/Week View */}
        {(view === 'month' || view === 'week') && (
          <>
            {/* Day Headers */}
            <div className="grid grid-cols-7 border-b" style={{ borderColor: '#334155' }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="px-2 py-2 text-center text-xs font-medium text-slate-500">
                  <span className="hidden sm:inline">{day}</span>
                  <span className="sm:hidden">{day[0]}</span>
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className={`grid grid-cols-7 ${view === 'month' ? '' : 'min-h-[400px]'}`}>
              {(view === 'month' ? getMonthDays() : getWeekDays()).map((day, idx) => {
                const dateStr = day.date.toISOString().split('T')[0];
                const dayEvents = getEventsForDate(day.date);
                const today = isToday(day.date);
                const selected = selectedDate === dateStr;
                
                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`
                      min-h-[80px] sm:min-h-[100px] p-1 border-b border-r cursor-pointer transition
                      ${day.isCurrentMonth ? '' : 'opacity-40'}
                      ${selected ? 'bg-purple-500/10' : 'hover:bg-slate-800/50'}
                    `}
                    style={{ borderColor: '#334155' }}
                  >
                    {/* Date Number */}
                    <div className={`
                      w-7 h-7 flex items-center justify-center text-sm rounded-full mb-1
                      ${today ? 'bg-purple-500 text-white font-bold' : 'text-slate-400'}
                    `}>
                      {day.date.getDate()}
                    </div>

                    {/* Events */}
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, view === 'month' ? 2 : 5).map(event => (
                        <div
                          key={event.id}
                          onClick={(e) => { e.stopPropagation(); handleEditEvent(event); }}
                          className={`
                            px-1.5 py-0.5 rounded text-xs truncate cursor-pointer
                            ${typeColors[event.type]?.bg || 'bg-slate-700'} 
                            ${typeColors[event.type]?.text || 'text-slate-300'}
                            hover:opacity-80
                          `}
                          title={event.title}
                        >
                          {event.time && <span className="hidden sm:inline">{formatTime(event.time)} </span>}
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > (view === 'month' ? 2 : 5) && (
                        <div className="text-xs text-slate-500 px-1">
                          +{dayEvents.length - (view === 'month' ? 2 : 5)} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Day View */}
        {view === 'day' && (
          <div className="p-4">
            <DayView
              date={currentDate}
              events={getEventsForDate(currentDate)}
              onEditEvent={handleEditEvent}
              onAddEvent={() => handleAddEvent(currentDate.toISOString().split('T')[0])}
              typeColors={typeColors}
            />
          </div>
        )}

        {/* Agenda View */}
        {view === 'agenda' && (
          <div className="p-4">
            <AgendaView
              events={events.filter(e => filterTypes.includes(e.type))}
              onEditEvent={handleEditEvent}
              typeColors={typeColors}
            />
          </div>
        )}
      </div>

      {/* Selected Day Events (Mobile) */}
      {selectedDate && view === 'month' && (
        <div 
          className="sm:hidden rounded-xl border p-4"
          style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-white">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { 
                weekday: 'short', month: 'short', day: 'numeric' 
              })}
            </h4>
            <button
              onClick={() => handleAddEvent(selectedDate)}
              className="text-purple-400 text-sm"
            >
              + Add
            </button>
          </div>
          <div className="space-y-2">
            {getEventsForDate(new Date(selectedDate + 'T00:00:00')).length === 0 ? (
              <p className="text-slate-500 text-sm">No events</p>
            ) : (
              getEventsForDate(new Date(selectedDate + 'T00:00:00')).map(event => (
                <div
                  key={event.id}
                  onClick={() => handleEditEvent(event)}
                  className={`p-3 rounded-lg ${typeColors[event.type]?.bg || 'bg-slate-700'}`}
                >
                  <p className={`font-medium ${typeColors[event.type]?.text || 'text-white'}`}>
                    {event.title}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {event.time && formatTime(event.time)}
                    {event.duration && ` • ${event.duration} min`}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Gmail Inbox Preview */}
      {gmailConnected && emails.length > 0 && (
        <div 
          className="rounded-xl border p-4"
          style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
        >
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
            📧 Recent Emails
            <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400">
              {emails.filter(e => !e.read).length} unread
            </span>
          </h3>
          <div className="space-y-2">
            {emails.slice(0, 3).map(email => (
              <div
                key={email.id}
                className={`p-3 rounded-lg flex items-start gap-3 ${
                  email.read ? 'bg-slate-800/50' : 'bg-blue-500/10 border border-blue-500/20'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm truncate ${email.read ? 'text-slate-400' : 'text-white font-medium'}`}>
                      {email.from}
                    </p>
                    {email.starred && <span className="text-yellow-400">⭐</span>}
                  </div>
                  <p className={`text-sm truncate ${email.read ? 'text-slate-500' : 'text-slate-300'}`}>
                    {email.subject}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${
                  email.category === 'quote' ? 'bg-purple-500/20 text-purple-400' :
                  email.category === 'order' ? 'bg-green-500/20 text-green-400' :
                  'bg-slate-600 text-slate-400'
                }`}>
                  {email.category}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Event Modal */}
      {showEventModal && (
        <EventModal
          event={editingEvent}
          date={selectedDate}
          onSave={handleSaveEvent}
          onDelete={editingEvent ? () => handleDeleteEvent(editingEvent.id) : null}
          onClose={() => { setShowEventModal(false); setEditingEvent(null); }}
        />
      )}
    </div>
  );
}

/**
 * DayView - Hourly view for a single day
 */
function DayView({ date, events, onEditEvent, onAddEvent, typeColors }) {
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getEventsAtHour = (hour) => {
    return events.filter(e => {
      if (!e.time) return false;
      const eventHour = parseInt(e.time.split(':')[0]);
      return eventHour === hour;
    });
  };

  return (
    <div className="space-y-1">
      {hours.slice(6, 22).map(hour => (
        <div key={hour} className="flex gap-3 min-h-[60px]">
          <div className="w-16 text-right text-xs text-slate-500 pt-1">
            {hour.toString().padStart(2, '0')}:00
          </div>
          <div 
            className="flex-1 border-t border-slate-700/50 pt-1 space-y-1"
            onClick={() => onAddEvent()}
          >
            {getEventsAtHour(hour).map(event => (
              <div
                key={event.id}
                onClick={(e) => { e.stopPropagation(); onEditEvent(event); }}
                className={`
                  p-2 rounded-lg cursor-pointer
                  ${typeColors[event.type]?.bg || 'bg-slate-700'}
                `}
              >
                <p className={`font-medium text-sm ${typeColors[event.type]?.text || 'text-white'}`}>
                  {event.title}
                </p>
                <p className="text-xs text-slate-400">
                  {event.duration && `${event.duration} min`}
                  {event.progress !== undefined && ` • ${event.progress}% complete`}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * AgendaView - List of upcoming events
 */
function AgendaView({ events, onEditEvent, typeColors }) {
  const today = new Date().toISOString().split('T')[0];
  
  const upcomingEvents = events
    .filter(e => e.date >= today)
    .sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return (a.time || '').localeCompare(b.time || '');
    })
    .slice(0, 20);

  const groupedByDate = upcomingEvents.reduce((groups, event) => {
    const date = event.date;
    if (!groups[date]) groups[date] = [];
    groups[date].push(event);
    return groups;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(groupedByDate).map(([date, dayEvents]) => (
        <div key={date}>
          <h4 className="text-sm font-medium text-slate-400 mb-2">
            {new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric'
            })}
          </h4>
          <div className="space-y-2">
            {dayEvents.map(event => (
              <div
                key={event.id}
                onClick={() => onEditEvent(event)}
                className={`p-3 rounded-lg cursor-pointer ${typeColors[event.type]?.bg || 'bg-slate-700'}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`font-medium ${typeColors[event.type]?.text || 'text-white'}`}>
                      {event.title}
                    </p>
                    {event.description && (
                      <p className="text-sm text-slate-400 mt-1">{event.description}</p>
                    )}
                  </div>
                  <div className="text-right text-sm">
                    {event.time && (
                      <p className="text-slate-400">{event.time}</p>
                    )}
                    {event.duration && (
                      <p className="text-slate-500 text-xs">{event.duration} min</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {Object.keys(groupedByDate).length === 0 && (
        <div className="text-center py-8 text-slate-400">
          <p className="text-4xl mb-2">📭</p>
          <p>No upcoming events</p>
        </div>
      )}
    </div>
  );
}

/**
 * EventModal - Add/Edit event
 */
function EventModal({ event, date, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({
    title: event?.title || '',
    type: event?.type || 'meetings',
    date: event?.date || date || new Date().toISOString().split('T')[0],
    time: event?.time || '',
    duration: event?.duration || 60,
    description: event?.description || '',
    color: event?.color || '#a855f7',
    status: event?.status || 'scheduled',
  });

  const types = [
    { id: 'orders', name: 'Order', icon: '📦' },
    { id: 'jobs', name: 'Print Job', icon: '🖨️' },
    { id: 'maintenance', name: 'Maintenance', icon: '🔧' },
    { id: 'meetings', name: 'Meeting', icon: '👥' },
    { id: 'emails', name: 'Email', icon: '📧' },
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      alert('Please enter a title');
      return;
    }
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl border shadow-2xl"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#334155' }}>
          <h3 className="font-bold text-white">{event ? 'Edit Event' : 'New Event'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Event title..."
              className="w-full px-3 py-2 rounded-lg text-white"
              style={{ backgroundColor: '#334155' }}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Type</label>
            <div className="flex flex-wrap gap-2">
              {types.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setForm({ ...form, type: t.id })}
                  className={`px-3 py-1.5 rounded-lg text-sm transition ${
                    form.type === t.id 
                      ? 'bg-purple-500 text-white' 
                      : 'bg-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {t.icon} {t.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Time</label>
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Duration (minutes)</label>
            <input
              type="number"
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 rounded-lg text-white"
              style={{ backgroundColor: '#334155' }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-white resize-none"
              style={{ backgroundColor: '#334155' }}
            />
          </div>

          <div className="flex gap-3 pt-2">
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="px-4 py-2 rounded-lg text-red-400 border border-red-500/30 hover:bg-red-500/10"
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg text-slate-300 border border-slate-600 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 rounded-lg font-medium text-white"
              style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
            >
              {event ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default UnifiedCalendar;
