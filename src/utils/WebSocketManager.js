/**
 * WebSocket Manager - Handles connection with fallbacks and error recovery
 * Logs detailed errors to help diagnose issues
 */

class WebSocketManager {
  constructor(url = 'ws://127.0.0.1:5000/ws') {
    this.url = url;
    this.ws = null;
    this.listeners = {};
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
    this.isManualClose = false;
    this.messageQueue = [];
    this.isConnected = false;
  }

  /**
   * Connect to WebSocket with detailed error handling
   */
  connect(onMessage, onError, onConnect) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[WS] Already connected');
      if (onConnect) onConnect();
      return;
    }

    console.log(`[WS] Attempting connection to ${this.url}...`);

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('[WS] ✅ Connected successfully');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;

        // Send queued messages
        while (this.messageQueue.length > 0) {
          const msg = this.messageQueue.shift();
          this.ws.send(msg);
          console.log('[WS] Sent queued message');
        }

        if (onConnect) onConnect();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[WS] Message received:', data.type || 'unknown');
          if (onMessage) onMessage(data);
        } catch (e) {
          console.error('[WS] Failed to parse message:', e, event.data);
        }
      };

      this.ws.onerror = (event) => {
        console.error('[WS] Connection error:', event);
        
        // Detailed error diagnostics
        if (this.ws.readyState === WebSocket.CONNECTING) {
          console.error('[WS] Error during connection attempt');
        } else if (this.ws.readyState === WebSocket.OPEN) {
          console.error('[WS] Error while connected');
        } else if (this.ws.readyState === WebSocket.CLOSING) {
          console.error('[WS] Error while closing');
        } else if (this.ws.readyState === WebSocket.CLOSED) {
          console.error('[WS] Error after closed');
        }

        if (onError) onError(event);
      };

      this.ws.onclose = (event) => {
        console.log(`[WS] Connection closed: code=${event.code}, reason=${event.reason}`);
        this.isConnected = false;

        // Don't reconnect if manually closed
        if (this.isManualClose) {
          console.log('[WS] Manual close - not reconnecting');
          return;
        }

        // Attempt reconnect with exponential backoff
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
          console.log(`[WS] Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
          setTimeout(() => this.connect(onMessage, onError, onConnect), delay);
        } else {
          console.error('[WS] Max reconnection attempts reached');
          if (onError) {
            onError(new Error(`WebSocket failed after ${this.maxReconnectAttempts} reconnection attempts`));
          }
        }
      };
    } catch (e) {
      console.error('[WS] Failed to create WebSocket:', e);
      if (onError) onError(e);
    }
  }

  /**
   * Send message with queue fallback
   */
  send(data) {
    const message = typeof data === 'string' ? data : JSON.stringify(data);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(message);
        console.log('[WS] Message sent:', typeof data === 'object' ? data.type : 'text');
        return true;
      } catch (e) {
        console.error('[WS] Failed to send message:', e);
        this.messageQueue.push(message);
        return false;
      }
    } else {
      console.warn('[WS] Not connected - queuing message');
      this.messageQueue.push(message);
      return false;
    }
  }

  /**
   * Subscribe to message type
   */
  on(type, callback) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(callback);
  }

  /**
   * Unsubscribe from message type
   */
  off(type, callback) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter(cb => cb !== callback);
    }
  }

  /**
   * Close connection
   */
  close() {
    console.log('[WS] Closing connection');
    this.isManualClose = true;
    if (this.ws) {
      this.ws.close();
    }
  }

  /**
   * Check if connected
   */
  isReady() {
    return this.ws && this.ws.readyState === WebSocket.OPEN && this.isConnected;
  }

  /**
   * Get connection status
   */
  getStatus() {
    if (!this.ws) return 'not_initialized';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
        return 'closing';
      case WebSocket.CLOSED:
        return 'closed';
      default:
        return 'unknown';
    }
  }
}

export default WebSocketManager;
