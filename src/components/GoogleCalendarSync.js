import React, { useState, useEffect, useCallback } from 'react';
import { api, unwrap } from '../services/api';

/**
 * GoogleCalendarSync - Bidirectional sync with Google Calendar
 * Uses OAuth 2.0 for authentication
 */

// Google Calendar API configuration
// In production, store these in environment variables
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';
const GOOGLE_API_KEY = process.env.REACT_APP_GOOGLE_API_KEY || '';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

function GoogleCalendarSync({ events = [], onEventsImport, onEventExport }) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [googleCalendars, setGoogleCalendars] = useState([]);
  const [selectedCalendar, setSelectedCalendar] = useState('primary');
  const [googleEvents, setGoogleEvents] = useState([]);
  const [syncSettings, setSyncSettings] = useState({
    autoSync: false,
    syncInterval: 15, // minutes
    importDeadlines: true,
    exportPrintJobs: true,
    twoWaySync: false,
  });
  const [lastSync, setLastSync] = useState(null);
  const [error, setError] = useState(null);

  // Load saved settings
  useEffect(() => {
    const saved = localStorage.getItem('polywerk_google_sync_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSyncSettings(prev => ({ ...prev, ...parsed }));
        setSelectedCalendar(parsed.selectedCalendar || 'primary');
      } catch (e) {
        console.error('Failed to parse sync settings:', e);
      }
    }

    const lastSyncTime = localStorage.getItem('polywerk_google_last_sync');
    if (lastSyncTime) {
      setLastSync(new Date(lastSyncTime));
    }

    // Check if already signed in
    checkSignInStatus();
  }, []);

  // Save settings when changed
  const saveSettings = useCallback((newSettings) => {
    setSyncSettings(newSettings);
    localStorage.setItem('polywerk_google_sync_settings', JSON.stringify({
      ...newSettings,
      selectedCalendar,
    }));
  }, [selectedCalendar]);

  // Initialize Google API client
  const initGoogleApi = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID) {
      setLoading(false);
      return;
    }

    try {
      // Load the Google API client library
      await loadGoogleScript();
      
      await window.gapi.client.init({
        apiKey: GOOGLE_API_KEY,
        clientId: GOOGLE_CLIENT_ID,
        discoveryDocs: [DISCOVERY_DOC],
        scope: SCOPES,
      });

      // Listen for sign-in state changes
      window.gapi.auth2.getAuthInstance().isSignedIn.listen(updateSignInStatus);
      
      // Handle initial sign-in state
      updateSignInStatus(window.gapi.auth2.getAuthInstance().isSignedIn.get());
    } catch (err) {
      console.error('Google API init error:', err);
      setError('Failed to initialize Google Calendar. Check API credentials.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGoogleScript = () => {
    return new Promise((resolve, reject) => {
      if (window.gapi) {
        window.gapi.load('client:auth2', resolve);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        window.gapi.load('client:auth2', resolve);
      };
      script.onerror = reject;
      document.body.appendChild(script);
    });
  };

  const checkSignInStatus = async () => {
    // Check if we have a stored token
    const token = localStorage.getItem('polywerk_google_token');
    if (token) {
      try {
        // Verify token is still valid
        const response = await fetch(
          `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`
        );
        if (response.ok) {
          setIsSignedIn(true);
          await loadCalendars(token);
        } else {
          localStorage.removeItem('polywerk_google_token');
        }
      } catch (err) {
        console.error('Token verification error:', err);
      }
    }
    setLoading(false);
  };

  const updateSignInStatus = (signedIn) => {
    setIsSignedIn(signedIn);
    if (signedIn) {
      loadCalendars();
    }
  };

  const handleSignIn = async () => {
    if (!GOOGLE_CLIENT_ID) {
      // Show manual token input for development
      const token = prompt('Enter Google OAuth access token:');
      if (token) {
        localStorage.setItem('polywerk_google_token', token);
        setIsSignedIn(true);
        await loadCalendars(token);
      }
      return;
    }

    try {
      await window.gapi.auth2.getAuthInstance().signIn();
    } catch (err) {
      console.error('Sign in error:', err);
      setError('Failed to sign in with Google');
    }
  };

  const handleSignOut = async () => {
    try {
      if (window.gapi?.auth2) {
        await window.gapi.auth2.getAuthInstance().signOut();
      }
      localStorage.removeItem('polywerk_google_token');
      setIsSignedIn(false);
      setGoogleCalendars([]);
      setGoogleEvents([]);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const loadCalendars = async (token) => {
    try {
      const accessToken = token || localStorage.getItem('polywerk_google_token');
      if (!accessToken) return;

      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to load calendars');

      const data = await response.json();
      setGoogleCalendars(data.items || []);
    } catch (err) {
      console.error('Load calendars error:', err);
      setError('Failed to load Google Calendars');
    }
  };

  const fetchGoogleEvents = async () => {
    setSyncing(true);
    setError(null);

    try {
      const accessToken = localStorage.getItem('polywerk_google_token');
      if (!accessToken) throw new Error('Not authenticated');

      const now = new Date();
      const oneMonthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(selectedCalendar)}/events?` +
        `timeMin=${now.toISOString()}&timeMax=${oneMonthLater.toISOString()}&singleEvents=true&orderBy=startTime`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch events');

      const data = await response.json();
      setGoogleEvents(data.items || []);
      
      // Update last sync time
      const syncTime = new Date();
      setLastSync(syncTime);
      localStorage.setItem('polywerk_google_last_sync', syncTime.toISOString());

      return data.items;
    } catch (err) {
      console.error('Fetch events error:', err);
      setError('Failed to fetch Google Calendar events');
      return [];
    } finally {
      setSyncing(false);
    }
  };

  const importGoogleEvents = async () => {
    const events = await fetchGoogleEvents();
    
    if (events.length > 0 && onEventsImport) {
      // Transform Google events to our format
      const importedEvents = events.map(event => ({
        id: `google-${event.id}`,
        title: event.summary || 'Untitled',
        description: event.description || '',
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        allDay: !event.start?.dateTime,
        type: categorizeEvent(event.summary),
        source: 'google',
        googleEventId: event.id,
        location: event.location,
      }));

      onEventsImport(importedEvents);
    }
  };

  const exportToGoogle = async (event) => {
    setSyncing(true);
    setError(null);

    try {
      const accessToken = localStorage.getItem('polywerk_google_token');
      if (!accessToken) throw new Error('Not authenticated');

      const googleEvent = {
        summary: event.title,
        description: event.description || `Polywerk: ${event.type || 'Event'}`,
        start: {
          dateTime: new Date(event.start).toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: new Date(event.end).toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      };

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(selectedCalendar)}/events`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(googleEvent),
        }
      );

      if (!response.ok) throw new Error('Failed to create event');

      const createdEvent = await response.json();
      
      if (onEventExport) {
        onEventExport(event, createdEvent);
      }

      return createdEvent;
    } catch (err) {
      console.error('Export event error:', err);
      setError('Failed to export event to Google Calendar');
      return null;
    } finally {
      setSyncing(false);
    }
  };

  const categorizeEvent = (title) => {
    const lower = title?.toLowerCase() || '';
    if (lower.includes('deadline') || lower.includes('due')) return 'deadline';
    if (lower.includes('meeting') || lower.includes('call')) return 'meeting';
    if (lower.includes('maintenance')) return 'maintenance';
    if (lower.includes('delivery') || lower.includes('pickup')) return 'delivery';
    return 'other';
  };

  const formatLastSync = () => {
    if (!lastSync) return 'Never';
    const diff = Date.now() - lastSync.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return lastSync.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img 
            src="https://www.gstatic.com/images/branding/product/2x/calendar_2020q4_48dp.png" 
            alt="Google Calendar" 
            className="w-8 h-8"
          />
          <div>
            <h3 className="font-semibold text-white">Google Calendar</h3>
            <p className="text-xs text-slate-400">
              {isSignedIn ? 'Connected' : 'Not connected'}
            </p>
          </div>
        </div>

        {isSignedIn ? (
          <button
            onClick={handleSignOut}
            className="px-3 py-1.5 rounded-lg text-sm text-red-400 border border-red-500/30 hover:bg-red-500/10"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={handleSignIn}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: 'linear-gradient(135deg, #4285f4 0%, #34a853 100%)' }}
          >
            Connect Google
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {!GOOGLE_CLIENT_ID && !isSignedIn && (
        <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <p className="text-yellow-400 text-sm mb-2">⚠️ Google API not configured</p>
          <p className="text-slate-400 text-xs">
            Set REACT_APP_GOOGLE_CLIENT_ID in your environment to enable OAuth.
            For testing, click "Connect Google" to enter an access token manually.
          </p>
        </div>
      )}

      {isSignedIn && (
        <>
          {/* Calendar Selection */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Sync Calendar</label>
            <select
              value={selectedCalendar}
              onChange={(e) => {
                setSelectedCalendar(e.target.value);
                saveSettings({ ...syncSettings, selectedCalendar: e.target.value });
              }}
              className="w-full px-3 py-2 rounded-lg text-white text-sm"
              style={{ backgroundColor: '#334155' }}
            >
              {googleCalendars.map(cal => (
                <option key={cal.id} value={cal.id}>
                  {cal.summary} {cal.primary && '(Primary)'}
                </option>
              ))}
            </select>
          </div>

          {/* Sync Actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={fetchGoogleEvents}
              disabled={syncing}
              className="flex-1 py-2.5 rounded-lg text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/10 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {syncing ? (
                <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                '⬇️'
              )}
              Fetch Events
            </button>
            <button
              onClick={importGoogleEvents}
              disabled={syncing}
              className="flex-1 py-2.5 rounded-lg font-medium text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #4285f4 0%, #34a853 100%)' }}
            >
              📥 Import to Polywerk
            </button>
          </div>

          {/* Last Sync */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Last synced: {formatLastSync()}</span>
            {googleEvents.length > 0 && (
              <span className="text-slate-400">{googleEvents.length} events found</span>
            )}
          </div>

          {/* Sync Settings */}
          <div 
            className="rounded-xl border p-4 space-y-4"
            style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
          >
            <h4 className="font-medium text-white">Sync Settings</h4>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-white text-sm">Import deadlines as orders</p>
                <p className="text-slate-500 text-xs">Events with "deadline" or "due" become order deadlines</p>
              </div>
              <input
                type="checkbox"
                checked={syncSettings.importDeadlines}
                onChange={(e) => saveSettings({ ...syncSettings, importDeadlines: e.target.checked })}
                className="w-5 h-5 rounded"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-white text-sm">Export print jobs to calendar</p>
                <p className="text-slate-500 text-xs">Scheduled prints appear in Google Calendar</p>
              </div>
              <input
                type="checkbox"
                checked={syncSettings.exportPrintJobs}
                onChange={(e) => saveSettings({ ...syncSettings, exportPrintJobs: e.target.checked })}
                className="w-5 h-5 rounded"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-white text-sm">Auto-sync</p>
                <p className="text-slate-500 text-xs">Automatically sync every {syncSettings.syncInterval} minutes</p>
              </div>
              <input
                type="checkbox"
                checked={syncSettings.autoSync}
                onChange={(e) => saveSettings({ ...syncSettings, autoSync: e.target.checked })}
                className="w-5 h-5 rounded"
              />
            </label>
          </div>

          {/* Preview Events */}
          {googleEvents.length > 0 && (
            <div>
              <h4 className="font-medium text-white mb-3">Upcoming Events</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {googleEvents.slice(0, 10).map(event => (
                  <div 
                    key={event.id}
                    className="p-3 rounded-lg flex items-center justify-between"
                    style={{ backgroundColor: '#334155' }}
                  >
                    <div>
                      <p className="text-white text-sm">{event.summary}</p>
                      <p className="text-slate-500 text-xs">
                        {new Date(event.start?.dateTime || event.start?.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      categorizeEvent(event.summary) === 'deadline' ? 'bg-red-500/20 text-red-400' :
                      categorizeEvent(event.summary) === 'meeting' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-slate-600 text-slate-400'
                    }`}>
                      {categorizeEvent(event.summary)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default GoogleCalendarSync;
