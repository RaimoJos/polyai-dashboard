import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

/**
 * QCChecklist - Quality Control checklist before shipping orders
 */
function QCChecklist({ order, onComplete, onClose }) {
  const [loading, setLoading] = useState(false);
  const [checklist, setChecklist] = useState([]);
  const [notes, setNotes] = useState('');
  const [defects, setDefects] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [showDefectModal, setShowDefectModal] = useState(false);

  // Default QC checklist items based on order type
  const defaultChecklist = [
    { id: 'visual', label: 'Visual inspection - no visible defects', category: 'quality', required: true },
    { id: 'dimensions', label: 'Dimensions match specifications', category: 'quality', required: true },
    { id: 'layer_adhesion', label: 'Layer adhesion is good', category: 'quality', required: true },
    { id: 'supports_removed', label: 'All supports removed', category: 'finishing', required: true },
    { id: 'stringing', label: 'No stringing or blobs', category: 'quality', required: false },
    { id: 'surface_finish', label: 'Surface finish acceptable', category: 'quality', required: true },
    { id: 'color_match', label: 'Color matches order', category: 'appearance', required: true },
    { id: 'quantity', label: 'Quantity matches order', category: 'packaging', required: true },
    { id: 'cleaned', label: 'Parts cleaned', category: 'finishing', required: false },
    { id: 'packaged', label: 'Properly packaged', category: 'packaging', required: true },
    { id: 'labeled', label: 'Package labeled correctly', category: 'packaging', required: true },
    { id: 'invoice', label: 'Invoice/receipt included', category: 'documentation', required: false },
  ];

  useEffect(() => {
    // Initialize checklist with unchecked items
    setChecklist(defaultChecklist.map(item => ({ ...item, checked: false })));
  }, []);

  const toggleItem = (id) => {
    setChecklist(prev => prev.map(item =>
      item.id === id ? { ...item, checked: !item.checked } : item
    ));
  };

  const allRequiredChecked = checklist
    .filter(item => item.required)
    .every(item => item.checked);

  const completedCount = checklist.filter(item => item.checked).length;
  const progress = (completedCount / checklist.length) * 100;

  const handleAddDefect = (defect) => {
    setDefects(prev => [...prev, {
      id: Date.now(),
      ...defect,
      created_at: new Date().toISOString(),
    }]);
    setShowDefectModal(false);
  };

  const handleRemoveDefect = (id) => {
    setDefects(prev => prev.filter(d => d.id !== id));
  };

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotos(prev => [...prev, {
          id: Date.now(),
          name: file.name,
          data: event.target.result,
          type: file.type,
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemovePhoto = (id) => {
    setPhotos(prev => prev.filter(p => p.id !== id));
  };

  const handlePass = async () => {
    setLoading(true);
    try {
      const qcData = {
        order_id: order.order_id || order.id,
        status: 'passed',
        checklist: checklist,
        notes: notes,
        defects: [],
        photos: photos.map(p => ({ name: p.name, type: p.type })),
        completed_at: new Date().toISOString(),
      };

      // Update order status to ready
      await api.updateOrder(order.order_id || order.id, {
        status: 'ready',
        qc_result: qcData,
        qc_notes: notes,
      });

      onComplete?.('passed', qcData);
    } catch (err) {
      console.error('Failed to complete QC:', err);
      alert('Failed to save QC results');
    } finally {
      setLoading(false);
    }
  };

  const handleFail = async () => {
    if (defects.length === 0) {
      alert('Please add at least one defect before failing QC');
      return;
    }

    setLoading(true);
    try {
      const qcData = {
        order_id: order.order_id || order.id,
        status: 'failed',
        checklist: checklist,
        notes: notes,
        defects: defects,
        photos: photos.map(p => ({ name: p.name, type: p.type })),
        completed_at: new Date().toISOString(),
      };

      // Update order status back to in_progress for reprint
      await api.updateOrder(order.order_id || order.id, {
        status: 'in_progress',
        qc_result: qcData,
        qc_notes: notes,
        needs_reprint: true,
      });

      onComplete?.('failed', qcData);
    } catch (err) {
      console.error('Failed to complete QC:', err);
      alert('Failed to save QC results');
    } finally {
      setLoading(false);
    }
  };

  const categories = [...new Set(checklist.map(item => item.category))];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        {/* Header */}
        <div className="sticky top-0 px-6 py-4 border-b flex items-center justify-between z-10" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              🔍 Quality Control
            </h2>
            <p className="text-sm text-slate-400">
              Order {order?.order_number || `#${(order?.order_id || order?.id || '').slice(-6)}`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-400">Progress</span>
              <span className="text-white font-medium">{completedCount}/{checklist.length} items</span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-700 overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-300"
                style={{ 
                  width: `${progress}%`,
                  background: progress === 100 
                    ? 'linear-gradient(90deg, #22c55e 0%, #10b981 100%)'
                    : 'linear-gradient(90deg, #a855f7 0%, #06b6d4 100%)'
                }}
              />
            </div>
          </div>

          {/* Checklist by Category */}
          {categories.map(category => (
            <div key={category}>
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
                {category}
              </h3>
              <div className="space-y-2">
                {checklist.filter(item => item.category === category).map(item => (
                  <label
                    key={item.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition ${
                      item.checked 
                        ? 'bg-green-500/20 border border-green-500/30' 
                        : 'bg-slate-800 border border-transparent hover:border-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => toggleItem(item.id)}
                      className="w-5 h-5 rounded border-slate-500 text-green-500 focus:ring-green-500 focus:ring-offset-0"
                    />
                    <span className={`flex-1 ${item.checked ? 'text-green-400' : 'text-white'}`}>
                      {item.label}
                    </span>
                    {item.required && (
                      <span className="text-xs text-red-400">Required</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}

          {/* Defects Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                Defects Found
              </h3>
              <button
                onClick={() => setShowDefectModal(true)}
                className="text-sm text-red-400 hover:text-red-300"
              >
                + Add Defect
              </button>
            </div>
            
            {defects.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No defects reported</p>
            ) : (
              <div className="space-y-2">
                {defects.map(defect => (
                  <div 
                    key={defect.id}
                    className="flex items-start justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/30"
                  >
                    <div>
                      <p className="font-medium text-red-400">{defect.type}</p>
                      <p className="text-sm text-slate-400">{defect.description}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Severity: <span className={`font-medium ${
                          defect.severity === 'critical' ? 'text-red-400' :
                          defect.severity === 'major' ? 'text-orange-400' : 'text-yellow-400'
                        }`}>{defect.severity}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveDefect(defect.id)}
                      className="text-slate-500 hover:text-red-400"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Photos */}
          <div>
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
              Photos (Optional)
            </h3>
            <div className="flex flex-wrap gap-2">
              {photos.map(photo => (
                <div key={photo.id} className="relative group">
                  <img 
                    src={photo.data} 
                    alt={photo.name}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => handleRemovePhoto(photo.id)}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs opacity-0 group-hover:opacity-100 transition"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <label className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-600 flex items-center justify-center cursor-pointer hover:border-purple-500 transition">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <span className="text-2xl text-slate-500">📷</span>
              </label>
            </div>
          </div>

          {/* Notes */}
          <div>
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
              QC Notes
            </h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about the quality check..."
              rows={3}
              className="w-full px-4 py-3 rounded-lg text-white resize-none"
              style={{ backgroundColor: '#334155' }}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 px-6 py-4 border-t flex gap-3" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <button
            onClick={handleFail}
            disabled={loading}
            className="flex-1 py-3 rounded-xl font-medium text-red-400 border border-red-500/30 hover:bg-red-500/10 disabled:opacity-50"
          >
            ❌ Fail & Reprint
          </button>
          <button
            onClick={handlePass}
            disabled={loading || !allRequiredChecked}
            className="flex-1 py-3 rounded-xl font-medium text-white disabled:opacity-50"
            style={{ background: allRequiredChecked ? 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)' : '#334155' }}
          >
            {loading ? 'Saving...' : '✅ Pass QC'}
          </button>
        </div>
      </div>

      {/* Add Defect Modal */}
      {showDefectModal && (
        <AddDefectModal
          onAdd={handleAddDefect}
          onClose={() => setShowDefectModal(false)}
        />
      )}
    </div>
  );
}

/**
 * AddDefectModal - Modal to add a new defect
 */
function AddDefectModal({ onAdd, onClose }) {
  const [defect, setDefect] = useState({
    type: '',
    description: '',
    severity: 'minor',
  });

  const defectTypes = [
    'Layer adhesion failure',
    'Warping',
    'Stringing',
    'Under-extrusion',
    'Over-extrusion',
    'Surface defects',
    'Dimensional inaccuracy',
    'Color mismatch',
    'Missing features',
    'Support marks',
    'Other',
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!defect.type) return;
    onAdd(defect);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div 
        className="relative w-full max-w-md rounded-xl border shadow-2xl"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#334155' }}>
          <h3 className="font-bold text-white">Add Defect</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Defect Type *</label>
            <select
              value={defect.type}
              onChange={(e) => setDefect({ ...defect, type: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-lg text-white"
              style={{ backgroundColor: '#334155' }}
            >
              <option value="">Select type...</option>
              {defectTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Severity *</label>
            <div className="flex gap-2">
              {['minor', 'major', 'critical'].map(sev => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setDefect({ ...defect, severity: sev })}
                  className={`flex-1 py-2 rounded-lg font-medium capitalize transition ${
                    defect.severity === sev
                      ? sev === 'critical' ? 'bg-red-500 text-white' :
                        sev === 'major' ? 'bg-orange-500 text-white' : 'bg-yellow-500 text-black'
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
            <textarea
              value={defect.description}
              onChange={(e) => setDefect({ ...defect, description: e.target.value })}
              placeholder="Describe the defect..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-white resize-none"
              style={{ backgroundColor: '#334155' }}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg font-medium text-slate-300 border border-slate-600 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 rounded-lg font-medium text-white bg-red-500 hover:bg-red-600"
            >
              Add Defect
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * QCButton - Standalone button to trigger QC for an order
 */
export function QCButton({ order, onComplete, size = 'md' }) {
  const [showQC, setShowQC] = useState(false);

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <>
      <button
        onClick={() => setShowQC(true)}
        className={`${sizeClasses[size]} rounded-lg font-medium text-orange-400 border border-orange-500/30 hover:bg-orange-500/10 transition`}
      >
        🔍 QC Check
      </button>

      {showQC && (
        <QCChecklist
          order={order}
          onComplete={(result, data) => {
            setShowQC(false);
            onComplete?.(result, data);
          }}
          onClose={() => setShowQC(false)}
        />
      )}
    </>
  );
}

export default QCChecklist;
