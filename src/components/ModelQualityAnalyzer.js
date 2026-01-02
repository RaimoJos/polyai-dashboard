/**
 * ModelQualityAnalyzer - AI-powered STL printability analysis
 * 
 * Features:
 * - Detailed printability scoring
 * - Issue detection (thin walls, overhangs, manifold)
 * - Print orientation suggestions
 * - Support requirement analysis
 * - Repair recommendations
 */

import React, { useState, useCallback, useRef } from 'react';
import { useLanguage } from '../i18n';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000/api/v1';

function ModelQualityAnalyzer() {
  const { t } = useLanguage();
  const fileInputRef = useRef(null);
  
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  // Clear/reset file and analysis
  const clearFile = () => {
    setSelectedFile(null);
    setAnalysis(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const processFile = async (file) => {
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.stl')) {
      setError('Please upload an STL file');
      return;
    }
    
    setSelectedFile(file);
    setLoading(true);
    setError(null);
    setAnalysis(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${API_BASE}/quote/analyze`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Backend returns data directly in response root (not in data.data)
        if (data.data) {
          setAnalysis(data.data);
        } else {
          const { success, ...analysisData } = data;
          setAnalysis(analysisData);
        }
      } else {
        setError(data.error || 'Failed to analyze model');
      }
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err.message || 'Failed to analyze model');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return '#22c55e'; // green
    if (score >= 60) return '#eab308'; // yellow
    if (score >= 40) return '#f97316'; // orange
    return '#ef4444'; // red
  };

  const getScoreLabel = (score) => {
    if (score >= 80) return { text: 'Excellent', emoji: '🌟' };
    if (score >= 60) return { text: 'Good', emoji: '👍' };
    if (score >= 40) return { text: 'Fair', emoji: '⚠️' };
    return { text: 'Poor', emoji: '❌' };
  };

  const CheckItem = ({ label, passed, warning, neutral }) => (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ backgroundColor: '#334155' }}>
      <span className="text-slate-300">{label}</span>
      {neutral ? (
        <span className="text-slate-400">—</span>
      ) : passed ? (
        <span className="text-green-400 flex items-center gap-1">
          <span>✓</span> Pass
        </span>
      ) : warning ? (
        <span className="text-yellow-400 flex items-center gap-1">
          <span>⚠</span> Warning
        </span>
      ) : (
        <span className="text-red-400 flex items-center gap-1">
          <span>✗</span> Issue
        </span>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          🔍 Model Quality Analyzer
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Analyze your 3D model for printability issues and get optimization suggestions
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Section */}
        <div className="space-y-4">
          {/* Drop Zone */}
          <div
            className={`relative rounded-xl border-2 border-dashed p-8 transition-all ${
              dragActive 
                ? 'border-cyan-500 bg-cyan-500/10' 
                : 'border-slate-600 hover:border-slate-500'
            }`}
            style={{ backgroundColor: dragActive ? undefined : '#1e293b' }}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".stl"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <div className="text-center">
              {loading ? (
                <>
                  <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-white font-medium">Analyzing model...</p>
                  <p className="text-slate-400 text-sm mt-1">
                    Checking geometry, manifold status, and printability
                  </p>
                </>
              ) : selectedFile ? (
                <>
                  <div className="text-5xl mb-4">🔬</div>
                  <p className="text-white font-medium">{selectedFile.name}</p>
                  <p className="text-slate-400 text-sm mt-1">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <div className="flex items-center justify-center gap-3 mt-4">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/10"
                    >
                      🔄 Change File
                    </button>
                    <button
                      onClick={clearFile}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-red-400 border border-red-500/30 hover:bg-red-500/10"
                    >
                      🗑️ Remove
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-5xl mb-4">📐</div>
                  <p className="text-white font-medium">
                    Drop your STL file here for analysis
                  </p>
                  <p className="text-slate-400 text-sm mt-2">
                    We'll check for printability issues and suggest improvements
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-4 px-6 py-2.5 rounded-lg font-medium text-white"
                    style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #a855f7 100%)' }}
                  >
                    Select STL File
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/30">
              <p className="text-red-400 flex items-center gap-2">
                <span>⚠️</span> {error}
              </p>
            </div>
          )}

          {/* Geometry Info */}
          {analysis && (
            <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
              <h3 className="text-sm font-medium text-slate-400 mb-3">📦 Model Geometry</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg" style={{ backgroundColor: '#334155' }}>
                  <p className="text-xs text-slate-400">Dimensions</p>
                  <p className="text-white font-medium text-sm">
                    {analysis.geometry.dimensions_mm.width.toFixed(1)} × {analysis.geometry.dimensions_mm.depth.toFixed(1)} × {analysis.geometry.dimensions_mm.height.toFixed(1)} mm
                  </p>
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: '#334155' }}>
                  <p className="text-xs text-slate-400">Volume</p>
                  <p className="text-white font-medium">{analysis.geometry.volume_cm3} cm³</p>
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: '#334155' }}>
                  <p className="text-xs text-slate-400">Surface Area</p>
                  <p className="text-white font-medium">{analysis.geometry.surface_area_cm2} cm²</p>
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: '#334155' }}>
                  <p className="text-xs text-slate-400">Triangles</p>
                  <p className="text-white font-medium">{analysis.geometry.triangle_count.toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Analysis Results */}
        <div className="space-y-4">
          {analysis ? (
            <>
              {/* Score Card */}
              <div className="rounded-xl border p-6 text-center" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
                <div className="relative inline-block">
                  <svg width="160" height="160" viewBox="0 0 160 160">
                    {/* Background circle */}
                    <circle
                      cx="80"
                      cy="80"
                      r="70"
                      fill="none"
                      stroke="#334155"
                      strokeWidth="12"
                    />
                    {/* Progress circle */}
                    <circle
                      cx="80"
                      cy="80"
                      r="70"
                      fill="none"
                      stroke={getScoreColor(analysis.printability.overall_score)}
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeDasharray={`${(analysis.printability.overall_score / 100) * 440} 440`}
                      transform="rotate(-90 80 80)"
                      style={{ transition: 'stroke-dasharray 0.5s ease' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold" style={{ color: getScoreColor(analysis.printability.overall_score) }}>
                      {analysis.printability.overall_score}
                    </span>
                    <span className="text-slate-400 text-sm">/ 100</span>
                  </div>
                </div>
                
                <div className="mt-4">
                  <p className="text-white font-bold text-lg flex items-center justify-center gap-2">
                    {getScoreLabel(analysis.printability.overall_score).emoji}
                    {getScoreLabel(analysis.printability.overall_score).text} Printability
                  </p>
                  <p className="text-slate-400 text-sm mt-1">
                    {analysis.printability.is_printable 
                      ? 'This model is ready to print'
                      : 'This model needs attention before printing'}
                  </p>
                </div>
              </div>

              {/* Checklist */}
              <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
                <h3 className="text-sm font-medium text-slate-400 mb-3">✅ Quality Checklist</h3>
                
                <div className="space-y-2">
                  <CheckItem 
                    label="Mesh is Watertight" 
                    passed={analysis.geometry.is_watertight}
                    warning={!analysis.geometry.is_watertight}
                  />
                  <CheckItem 
                    label="No Thin Walls"
                    passed={!analysis.printability.has_thin_walls}
                    warning={analysis.printability.has_thin_walls}
                  />
                  <CheckItem 
                    label="Manageable Overhangs"
                    passed={!analysis.printability.has_overhangs || analysis.printability.max_overhang_angle <= 45}
                    warning={analysis.printability.has_overhangs && analysis.printability.max_overhang_angle > 45}
                  />
                  <CheckItem 
                    label="No Supports Needed"
                    passed={!analysis.printability.needs_supports}
                    warning={analysis.printability.needs_supports}
                  />
                </div>
              </div>

              {/* Issues & Warnings */}
              {(analysis.printability.warnings.length > 0 || analysis.printability.suggestions.length > 0) && (
                <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
                  {analysis.printability.warnings.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-sm font-medium text-yellow-400 mb-2 flex items-center gap-2">
                        ⚠️ Warnings
                      </h3>
                      <ul className="space-y-1">
                        {analysis.printability.warnings.map((warning, i) => (
                          <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                            <span className="text-yellow-500 mt-1">•</span>
                            {warning}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {analysis.printability.suggestions.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-cyan-400 mb-2 flex items-center gap-2">
                        💡 Suggestions
                      </h3>
                      <ul className="space-y-1">
                        {analysis.printability.suggestions.map((suggestion, i) => (
                          <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                            <span className="text-cyan-500 mt-1">•</span>
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Orientation Recommendation */}
              <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
                <h3 className="text-sm font-medium text-slate-400 mb-2">🔄 Print Orientation</h3>
                <p className="text-white">{analysis.printability.recommended_orientation}</p>
              </div>

              {/* Recommended Material */}
              <div className="rounded-xl border p-4 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border-purple-500/30">
                <h3 className="text-sm font-medium text-slate-400 mb-2">🏆 Recommended Material</h3>
                <p className="text-white font-bold text-lg">{analysis.recommended_material}</p>
                <p className="text-slate-400 text-sm mt-1">
                  Best suited for this model's geometry and requirements
                </p>
              </div>
            </>
          ) : (
            <div className="rounded-xl border p-8 text-center" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
              <div className="text-5xl mb-4">📊</div>
              <p className="text-slate-400">Upload an STL file to analyze</p>
              <p className="text-slate-500 text-sm mt-2">
                We'll check for printability issues, thin walls, overhangs, and more
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ModelQualityAnalyzer;
