import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

const SystemStats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // getSystemStatus uses safeUnwrap which returns data directly
        const data = await api.getSystemStatus();
        setStats(data || {});
      } catch (err) {
        console.error('Error fetching system stats:', err);
        setStats({});
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Helper to safely extract platform string
  const getPlatformDisplay = () => {
    if (!stats?.platform) return 'N/A';
    // If platform is a string, return it
    if (typeof stats.platform === 'string') return stats.platform;
    // If platform is an object with system property
    if (typeof stats.platform === 'object') {
      return stats.platform.system || stats.platform.release || 'Unknown';
    }
    // Fallback: check for top-level system property
    if (stats.system) {
      return typeof stats.system === 'string' ? stats.system : 'System';
    }
    return 'N/A';
  };

  // Helper to get CPU percentage
  const getCpuPercent = () => {
    const cpu = stats?.cpu_percent ?? stats?.cpu ?? stats?.cpu_usage ?? 0;
    return typeof cpu === 'number' ? cpu.toFixed(0) : '0';
  };

  // Helper to get memory percentage
  const getMemoryPercent = () => {
    const mem = stats?.memory?.percent_used ?? stats?.memory?.percent ?? stats?.memory_percent ?? stats?.memory_usage ?? 0;
    return typeof mem === 'number' ? mem.toFixed(0) : '0';
  };

  // Helper to determine status
  const getStatus = () => {
    const status = stats?.status;
    if (status === 'ok' || status === 'healthy' || status === 'online' || status === true) {
      return 'ok';
    }
    // If we got any data back, consider it online
    if (stats && Object.keys(stats).length > 0) {
      return 'ok';
    }
    return 'offline';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <p className="text-gray-500">Loading system stats...</p>
      </div>
    );
  }

  const status = getStatus();

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-xs text-gray-500">CPU</p>
            <p className="text-lg font-bold">{getCpuPercent()}%</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Memory</p>
            <p className="text-lg font-bold">{getMemoryPercent()}%</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Platform</p>
            <p className="text-lg font-bold">{getPlatformDisplay()}</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
          status === 'ok' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {status === 'ok' ? '● Online' : '● Offline'}
        </div>
      </div>
    </div>
  );
};

export default SystemStats;
