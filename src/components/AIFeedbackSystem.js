import React, { useState, useEffect, createContext, useContext } from 'react';

/**
 * AIFeedbackSystem - Collect feedback to improve AI predictions
 * Tracks: predictions made, user ratings, accuracy over time
 * EXPERIMENTAL: Data stored locally, ready for future ML training
 */

// Context for sharing feedback state across components
const AIFeedbackContext = createContext(null);

export function useAIFeedback() {
  return useContext(AIFeedbackContext);
}

// Storage key
const STORAGE_KEY = 'polywerk_ai_feedback';

// Load feedback data from localStorage
function loadFeedbackData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load AI feedback data:', e);
  }
  return {
    predictions: [],
    feedbackCount: 0,
    accuracyScore: null,
    lastUpdated: null,
  };
}

// Save feedback data to localStorage
function saveFeedbackData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...data,
      lastUpdated: new Date().toISOString(),
    }));
  } catch (e) {
    console.error('Failed to save AI feedback data:', e);
  }
}

// Provider component
export function AIFeedbackProvider({ children }) {
  const [feedbackData, setFeedbackData] = useState(loadFeedbackData);

  // Calculate accuracy when feedback changes
  const stats = React.useMemo(() => {
    const rated = feedbackData.predictions.filter(p => p.rating !== null);
    const positive = rated.filter(p => p.rating >= 4);
    const negative = rated.filter(p => p.rating <= 2);
    
    return {
      totalPredictions: feedbackData.predictions.length,
      ratedCount: rated.length,
      positiveCount: positive.length,
      negativeCount: negative.length,
      neutralCount: rated.length - positive.length - negative.length,
      accuracyScore: rated.length > 0 
        ? Math.round((positive.length / rated.length) * 100) 
        : null,
      avgRating: rated.length > 0
        ? (rated.reduce((s, p) => s + p.rating, 0) / rated.length).toFixed(1)
        : null,
    };
  }, [feedbackData.predictions]);

  // Record a new prediction
  const recordPrediction = (prediction) => {
    const newPrediction = {
      id: `pred-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...prediction,
      rating: null,
      feedback: null,
      createdAt: new Date().toISOString(),
      ratedAt: null,
    };

    setFeedbackData(prev => {
      const updated = {
        ...prev,
        predictions: [newPrediction, ...prev.predictions].slice(0, 500), // Keep last 500
      };
      saveFeedbackData(updated);
      return updated;
    });

    return newPrediction.id;
  };

  // Rate a prediction
  const ratePrediction = (predictionId, rating, feedback = null) => {
    setFeedbackData(prev => {
      const updated = {
        ...prev,
        predictions: prev.predictions.map(p => 
          p.id === predictionId 
            ? { ...p, rating, feedback, ratedAt: new Date().toISOString() }
            : p
        ),
        feedbackCount: prev.feedbackCount + 1,
      };
      saveFeedbackData(updated);
      return updated;
    });
  };

  // Get predictions by type
  const getPredictionsByType = (type) => {
    return feedbackData.predictions.filter(p => p.type === type);
  };

  // Get unrated predictions
  const getUnratedPredictions = () => {
    return feedbackData.predictions.filter(p => p.rating === null);
  };

  // Export feedback data (for future ML training)
  const exportFeedbackData = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      stats,
      predictions: feedbackData.predictions,
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-feedback-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Clear all feedback data
  const clearFeedbackData = () => {
    const empty = {
      predictions: [],
      feedbackCount: 0,
      accuracyScore: null,
      lastUpdated: null,
    };
    setFeedbackData(empty);
    saveFeedbackData(empty);
  };

  const value = {
    feedbackData,
    stats,
    recordPrediction,
    ratePrediction,
    getPredictionsByType,
    getUnratedPredictions,
    exportFeedbackData,
    clearFeedbackData,
  };

  return (
    <AIFeedbackContext.Provider value={value}>
      {children}
    </AIFeedbackContext.Provider>
  );
}

/**
 * FeedbackButton - Quick thumbs up/down for predictions
 */
export function FeedbackButton({ predictionId, onRate, size = 'sm' }) {
  const feedback = useAIFeedback();
  const [localRating, setLocalRating] = useState(null);

  if (!feedback) return null;

  const prediction = feedback.feedbackData.predictions.find(p => p.id === predictionId);
  const currentRating = prediction?.rating || localRating;

  const handleRate = (rating) => {
    setLocalRating(rating);
    if (predictionId) {
      feedback.ratePrediction(predictionId, rating);
    }
    onRate?.(rating);
  };

  const btnSize = size === 'sm' ? 'text-lg px-2 py-1' : 'text-2xl px-3 py-2';

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => handleRate(5)}
        className={`${btnSize} rounded hover:bg-green-500/20 transition ${
          currentRating === 5 ? 'bg-green-500/30 text-green-400' : 'text-slate-500 hover:text-green-400'
        }`}
        title="Helpful"
      >
        👍
      </button>
      <button
        onClick={() => handleRate(1)}
        className={`${btnSize} rounded hover:bg-red-500/20 transition ${
          currentRating === 1 ? 'bg-red-500/30 text-red-400' : 'text-slate-500 hover:text-red-400'
        }`}
        title="Not helpful"
      >
        👎
      </button>
    </div>
  );
}

/**
 * FeedbackStars - 5-star rating for predictions
 */
export function FeedbackStars({ predictionId, onRate, size = 'sm' }) {
  const feedback = useAIFeedback();
  const [hoveredStar, setHoveredStar] = useState(0);
  const [localRating, setLocalRating] = useState(0);

  if (!feedback) return null;

  const prediction = feedback.feedbackData.predictions.find(p => p.id === predictionId);
  const currentRating = prediction?.rating || localRating;

  const handleRate = (rating) => {
    setLocalRating(rating);
    if (predictionId) {
      feedback.ratePrediction(predictionId, rating);
    }
    onRate?.(rating);
  };

  const starSize = size === 'sm' ? 'text-lg' : 'text-2xl';

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          onClick={() => handleRate(star)}
          onMouseEnter={() => setHoveredStar(star)}
          onMouseLeave={() => setHoveredStar(0)}
          className={`${starSize} transition ${
            star <= (hoveredStar || currentRating) 
              ? 'text-yellow-400' 
              : 'text-slate-600'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

/**
 * FeedbackCard - Full feedback form for a prediction
 */
export function FeedbackCard({ prediction, onClose }) {
  const feedback = useAIFeedback();
  const [rating, setRating] = useState(prediction?.rating || 0);
  const [comment, setComment] = useState(prediction?.feedback || '');

  if (!feedback) return null;

  const handleSubmit = () => {
    if (prediction?.id) {
      feedback.ratePrediction(prediction.id, rating, comment || null);
    }
    onClose?.();
  };

  return (
    <div className="rounded-xl border p-4 space-y-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-white font-medium">{prediction?.title || 'AI Prediction'}</p>
          <p className="text-sm text-slate-500">{prediction?.description}</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-500 hover:text-white">✕</button>
        )}
      </div>

      <div>
        <p className="text-sm text-slate-400 mb-2">How accurate was this prediction?</p>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              onClick={() => setRating(star)}
              className={`text-2xl transition ${
                star <= rating ? 'text-yellow-400' : 'text-slate-600 hover:text-slate-500'
              }`}
            >
              ★
            </button>
          ))}
          <span className="ml-2 text-sm text-slate-500">
            {rating === 0 && 'Click to rate'}
            {rating === 1 && 'Completely wrong'}
            {rating === 2 && 'Mostly wrong'}
            {rating === 3 && 'Partially correct'}
            {rating === 4 && 'Mostly correct'}
            {rating === 5 && 'Spot on!'}
          </span>
        </div>
      </div>

      <div>
        <p className="text-sm text-slate-400 mb-2">Additional feedback (optional)</p>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What could be improved?"
          rows={2}
          className="w-full px-3 py-2 rounded-lg text-white text-sm resize-none"
          style={{ backgroundColor: '#334155' }}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={rating === 0}
        className={`w-full py-2 rounded-lg font-medium transition ${
          rating > 0 
            ? 'bg-purple-500 text-white hover:bg-purple-600' 
            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
        }`}
      >
        Submit Feedback
      </button>
    </div>
  );
}

