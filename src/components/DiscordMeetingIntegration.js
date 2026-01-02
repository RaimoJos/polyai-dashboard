import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

/**
 * DiscordMeetingIntegration - Team meeting management via Discord
 * Features:
 * - Webhook configuration
 * - Auto meeting summaries
 * - Next meeting suggestions
 * - Meeting reminders
 * - Attendance tracking
 */

// ============ HELPERS ============
function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// ============ DISCORD API ============
async function sendDiscordWebhook(webhookUrl, payload) {
  if (!webhookUrl) {
    throw new Error('No webhook URL configured');
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status}`);
    }

    return true;
  } catch (err) {
    console.error('Discord webhook error:', err);
    throw err;
  }
}

function buildMeetingSummaryEmbed(meeting, summary) {
  return {
    embeds: [{
      title: `📋 Meeting Summary: ${meeting.title}`,
      color: 0x7C3AED, // Purple
      fields: [
        {
          name: '📅 Date & Time',
          value: `${formatDate(meeting.start)} at ${formatTime(meeting.start)}`,
          inline: true,
        },
        {
          name: '⏱️ Duration',
          value: formatDuration(meeting.duration || 60),
          inline: true,
        },
        {
          name: '👥 Attendees',
          value: summary.attendees?.length > 0 
            ? summary.attendees.join(', ') 
            : 'Not recorded',
          inline: false,
        },
        {
          name: '📝 Key Points',
          value: summary.keyPoints?.length > 0 
            ? summary.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')
            : 'No key points recorded',
          inline: false,
        },
        {
          name: '✅ Action Items',
          value: summary.actionItems?.length > 0
            ? summary.actionItems.map(a => `• ${a.task} → ${a.assignee || 'TBD'}`).join('\n')
            : 'No action items',
          inline: false,
        },
        {
          name: '📅 Next Meeting',
          value: summary.nextMeeting 
            ? `${formatDate(summary.nextMeeting)} at ${formatTime(summary.nextMeeting)}`
            : 'Not scheduled',
          inline: true,
        },
      ],
      footer: {
        text: 'Polywerk Team Meeting Bot',
      },
      timestamp: new Date().toISOString(),
    }],
  };
}

function buildMeetingReminderEmbed(meeting, minutesBefore) {
  const timeLabel = minutesBefore >= 60 
    ? `${Math.floor(minutesBefore / 60)} hour${minutesBefore >= 120 ? 's' : ''}`
    : `${minutesBefore} minutes`;

  return {
    content: meeting.mentionEveryone ? '@everyone' : '',
    embeds: [{
      title: `🔔 Meeting Reminder`,
      description: `**${meeting.title}** starts in ${timeLabel}!`,
      color: 0xF59E0B, // Yellow/Orange
      fields: [
        {
          name: '📅 When',
          value: `${formatDate(meeting.start)} at ${formatTime(meeting.start)}`,
          inline: true,
        },
        {
          name: '⏱️ Duration',
          value: formatDuration(meeting.duration || 60),
          inline: true,
        },
        {
          name: '📍 Location',
          value: meeting.location || meeting.meetingLink || 'TBD',
          inline: false,
        },
      ],
      footer: {
        text: 'Polywerk Team Meeting Bot',
      },
    }],
  };
}

function buildNextMeetingSuggestionEmbed(suggestions) {
  return {
    embeds: [{
      title: '📊 Next Meeting Suggestions',
      description: 'Based on your team\'s meeting patterns:',
      color: 0x06B6D4, // Cyan
      fields: suggestions.map((s, i) => ({
        name: `Option ${i + 1}: ${formatDate(s.date)}`,
        value: `🕐 ${formatTime(s.date)}\n📈 Confidence: ${s.confidence}%\n💡 ${s.reason}`,
        inline: true,
      })),
      footer: {
        text: 'React with 1️⃣ 2️⃣ 3️⃣ to vote',
      },
    }],
  };
}

// ============ MEETING SUGGESTION ALGORITHM ============
function suggestNextMeetings(pastMeetings, count = 3) {
  if (pastMeetings.length < 2) {
    // Not enough history, suggest next week same day/time
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    nextWeek.setHours(10, 0, 0, 0);
    
    return [{
      date: nextWeek.toISOString(),
      confidence: 50,
      reason: 'Default suggestion (not enough meeting history)',
    }];
  }

  // Analyze patterns
  const dayOfWeekCount = {};
  const hourCount = {};
  const intervals = [];

  // Sort meetings by date
  const sorted = [...pastMeetings].sort((a, b) => 
    new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  sorted.forEach((meeting, i) => {
    const date = new Date(meeting.start);
    const dayOfWeek = date.getDay();
    const hour = date.getHours();

    dayOfWeekCount[dayOfWeek] = (dayOfWeekCount[dayOfWeek] || 0) + 1;
    hourCount[hour] = (hourCount[hour] || 0) + 1;

    // Calculate interval to next meeting
    if (i < sorted.length - 1) {
      const nextDate = new Date(sorted[i + 1].start);
      const intervalDays = Math.round((nextDate - date) / (24 * 60 * 60 * 1000));
      if (intervalDays > 0 && intervalDays < 30) {
        intervals.push(intervalDays);
      }
    }
  });

  // Find most common day of week
  const preferredDay = Object.entries(dayOfWeekCount)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 1;

  // Find most common hour
  const preferredHour = Object.entries(hourCount)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 10;

  // Calculate average interval
  const avgInterval = intervals.length > 0 
    ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)
    : 7;

  // Generate suggestions
  const suggestions = [];
  const lastMeeting = new Date(sorted[sorted.length - 1]?.start || Date.now());
  const now = new Date();

  // Suggestion 1: Based on average interval
  let suggestion1 = new Date(lastMeeting.getTime() + avgInterval * 24 * 60 * 60 * 1000);
  suggestion1.setHours(parseInt(preferredHour), 0, 0, 0);
  if (suggestion1 < now) {
    suggestion1 = new Date(now.getTime() + avgInterval * 24 * 60 * 60 * 1000);
    suggestion1.setHours(parseInt(preferredHour), 0, 0, 0);
  }
  suggestions.push({
    date: suggestion1.toISOString(),
    confidence: 85,
    reason: `Based on ${avgInterval}-day average interval`,
  });

  // Suggestion 2: Next occurrence of preferred day
  let suggestion2 = new Date(now);
  const daysUntilPreferred = (parseInt(preferredDay) - suggestion2.getDay() + 7) % 7 || 7;
  suggestion2.setDate(suggestion2.getDate() + daysUntilPreferred);
  suggestion2.setHours(parseInt(preferredHour), 0, 0, 0);
  suggestions.push({
    date: suggestion2.toISOString(),
    confidence: 75,
    reason: `Team usually meets on ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][preferredDay]}s`,
  });

  // Suggestion 3: Alternative time
  let suggestion3 = new Date(suggestion1);
  suggestion3.setDate(suggestion3.getDate() + 1);
  const altHour = parseInt(preferredHour) < 12 ? 14 : 10;
  suggestion3.setHours(altHour, 0, 0, 0);
  suggestions.push({
    date: suggestion3.toISOString(),
    confidence: 60,
    reason: 'Alternative time slot',
  });

  return suggestions.slice(0, count);
}

// ============ MAIN COMPONENT ============
function DiscordMeetingIntegration({ calendarEvents = [], onCreateEvent }) {
  const [config, setConfig] = useState({
    webhookUrl: '',
    channelName: '',
    enableReminders: true,
    reminderMinutes: [60, 15], // 1 hour and 15 minutes before
    enableSummaries: true,
    mentionEveryone: false,
  });
  const [meetings, setMeetings] = useState([]);
  const [activeMeeting, setActiveMeeting] = useState(null);
  const [showSummaryForm, setShowSummaryForm] = useState(false);
  const [summary, setSummary] = useState({
    attendees: [],
    keyPoints: [],
    actionItems: [],
    notes: '',
    nextMeeting: null,
  });
  const [suggestions, setSuggestions] = useState([]);
  const [showConfig, setShowConfig] = useState(false);
  const [testStatus, setTestStatus] = useState(null);

  // Load config and meetings
  useEffect(() => {
    const savedConfig = localStorage.getItem('polywerk_discord_config');
    if (savedConfig) {
      try {
        setConfig(JSON.parse(savedConfig));
      } catch (e) {
        console.error('Failed to load Discord config:', e);
      }
    }

    const savedMeetings = localStorage.getItem('polywerk_team_meetings');
    if (savedMeetings) {
      try {
        setMeetings(JSON.parse(savedMeetings));
      } catch (e) {
        console.error('Failed to load meetings:', e);
      }
    }
  }, []);

  // Filter calendar events for team meetings
  useEffect(() => {
    const teamMeetings = calendarEvents.filter(e => 
      e.category === 'meeting' || 
      e.title?.toLowerCase().includes('meeting') ||
      e.title?.toLowerCase().includes('standup') ||
      e.title?.toLowerCase().includes('sync')
    );
    
    if (teamMeetings.length > 0) {
      // Merge with stored meetings
      const merged = [...meetings];
      teamMeetings.forEach(tm => {
        if (!merged.find(m => m.id === tm.id)) {
          merged.push(tm);
        }
      });
      if (merged.length !== meetings.length) {
        setMeetings(merged);
        localStorage.setItem('polywerk_team_meetings', JSON.stringify(merged));
      }
    }
  }, [calendarEvents]);

  // Generate suggestions when meetings change
  useEffect(() => {
    if (meetings.length > 0) {
      const newSuggestions = suggestNextMeetings(meetings);
      setSuggestions(newSuggestions);
    }
  }, [meetings]);

  const saveConfig = (newConfig) => {
    setConfig(newConfig);
    localStorage.setItem('polywerk_discord_config', JSON.stringify(newConfig));
    toast.success('Discord settings saved');
  };

  const testWebhook = async () => {
    if (!config.webhookUrl) {
      toast.error('Please enter a webhook URL first');
      return;
    }

    setTestStatus('testing');
    try {
      await sendDiscordWebhook(config.webhookUrl, {
        embeds: [{
          title: '✅ Webhook Test Successful',
          description: 'Your Polywerk Discord integration is working!',
          color: 0x22C55E,
          footer: { text: 'Polywerk Team Meeting Bot' },
          timestamp: new Date().toISOString(),
        }],
      });
      setTestStatus('success');
      toast.success('Test message sent to Discord!');
    } catch (err) {
      setTestStatus('error');
      toast.error('Failed to send test message');
    }
  };

  const sendReminder = async (meeting) => {
    if (!config.webhookUrl) {
      toast.error('Discord webhook not configured');
      return;
    }

    try {
      const now = new Date();
      const meetingTime = new Date(meeting.start);
      const minutesBefore = Math.round((meetingTime - now) / (60 * 1000));

      await sendDiscordWebhook(config.webhookUrl, 
        buildMeetingReminderEmbed({ ...meeting, mentionEveryone: config.mentionEveryone }, minutesBefore)
      );
      toast.success('Reminder sent to Discord!');
    } catch (err) {
      toast.error('Failed to send reminder');
    }
  };

  const sendSummary = async () => {
    if (!config.webhookUrl || !activeMeeting) {
      toast.error('Discord webhook not configured or no meeting selected');
      return;
    }

    try {
      await sendDiscordWebhook(config.webhookUrl,
        buildMeetingSummaryEmbed(activeMeeting, summary)
      );

      // Save summary to meeting
      const updatedMeetings = meetings.map(m => 
        m.id === activeMeeting.id ? { ...m, summary } : m
      );
      setMeetings(updatedMeetings);
      localStorage.setItem('polywerk_team_meetings', JSON.stringify(updatedMeetings));

      toast.success('Summary posted to Discord!');
      setShowSummaryForm(false);
      setActiveMeeting(null);
      setSummary({ attendees: [], keyPoints: [], actionItems: [], notes: '', nextMeeting: null });
    } catch (err) {
      toast.error('Failed to post summary');
    }
  };

  const sendSuggestions = async () => {
    if (!config.webhookUrl || suggestions.length === 0) {
      toast.error('Discord webhook not configured or no suggestions');
      return;
    }

    try {
      await sendDiscordWebhook(config.webhookUrl,
        buildNextMeetingSuggestionEmbed(suggestions)
      );
      toast.success('Suggestions posted to Discord!');
    } catch (err) {
      toast.error('Failed to post suggestions');
    }
  };

  const addMeeting = (suggestionDate = null) => {
    const newMeeting = {
      id: `meeting-${Date.now()}`,
      title: 'Team Meeting',
      start: suggestionDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      duration: 60,
      category: 'meeting',
      location: '',
      meetingLink: '',
    };

    const updated = [...meetings, newMeeting];
    setMeetings(updated);
    localStorage.setItem('polywerk_team_meetings', JSON.stringify(updated));

    // Notify calendar
    if (onCreateEvent) {
      onCreateEvent(newMeeting);
    }

    toast.success('Meeting added');
  };

  // Upcoming meetings
  const upcomingMeetings = meetings
    .filter(m => new Date(m.start) > new Date())
    .sort((a, b) => new Date(a.start) - new Date(b.start))
    .slice(0, 5);

  // Past meetings (for summaries)
  const pastMeetings = meetings
    .filter(m => new Date(m.start) < new Date())
    .sort((a, b) => new Date(b.start) - new Date(a.start))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">💬</span> Discord Meeting Integration
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Team meetings, summaries, and scheduling via Discord
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`px-4 py-2 rounded-lg text-sm ${
              showConfig ? 'bg-purple-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            ⚙️ {showConfig ? 'Hide Config' : 'Configure'}
          </button>
        </div>
      </div>

      {/* Configuration Panel */}
      {showConfig && (
        <div className="rounded-xl border p-6" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <h3 className="font-medium text-white mb-4">Discord Webhook Configuration</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Webhook URL *</label>
              <input
                type="text"
                value={config.webhookUrl}
                onChange={(e) => setConfig(prev => ({ ...prev, webhookUrl: e.target.value }))}
                placeholder="https://discord.com/api/webhooks/..."
                className="w-full px-3 py-2 rounded-lg text-white text-sm"
                style={{ backgroundColor: '#334155' }}
              />
              <p className="text-xs text-slate-500 mt-1">
                Create a webhook in your Discord channel settings → Integrations → Webhooks
              </p>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Channel Name (for reference)</label>
              <input
                type="text"
                value={config.channelName}
                onChange={(e) => setConfig(prev => ({ ...prev, channelName: e.target.value }))}
                placeholder="#team-meetings"
                className="w-full px-3 py-2 rounded-lg text-white text-sm"
                style={{ backgroundColor: '#334155' }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.enableReminders}
                  onChange={(e) => setConfig(prev => ({ ...prev, enableReminders: e.target.checked }))}
                  className="w-4 h-4 rounded"
                />
                <span className="text-slate-300 text-sm">Enable meeting reminders</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.mentionEveryone}
                  onChange={(e) => setConfig(prev => ({ ...prev, mentionEveryone: e.target.checked }))}
                  className="w-4 h-4 rounded"
                />
                <span className="text-slate-300 text-sm">@everyone on reminders</span>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => saveConfig(config)}
                className="px-4 py-2 rounded-lg font-medium text-white"
                style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
              >
                💾 Save Settings
              </button>
              <button
                onClick={testWebhook}
                disabled={testStatus === 'testing'}
                className={`px-4 py-2 rounded-lg text-sm ${
                  testStatus === 'success' ? 'bg-green-500/20 text-green-400' :
                  testStatus === 'error' ? 'bg-red-500/20 text-red-400' :
                  'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {testStatus === 'testing' ? '⏳ Testing...' :
                 testStatus === 'success' ? '✅ Success!' :
                 testStatus === 'error' ? '❌ Failed' :
                 '🧪 Test Webhook'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={() => addMeeting()}
          className="rounded-xl border p-4 text-left hover:border-purple-500/50 transition"
          style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
        >
          <span className="text-2xl">📅</span>
          <p className="text-white font-medium mt-2">New Meeting</p>
          <p className="text-slate-500 text-xs">Schedule team meeting</p>
        </button>

        <button
          onClick={sendSuggestions}
          disabled={!config.webhookUrl || suggestions.length === 0}
          className="rounded-xl border p-4 text-left hover:border-purple-500/50 transition disabled:opacity-50"
          style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
        >
          <span className="text-2xl">🤖</span>
          <p className="text-white font-medium mt-2">Post Suggestions</p>
          <p className="text-slate-500 text-xs">AI meeting time poll</p>
        </button>

        <button
          onClick={() => upcomingMeetings[0] && sendReminder(upcomingMeetings[0])}
          disabled={!config.webhookUrl || upcomingMeetings.length === 0}
          className="rounded-xl border p-4 text-left hover:border-purple-500/50 transition disabled:opacity-50"
          style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
        >
          <span className="text-2xl">🔔</span>
          <p className="text-white font-medium mt-2">Send Reminder</p>
          <p className="text-slate-500 text-xs">Notify team now</p>
        </button>

        <button
          onClick={() => pastMeetings[0] && (setActiveMeeting(pastMeetings[0]), setShowSummaryForm(true))}
          disabled={pastMeetings.length === 0}
          className="rounded-xl border p-4 text-left hover:border-purple-500/50 transition disabled:opacity-50"
          style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
        >
          <span className="text-2xl">📝</span>
          <p className="text-white font-medium mt-2">Post Summary</p>
          <p className="text-slate-500 text-xs">Share meeting notes</p>
        </button>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Meetings */}
        <div className="rounded-xl border p-6" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <h3 className="font-medium text-white mb-4 flex items-center gap-2">
            📅 Upcoming Meetings
          </h3>
          <div className="space-y-3">
            {upcomingMeetings.length === 0 ? (
              <p className="text-slate-500 text-sm">No upcoming meetings</p>
            ) : (
              upcomingMeetings.map(meeting => (
                <div
                  key={meeting.id}
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{ backgroundColor: '#334155' }}
                >
                  <div>
                    <p className="text-white font-medium">{meeting.title}</p>
                    <p className="text-sm text-slate-500">
                      {formatDate(meeting.start)} at {formatTime(meeting.start)}
                    </p>
                  </div>
                  <button
                    onClick={() => sendReminder(meeting)}
                    disabled={!config.webhookUrl}
                    className="px-3 py-1 rounded-lg text-sm bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 disabled:opacity-50"
                  >
                    🔔 Remind
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* AI Suggestions */}
        <div className="rounded-xl border p-6" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <h3 className="font-medium text-white mb-4 flex items-center gap-2">
            🤖 AI Meeting Suggestions
          </h3>
          <div className="space-y-3">
            {suggestions.length === 0 ? (
              <p className="text-slate-500 text-sm">Need more meeting history for suggestions</p>
            ) : (
              suggestions.map((suggestion, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{ backgroundColor: '#334155' }}
                >
                  <div>
                    <p className="text-white font-medium">
                      {formatDate(suggestion.date)} at {formatTime(suggestion.date)}
                    </p>
                    <p className="text-sm text-slate-500">{suggestion.reason}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      suggestion.confidence >= 80 ? 'bg-green-500/20 text-green-400' :
                      suggestion.confidence >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-slate-600 text-slate-400'
                    }`}>
                      {suggestion.confidence}%
                    </span>
                    <button
                      onClick={() => addMeeting(suggestion.date)}
                      className="px-2 py-1 rounded text-sm bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                    >
                      ✓
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Past Meetings for Summaries */}
      <div className="rounded-xl border p-6" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        <h3 className="font-medium text-white mb-4 flex items-center gap-2">
          📋 Recent Meetings (Add Summary)
        </h3>
        <div className="space-y-3">
          {pastMeetings.length === 0 ? (
            <p className="text-slate-500 text-sm">No past meetings</p>
          ) : (
            pastMeetings.map(meeting => (
              <div
                key={meeting.id}
                className="flex items-center justify-between p-3 rounded-lg"
                style={{ backgroundColor: '#334155' }}
              >
                <div>
                  <p className="text-white font-medium">{meeting.title}</p>
                  <p className="text-sm text-slate-500">
                    {formatDate(meeting.start)} at {formatTime(meeting.start)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {meeting.summary ? (
                    <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">
                      ✓ Summary posted
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setActiveMeeting(meeting);
                        setShowSummaryForm(true);
                      }}
                      className="px-3 py-1 rounded-lg text-sm bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
                    >
                      📝 Add Summary
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Summary Form Modal */}
      {showSummaryForm && activeMeeting && (
        <MeetingSummaryModal
          meeting={activeMeeting}
          summary={summary}
          setSummary={setSummary}
          suggestions={suggestions}
          onSend={sendSummary}
          onClose={() => {
            setShowSummaryForm(false);
            setActiveMeeting(null);
          }}
          webhookConfigured={!!config.webhookUrl}
        />
      )}
    </div>
  );
}

// ============ MEETING SUMMARY MODAL ============
function MeetingSummaryModal({ meeting, summary, setSummary, suggestions, onSend, onClose, webhookConfigured }) {
  const [newAttendee, setNewAttendee] = useState('');
  const [newKeyPoint, setNewKeyPoint] = useState('');
  const [newActionItem, setNewActionItem] = useState({ task: '', assignee: '' });

  const addAttendee = () => {
    if (newAttendee.trim()) {
      setSummary(prev => ({ ...prev, attendees: [...prev.attendees, newAttendee.trim()] }));
      setNewAttendee('');
    }
  };

  const addKeyPoint = () => {
    if (newKeyPoint.trim()) {
      setSummary(prev => ({ ...prev, keyPoints: [...prev.keyPoints, newKeyPoint.trim()] }));
      setNewKeyPoint('');
    }
  };

  const addActionItem = () => {
    if (newActionItem.task.trim()) {
      setSummary(prev => ({ 
        ...prev, 
        actionItems: [...prev.actionItems, { ...newActionItem, task: newActionItem.task.trim() }] 
      }));
      setNewActionItem({ task: '', assignee: '' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <div className="sticky top-0 px-6 py-4 border-b flex items-center justify-between z-10" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <div>
            <h2 className="font-bold text-white">📋 Meeting Summary</h2>
            <p className="text-sm text-slate-500">{meeting.title} - {formatDate(meeting.start)}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400">✕</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Attendees */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">👥 Attendees</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {summary.attendees.map((a, i) => (
                <span key={i} className="px-2 py-1 rounded bg-purple-500/20 text-purple-400 text-sm flex items-center gap-1">
                  {a}
                  <button 
                    onClick={() => setSummary(prev => ({ 
                      ...prev, 
                      attendees: prev.attendees.filter((_, idx) => idx !== i) 
                    }))}
                    className="hover:text-white"
                  >×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newAttendee}
                onChange={(e) => setNewAttendee(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addAttendee()}
                placeholder="Add attendee name..."
                className="flex-1 px-3 py-2 rounded-lg text-white text-sm"
                style={{ backgroundColor: '#334155' }}
              />
              <button onClick={addAttendee} className="px-3 py-2 rounded-lg bg-purple-500/20 text-purple-400">+</button>
            </div>
          </div>

          {/* Key Points */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">📝 Key Points Discussed</label>
            <div className="space-y-2 mb-2">
              {summary.keyPoints.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg" style={{ backgroundColor: '#334155' }}>
                  <span className="text-white text-sm">{i + 1}. {p}</span>
                  <button 
                    onClick={() => setSummary(prev => ({ 
                      ...prev, 
                      keyPoints: prev.keyPoints.filter((_, idx) => idx !== i) 
                    }))}
                    className="text-slate-500 hover:text-red-400"
                  >🗑️</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newKeyPoint}
                onChange={(e) => setNewKeyPoint(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addKeyPoint()}
                placeholder="Add key point..."
                className="flex-1 px-3 py-2 rounded-lg text-white text-sm"
                style={{ backgroundColor: '#334155' }}
              />
              <button onClick={addKeyPoint} className="px-3 py-2 rounded-lg bg-cyan-500/20 text-cyan-400">+</button>
            </div>
          </div>

          {/* Action Items */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">✅ Action Items</label>
            <div className="space-y-2 mb-2">
              {summary.actionItems.map((a, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg" style={{ backgroundColor: '#334155' }}>
                  <span className="text-white text-sm">
                    • {a.task} {a.assignee && <span className="text-cyan-400">→ {a.assignee}</span>}
                  </span>
                  <button 
                    onClick={() => setSummary(prev => ({ 
                      ...prev, 
                      actionItems: prev.actionItems.filter((_, idx) => idx !== i) 
                    }))}
                    className="text-slate-500 hover:text-red-400"
                  >🗑️</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newActionItem.task}
                onChange={(e) => setNewActionItem(prev => ({ ...prev, task: e.target.value }))}
                placeholder="Action item..."
                className="flex-1 px-3 py-2 rounded-lg text-white text-sm"
                style={{ backgroundColor: '#334155' }}
              />
              <input
                type="text"
                value={newActionItem.assignee}
                onChange={(e) => setNewActionItem(prev => ({ ...prev, assignee: e.target.value }))}
                placeholder="Assignee"
                className="w-32 px-3 py-2 rounded-lg text-white text-sm"
                style={{ backgroundColor: '#334155' }}
              />
              <button onClick={addActionItem} className="px-3 py-2 rounded-lg bg-green-500/20 text-green-400">+</button>
            </div>
          </div>

          {/* Next Meeting */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">📅 Next Meeting</label>
            <div className="grid grid-cols-2 gap-2">
              {suggestions.slice(0, 2).map((s, i) => (
                <button
                  key={i}
                  onClick={() => setSummary(prev => ({ ...prev, nextMeeting: s.date }))}
                  className={`p-3 rounded-lg text-left text-sm ${
                    summary.nextMeeting === s.date 
                      ? 'bg-purple-500/30 border-purple-500' 
                      : 'hover:bg-slate-600'
                  }`}
                  style={{ backgroundColor: '#334155', borderColor: summary.nextMeeting === s.date ? '#a855f7' : '#334155', borderWidth: '1px' }}
                >
                  <p className="text-white font-medium">{formatDate(s.date)}</p>
                  <p className="text-slate-500 text-xs">{formatTime(s.date)}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t" style={{ borderColor: '#334155' }}>
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-slate-300 border border-slate-600 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={onSend}
              disabled={!webhookConfigured}
              className="flex-1 py-2.5 rounded-lg font-medium text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
            >
              📤 Post to Discord
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DiscordMeetingIntegration;
