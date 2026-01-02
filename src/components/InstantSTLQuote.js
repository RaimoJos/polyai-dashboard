/**
 * InstantSTLQuote - ENHANCED v5 with OrcaSlicer Integration
 * 
 * Optimized for:
 * - Bambu Lab P1S/P2S (high-speed, 256x256x256mm)
 * - Creality K1/K1 Max (high-speed, 220x220x250mm / 300x300x300mm)
 * 
 * Features:
 * - Local STL parsing for instant feedback
 * - OrcaSlicer integration for accurate print times
 * - Estimate source indicator (slicer vs calculated)
 * - Purpose detection (structural, mechanical, decorative, etc.)
 * - Estonian VAT (24%) included
 * - Modal for order creation with client selection
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useLanguage } from '../i18n';
import { api } from '../services/api';
import toast from '../utils/toast';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Center } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000/api/v1';

// Quality presets with layer heights and speed factors
const QUALITY_PRESETS = [
  { id: 'draft', name: 'Draft', icon: '⚡', layerHeight: 0.28, speedFactor: 1.0, priceMultiplier: 0.9 },
  { id: 'standard', name: 'Standard', icon: '⚖️', layerHeight: 0.20, speedFactor: 0.85, priceMultiplier: 1.0 },
  { id: 'quality', name: 'Quality', icon: '✨', layerHeight: 0.16, speedFactor: 0.7, priceMultiplier: 1.1 },
  { id: 'high_quality', name: 'High Detail', icon: '💎', layerHeight: 0.12, speedFactor: 0.5, priceMultiplier: 1.25 },
];

// Purpose detection categories
const PART_PURPOSES = {
  structural: { 
    icon: '🏗️', 
    name: 'Structural/Load-Bearing',
    description: 'Brackets, mounts, supports',
    recommendedInfill: 60,
    recommendedWalls: 4,
    recommendedPattern: 'cubic',
    layerWarning: true,
  },
  mechanical: {
    icon: '⚙️',
    name: 'Mechanical/Functional',
    description: 'Gears, hinges, moving parts',
    recommendedInfill: 40,
    recommendedWalls: 3,
    recommendedPattern: 'gyroid',
    layerWarning: true,
  },
  enclosure: {
    icon: '📦',
    name: 'Enclosure/Housing',
    description: 'Boxes, cases, covers',
    recommendedInfill: 20,
    recommendedWalls: 3,
    recommendedPattern: 'grid',
    layerWarning: false,
  },
  decorative: {
    icon: '🎨',
    name: 'Decorative/Display',
    description: 'Figurines, art, display items',
    recommendedInfill: 15,
    recommendedWalls: 2,
    recommendedPattern: 'lines',
    layerWarning: false,
  },
  prototype: {
    icon: '🔬',
    name: 'Prototype/Test',
    description: 'Quick test prints, fit checks',
    recommendedInfill: 15,
    recommendedWalls: 2,
    recommendedPattern: 'lines',
    layerWarning: false,
  },
  watertight: {
    icon: '💧',
    name: 'Watertight/Sealed',
    description: 'Containers, seals, housings',
    recommendedInfill: 100,
    recommendedWalls: 5,
    recommendedPattern: 'grid',
    layerWarning: true,
  },
  unknown: {
    icon: '❓',
    name: 'General Purpose',
    description: 'Standard settings',
    recommendedInfill: 20,
    recommendedWalls: 3,
    recommendedPattern: 'grid',
    layerWarning: false,
  },
};

// Infill patterns
const INFILL_PATTERNS = [
  { id: 'lines', name: 'Lines', strength: 50, icon: '═', priceMultiplier: 1.0 },
  { id: 'grid', name: 'Grid', strength: 65, icon: '▦', priceMultiplier: 1.0 },
  { id: 'triangles', name: 'Triangles', strength: 70, icon: '△', priceMultiplier: 1.0 },
  { id: 'cubic', name: 'Cubic', strength: 80, icon: '◇', priceMultiplier: 1.0 },
  { id: 'gyroid', name: 'Gyroid', strength: 85, icon: '∿', priceMultiplier: 1.05 },
  { id: 'honeycomb', name: 'Honeycomb', strength: 90, icon: '⬡', priceMultiplier: 1.05 },
];

// Material configurations
const MATERIALS = {
  PLA: { name: 'PLA', pricePerGram: 0.12, density: 1.24, minPrice: 8 },
  PETG: { name: 'PETG', pricePerGram: 0.15, density: 1.27, minPrice: 10 },
  ABS: { name: 'ABS', pricePerGram: 0.14, density: 1.04, minPrice: 10 },
  TPU: { name: 'TPU Flexible', pricePerGram: 0.28, density: 1.21, minPrice: 15 },
  ASA: { name: 'ASA', pricePerGram: 0.18, density: 1.07, minPrice: 12 },
  Nylon: { name: 'Nylon', pricePerGram: 0.30, density: 1.14, minPrice: 15 },
  PC: { name: 'Polycarbonate', pricePerGram: 0.35, density: 1.20, minPrice: 15 },
  'CF-PLA': { name: 'Carbon Fiber PLA', pricePerGram: 0.25, density: 1.30, minPrice: 15 },
  'CF-PETG': { name: 'Carbon Fiber PETG', pricePerGram: 0.32, density: 1.35, minPrice: 18 },
};

// STL Model component
function STLModel({ file, color }) {
  const [geometry, setGeometry] = useState(null);
  
  useEffect(() => {
    if (!file) return;
    
    const loader = new STLLoader();
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const geom = loader.parse(e.target.result);
        geom.computeVertexNormals();
        geom.center();
        
        geom.computeBoundingBox();
        const bbox = geom.boundingBox;
        const maxDim = Math.max(
          bbox.max.x - bbox.min.x,
          bbox.max.y - bbox.min.y,
          bbox.max.z - bbox.min.z
        );
        const scale = 2 / maxDim;
        geom.scale(scale, scale, scale);
        
        setGeometry(geom);
      } catch (err) {
        console.error('STL parse error:', err);
      }
    };
    
    reader.readAsArrayBuffer(file);
  }, [file]);
  
  if (!geometry) return null;
  
  return (
    <mesh geometry={geometry}>
      <meshPhongMaterial color={color} specular={0x444444} shininess={30} />
    </mesh>
  );
}

// Model Preview
function ModelPreview({ stlFile, dimensions, color = '#a855f7' }) {
  return (
    <div className="relative py-2">
      <div 
        className="rounded-lg overflow-hidden mx-auto"
        style={{ width: '100%', maxWidth: '280px', height: '180px', backgroundColor: '#1e293b' }}
      >
        {stlFile ? (
          <Canvas camera={{ position: [3, 2, 3], fov: 45 }} style={{ background: '#1e293b' }}>
            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 5, 5]} intensity={0.8} />
            <directionalLight position={[-5, -5, -5]} intensity={0.4} />
            <Center>
              <STLModel file={stlFile} color={color} />
            </Center>
            <OrbitControls autoRotate autoRotateSpeed={2} enableZoom={true} enablePan={false} />
          </Canvas>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            Upload STL to preview
          </div>
        )}
      </div>
      
      {dimensions && (
        <div className="text-center text-sm text-white font-medium mt-2">
          {dimensions.width?.toFixed(0)} × {dimensions.depth?.toFixed(0)} × {dimensions.height?.toFixed(0)} mm
        </div>
      )}
    </div>
  );
}

// Slicer Status Badge
function SlicerStatusBadge({ status, onClick, isLoading }) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700 text-slate-400 text-xs">
        <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
        <span>Checking slicer...</span>
      </div>
    );
  }
  
  const isAvailable = status?.available && status?.profiles_configured;
  const slicerName = status?.slicer_type === 'orcaslicer' ? 'OrcaSlicer' : 
                     status?.slicer_type === 'bambu_studio' ? 'Bambu Studio' : 'Slicer';
  
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all ${
        isAvailable 
          ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
          : 'bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30'
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-green-400' : 'bg-orange-400'}`} />
      {isAvailable ? `${slicerName} Ready` : 'Using Estimates'}
    </button>
  );
}

// Estimate Source Badge
function EstimateSourceBadge({ source, onRefresh, isRefreshing }) {
  const isFromSlicer = source === 'orcaslicer' || source === 'bambu_studio';
  
  return (
    <div className="flex items-center gap-2">
      <span className={`px-2 py-1 rounded text-xs font-medium ${
        isFromSlicer 
          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
          : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
      }`}>
        {isFromSlicer ? '🎯 Slicer Accurate' : '📐 Calculated'}
      </span>
      
      {!isFromSlicer && onRefresh && (
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="px-2 py-1 rounded text-xs text-purple-400 border border-purple-500/30 hover:bg-purple-500/10 disabled:opacity-50 flex items-center gap-1"
        >
          {isRefreshing ? (
            <>
              <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              Slicing...
            </>
          ) : (
            <>🔄 Get from Slicer</>
          )}
        </button>
      )}
    </div>
  );
}

// Complexity Meter
function ComplexityMeter({ score }) {
  const percentage = Math.min(100, score);
  
  const getStyle = () => {
    if (percentage <= 30) return { bg: 'bg-green-500', text: 'text-green-400', label: 'Simple' };
    if (percentage <= 50) return { bg: 'bg-cyan-500', text: 'text-cyan-400', label: 'Standard' };
    if (percentage <= 70) return { bg: 'bg-yellow-500', text: 'text-yellow-400', label: 'Moderate' };
    if (percentage <= 85) return { bg: 'bg-orange-500', text: 'text-orange-400', label: 'Complex' };
    return { bg: 'bg-red-500', text: 'text-red-400', label: 'Very Complex' };
  };
  
  const { bg, text, label } = getStyle();
  
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">Print Complexity</span>
        <span className={text}>{label}</span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${bg} transition-all duration-300`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

// Smart Recommendations Panel
function SmartRecommendations({ purpose, onApply }) {
  const purposeConfig = PART_PURPOSES[purpose] || PART_PURPOSES.unknown;
  const pattern = INFILL_PATTERNS.find(p => p.id === purposeConfig.recommendedPattern);
  
  if (purpose === 'unknown') return null;
  
  return (
    <div className="p-4 rounded-xl border bg-gradient-to-br from-purple-500/10 to-cyan-500/10 border-purple-500/30">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{purposeConfig.icon}</span>
          <div>
            <h4 className="text-sm font-medium text-white">Detected: {purposeConfig.name}</h4>
            <p className="text-xs text-slate-400">{purposeConfig.description}</p>
          </div>
        </div>
        <button
          onClick={onApply}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-purple-500 hover:bg-purple-600 transition"
        >
          Apply
        </button>
      </div>
      
      <div className="grid grid-cols-3 gap-2 mt-3">
        <div className="p-2 rounded-lg bg-slate-800/50 text-center">
          <p className="text-xs text-slate-400">Infill</p>
          <p className="text-lg font-bold text-purple-400">{purposeConfig.recommendedInfill}%</p>
        </div>
        <div className="p-2 rounded-lg bg-slate-800/50 text-center">
          <p className="text-xs text-slate-400">Walls</p>
          <p className="text-lg font-bold text-cyan-400">{purposeConfig.recommendedWalls}</p>
        </div>
        <div className="p-2 rounded-lg bg-slate-800/50 text-center">
          <p className="text-xs text-slate-400">Pattern</p>
          <p className="text-lg font-bold text-white">{pattern?.icon}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ORDER CREATION MODAL
// ============================================================
function CreateOrderModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  pricing, 
  stlGeometry, 
  selectedFile,
  material,
  color,
  infill,
  walls,
  quality,
  rush,
  delivery,
  loading 
}) {
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [isNewClient, setIsNewClient] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [loadingClients, setLoadingClients] = useState(false);

  // Load clients when modal opens
  useEffect(() => {
    if (isOpen) {
      setLoadingClients(true);
      api.getClients()
        .then(response => {
          const clientList = Array.isArray(response) ? response : (response?.data || response?.clients || []);
          setClients(clientList);
        })
        .catch(err => console.error('Failed to load clients:', err))
        .finally(() => setLoadingClients(false));
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (!selectedClientId && !clientName) {
      toast.error('Palun vali klient või sisesta uue kliendi nimi');
      return;
    }
    
    const selectedClient = clients.find(c => c.id === selectedClientId || c.client_id === selectedClientId);
    
    onSubmit({
      clientId: selectedClientId,
      clientName: isNewClient ? clientName : (selectedClient?.name || selectedClient?.company_name || 'Walk-in'),
      clientEmail: isNewClient ? clientEmail : (selectedClient?.email || ''),
      clientPhone: isNewClient ? clientPhone : (selectedClient?.phone || ''),
      isNewClient,
      orderNotes,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden"
           style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}>
        
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">📝 Loo tellimus</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Order Summary */}
        <div className="p-4 bg-slate-800/50 border-b border-slate-700">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg bg-slate-700 flex items-center justify-center text-2xl">
              📁
            </div>
            <div className="flex-1">
              <p className="text-white font-medium truncate">{selectedFile?.name}</p>
              <div className="flex flex-wrap gap-2 mt-1">
                <span className="px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400">{material}</span>
                <span className="px-2 py-0.5 rounded text-xs bg-cyan-500/20 text-cyan-400">{infill}% infill</span>
                <span className="px-2 py-0.5 rounded text-xs bg-slate-600 text-slate-300">{pricing?.weight_g}g</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-cyan-400">€{pricing?.grand_total}</p>
              <p className="text-xs text-slate-500">koos KM</p>
            </div>
          </div>
        </div>

        {/* Client Selection */}
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">👤 Klient</label>
            
            <div className="flex items-center gap-3 mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={!isNewClient}
                  onChange={() => setIsNewClient(false)}
                  className="text-purple-500"
                />
                <span className="text-sm text-slate-300">Olemasolev</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={isNewClient}
                  onChange={() => setIsNewClient(true)}
                  className="text-purple-500"
                />
                <span className="text-sm text-slate-300">Uus klient</span>
              </label>
            </div>

            {!isNewClient ? (
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-white bg-slate-700 border border-slate-600"
                disabled={loadingClients}
              >
                <option value="">-- Vali klient --</option>
                {clients.map(client => (
                  <option key={client.id || client.client_id} value={client.id || client.client_id}>
                    {client.name || client.company_name} {client.email && `(${client.email})`}
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Kliendi nimi *"
                  className="w-full px-3 py-2.5 rounded-lg text-white bg-slate-700 border border-slate-600"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="Email"
                    className="w-full px-3 py-2.5 rounded-lg text-white bg-slate-700 border border-slate-600"
                  />
                  <input
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="Telefon"
                    className="w-full px-3 py-2.5 rounded-lg text-white bg-slate-700 border border-slate-600"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">📝 Märkused</label>
            <textarea
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="Lisainfo tellimuse kohta..."
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg text-white bg-slate-700 border border-slate-600 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-slate-300 bg-slate-700 hover:bg-slate-600 transition"
          >
            Tühista
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg text-white font-medium disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
          >
            {loading ? '⏳ Loome...' : '✅ Kinnita tellimus'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================
function InstantSTLQuote({ onOrderCreate, currentUser }) {
  const { t } = useLanguage();
  const fileInputRef = useRef(null);
  
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  
  // Slicer state
  const [slicerStatus, setSlicerStatus] = useState(null);
  const [slicerLoading, setSlicerLoading] = useState(true);
  const [slicerEstimate, setSlicerEstimate] = useState(null);
  const [isSlicing, setIsSlicing] = useState(false);
  
  // File & geometry state
  const [selectedFile, setSelectedFile] = useState(null);
  const [stlGeometry, setStlGeometry] = useState(null);
  
  // Analysis state
  const [detectedPurpose, setDetectedPurpose] = useState('unknown');
  const [showAnalysis, setShowAnalysis] = useState(true);
  
  // Print settings
  const [material, setMaterial] = useState('PLA');
  const [color, setColor] = useState('black');
  const [quality, setQuality] = useState('standard');
  const [quantity, setQuantity] = useState(1);
  const [rush, setRush] = useState('standard');
  const [delivery, setDelivery] = useState('pickup');
  const [infill, setInfill] = useState(20);
  const [walls, setWalls] = useState(3);
  const [infillPattern, setInfillPattern] = useState('grid');
  
  // Check slicer status on mount
  useEffect(() => {
    const checkSlicer = async () => {
      try {
        setSlicerLoading(true);
        const status = await api.getSlicerStatus();
        setSlicerStatus(status);
        console.log('Slicer status:', status);
      } catch (err) {
        console.warn('Could not check slicer status:', err);
        setSlicerStatus({ available: false, slicer_type: 'none' });
      } finally {
        setSlicerLoading(false);
      }
    };
    checkSlicer();
  }, []);
  
  // Get accurate estimate from slicer
  const getSlicerEstimate = useCallback(async (file) => {
    if (!file || !slicerStatus?.available || !slicerStatus?.profiles_configured) {
      return null;
    }
    
    setIsSlicing(true);
    try {
      const qualityConfig = QUALITY_PRESETS.find(q => q.id === quality) || QUALITY_PRESETS[1];
      
      const settings = {
        layer_height: qualityConfig.layerHeight,
        infill_percent: infill,
        wall_count: walls,
        material: material,
        supports: false,
        brim: false,
      };
      
      console.log('Requesting slicer estimate with settings:', settings);
      const result = await api.sliceModel(file, settings);
      
      if (result?.result?.success) {
        console.log('Slicer estimate received:', result.result);
        setSlicerEstimate(result.result);
        return result.result;
      }
      
      return null;
    } catch (err) {
      console.warn('Slicer estimate failed:', err);
      return null;
    } finally {
      setIsSlicing(false);
    }
  }, [slicerStatus, quality, infill, walls, material]);
  
  // Manual refresh estimate
  const handleRefreshEstimate = useCallback(() => {
    if (selectedFile) {
      getSlicerEstimate(selectedFile);
    }
  }, [selectedFile, getSlicerEstimate]);
  
  // Available colors per material
  const colorOptions = useMemo(() => ({
    PLA: [
      { id: 'black', name: 'Black', hex: '#1a1a1a' },
      { id: 'white', name: 'White', hex: '#f5f5f5' },
      { id: 'gray', name: 'Gray', hex: '#6b7280' },
      { id: 'red', name: 'Red', hex: '#ef4444' },
      { id: 'blue', name: 'Blue', hex: '#3b82f6' },
      { id: 'green', name: 'Green', hex: '#22c55e' },
      { id: 'orange', name: 'Orange', hex: '#f97316' },
      { id: 'purple', name: 'Purple', hex: '#a855f7' },
      { id: 'yellow', name: 'Yellow', hex: '#eab308' },
    ],
    PETG: [
      { id: 'black', name: 'Black', hex: '#1a1a1a' },
      { id: 'white', name: 'White', hex: '#f5f5f5' },
      { id: 'clear', name: 'Clear', hex: '#e5e5e5' },
      { id: 'blue', name: 'Blue', hex: '#3b82f6' },
      { id: 'orange', name: 'Orange', hex: '#f97316' },
    ],
    ABS: [
      { id: 'black', name: 'Black', hex: '#1a1a1a' },
      { id: 'white', name: 'White', hex: '#f5f5f5' },
      { id: 'gray', name: 'Gray', hex: '#6b7280' },
    ],
    TPU: [
      { id: 'black', name: 'Black', hex: '#1a1a1a' },
      { id: 'white', name: 'White', hex: '#f5f5f5' },
      { id: 'clear', name: 'Clear', hex: '#e5e5e5' },
    ],
    ASA: [
      { id: 'black', name: 'Black', hex: '#1a1a1a' },
      { id: 'white', name: 'White', hex: '#f5f5f5' },
    ],
    Nylon: [
      { id: 'natural', name: 'Natural', hex: '#d4d4d4' },
      { id: 'black', name: 'Black', hex: '#1a1a1a' },
    ],
    PC: [
      { id: 'clear', name: 'Clear', hex: '#e5e5e5' },
      { id: 'black', name: 'Black', hex: '#1a1a1a' },
    ],
    'CF-PLA': [{ id: 'black', name: 'Black', hex: '#1a1a1a' }],
    'CF-PETG': [{ id: 'black', name: 'Black', hex: '#1a1a1a' }],
  }), []);
  
  const availableColors = colorOptions[material] || colorOptions.PLA;
  const selectedColorHex = availableColors.find(c => c.id === color)?.hex || '#a855f7';
  
  // Delivery & rush options
  const deliveryOptions = [
    { id: 'pickup', name: 'Pickup (Tartu)', price: 0, days: 0 },
    { id: 'omniva', name: 'Omniva Pakiautomaat', price: 3.50, days: 2 },
    { id: 'dpd', name: 'DPD Courier', price: 5.00, days: 1 },
    { id: 'express', name: 'Express Same-Day (Tartu)', price: 15.00, days: 0 },
  ];
  
  const rushOptions = [
    { id: 'standard', name: 'Standard', description: '3-5 tööpäeva', multiplier: 1.0 },
    { id: 'priority', name: 'Priority', description: '2-3 tööpäeva', multiplier: 1.25 },
    { id: 'express', name: 'Express 48h', description: '1-2 tööpäeva', multiplier: 1.5 },
    { id: 'rush', name: 'Rush 24h', description: 'Järgmine tööpäev', multiplier: 2.0 },
  ];
  
  const batchTiers = [
    { min: 5, discount: 5 },
    { min: 10, discount: 10 },
    { min: 25, discount: 15 },
    { min: 50, discount: 20 },
    { min: 100, discount: 25 },
  ];

  // Calculate pricing - now uses slicer data when available
  const pricing = useMemo(() => {
    if (!stlGeometry) return null;
    
    const { volume_cm3, dimensions_mm = {} } = stlGeometry;
    const vol = parseFloat(volume_cm3) || 0;
    const dims = dimensions_mm;
    
    const matConfig = MATERIALS[material] || MATERIALS.PLA;
    const qualityConfig = QUALITY_PRESETS.find(q => q.id === quality) || QUALITY_PRESETS[1];
    const patternConfig = INFILL_PATTERNS.find(p => p.id === infillPattern) || INFILL_PATTERNS[1];
    const rushConfig = rushOptions.find(r => r.id === rush) || rushOptions[0];
    const deliveryConfig = deliveryOptions.find(d => d.id === delivery) || deliveryOptions[0];
    
    // Use slicer data if available, otherwise calculate
    let weight_g, printTimeHours, estimateSource;
    
    if (slicerEstimate?.success && slicerEstimate.filament_used_g > 0) {
      // Use slicer's accurate data
      weight_g = slicerEstimate.filament_used_g;
      printTimeHours = slicerEstimate.print_time_seconds / 3600;
      estimateSource = slicerEstimate.source || 'orcaslicer';
    } else {
      // Fallback to calculated estimates
      estimateSource = 'calculated';
      
      // Weight calculation
      const shellThickness = walls * 0.4;
      const totalVolume = vol;
      const shellVolume = totalVolume * 0.25 * (walls / 3);
      const infillVolume = totalVolume * 0.75 * (infill / 100);
      const effectiveVolume = shellVolume + infillVolume;
      weight_g = effectiveVolume * matConfig.density;
      
      // Print time
      const layerHeight = qualityConfig.layerHeight;
      const layers = dims.height / layerHeight;
      const perimeter_mm = 2 * (dims.width + dims.depth);
      const perimeterTime_s = (perimeter_mm * walls) / 175;
      const infillArea_mm2 = (dims.width - walls) * (dims.depth - walls) * (infill / 100);
      const infillTime_s = (infillArea_mm2 / 0.4) / 250;
      const layerTime_s = perimeterTime_s + infillTime_s + 1.5;
      const totalPrintTime_s = layers * layerTime_s / qualityConfig.speedFactor;
      printTimeHours = totalPrintTime_s / 3600;
    }
    
    // Pricing
    let basePrice = weight_g * matConfig.pricePerGram;
    const setupFee = 3.00;
    basePrice += setupFee;
    basePrice *= qualityConfig.priceMultiplier;
    basePrice *= patternConfig.priceMultiplier;
    
    let unitPrice = Math.max(basePrice, matConfig.minPrice);
    
    // Quantity discounts
    let discountPercent = 0;
    for (const tier of [...batchTiers].sort((a, b) => b.min - a.min)) {
      if (quantity >= tier.min) {
        discountPercent = tier.discount;
        break;
      }
    }
    
    const subtotalBeforeDiscount = unitPrice * quantity;
    const discountAmount = subtotalBeforeDiscount * (discountPercent / 100);
    const subtotalAfterDiscount = subtotalBeforeDiscount - discountAmount;
    
    const afterRush = subtotalAfterDiscount * rushConfig.multiplier;
    const deliveryFee = deliveryConfig.price;
    const subtotalBeforeVat = afterRush + deliveryFee;
    
    const vat = subtotalBeforeVat * 0.24;
    const grandTotal = subtotalBeforeVat + vat;
    
    const rushDays = rush === 'rush' ? 1 : rush === 'express' ? 2 : rush === 'priority' ? 3 : 5;
    const estDate = new Date();
    estDate.setDate(estDate.getDate() + rushDays + deliveryConfig.days);
    
    return {
      weight_g: weight_g.toFixed(0),
      print_time_hours: printTimeHours,
      print_time_formatted: printTimeHours >= 1 
        ? `${Math.floor(printTimeHours)}h ${Math.round((printTimeHours % 1) * 60)}m`
        : `${Math.round(printTimeHours * 60)}m`,
      price_per_gram: matConfig.pricePerGram.toFixed(2),
      setup_fee: setupFee.toFixed(2),
      base_price: basePrice.toFixed(2),
      unit_price: unitPrice.toFixed(2),
      quantity,
      discount_percent: discountPercent,
      discount_amount: discountAmount.toFixed(2),
      rush_multiplier: rushConfig.multiplier,
      rush_name: rushConfig.name,
      delivery_name: deliveryConfig.name,
      delivery_fee: deliveryFee.toFixed(2),
      subtotal: subtotalBeforeVat.toFixed(2),
      vat: vat.toFixed(2),
      grand_total: grandTotal.toFixed(2),
      estimated_date: estDate.toLocaleDateString('et-EE', { day: 'numeric', month: 'short' }),
      estimate_source: estimateSource,
      layer_count: slicerEstimate?.layer_count || null,
    };
  }, [stlGeometry, material, quality, infill, walls, infillPattern, quantity, rush, delivery, slicerEstimate]);

  // Purpose detection
  const detectPurpose = useCallback((geometry, filename) => {
    const vol = parseFloat(geometry?.volume_cm3) || 0;
    const dims = geometry?.dimensions_mm || {};
    const triangles = geometry?.triangles || 0;
    
    const aspectRatio = Math.max(dims.width, dims.depth, dims.height) / 
                       Math.max(1, Math.min(dims.width, dims.depth, dims.height));
    
    const fname = (filename || '').toLowerCase();
    
    if (fname.includes('seal') || fname.includes('hydro') || fname.includes('water') || fname.includes('tank')) return 'watertight';
    if (fname.includes('bracket') || fname.includes('mount') || fname.includes('holder')) return 'structural';
    if (fname.includes('gear') || fname.includes('hinge') || fname.includes('mechanism')) return 'mechanical';
    if (fname.includes('case') || fname.includes('box') || fname.includes('enclosure') || fname.includes('housing')) return 'enclosure';
    if (fname.includes('figure') || fname.includes('statue') || fname.includes('decoration')) return 'decorative';
    if (fname.includes('test') || fname.includes('proto') || fname.includes('sample')) return 'prototype';
    
    if (aspectRatio > 4) return 'structural';
    if (aspectRatio < 1.5 && vol > 100) return 'enclosure';
    if (triangles / Math.max(1, vol) > 800) return 'decorative';
    if (vol < 30) return 'prototype';
    
    return 'unknown';
  }, []);

  // Parse STL file locally
  const parseSTLFile = useCallback((file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const buffer = e.target.result;
          const dataView = new DataView(buffer);
          
          let triangles = 0;
          let isBinary = false;
          
          if (buffer.byteLength > 84) {
            triangles = dataView.getUint32(80, true);
            const expectedSize = 84 + triangles * 50;
            isBinary = Math.abs(buffer.byteLength - expectedSize) < 100;
          }
          
          let minX = Infinity, minY = Infinity, minZ = Infinity;
          let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
          let totalVolume = 0;
          
          if (isBinary && triangles > 0 && triangles < 10000000) {
            let offset = 84;
            const maxTris = Math.min(triangles, 500000);
            
            for (let i = 0; i < maxTris; i++) {
              offset += 12;
              
              const vertices = [];
              for (let v = 0; v < 3; v++) {
                const x = dataView.getFloat32(offset, true);
                const y = dataView.getFloat32(offset + 4, true);
                const z = dataView.getFloat32(offset + 8, true);
                offset += 12;
                
                vertices.push({ x, y, z });
                
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                minZ = Math.min(minZ, z);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
                maxZ = Math.max(maxZ, z);
              }
              
              offset += 2;
              
              const [v0, v1, v2] = vertices;
              const signedVol = (
                v0.x * (v1.y * v2.z - v2.y * v1.z) -
                v1.x * (v0.y * v2.z - v2.y * v0.z) +
                v2.x * (v0.y * v1.z - v1.y * v0.z)
              ) / 6.0;
              totalVolume += signedVol;
            }
          } else {
            const text = new TextDecoder().decode(buffer);
            const vertexRegex = /vertex\s+([-\d.e+]+)\s+([-\d.e+]+)\s+([-\d.e+]+)/gi;
            let match;
            let count = 0;
            
            while ((match = vertexRegex.exec(text)) !== null && count < 300000) {
              const x = parseFloat(match[1]);
              const y = parseFloat(match[2]);
              const z = parseFloat(match[3]);
              
              minX = Math.min(minX, x);
              minY = Math.min(minY, y);
              minZ = Math.min(minZ, z);
              maxX = Math.max(maxX, x);
              maxY = Math.max(maxY, y);
              maxZ = Math.max(maxZ, z);
              count++;
            }
            triangles = Math.floor(count / 3);
          }
          
          const width = maxX - minX;
          const depth = maxY - minY;
          const height = maxZ - minZ;
          
          const volume_cm3 = Math.abs(totalVolume) / 1000 || (width * depth * height * 0.3) / 1000;
          
          resolve({
            dimensions_mm: { width, depth, height },
            volume_cm3: Math.max(0.1, volume_cm3).toFixed(1),
            triangles,
          });
        } catch (err) {
          console.error('STL parse error:', err);
          resolve({
            dimensions_mm: { width: 50, depth: 50, height: 30 },
            volume_cm3: 25,
            triangles: 5000,
          });
        }
      };
      
      reader.onerror = () => resolve({
        dimensions_mm: { width: 50, depth: 50, height: 30 },
        volume_cm3: 25,
        triangles: 5000,
      });
      
      reader.readAsArrayBuffer(file);
    });
  }, []);

  const processFile = useCallback(async (file) => {
    if (!file || !file.name.toLowerCase().endsWith('.stl')) {
      setError('Please upload an STL file');
      return;
    }
    
    setSelectedFile(file);
    setLoading(true);
    setError(null);
    setSlicerEstimate(null);
    
    try {
      // Quick local parsing first
      const geometry = await parseSTLFile(file);
      setStlGeometry(geometry);
      
      const purpose = detectPurpose(geometry, file.name);
      setDetectedPurpose(purpose);
      
      const purposeConfig = PART_PURPOSES[purpose];
      if (purposeConfig && purpose !== 'unknown') {
        setInfill(purposeConfig.recommendedInfill);
        setWalls(purposeConfig.recommendedWalls);
        setInfillPattern(purposeConfig.recommendedPattern);
      }
      
      setLoading(false);
      
      // Then try to get accurate slicer estimate in background
      if (slicerStatus?.available && slicerStatus?.profiles_configured) {
        getSlicerEstimate(file);
      }
      
    } catch (err) {
      setError('Failed to analyze file');
      setLoading(false);
    }
  }, [parseSTLFile, detectPurpose, slicerStatus, getSlicerEstimate]);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const file = Array.from(e.dataTransfer.files).find(f => 
      f.name.toLowerCase().endsWith('.stl')
    );
    if (file) processFile(file);
  }, [processFile]);

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const clearFile = useCallback(() => {
    setSelectedFile(null);
    setStlGeometry(null);
    setSlicerEstimate(null);
    setError(null);
    setDetectedPurpose('unknown');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleApplyRecommended = useCallback(() => {
    const cfg = PART_PURPOSES[detectedPurpose];
    if (cfg) {
      setInfill(cfg.recommendedInfill);
      setWalls(cfg.recommendedWalls);
      setInfillPattern(cfg.recommendedPattern);
    }
  }, [detectedPurpose]);

  const handleMaterialChange = useCallback((mat) => {
    setMaterial(mat);
    const colors = colorOptions[mat] || colorOptions.PLA;
    if (!colors.find(c => c.id === color)) {
      setColor(colors[0]?.id || 'black');
    }
    // Clear slicer estimate when material changes (requires re-slice)
    setSlicerEstimate(null);
  }, [color, colorOptions]);

  // Complexity score
  const complexityScore = useMemo(() => {
    if (!stlGeometry) return 0;
    
    const triangles = stlGeometry.triangles || 0;
    const vol = parseFloat(stlGeometry.volume_cm3) || 1;
    const dims = stlGeometry.dimensions_mm || {};
    const aspect = Math.max(dims.width, dims.depth, dims.height) / 
                   Math.max(1, Math.min(dims.width, dims.depth, dims.height));
    
    let score = 0;
    score += Math.min(25, triangles / 50000 * 25);
    score += Math.min(20, aspect * 4);
    score += infill > 50 ? 15 : infill > 30 ? 10 : 5;
    score += walls > 3 ? 10 : 5;
    score += vol > 500 ? 20 : vol > 200 ? 15 : vol > 100 ? 10 : 5;
    
    return Math.min(100, Math.round(score));
  }, [stlGeometry, infill, walls]);

  // CREATE ORDER - Triggered from modal
  const handleCreateOrder = async (clientData) => {
    if (!stlGeometry || !pricing || creatingOrder) return;
    
    setCreatingOrder(true);
    
    try {
      // Upload STL file
      let fileId = null;
      let filePath = null;
      
      if (selectedFile) {
        try {
          const formData = new FormData();
          formData.append('file', selectedFile);
          formData.append('layer_height', '0.2');
          
          const uploadResult = await api.uploadSlicingFile(formData);
          if (uploadResult) {
            fileId = uploadResult.file_id || uploadResult.id;
            filePath = uploadResult.file_path || uploadResult.path;
          }
        } catch (uploadErr) {
          console.warn('File upload failed:', uploadErr);
        }
      }
      
      // Create new client if needed
      let clientId = clientData.clientId;
      if (clientData.isNewClient && clientData.clientName) {
        try {
          const newClient = await api.createClient({
            name: clientData.clientName,
            email: clientData.clientEmail,
            phone: clientData.clientPhone,
            type: 'individual',
            source: 'instant_quote',
          });
          clientId = newClient?.id || newClient?.client_id;
        } catch (clientErr) {
          console.warn('Failed to create client:', clientErr);
        }
      }
      
      // Build quote object
      const quoteForBackend = {
        total: parseFloat(pricing.grand_total),
        subtotal: parseFloat(pricing.subtotal),
        vat: parseFloat(pricing.vat),
        unit_price: parseFloat(pricing.unit_price),
        discount_percent: pricing.discount_percent,
        discount_amount: parseFloat(pricing.discount_amount),
        delivery_fee: parseFloat(pricing.delivery_fee),
        rush_multiplier: pricing.rush_multiplier,
        estimate_source: pricing.estimate_source,
      };
      
      // Build order data
      const orderData = {
        item_name: selectedFile?.name?.replace('.stl', '') || 'STL Print Job',
        description: `${material} ${color} - ${infill}% infill, ${walls} walls. ${clientData.orderNotes}`.trim(),
        material_type: material,
        material_weight_g: parseFloat(pricing.weight_g) || 0,
        print_time_hours: pricing.print_time_hours || 0,
        complexity: complexityScore > 70 ? 'high' : complexityScore > 40 ? 'medium' : 'low',
        quantity: quantity,
        rush_order: rush !== 'standard',
        
        client_id: clientId || null,
        client_name: clientData.clientName,
        client_email: clientData.clientEmail || '',
        
        file_path: filePath || '',
        
        quote: quoteForBackend,
        
        notes: clientData.orderNotes,
        delivery_date: pricing.estimated_date,
        status: 'quoted',
        payment_status: 'pending',
        
        color, infill, walls,
        infill_pattern: infillPattern,
        quality,
        delivery_method: delivery,
        source: 'instant_quote',
        estimate_source: pricing.estimate_source,
      };
      
      // Create order via API
      try {
        const response = await api.createOrder(orderData);
        if (response?.success || response?.order_id || response?.id) {
          toast.success(`Tellimus loodud! #${response.order_id || response.id || 'NEW'}`);
          
          // Update file library cache
          if (filePath) {
            try {
              const cached = localStorage.getItem('polywerk_stl_analysis');
              const stlCache = cached ? JSON.parse(cached) : {};
              stlCache[filePath] = {
                ...stlCache[filePath],
                dimensions: stlGeometry?.dimensions_mm,
                volume_cm3: stlGeometry?.volume_cm3,
                weight_g: parseInt(pricing.weight_g),
                triangles: stlGeometry?.triangles || 0,
                estimated_price: pricing.grand_total,
                estimated_price_no_vat: pricing.subtotal,
                estimated_time_hours: pricing.print_time_hours,
                estimated_time_formatted: pricing.print_time_formatted,
                isOrderPrice: true,
                orderSettings: `${material}, ${infill}% infill`,
                orderId: response.order_id || response.id,
                estimate_source: pricing.estimate_source,
              };
              localStorage.setItem('polywerk_stl_analysis', JSON.stringify(stlCache));
            } catch (cacheErr) {
              console.warn('Failed to update price cache:', cacheErr);
            }
          }
          
          setShowOrderModal(false);
          clearFile();
          
          if (onOrderCreate) {
            onOrderCreate(orderData);
          }
          return;
        }
      } catch (apiError) {
        console.log('API order creation failed:', apiError);
      }
      
      toast.success(`Tellimus valmis kliendile ${clientData.clientName}!`);
      setShowOrderModal(false);
      if (onOrderCreate) {
        onOrderCreate(orderData);
      }
      clearFile();
      
    } catch (err) {
      console.error('Create order error:', err);
      toast.error('Tellimuse loomine ebaõnnestus');
    } finally {
      setCreatingOrder(false);
    }
  };

  const currentDiscount = useMemo(() => {
    for (const tier of [...batchTiers].sort((a, b) => b.min - a.min)) {
      if (quantity >= tier.min) return tier.discount;
    }
    return 0;
  }, [quantity, batchTiers]);

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showDiscounts, setShowDiscounts] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            🔬 Instant STL Quote
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Bambu P1S/P2S • Creality K1 • Live pricing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SlicerStatusBadge 
            status={slicerStatus} 
            isLoading={slicerLoading}
            onClick={() => {
              api.detectSlicer().then(setSlicerStatus);
              toast.info('Re-detecting slicer...');
            }}
          />
          <button
            onClick={() => setShowDiscounts(!showDiscounts)}
            className="text-sm text-purple-400 hover:text-purple-300"
          >
            📊 Soodustused
          </button>
          <button
            onClick={() => setShowAnalysis(!showAnalysis)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              showAnalysis ? 'bg-purple-500 text-white' : 'bg-slate-700 text-slate-300'
            }`}
          >
            {showAnalysis ? '🧠 Analysis On' : '🧠 Analysis'}
          </button>
        </div>
      </div>

      {/* Discount Tiers */}
      {showDiscounts && (
        <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
          <h4 className="text-sm font-medium text-white mb-2">📦 Koguse soodustused</h4>
          <div className="flex flex-wrap gap-2">
            {batchTiers.map((tier, i) => (
              <span key={i} className={`px-3 py-1.5 rounded-full text-sm ${
                quantity >= tier.min ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'
              }`}>
                {tier.min}+: <strong>-{tier.discount}%</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Upload & Settings */}
        <div className="lg:col-span-2 space-y-4">
          {/* Drop Zone */}
          <div
            className={`relative rounded-xl border-2 border-dashed p-6 transition-all cursor-pointer ${
              dragActive ? 'border-purple-500 bg-purple-500/10' : 'border-slate-600 hover:border-purple-500/50'
            }`}
            style={{ backgroundColor: '#1e293b' }}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => !selectedFile && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".stl"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            {loading ? (
              <div className="text-center py-8">
                <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-white font-medium">Analyzing...</p>
              </div>
            ) : selectedFile && stlGeometry ? (
              <div>
                <ModelPreview 
                  stlFile={selectedFile}
                  dimensions={stlGeometry.dimensions_mm}
                  color={selectedColorHex}
                />
                
                <div className="text-center mt-2">
                  <p className="text-white font-medium">{selectedFile.name}</p>
                  <p className="text-slate-400 text-sm">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • {stlGeometry.triangles?.toLocaleString()} triangles
                  </p>
                </div>
                
                <div className="flex justify-center gap-3 mt-4">
                  <button
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    className="px-4 py-2 rounded-lg text-sm text-purple-400 border border-purple-500/30 hover:bg-purple-500/10"
                  >
                    🔄 Vaheta
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); clearFile(); }}
                    className="px-4 py-2 rounded-lg text-sm text-red-400 border border-red-500/30 hover:bg-red-500/10"
                  >
                    🗑️ Tühjenda
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-5xl mb-4">📁</div>
                <p className="text-white font-medium">Lohista STL fail siia</p>
                <p className="text-slate-400 text-sm mt-1">või kliki failide sirvimiseks</p>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm">
              ⚠️ {error}
            </div>
          )}

          {/* Settings Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Materjal</label>
              <select
                value={material}
                onChange={(e) => handleMaterialChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-white text-sm bg-slate-700"
              >
                {Object.entries(MATERIALS).map(([id, m]) => (
                  <option key={id} value={id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Värv</label>
              <div className="relative">
                <button
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="w-full px-3 py-2 rounded-lg text-white text-sm bg-slate-700 flex items-center gap-2"
                >
                  <span className="w-4 h-4 rounded-full border border-white/30" style={{ backgroundColor: selectedColorHex }} />
                  <span className="truncate">{availableColors.find(c => c.id === color)?.name || color}</span>
                </button>
                
                {showColorPicker && (
                  <div className="absolute z-50 top-full left-0 mt-1 p-3 rounded-lg bg-slate-800 border border-slate-700 shadow-xl">
                    <div className="grid grid-cols-5 gap-2">
                      {availableColors.map(c => (
                        <button
                          key={c.id}
                          onClick={() => { setColor(c.id); setShowColorPicker(false); }}
                          className={`w-7 h-7 rounded-full border-2 ${c.id === color ? 'border-purple-500' : 'border-transparent'}`}
                          style={{ backgroundColor: c.hex }}
                          title={c.name}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Kvaliteet</label>
              <select
                value={quality}
                onChange={(e) => { setQuality(e.target.value); setSlicerEstimate(null); }}
                className="w-full px-3 py-2 rounded-lg text-white text-sm bg-slate-700"
              >
                {QUALITY_PRESETS.map(q => (
                  <option key={q.id} value={q.id}>{q.icon} {q.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Kogus {currentDiscount > 0 && <span className="text-green-400">(-{currentDiscount}%)</span>}
              </label>
              <input
                type="number"
                min="1"
                max="500"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 rounded-lg text-white text-sm bg-slate-700"
              />
            </div>
          </div>

          {/* Print Settings */}
          {stlGeometry && showAnalysis && (
            <div className="p-4 rounded-xl border border-slate-700 bg-slate-800/50">
              <h4 className="text-sm font-medium text-white mb-3">⚙️ Prindi seaded</h4>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Täidis: <span className="text-purple-400">{infill}%</span>
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={infill}
                    onChange={(e) => { setInfill(parseInt(e.target.value)); setSlicerEstimate(null); }}
                    className="w-full accent-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Seinad</label>
                  <select
                    value={walls}
                    onChange={(e) => { setWalls(parseInt(e.target.value)); setSlicerEstimate(null); }}
                    className="w-full px-3 py-2 rounded-lg text-white text-sm bg-slate-700"
                  >
                    {[2, 3, 4, 5, 6].map(n => (
                      <option key={n} value={n}>{n} seina</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Muster</label>
                  <select
                    value={infillPattern}
                    onChange={(e) => setInfillPattern(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-white text-sm bg-slate-700"
                  >
                    {INFILL_PATTERNS.map(p => (
                      <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <ComplexityMeter score={complexityScore} />
                </div>
              </div>
            </div>
          )}

          {/* Smart Recommendations */}
          {stlGeometry && showAnalysis && detectedPurpose !== 'unknown' && (
            <SmartRecommendations purpose={detectedPurpose} onApply={handleApplyRecommended} />
          )}

          {/* Rush & Delivery */}
          {stlGeometry && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-700 bg-slate-800/50">
                <h4 className="text-sm font-medium text-white mb-3">⏱️ Kiirus</h4>
                <div className="space-y-2">
                  {rushOptions.map(opt => (
                    <label key={opt.id} className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${
                      rush === opt.id ? 'bg-purple-500/20 border border-purple-500' : 'hover:bg-slate-700/50'
                    }`}>
                      <div className="flex items-center gap-2">
                        <input type="radio" checked={rush === opt.id} onChange={() => setRush(opt.id)} className="text-purple-500" />
                        <div>
                          <p className="text-white text-sm">{opt.name}</p>
                          <p className="text-slate-400 text-xs">{opt.description}</p>
                        </div>
                      </div>
                      {opt.multiplier > 1 && <span className="text-orange-400 text-xs">+{Math.round((opt.multiplier - 1) * 100)}%</span>}
                    </label>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-700 bg-slate-800/50">
                <h4 className="text-sm font-medium text-white mb-3">🚚 Tarne</h4>
                <div className="space-y-2">
                  {deliveryOptions.map(opt => (
                    <label key={opt.id} className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${
                      delivery === opt.id ? 'bg-cyan-500/20 border border-cyan-500' : 'hover:bg-slate-700/50'
                    }`}>
                      <div className="flex items-center gap-2">
                        <input type="radio" checked={delivery === opt.id} onChange={() => setDelivery(opt.id)} className="text-cyan-500" />
                        <p className="text-white text-sm">{opt.name}</p>
                      </div>
                      <span className="text-cyan-400 text-sm">{opt.price === 0 ? 'TASUTA' : `€${opt.price.toFixed(2)}`}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          {stlGeometry && pricing && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-slate-700/50">
                <p className="text-xs text-slate-400">Mõõtmed</p>
                <p className="text-white font-medium text-sm">
                  {stlGeometry.dimensions_mm.width.toFixed(0)}×{stlGeometry.dimensions_mm.depth.toFixed(0)}×{stlGeometry.dimensions_mm.height.toFixed(0)}mm
                </p>
              </div>
              <div className="p-3 rounded-lg bg-slate-700/50">
                <p className="text-xs text-slate-400">Maht</p>
                <p className="text-white font-medium">{stlGeometry.volume_cm3} cm³</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-700/50">
                <p className="text-xs text-slate-400">Kaal</p>
                <p className="text-white font-medium">{pricing.weight_g}g</p>
              </div>
              <div className="p-3 rounded-lg bg-purple-500/20 border border-purple-500/30">
                <p className="text-xs text-purple-400">Printimisaeg</p>
                <p className="text-purple-300 font-bold">{pricing.print_time_formatted}</p>
                {pricing.layer_count && (
                  <p className="text-xs text-purple-400">{pricing.layer_count} kihti</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Price */}
        <div className="space-y-4">
          {stlGeometry && pricing ? (
            <>
              <div className="rounded-xl border border-slate-700 p-5 bg-slate-800/80">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">💵 Hind</h3>
                  <EstimateSourceBadge 
                    source={pricing.estimate_source}
                    onRefresh={slicerStatus?.available ? handleRefreshEstimate : null}
                    isRefreshing={isSlicing}
                  />
                </div>
                
                {/* Settings summary */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  <span className="px-2 py-1 rounded text-xs bg-purple-500/20 text-purple-400">{infill}%</span>
                  <span className="px-2 py-1 rounded text-xs bg-cyan-500/20 text-cyan-400">{walls}w</span>
                  <span className="px-2 py-1 rounded text-xs bg-slate-700 text-slate-300">{INFILL_PATTERNS.find(p => p.id === infillPattern)?.icon}</span>
                  <span className="px-2 py-1 rounded text-xs" style={{ backgroundColor: selectedColorHex + '30', color: selectedColorHex }}>
                    {availableColors.find(c => c.id === color)?.name}
                  </span>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Ühiku hind</span>
                    <span className="text-white">€{pricing.unit_price}</span>
                  </div>
                  {quantity > 1 && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">× {quantity} tk</span>
                      <span className="text-white">€{(parseFloat(pricing.unit_price) * quantity).toFixed(2)}</span>
                    </div>
                  )}
                  {parseFloat(pricing.discount_amount) > 0 && (
                    <div className="flex justify-between text-green-400">
                      <span>Koguse soodustus (-{pricing.discount_percent}%)</span>
                      <span>-€{pricing.discount_amount}</span>
                    </div>
                  )}
                  {pricing.rush_multiplier > 1 && (
                    <div className="flex justify-between text-orange-400">
                      <span>{pricing.rush_name}</span>
                      <span>+{Math.round((pricing.rush_multiplier - 1) * 100)}%</span>
                    </div>
                  )}
                  
                  <div className="border-t border-slate-700 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">{pricing.delivery_name}</span>
                      <span className="text-white">{parseFloat(pricing.delivery_fee) === 0 ? 'TASUTA' : `€${pricing.delivery_fee}`}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-700 pt-4 mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-500">ilma KM</span>
                    <span className="text-slate-400">€{pricing.subtotal}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-3">
                    <span className="text-slate-500">+ KM 24%</span>
                    <span className="text-slate-400">€{pricing.vat}</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-white font-bold">Kokku</span>
                    <div className="text-right">
                      <span className="text-3xl font-bold text-cyan-400">€{pricing.grand_total}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                  <p className="text-xs text-cyan-400">📅 Valmimise aeg</p>
                  <p className="text-cyan-300 font-medium">{pricing.estimated_date}</p>
                </div>

                {/* CREATE ORDER BUTTON */}
                <div className="mt-4">
                  <button
                    onClick={() => setShowOrderModal(true)}
                    disabled={creatingOrder}
                    className="w-full py-3 rounded-lg font-medium text-white disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
                  >
                    📝 Loo tellimus →
                  </button>
                </div>
              </div>

              {/* Purpose badge */}
              {detectedPurpose !== 'unknown' && (
                <div className="p-4 rounded-xl border border-slate-700 bg-slate-800/50">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{PART_PURPOSES[detectedPurpose].icon}</span>
                    <div>
                      <p className="text-xs text-slate-400">Tuvastatud tüüp</p>
                      <p className="text-white font-medium">{PART_PURPOSES[detectedPurpose].name}</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-slate-700 p-6 text-center bg-slate-800/50">
              <div className="text-4xl mb-3">🔬</div>
              <p className="text-slate-400">Lae üles STL fail</p>
              <p className="text-xs text-slate-500 mt-2">Kohene analüüs & hinnang</p>
            </div>
          )}
        </div>
      </div>

      {/* Order Creation Modal */}
      <CreateOrderModal
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        onSubmit={handleCreateOrder}
        pricing={pricing}
        stlGeometry={stlGeometry}
        selectedFile={selectedFile}
        material={material}
        color={color}
        infill={infill}
        walls={walls}
        quality={quality}
        rush={rush}
        delivery={delivery}
        loading={creatingOrder}
      />
    </div>
  );
}

export default InstantSTLQuote;
