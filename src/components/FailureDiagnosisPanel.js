import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';

// Ensure API base always includes /v1 version prefix
const rawApiBase = process.env.REACT_APP_API_BASE || 'http://localhost:5000/api/v1';
const API_BASE = rawApiBase.includes('/v1')
  ? rawApiBase
  : rawApiBase.replace(/\/api\/?$/, '/api/v1');

const FailureDiagnosisPanel = ({ jobId, failureReason, onClose, inline = false }) => {
  const [diagnosis, setDiagnosis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedSection, setExpandedSection] = useState('recommendations');

  useEffect(() => {
    loadDiagnosis();
  }, [jobId, failureReason]);

  const loadDiagnosis = async () => {
    setLoading(true);
    setError(null);

    try {
      let response;

      if (jobId) {
        // Get diagnosis for specific job
        response = await axios.get(`${API_BASE}/failure_diagnosis/job/${jobId}`);
      } else if (failureReason) {
        // Quick diagnosis based on failure reason
        response = await axios.get(`${API_BASE}/failure_diagnosis/quick`, {
          params: { reason: failureReason }
        });
      } else {
        throw new Error('Either jobId or failureReason is required');
      }

      const data = response.data?.data || response.data;
      setDiagnosis(data);
    } catch (err) {
      console.error('Failed to load diagnosis:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load diagnosis');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-600 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'adhesion': return '🟥';
      case 'thermal': return '🌡️';
      case 'mechanical': return '⚙️';
      case 'material': return '🧵';
      case 'settings': return '⚙️';
      case 'environmental': return '🌍';
      case 'hardware': return '🔧';
      default: return '❓';
    }
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'easy': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'hard': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  if (loading) {
    return (
      <div className={`${inline ? '' : 'bg-gray-800 rounded-lg p-6'} animate-pulse`}>
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gray-600 rounded-full"></div>
          <div className="flex-1">
            <div className="h-4 bg-gray-600 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-700 rounded w-1/2"></div>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <div className="h-3 bg-gray-700 rounded"></div>
          <div className="h-3 bg-gray-700 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${inline ? '' : 'bg-gray-800 rounded-lg p-6'}`}>
        <div className="flex items-center space-x-3 text-red-400">
          <span className="text-2xl">⚠️</span>
          <div>
            <h3 className="font-semibold">Diagnosis Error</h3>
            <p className="text-sm text-gray-400">{error}</p>
          </div>
        </div>
        <button
          onClick={loadDiagnosis}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!diagnosis) {
    return null;
  }

  const containerClass = inline
    ? 'border border-gray-700 rounded-lg p-4 bg-gray-800/50'
    : 'bg-gray-800 rounded-lg p-6 shadow-xl max-w-2xl mx-auto';

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <span className="text-3xl">{getCategoryIcon(diagnosis.category)}</span>
          <div>
            <h3 className="text-lg font-semibold text-white">AI Failure Diagnosis</h3>
            <div className="flex items-center space-x-2 mt-1">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(diagnosis.severity)}`}>
                {diagnosis.severity?.toUpperCase()}
              </span>
              <span className="text-gray-400 text-sm">
                {Math.round((diagnosis.confidence || 0) * 100)}% confidence
              </span>
            </div>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Diagnosis Summary */}
      <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
        <p className="text-gray-200 leading-relaxed">{diagnosis.diagnosis}</p>
      </div>

      {/* Recommendations Section */}
      <div className="mb-4">
        <button
          onClick={() => toggleSection('recommendations')}
          className="w-full flex items-center justify-between p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
        >
          <span className="font-medium text-white flex items-center">
            <span className="mr-2">🔧</span>
            Fix Recommendations ({diagnosis.recommendations?.length || diagnosis.top_recommendations?.length || 0})
          </span>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${expandedSection === 'recommendations' ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {expandedSection === 'recommendations' && (
          <div className="mt-2 space-y-2">
            {(diagnosis.recommendations || diagnosis.top_recommendations || []).map((rec, index) => (
              <div
                key={`rec-${rec.priority || index}-${rec.title?.substring(0, 20) || index}`}
                className="bg-gray-700/30 rounded-lg p-4 border-l-4 border-blue-500"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                        #{rec.priority || index + 1}
                      </span>
                      <h4 className="font-medium text-white">{rec.title}</h4>
                    </div>
                    <p className="text-gray-300 text-sm mt-2">{rec.description}</p>
                    <div className="flex items-center space-x-4 mt-3 text-xs">
                      <span className={`flex items-center ${getDifficultyColor(rec.difficulty)}`}>
                        <span className="mr-1">⚡</span>
                        {rec.difficulty}
                      </span>
                      {rec.estimated_time && (
                        <span className="text-gray-400 flex items-center">
                          <span className="mr-1">⏱️</span>
                          {rec.estimated_time}
                        </span>
                      )}
                      {rec.category && (
                        <span className="text-gray-500 capitalize">
                          {rec.category}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Root Causes Section */}
      {diagnosis.root_causes && diagnosis.root_causes.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => toggleSection('causes')}
            className="w-full flex items-center justify-between p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <span className="font-medium text-white flex items-center">
              <span className="mr-2">🔍</span>
              Potential Root Causes ({diagnosis.root_causes.length})
            </span>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${expandedSection === 'causes' ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expandedSection === 'causes' && (
            <ul className="mt-2 space-y-2">
              {diagnosis.root_causes.map((cause, index) => (
                <li
                  key={`cause-${index}-${cause?.substring(0, 15) || index}`}
                  className="flex items-start space-x-2 p-3 bg-gray-700/30 rounded-lg"
                >
                  <span className="text-red-400 mt-0.5">•</span>
                  <span className="text-gray-200">{cause}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Contributing Factors */}
      {diagnosis.contributing_factors && diagnosis.contributing_factors.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => toggleSection('factors')}
            className="w-full flex items-center justify-between p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <span className="font-medium text-white flex items-center">
              <span className="mr-2">📊</span>
              Contributing Factors ({diagnosis.contributing_factors.length})
            </span>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${expandedSection === 'factors' ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expandedSection === 'factors' && (
            <div className="mt-2 flex flex-wrap gap-2">
              {diagnosis.contributing_factors.map((factor, index) => (
                <span
                  key={`factor-${index}-${factor?.substring(0, 15) || index}`}
                  className="px-3 py-1 bg-yellow-900/40 text-yellow-200 rounded-full text-sm"
                >
                  {factor}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Prevention Tips */}
      {diagnosis.prevention_tips && diagnosis.prevention_tips.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => toggleSection('prevention')}
            className="w-full flex items-center justify-between p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <span className="font-medium text-white flex items-center">
              <span className="mr-2">💡</span>
              Prevention Tips ({diagnosis.prevention_tips.length})
            </span>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${expandedSection === 'prevention' ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expandedSection === 'prevention' && (
            <ul className="mt-2 space-y-2">
              {diagnosis.prevention_tips.map((tip, index) => (
                <li
                  key={`tip-${index}-${tip?.substring(0, 15) || index}`}
                  className="flex items-start space-x-2 p-3 bg-green-900/20 rounded-lg border-l-2 border-green-500"
                >
                  <span className="text-green-400">✓</span>
                  <span className="text-gray-200">{tip}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Telemetry Insights */}
      {diagnosis.telemetry_insights && diagnosis.telemetry_insights.has_data && (
        <div className="mb-4">
          <button
            onClick={() => toggleSection('telemetry')}
            className="w-full flex items-center justify-between p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <span className="font-medium text-white flex items-center">
              <span className="mr-2">📈</span>
              Telemetry Analysis
            </span>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${expandedSection === 'telemetry' ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expandedSection === 'telemetry' && (
            <div className="mt-2 grid grid-cols-2 gap-3">
              {diagnosis.telemetry_insights.nozzle_temp && (
                <div className="bg-gray-700/30 rounded-lg p-3">
                  <h5 className="text-xs text-gray-400 uppercase mb-1">Nozzle Temp</h5>
                  <p className="text-white font-medium">
                    {diagnosis.telemetry_insights.nozzle_temp.average}°C avg
                  </p>
                  <p className="text-xs text-gray-400">
                    Range: {diagnosis.telemetry_insights.nozzle_temp.min}°C - {diagnosis.telemetry_insights.nozzle_temp.max}°C
                  </p>
                  {!diagnosis.telemetry_insights.nozzle_temp.stable && (
                    <span className="text-xs text-yellow-400">⚠️ Unstable</span>
                  )}
                </div>
              )}
              {diagnosis.telemetry_insights.bed_temp && (
                <div className="bg-gray-700/30 rounded-lg p-3">
                  <h5 className="text-xs text-gray-400 uppercase mb-1">Bed Temp</h5>
                  <p className="text-white font-medium">
                    {diagnosis.telemetry_insights.bed_temp.average}°C avg
                  </p>
                  <p className="text-xs text-gray-400">
                    Range: {diagnosis.telemetry_insights.bed_temp.min}°C - {diagnosis.telemetry_insights.bed_temp.max}°C
                  </p>
                </div>
              )}
              {diagnosis.telemetry_insights.progress && (
                <div className="bg-gray-700/30 rounded-lg p-3">
                  <h5 className="text-xs text-gray-400 uppercase mb-1">Progress at Failure</h5>
                  <p className="text-white font-medium">
                    {diagnosis.telemetry_insights.progress.final}%
                  </p>
                  <p className="text-xs text-gray-400">
                    {diagnosis.telemetry_insights.progress.samples} data points
                  </p>
                </div>
              )}
              {diagnosis.telemetry_insights.anomaly_score && (
                <div className="bg-gray-700/30 rounded-lg p-3">
                  <h5 className="text-xs text-gray-400 uppercase mb-1">Anomaly Score</h5>
                  <p className="text-white font-medium">
                    {(diagnosis.telemetry_insights.anomaly_score.max * 100).toFixed(0)}% max
                  </p>
                  <p className="text-xs text-gray-400">
                    {(diagnosis.telemetry_insights.anomaly_score.average * 100).toFixed(0)}% average
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer with timestamp */}
      <div className="mt-4 pt-3 border-t border-gray-700 flex items-center justify-between text-xs text-gray-500">
        <span>
          Diagnosed: {diagnosis.diagnosed_at ? new Date(diagnosis.diagnosed_at).toLocaleString() : 'Just now'}
        </span>
        <button
          onClick={loadDiagnosis}
          className="text-blue-400 hover:text-blue-300 flex items-center"
        >
          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>
    </div>
  );
};

// Quick Diagnosis Button Component - can be used inline
export const QuickDiagnosisButton = ({ failureReason, className = '' }) => {
  const [showPanel, setShowPanel] = useState(false);

  if (!failureReason) return null;

  return (
    <>
      <button
        onClick={() => setShowPanel(true)}
        className={`inline-flex items-center px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors ${className}`}
        title="Get AI diagnosis for this failure"
      >
        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        AI Diagnosis
      </button>

      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <FailureDiagnosisPanel
              failureReason={failureReason}
              onClose={() => setShowPanel(false)}
            />
          </div>
        </div>
      )}
    </>
  );
};

// Batch Diagnosis Component - shows multiple failed job diagnoses
export const BatchDiagnosisPanel = ({ printerId = null, limit = 5 }) => {
  const [diagnoses, setDiagnoses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedJob, setExpandedJob] = useState(null);

  useEffect(() => {
    loadBatchDiagnosis();
  }, [printerId, limit]);

  const loadBatchDiagnosis = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = { limit };
      if (printerId) params.printer_id = printerId;

      const response = await axios.get(`${API_BASE}/failure_diagnosis/batch`, { params });
      const data = response.data?.data || response.data;
      setDiagnoses(data.diagnoses || []);
    } catch (err) {
      console.error('Failed to load batch diagnosis:', err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-900/20';
      case 'high': return 'border-orange-500 bg-orange-900/20';
      case 'medium': return 'border-yellow-500 bg-yellow-900/20';
      case 'low': return 'border-green-500 bg-green-900/20';
      default: return 'border-gray-500 bg-gray-900/20';
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="text-red-400 flex items-center space-x-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (diagnoses.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="text-center text-gray-400">
          <span className="text-4xl mb-2">✨</span>
          <p>No recent failures to diagnose</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
        <span className="mr-2">🔍</span>
        Recent Failure Diagnoses
      </h3>

      <div className="space-y-3">
        {diagnoses.map((diagnosis, index) => (
          <div
            key={diagnosis.job_id || index}
            className={`border-l-4 rounded-lg p-4 cursor-pointer transition-all ${getSeverityColor(diagnosis.severity)}`}
            onClick={() => setExpandedJob(expandedJob === index ? null : index)}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-white">
                    Job #{diagnosis.job_id}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    diagnosis.severity === 'critical' ? 'bg-red-600' :
                    diagnosis.severity === 'high' ? 'bg-orange-500' :
                    diagnosis.severity === 'medium' ? 'bg-yellow-500 text-black' :
                    'bg-green-500'
                  } text-white`}>
                    {diagnosis.severity}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  {diagnosis.failure_reason}
                </p>
              </div>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${expandedJob === index ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {expandedJob === index && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <p className="text-gray-200 mb-3">{diagnosis.diagnosis}</p>

                {diagnosis.recommendations && diagnosis.recommendations.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-white">Top Recommendations:</h4>
                    {diagnosis.recommendations.slice(0, 3).map((rec, i) => (
                      <div key={i} className="text-sm text-gray-300 flex items-start space-x-2">
                        <span className="text-blue-400">#{i + 1}</span>
                        <span>{rec.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={loadBatchDiagnosis}
        className="mt-4 w-full py-2 text-center text-blue-400 hover:text-blue-300 text-sm"
      >
        Refresh Diagnoses
      </button>
    </div>
  );
};

FailureDiagnosisPanel.propTypes = {
  jobId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  failureReason: PropTypes.string,
  onClose: PropTypes.func,
  inline: PropTypes.bool
};

QuickDiagnosisButton.propTypes = {
  failureReason: PropTypes.string,
  className: PropTypes.string
};

BatchDiagnosisPanel.propTypes = {
  printerId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  limit: PropTypes.number
};

export default FailureDiagnosisPanel;
