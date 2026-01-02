// Alert System with Toast + Persistent Notifications
import React, { useState, useEffect, useCallback } from 'react';

const AlertContext = React.createContext(null);

export const ALERT_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
  MAINTENANCE: 'maintenance',
};

export function useAlerts() {
  const context = React.useContext(AlertContext);
  if (!context) {
    throw new Error('useAlerts must be used within AlertProvider');
  }
  return context;
}

export function AlertProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [persistentAlerts, setPersistentAlerts] = useState([]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts(prev => prev.slice(1));
    }, 5000);
    return () => clearTimeout(timer);
  }, [toasts]);

  const addToast = useCallback((type, message, title = '') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, title, message }]);
    return id;
  }, []);

  const addAlert = useCallback((alert) => {
    const id = Date.now();
    setPersistentAlerts(prev => [...prev, { id, ...alert }]);
    return id;
  }, []);

  const removeAlert = useCallback((id) => {
    setPersistentAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const clearAlerts = useCallback(() => {
    setPersistentAlerts([]);
  }, []);

  const toast = {
    success: (msg, title) => addToast(ALERT_TYPES.SUCCESS, msg, title),
    error: (msg, title) => addToast(ALERT_TYPES.ERROR, msg, title),
    warning: (msg, title) => addToast(ALERT_TYPES.WARNING, msg, title),
    info: (msg, title) => addToast(ALERT_TYPES.INFO, msg, title),
  };

  return (
    <AlertContext.Provider value={{ toast, addAlert, removeAlert, clearAlerts, toasts, persistentAlerts }}>
      {children}
      <ToastContainer toasts={toasts} />
      <AlertsPanel alerts={persistentAlerts} onRemove={removeAlert} />
    </AlertContext.Provider>
  );
}

function ToastContainer({ toasts }) {
  return (
    <div className="fixed bottom-4 right-4 space-y-2 z-50 pointer-events-none">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

function ToastItem({ toast }) {
  const getIcon = (type) => {
    switch (type) {
      case ALERT_TYPES.SUCCESS: return '✅';
      case ALERT_TYPES.ERROR: return '❌';
      case ALERT_TYPES.WARNING: return '⚠️';
      case ALERT_TYPES.INFO: return 'ℹ️';
      default: return '📢';
    }
  };

  const getBgColor = (type) => {
    switch (type) {
      case ALERT_TYPES.SUCCESS: return 'bg-green-900/90 border-green-700';
      case ALERT_TYPES.ERROR: return 'bg-red-900/90 border-red-700';
      case ALERT_TYPES.WARNING: return 'bg-yellow-900/90 border-yellow-700';
      case ALERT_TYPES.INFO: return 'bg-blue-900/90 border-blue-700';
      default: return 'bg-slate-900/90 border-slate-700';
    }
  };

  const getTextColor = (type) => {
    switch (type) {
      case ALERT_TYPES.SUCCESS: return 'text-green-300';
      case ALERT_TYPES.ERROR: return 'text-red-300';
      case ALERT_TYPES.WARNING: return 'text-yellow-300';
      case ALERT_TYPES.INFO: return 'text-blue-300';
      default: return 'text-slate-300';
    }
  };

  return (
    <div className={`${getBgColor(toast.type)} border rounded-lg p-4 shadow-xl pointer-events-auto max-w-sm animate-slideInUp`}>
      <div className="flex gap-3">
        <span className="text-xl flex-shrink-0">{getIcon(toast.type)}</span>
        <div className="flex-1 min-w-0">
          {toast.title && (
            <p className="font-semibold text-white text-sm">{toast.title}</p>
          )}
          <p className={`text-sm ${getTextColor(toast.type)}`}>{toast.message}</p>
        </div>
      </div>
    </div>
  );
}

function AlertsPanel({ alerts, onRemove }) {
  if (alerts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 space-y-2 z-40 max-w-md">
      {alerts.map(alert => (
        <AlertItem
          key={alert.id}
          alert={alert}
          onDismiss={() => onRemove(alert.id)}
        />
      ))}
    </div>
  );
}

function AlertItem({ alert, onDismiss }) {
  const getIconAndColor = (type) => {
    switch (type) {
      case ALERT_TYPES.SUCCESS:
        return { icon: '✅', bg: 'bg-green-900/20', border: 'border-green-700', title: 'text-green-300' };
      case ALERT_TYPES.ERROR:
        return { icon: '❌', bg: 'bg-red-900/20', border: 'border-red-700', title: 'text-red-300' };
      case ALERT_TYPES.WARNING:
        return { icon: '⚠️', bg: 'bg-yellow-900/20', border: 'border-yellow-700', title: 'text-yellow-300' };
      case ALERT_TYPES.MAINTENANCE:
        return { icon: '🔧', bg: 'bg-purple-900/20', border: 'border-purple-700', title: 'text-purple-300' };
      default:
        return { icon: 'ℹ️', bg: 'bg-blue-900/20', border: 'border-blue-700', title: 'text-blue-300' };
    }
  };

  const styles = getIconAndColor(alert.type);

  return (
    <div className={`${styles.bg} border ${styles.border} rounded-lg p-4 shadow-lg animate-slideInLeft`}>
      <div className="flex gap-3">
        <span className="text-2xl flex-shrink-0">{styles.icon}</span>
        <div className="flex-1 min-w-0">
          <h4 className={`font-semibold ${styles.title} text-sm mb-1`}>
            {alert.title}
          </h4>
          <p className="text-slate-300 text-sm mb-3">{alert.message}</p>
          
          {alert.actions && (
            <div className="flex gap-2">
              {alert.actions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    action.onClick?.();
                    onDismiss();
                  }}
                  className="px-3 py-1 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 rounded text-xs font-medium transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <button
          onClick={onDismiss}
          className="text-slate-400 hover:text-slate-300 text-xl leading-none"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export const AlertGenerator = {
  printComplete: (printerName, time, filament) => ({
    type: ALERT_TYPES.SUCCESS,
    title: `🎉 Print Complete!`,
    message: `${printerName} finished printing in ${time}. Used ${filament}g of filament.`,
  }),

  printFailed: (printerName, reason) => ({
    type: ALERT_TYPES.ERROR,
    title: `❌ Print Failed`,
    message: `${printerName} stopped printing: ${reason}`,
  }),

  temperatureWarning: (printerName, temp, threshold) => ({
    type: ALERT_TYPES.WARNING,
    title: `⚠️ Temperature Alert`,
    message: `${printerName} nozzle reached ${temp}°C (threshold: ${threshold}°C)`,
  }),

  printerOffline: (printerName) => ({
    type: ALERT_TYPES.ERROR,
    title: `📡 Printer Offline`,
    message: `${printerName} is no longer connected to the network.`,
  }),
};

export default AlertProvider;
