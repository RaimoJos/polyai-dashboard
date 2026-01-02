/**
 * React hooks for WebSocket real-time updates
 * 
 * Uses the WebSocket service with auto-reconnection support.
 */
import { useCallback, useEffect, useState } from 'react';
import wsService from '../services/websocket';

/**
 * Hook for WebSocket connection status and printer updates
 */
export function useLivePrinters() {
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [printers, setPrinters] = useState({});
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    // Connect on mount
    wsService.connect();

    // Set initial state
    setConnected(wsService.isConnected());
    setReconnecting(wsService.isReconnecting());

    const unsubConnect = wsService.on('onConnect', () => {
      setConnected(true);
      setReconnecting(false);
    });

    const unsubDisconnect = wsService.on('onDisconnect', () => {
      setConnected(false);
    });

    const unsubReconnecting = wsService.on('onReconnecting', () => {
      setReconnecting(true);
    });

    const unsubStates = wsService.on('onPrinterStates', (data) => {
      if (data?.printers) {
        const printerMap = {};
        data.printers.forEach((p) => {
          printerMap[p.name] = p;
        });
        setPrinters(printerMap);
        setLastUpdate(new Date());
      }
    });

    const unsubUpdate = wsService.on('onPrinterUpdate', (data) => {
      if (data?.printer) {
        setPrinters((prev) => ({
          ...prev,
          [data.printer.name]: data.printer,
        }));
        setLastUpdate(new Date());
      }
    });

    return () => {
      unsubConnect();
      unsubDisconnect();
      unsubReconnecting();
      unsubStates();
      unsubUpdate();
    };
  }, []);

  return { connected, reconnecting, printers, lastUpdate };
}

/**
 * Hook for job queue updates
 */
export function useLiveJobs() {
  const [jobs, setJobs] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    wsService.connect();

    const unsub = wsService.on('onJobUpdate', (data) => {
      if (!data) return;
      setJobs((prev) => {
        const idx = prev.findIndex((j) => j.job_id === data.job_id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], ...data };
          return updated;
        }
        return [...prev, data];
      });
      setLastUpdate(new Date());
    });

    return () => unsub();
  }, []);

  return { jobs, lastUpdate };
}

/**
 * Hook for alerts/notifications
 */
export function useLiveAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    wsService.connect();

    const unsub = wsService.on('onAlert', (alert) => {
      if (!alert) return;
      setAlerts((prev) => [
        { ...alert, id: Date.now(), read: false },
        ...prev.slice(0, 99),
      ]);
      setUnreadCount((prev) => prev + 1);
    });

    return () => unsub();
  }, []);

  const markRead = useCallback((alertId) => {
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, read: true } : a)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(() => {
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
    setUnreadCount(0);
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
    setUnreadCount(0);
  }, []);

  return { alerts, unreadCount, markRead, markAllRead, clearAlerts };
}

/**
 * Hook for printer controls
 */