/**
 * AIFeedbackStats - Display feedback statistics
 */
export function AIFeedbackStats({ compact = false }) {
  const feedback = useAIFeedback();

  if (!feedback) return null;

  const { stats } = feedback;

  if (compact) {
    return (
      <div className="flex items-center gap-4 text-sm">
        <span className="text-slate-400">
          Accuracy: <span className={stats.accuracyScore >= 70 ? 'text-green-400' : stats.accuracyScore >= 50 ? 'text-yellow-400' : 'text-red-400'}>
            {stats.accuracyScore !== null ? `${stats.accuracyScore}%` : '--'}
          </span>
        </span>
        <span className="text-slate-400">
          Rated: <span className="text-white">{stats.ratedCount}/{stats.totalPredictions}</span>
        </span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="rounded-xl border p-4 text-center" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        <p className="text-3xl font-bold text-cyan-400">
          {stats.accuracyScore !== null ? `${stats.accuracyScore}%` : '--'}
        </p>
        <p className="text-sm text-slate-500">Accuracy Score</p>
      </div>
      <div className="rounded-xl border p-4 text-center" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        <p className="text-3xl font-bold text-purple-400">{stats.totalPredictions}</p>
        <p className="text-sm text-slate-500">Total Predictions</p>
      </div>
      <div className="rounded-xl border p-4 text-center" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        <p className="text-3xl font-bold text-green-400">{stats.positiveCount}</p>
        <p className="text-sm text-slate-500">Helpful 👍</p>
      </div>
      <div className="rounded-xl border p-4 text-center" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        <p className="text-3xl font-bold text-red-400">{stats.negativeCount}</p>
        <p className="text-sm text-slate-500">Not Helpful 👎</p>
      </div>
    </div>
  );
}

/**
 * AIFeedbackPanel - Full feedback management panel
 */
export function AIFeedbackPanel() {
  const feedback = useAIFeedback();
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [filter, setFilter] = useState('all'); // all, unrated, positive, negative

  // MUST call useMemo BEFORE any early returns (React hooks rule)
  const filteredPredictions = React.useMemo(() => {
    if (!feedback) return [];
    switch (filter) {
      case 'unrated': return feedback.feedbackData.predictions.filter(p => p.rating === null);
      case 'positive': return feedback.feedbackData.predictions.filter(p => p.rating >= 4);
      case 'negative': return feedback.feedbackData.predictions.filter(p => p.rating && p.rating <= 2);
      default: return feedback.feedbackData.predictions;
    }
  }, [feedback, filter]);

  if (!feedback) return null;

  const { stats, feedbackData, getUnratedPredictions, exportFeedbackData, clearFeedbackData } = feedback;
  const unratedCount = getUnratedPredictions().length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            🎓 AI Learning Center
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Your feedback improves AI predictions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportFeedbackData}
            className="px-3 py-1.5 rounded-lg text-sm text-slate-300 border border-slate-600 hover:bg-slate-700"
          >
            📥 Export Data
          </button>
          <button
            onClick={() => setShowExportConfirm(true)}
            className="px-3 py-1.5 rounded-lg text-sm text-red-400 border border-red-500/30 hover:bg-red-500/10"
          >
            🗑️ Clear
          </button>
        </div>
      </div>

      {/* Stats */}
      <AIFeedbackStats />

      {/* Unrated Alert */}
      {unratedCount > 0 && (
        <div className="rounded-xl border p-4 bg-yellow-500/10 border-yellow-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⭐</span>
              <div>
                <p className="text-yellow-400 font-medium">{unratedCount} predictions need your feedback</p>
                <p className="text-slate-500 text-sm">Help improve AI accuracy by rating recent predictions</p>
              </div>
            </div>
            <button
              onClick={() => setFilter('unrated')}
              className="px-3 py-1.5 rounded-lg text-sm bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
            >
              Review Now
            </button>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {[
          { id: 'all', label: 'All', count: feedbackData.predictions.length },
          { id: 'unrated', label: 'Unrated', count: unratedCount },
          { id: 'positive', label: '👍 Helpful', count: stats.positiveCount },
          { id: 'negative', label: '👎 Not Helpful', count: stats.negativeCount },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              filter === tab.id 
                ? 'bg-purple-500 text-white' 
                : 'text-slate-400 hover:bg-slate-700'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Predictions List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {filteredPredictions.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No predictions to show</p>
        ) : (
          filteredPredictions.slice(0, 20).map(prediction => (
            <PredictionItem key={prediction.id} prediction={prediction} />
          ))
        )}
      </div>

      {/* Clear Confirmation Modal */}
      {showExportConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowExportConfirm(false)} />
          <div className="relative rounded-xl border p-6 max-w-sm" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
            <h3 className="text-white font-bold mb-2">Clear All Feedback Data?</h3>
            <p className="text-slate-400 text-sm mb-4">This will delete all {feedbackData.predictions.length} predictions and ratings. This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowExportConfirm(false)}
                className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  clearFeedbackData();
                  setShowExportConfirm(false);
                }}
                className="flex-1 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Individual prediction item
function PredictionItem({ prediction }) {
  const feedback = useAIFeedback();
  const [expanded, setExpanded] = useState(false);

  const typeIcons = {
    churn: '⚠️',
    upsell: '💡',
    lead: '🎯',
    pricing: '💰',
    demand: '📈',
    alert: '🔔',
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div 
      className="rounded-xl border p-4"
      style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <span className="text-xl">{typeIcons[prediction.type] || '🤖'}</span>
          <div className="flex-1">
            <p className="text-white font-medium">{prediction.title}</p>
            {prediction.description && (
              <p className="text-sm text-slate-500 mt-0.5">{prediction.description}</p>
            )}
            <p className="text-xs text-slate-600 mt-1">{formatDate(prediction.createdAt)}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {prediction.rating !== null ? (
            <span className={`text-sm px-2 py-0.5 rounded ${
              prediction.rating >= 4 ? 'bg-green-500/20 text-green-400' :
              prediction.rating <= 2 ? 'bg-red-500/20 text-red-400' :
              'bg-yellow-500/20 text-yellow-400'
            }`}>
              {'★'.repeat(prediction.rating)}{'☆'.repeat(5 - prediction.rating)}
            </span>
          ) : (
            <FeedbackButton predictionId={prediction.id} size="sm" />
          )}
        </div>
      </div>

      {prediction.feedback && (
        <div className="mt-3 pl-9">
          <p className="text-xs text-slate-400 italic">"{prediction.feedback}"</p>
        </div>
      )}
    </div>
  );
}

export default AIFeedbackPanel;
