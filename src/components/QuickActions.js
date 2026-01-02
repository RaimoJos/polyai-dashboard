import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { api } from '../services/api';
import toast from '../utils/toast';

/**
 * Quick Actions Bar - Global printer controls
 */
function QuickActions({ printers = [], onRefresh }) {
  const [loading, setLoading] = useState({});
  const [confirmAction, setConfirmAction] = useState(null);

  const handleAction = async (action, printerName = null) => {
    const key = printerName ? `${action}-${printerName}` : action;
    setLoading(prev => ({ ...prev, [key]: true }));

    try {
      if (printerName) {
        // Single printer action
        await api.controlPrinter(printerName, action);
      } else {
        // All printers
        const activePrinters = printers.filter(p => p.connected && p.state === 'printing');
        await Promise.all(
          activePrinters.map(p => api.controlPrinter(p.name, action))
        );
      }
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(`Action ${action} failed:`, err);
      toast.error(`Action failed: ${err.message}`);
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
      setConfirmAction(null);
    }
  };

  const handlePreheatAll = async () => {
    setLoading(prev => ({ ...prev, preheat: true }));
    try {
      const idlePrinters = printers.filter(p => p.connected && p.state === 'idle');
      await Promise.all(
        idlePrinters.map(p => api.controlPrinter(p.name, 'temp', { nozzle: 200, bed: 60 }))
      );
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Preheat failed:', err);
    } finally {
      setLoading(prev => ({ ...prev, preheat: false }));
    }
  };

  const handleCooldownAll = async () => {
    setLoading(prev => ({ ...prev, cooldown: true }));
    try {
      const hotPrinters = printers.filter(p => p.connected && (p.nozzle_temp > 50 || p.bed_temp > 40));
      await Promise.all(
        hotPrinters.map(p => api.controlPrinter(p.name, 'temp', { nozzle: 0, bed: 0 }))
      );
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Cooldown failed:', err);
    } finally {
      setLoading(prev => ({ ...prev, cooldown: false }));
    }
  };

  const handleLightsToggle = async (on) => {
    setLoading(prev => ({ ...prev, lights: true }));
    try {
      await Promise.all(
        printers.filter(p => p.connected).map(p => api.controlPrinter(p.name, 'light', { on }))
      );
    } catch (err) {
      console.error('Lights toggle failed:', err);
    } finally {
      setLoading(prev => ({ ...prev, lights: false }));
    }
  };

  const printingCount = printers.filter(p => p.state === 'printing').length;
  const idleCount = printers.filter(p => p.state === 'idle' && p.connected).length;
  const hotCount = printers.filter(p => p.connected && (p.nozzle_temp > 50 || p.bed_temp > 40)).length;

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg">⚡ Quick Actions</h3>
        <div className="flex gap-2 text-sm text-gray-500">
          <span className="px-2 py-1 bg-blue-100 rounded">{printingCount} printing</span>
          <span className="px-2 py-1 bg-green-100 rounded">{idleCount} idle</span>
          <span className="px-2 py-1 bg-orange-100 rounded">{hotCount} hot</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {/* Pause All */}
        <button
          onClick={() => setConfirmAction('pause')}
          disabled={loading.pause || printingCount === 0}
          className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading.pause ? (
            <span className="animate-spin">⏳</span>
          ) : (
            <>⏸️ Pause All</>
          )}
        </button>

        {/* Resume All */}
        <button
          onClick={() => handleAction('resume')}
          disabled={loading.resume}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
        >
          {loading.resume ? (
            <span className="animate-spin">⏳</span>
          ) : (
            <>▶️ Resume All</>
          )}
        </button>

        {/* Emergency Stop */}
        <button
          onClick={() => setConfirmAction('stop')}
          disabled={loading.stop || printingCount === 0}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading.stop ? (
            <span className="animate-spin">⏳</span>
          ) : (
            <>🛑 STOP ALL</>
          )}
        </button>

        <div className="w-px bg-gray-200 mx-2" />

        {/* Preheat All */}
        <button
          onClick={handlePreheatAll}
          disabled={loading.preheat || idleCount === 0}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading.preheat ? (
            <span className="animate-spin">⏳</span>
          ) : (
            <>🔥 Preheat All</>
          )}
        </button>

        {/* Cooldown All */}
        <button
          onClick={handleCooldownAll}
          disabled={loading.cooldown || hotCount === 0}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading.cooldown ? (
            <span className="animate-spin">⏳</span>
          ) : (
            <>❄️ Cooldown All</>
          )}
        </button>

        <div className="w-px bg-gray-200 mx-2" />

        {/* Lights */}
        <button
          onClick={() => handleLightsToggle(true)}
          disabled={loading.lights}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
        >
          💡 Lights On
        </button>
        <button
          onClick={() => handleLightsToggle(false)}
          disabled={loading.lights}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
        >
          🌙 Lights Off
        </button>
      </div>

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">
              {confirmAction === 'stop' ? '🛑 Emergency Stop' : '⏸️ Pause All Prints'}
            </h3>
            <p className="text-gray-600 mb-6">
              {confirmAction === 'stop' 
                ? `This will STOP all ${printingCount} active prints. This action cannot be undone and may damage prints.`
                : `This will pause all ${printingCount} active prints. You can resume them later.`
              }
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction(confirmAction)}
                className={`px-4 py-2 text-white rounded-lg ${
                  confirmAction === 'stop' 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-yellow-500 hover:bg-yellow-600'
                }`}
              >
                {confirmAction === 'stop' ? 'Yes, STOP ALL' : 'Yes, Pause All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

QuickActions.propTypes = {
  printers: PropTypes.arrayOf(PropTypes.shape({
    name: PropTypes.string,
    state: PropTypes.string,
    connected: PropTypes.bool,
    nozzle_temp: PropTypes.number,
    bed_temp: PropTypes.number
  })),
  onRefresh: PropTypes.func
};

export default QuickActions;
