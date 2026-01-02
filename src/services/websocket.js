/**
 * src/services/websocket.js
 * 
 * WebSocket service with:
 * - Automatic reconnection with exponential backoff
 * - Heartbeat/ping-pong monitoring
 * - Connection state tracking
 * - Clean error handling
 */

const SOCKET_URL = process.env.REACT_APP_WS_URL || 'ws://127.0.0.1:5000/ws';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.reconnecting = false;
    this.callbacks = {
      onConnect: [],
      onDisconnect: [],
      onReconnecting: [],
      onPrinterStates: [],
      onPrinterUpdate: [],
      onJobUpdate: [],
      onAlert: [],
      // Team chat
      onChatMessage: [],
      onChatHistory: [],
      onChatPresence: [],
      onChatTyping: [],
      onAuthSuccess: [],
    };
    
    // Reconnection settings
    this.retries = 0;
    this.maxRetries = 1000; // Essentially unlimited
    this.baseDelay = 1000; // 1 second
    this.maxDelay = 30000; // 30 seconds max
    this.reconnectTimeout = null;
    
    // Heartbeat settings
    this.pingInterval = null;
    this.pingIntervalMs = 30000; // 30 seconds
    this.lastPong = Date.now();
    this.pongTimeout = 60000; // 60 seconds
    
    // Track if we intentionally disconnected
    this.intentionalClose = false;
  }

  connect() {
    // Don't create duplicate connections
    if (this.socket && (this.socket.readyState === WebSocket.CONNECTING || 
        this.socket.readyState === WebSocket.OPEN)) {
      return;
    }

    this._clearReconnectTimeout();
    this.intentionalClose = false;

    try {
      console.log('[WS] Connecting to', SOCKET_URL);
      this.socket = new WebSocket(SOCKET_URL);

      this.socket.onopen = () => {
        console.log('[WS] Connected');
        this.connected = true;
        this.reconnecting = false;
        this.retries = 0;
        this.lastPong = Date.now();
        this._startHeartbeat();
        this._trigger('onConnect');
        
        // Auto-authenticate for chat if token is available
        this._authenticateForChat();
      };

      this.socket.onclose = (event) => {
        console.log('[WS] Closed:', event.code, event.reason);
        this._handleClose(event);
      };

      this.socket.onerror = (error) => {
        console.error('[WS] Error:', error);
        // onclose will be called after onerror, so reconnection happens there
      };

      this.socket.onmessage = (event) => {
        this._handleMessage(event);
      };
    } catch (error) {
      console.error('[WS] Connection error:', error);
      this._scheduleReconnect();
    }
  }

  disconnect() {
    console.log('[WS] Intentional disconnect');
    this.intentionalClose = true;
    this._cleanup();
  }

  _cleanup() {
    this._stopHeartbeat();
    this._clearReconnectTimeout();
    
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.connected = false;
    this.reconnecting = false;
  }

  _handleClose(event) {
    this.connected = false;
    this._stopHeartbeat();
    this.socket = null;
    
    this._trigger('onDisconnect');

    // Don't reconnect if intentionally closed or normal closure
    if (this.intentionalClose) {
      console.log('[WS] Not reconnecting (intentional close)');
      return;
    }

    // Reconnect for abnormal closures
    if (event.code !== 1000 && this.retries < this.maxRetries) {
      this._scheduleReconnect();
    }
  }

  _handleMessage(event) {
    try {
      const data = JSON.parse(event.data);

      // Handle ping/pong
      if (data.type === 'ping') {
        this._sendPong();
        return;
      }
      
      if (data.type === 'pong') {
        this.lastPong = Date.now();
        return;
      }

      // Route to appropriate handlers
      if (data.type === 'printer_states') {
        this._trigger('onPrinterStates', data);
      } else if (data.type === 'printer_update') {
        this._trigger('onPrinterUpdate', data);
      } else if (data.type === 'job_update') {
        this._trigger('onJobUpdate', data);
      } else if (data.type === 'alert') {
        this._trigger('onAlert', data);
      } else if (data.type === 'chat_message') {
        this._trigger('onChatMessage', data);
      } else if (data.type === 'chat_history') {
        this._trigger('onChatHistory', data);
      } else if (data.type === 'chat_presence') {
        this._trigger('onChatPresence', data);
      } else if (data.type === 'chat_typing') {
        this._trigger('onChatTyping', data);
      } else if (data.type === 'auth_success') {
        this._trigger('onAuthSuccess', data);
      }
    } catch (e) {
      console.error('[WS] Failed to parse message:', e);
    }
  }

  _scheduleReconnect() {
    if (this.reconnecting || this.intentionalClose) return;
    
    this.reconnecting = true;
    this.retries++;
    
    // Exponential backoff with jitter
    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.retries - 1) + Math.random() * 1000,
      this.maxDelay
    );
    
    console.log(`[WS] Reconnecting in ${Math.round(delay)}ms (attempt ${this.retries})`);
    this._trigger('onReconnecting', { attempt: this.retries, delay });

    this.reconnectTimeout = setTimeout(() => {
      this.reconnecting = false;
      this.connect();
    }, delay);
  }

  _clearReconnectTimeout() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    
    this.pingInterval = setInterval(() => {
      // Check if we've received a pong recently
      if (Date.now() - this.lastPong > this.pongTimeout) {
        console.warn('[WS] No pong received, reconnecting...');
        this._cleanup();
        this._scheduleReconnect();
        return;
      }

      // Send ping
      this._sendPing();
    }, this.pingIntervalMs);
  }

  _stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  _sendPing() {
    this.send({ type: 'ping', timestamp: Date.now() });
  }

  _sendPong() {
    this.send({ type: 'pong', timestamp: Date.now() });
  }

  send(data) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify(data));
        return true;
      } catch (error) {
        console.error('[WS] Send error:', error);
        return false;
      }
    }
    return false;
  }

  sendCommand(printerName, command, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const messageId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Set up response handler
      const timeout = setTimeout(() => {
        reject(new Error('Command timeout'));
      }, 30000);

      const handler = (data) => {
        if (data.messageId === messageId) {
          clearTimeout(timeout);
          this.off('onCommandResponse', handler);
          if (data.success) {
            resolve(data);
          } else {
            reject(new Error(data.error || 'Command failed'));
          }
        }
      };

      this.on('onCommandResponse', handler);

      // Send command
      this.send({
        type: 'command',
        messageId,
        printer: printerName,
        command,
        params,
      });
    });
  }

  on(event, cb) {
    if (!this.callbacks[event]) this.callbacks[event] = [];
    this.callbacks[event].push(cb);
    return () => this.off(event, cb);
  }

  off(event, cb) {
    if (!this.callbacks[event]) return;
    this.callbacks[event] = this.callbacks[event].filter(x => x !== cb);
  }

  _trigger(event, data) {
    const list = this.callbacks[event] || [];
    list.forEach(cb => {
      try { 
        cb(data); 
      } catch(e) { 
        console.error('[WS] Callback error:', e); 
      }
    });
  }

  // Chat methods
  sendChatMessage(message, channel = 'general') {
    return this.send({
      type: 'chat_message',
      message,
      channel,
      timestamp: Date.now(),
    });
  }

  sendTypingIndicator(channel = 'general', isTyping = true) {
    return this.send({
      type: 'chat_typing',
      channel,
      isTyping,
    });
  }

  requestChatHistory(channel = 'general', limit = 50) {
    return this.send({
      type: 'chat_history_request',
      channel,
      limit,
    });
  }

  _authenticateForChat() {
    // Get auth token from storage
    const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
    if (token) {
      this.send({
        type: 'auth',
        token,
      });
      console.log('[WS] Sent chat authentication');
    }
  }

  isConnected() { 
    return this.connected; 
  }

  isReconnecting() {
    return this.reconnecting;
  }

  getStatus() {
    if (this.connected) return 'connected';
    if (this.reconnecting) return 'reconnecting';
    return 'disconnected';
  }
}

const wsService = new WebSocketService();

// Auto-connect when module loads (optional - can be removed if you want manual control)
// Uncomment the line below if you want auto-connect on import:
// wsService.connect();

export default wsService;