export function usePrinterControls(printerName) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sendCommand = useCallback(
    async (command, params = {}) => {
      setLoading(true);
      setError(null);
      try {
        const result = await wsService.sendCommand(printerName, command, params);
        return result;
      } catch (err) {
        setError(err?.message || String(err));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [printerName]
  );

  const pause = useCallback(() => sendCommand('pause'), [sendCommand]);
  const resume = useCallback(() => sendCommand('resume'), [sendCommand]);
  const stop = useCallback(() => sendCommand('stop'), [sendCommand]);
  const setSpeed = useCallback((speed) => sendCommand('speed', { speed }), [sendCommand]);
  const setTemperature = useCallback((nozzle, bed) => sendCommand('temp', { nozzle, bed }), [sendCommand]);
  const setFan = useCallback((speed, type = 'part') => sendCommand('fan', { speed, type }), [sendCommand]);
  const toggleLight = useCallback(() => sendCommand('light'), [sendCommand]);

  return {
    loading,
    error,
    pause,
    resume,
    stop,
    setSpeed,
    setTemperature,
    setFan,
    toggleLight,
    sendCommand,
  };
}

/**
 * Hook for WebSocket connection status
 */
export function useWebSocketStatus() {
  const [status, setStatus] = useState(() => wsService.getStatus());
  const [connected, setConnected] = useState(() => wsService.isConnected());
  const [reconnecting, setReconnecting] = useState(() => wsService.isReconnecting());

  useEffect(() => {
    const unsubConnect = wsService.on('onConnect', () => {
      setConnected(true);
      setReconnecting(false);
      setStatus('connected');
    });

    const unsubDisconnect = wsService.on('onDisconnect', () => {
      setConnected(false);
      setStatus('disconnected');
    });

    const unsubReconnecting = wsService.on('onReconnecting', () => {
      setReconnecting(true);
      setStatus('reconnecting');
    });

    return () => {
      unsubConnect();
      unsubDisconnect();
      unsubReconnecting();
    };
  }, []);

  return { connected, reconnecting, status };
}

/**
 * Hook for team chat
 */
export function useTeamChat(channel = 'general') {
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    wsService.connect();

    // Request chat history on connect
    const unsubConnect = wsService.on('onConnect', () => {
      wsService.requestChatHistory(channel, 50);
    });

    // Handle incoming messages
    const unsubMessage = wsService.on('onChatMessage', (data) => {
      if (data.channel === channel || !data.channel) {
        const newMsg = {
          id: data.id || Date.now(),
          message: data.message,
          user_id: data.user_id,
          username: data.username,
          full_name: data.full_name,
          timestamp: data.timestamp || Date.now(),
          channel: data.channel || channel,
        };
        setMessages((prev) => [...prev, newMsg]);
        
        // Increment unread if chat is closed
        if (!isOpen) {
          setUnreadCount((prev) => prev + 1);
        }
      }
    });

    // Handle chat history
    const unsubHistory = wsService.on('onChatHistory', (data) => {
      if (data.channel === channel || !data.channel) {
        const historyMessages = (data.messages || []).map((m) => ({
          id: m.id || m.message_id,
          message: m.message || m.content,
          user_id: m.user_id,
          username: m.username,
          full_name: m.full_name,
          timestamp: m.timestamp || m.created_at,
          channel: m.channel || channel,
        }));
        setMessages(historyMessages);
      }
    });

    // Handle presence updates
    const unsubPresence = wsService.on('onChatPresence', (data) => {
      setOnlineUsers(data.users || []);
    });

    // Handle typing indicators
    const unsubTyping = wsService.on('onChatTyping', (data) => {
      if (data.channel === channel || !data.channel) {
        if (data.isTyping) {
          setTypingUsers((prev) => {
            if (!prev.find((u) => u.user_id === data.user_id)) {
              return [...prev, { user_id: data.user_id, username: data.username }];
            }
            return prev;
          });
        } else {
          setTypingUsers((prev) => prev.filter((u) => u.user_id !== data.user_id));
        }
      }
    });

    // Request history if already connected
    if (wsService.isConnected()) {
      wsService.requestChatHistory(channel, 50);
    }

    return () => {
      unsubConnect();
      unsubMessage();
      unsubHistory();
      unsubPresence();
      unsubTyping();
    };
  }, [channel, isOpen]);

  const sendMessage = useCallback((message) => {
    if (message.trim()) {
      wsService.sendChatMessage(message.trim(), channel);
    }
  }, [channel]);

  const sendTyping = useCallback((isTyping) => {
    wsService.sendTypingIndicator(channel, isTyping);
  }, [channel]);

  const openChat = useCallback(() => {
    setIsOpen(true);
    setUnreadCount(0);
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleChat = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) setUnreadCount(0);
      return !prev;
    });
  }, []);

  return {
    messages,
    onlineUsers,
    typingUsers,
    unreadCount,
    isOpen,
    sendMessage,
    sendTyping,
    openChat,
    closeChat,
    toggleChat,
  };
}

// Default export for backwards compatibility
export default {
  useLivePrinters,
  useLiveJobs,
  useLiveAlerts,
  usePrinterControls,
  useWebSocketStatus,
  useTeamChat,
};
