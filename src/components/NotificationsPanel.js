import React, { useEffect, useState } from 'react';
import { api, unwrap } from '../services/api';

const NotificationsPanel = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.getNotifications(10);
        const data = unwrap(res) || {};
        const list = data.notifications || data.data?.notifications;
        setNotifications(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error('Error fetching notifications:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getPriorityStyle = (priority) => {
    const styles = {
      'CRITICAL': 'bg-red-100 border-red-500',
      'HIGH': 'bg-orange-100 border-orange-500',
      'NORMAL': 'bg-blue-100 border-blue-500',
      'LOW': 'bg-gray-100 border-gray-400'
    };
    return styles[priority] || 'bg-gray-100 border-gray-400';
  };

  const getTimeAgo = (timestamp) => {
    const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (loading) return <div className="bg-white rounded-lg shadow p-6"><p className="text-gray-500">Loading...</p></div>;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">🔔 Notifications</h2>

      {notifications.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          <p className="text-3xl mb-2">✅</p>
          <p>All clear!</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {notifications.map((notif, index) => (
            <div 
              key={notif.notification_id || `notif-${index}`} 
              className={`border-l-4 rounded p-3 ${getPriorityStyle(notif.priority)}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{notif.title}</p>
                  <p className="text-xs text-gray-600 truncate">{notif.message}</p>
                </div>
                <span className="text-xs text-gray-500 ml-2">{getTimeAgo(notif.sent_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsPanel;
