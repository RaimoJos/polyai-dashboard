import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { api, unwrap } from '../services/api';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import * as THREE from 'three';

const MATERIALS = ['PLA', 'PETG', 'ABS', 'TPU', 'Nylon', 'ASA'];

// Printer bed sizes (in mm)
const PRINTER_BEDS = {
  'bambu_p1s': { x: 256, y: 256, z: 256, name: 'Bambu P1S' },
  'bambu_x1c': { x: 256, y: 256, z: 256, name: 'Bambu X1C' },
  'bambu_a1': { x: 256, y: 256, z: 256, name: 'Bambu A1' },
  'creality_k1': { x: 220, y: 220, z: 250, name: 'Creality K1' },
  'creality_k1_max': { x: 300, y: 300, z: 300, name: 'Creality K1 Max' },
  'ender3': { x: 220, y: 220, z: 250, name: 'Ender 3' },
  'default': { x: 256, y: 256, z: 256, name: 'Standard' }
};

// Support types
const SUPPORT_TYPES = [
  { value: 'none', label: 'None', icon: '❌' },
  { value: 'auto', label: 'Auto (Tree)', icon: '🌲' },
  { value: 'normal', label: 'Normal Grid', icon: '▦' },
  { value: 'organic', label: 'Organic', icon: '🌿' },
];

// Quality presets (matches backend)
const QUALITY_PRESETS = {
  draft: { name: 'Draft', layer_height: 0.28, infill_percent: 15, wall_count: 2, print_speed: 150 },
  standard: { name: 'Standard', layer_height: 0.20, infill_percent: 20, wall_count: 3, print_speed: 120 },
  quality: { name: 'Quality', layer_height: 0.12, infill_percent: 25, wall_count: 4, print_speed: 80 },
  fine: { name: 'Fine', layer_height: 0.08, infill_percent: 30, wall_count: 4, print_speed: 50 },
};

/**
 * Printer Bed Component - shows build plate outline
 */
const PrinterBed = ({ bedSize }) => {
  const { x, y, z } = bedSize;

  return (
    <group position={[0, 0, 0]}>
      {/* Build plate surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[x, y]} />
        <meshStandardMaterial
          color="#1a1a2e"
          transparent
          opacity={0.9}
          roughness={0.8}
        />
      </mesh>

      {/* Grid on bed */}
      <gridHelper
        args={[Math.max(x, y), Math.max(x, y) / 10, '#333355', '#222244']}
        position={[0, 0, 0]}
      />

      {/* Build volume wireframe */}
      <lineSegments position={[0, z/2, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(x, z, y)]} />
        <lineBasicMaterial color="#4a5568" transparent opacity={0.3} />
      </lineSegments>

      {/* Corner posts for height reference */}
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([dx, dy], i) => (
        <mesh key={i} position={[dx * x/2, z/2, dy * y/2]}>
          <cylinderGeometry args={[0.5, 0.5, z, 8]} />
          <meshBasicMaterial color="#4a5568" transparent opacity={0.2} />
        </mesh>
      ))}

      {/* Dimension labels */}
      <Html position={[x/2 + 10, 0, 0]} center>
        <div className="text-xs text-blue-400 bg-slate-800 px-1 rounded whitespace-nowrap">
          {x}mm
        </div>
      </Html>
      <Html position={[0, 0, y/2 + 10]} center>
        <div className="text-xs text-green-400 bg-slate-800 px-1 rounded whitespace-nowrap">
          {y}mm
        </div>
      </Html>
      <Html position={[-x/2 - 10, z/2, -y/2]} center>
        <div className="text-xs text-orange-400 bg-slate-800 px-1 rounded whitespace-nowrap">
          Z: {z}mm
        </div>
      </Html>
    </group>
  );
};

/**
 * Model info overlay with rotation info
 */
const ModelInfo = ({ dimensions, bedSize, rotation, onAutoRotate }) => {
  if (!dimensions) return null;

  const fitsX = dimensions.x <= bedSize.x;
  const fitsY = dimensions.y <= bedSize.y;
  const fitsZ = dimensions.z <= bedSize.z;
  const fitsAll = fitsX && fitsY && fitsZ;

  return (
    <div className="absolute top-2 left-2 bg-gray-900/95 text-white p-3 rounded-lg text-xs space-y-1 border border-gray-700">
      <div className="font-bold text-sm mb-2">📐 Model Size</div>
      <div className={`flex justify-between gap-4 ${fitsX ? 'text-green-400' : 'text-red-400'}`}>
        <span>X:</span>
        <span>{dimensions.x.toFixed(1)}mm</span>
      </div>
      <div className={`flex justify-between gap-4 ${fitsY ? 'text-green-400' : 'text-red-400'}`}>
        <span>Y:</span>
        <span>{dimensions.y.toFixed(1)}mm</span>
      </div>
      <div className={`flex justify-between gap-4 ${fitsZ ? 'text-green-400' : 'text-red-400'}`}>
        <span>Z:</span>
        <span>{dimensions.z.toFixed(1)}mm</span>
      </div>
      <div className={`mt-2 pt-2 border-t border-gray-700 font-bold ${fitsAll ? 'text-green-400' : 'text-red-400'}`}>
        {fitsAll ? '✓ Fits on bed' : '⚠ Too large!'}
      </div>

      {/* Rotation info */}
      {rotation && (
        <div className="mt-2 pt-2 border-t border-gray-700 text-zinc-400 text-[10px]">
          <div>Rot: X:{rotation.x}° Y:{rotation.y}° Z:{rotation.z}°</div>
        </div>
      )}

      {/* Auto-rotate button */}
      <button
        onClick={onAutoRotate}
        className="mt-2 w-full py-1 rounded text-white text-[10px] font-bold"
        style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)' }}
      >
        🔄 Auto-Rotate
      </button>
    </div>
  );
};

/**
 * 3D STL Viewer Component with printer bed reference and rotation controls
 */
const STLViewer = ({ url, printerType = 'default', onDimensionsChange, rotation, onRotationChange }) => {
  const [geometry, setGeometry] = useState(null);
  const [originalGeometry, setOriginalGeometry] = useState(null);
  const [dimensions, setDimensions] = useState(null);
  const [loading, setLoading] = useState(false);

  const bedSize = PRINTER_BEDS[printerType] || PRINTER_BEDS.default;

  // Calculate optimal rotation for minimal support
  const calculateOptimalRotation = useCallback(() => {
    if (!originalGeometry) return { x: 0, y: 0, z: 0 };

    let bestRotation = { x: 0, y: 0, z: 0 };
    let bestScore = Infinity;

    // Test common orientations (0, 90, 180, 270 degrees on each axis)
    const angles = [0, 90, 180, 270];

    for (const xAngle of angles) {
      for (const zAngle of [0, 90]) { // Limit search for performance
        const testClone = originalGeometry.clone();

        // Apply rotation
        testClone.rotateX(THREE.MathUtils.degToRad(xAngle));
        testClone.rotateZ(THREE.MathUtils.degToRad(zAngle));
        testClone.computeBoundingBox();

        const box = testClone.boundingBox;
        const size = new THREE.Vector3();
        box.getSize(size);

        // Score: minimize height (less supports needed) and maximize base area
        const height = size.y;
        const baseArea = size.x * size.z;
        const score = height / Math.sqrt(baseArea); // Lower is better

        // Also check if it fits the bed
        const fitsX = size.x <= bedSize.x;
        const fitsZ = size.z <= bedSize.y;
        const fitsY = size.y <= bedSize.z;

        if (fitsX && fitsZ && fitsY && score < bestScore) {
          bestScore = score;
          bestRotation = { x: xAngle, y: 0, z: zAngle };
        }

        testClone.dispose();
      }
    }

    return bestRotation;
  }, [originalGeometry, bedSize]);

  const handleAutoRotate = useCallback(() => {
    const optimal = calculateOptimalRotation();
    onRotationChange?.(optimal);
  }, [calculateOptimalRotation, onRotationChange]);

  // Apply rotation and recalculate dimensions
  useEffect(() => {
    if (!originalGeometry || !rotation) return;

    const rotatedGeo = originalGeometry.clone();

    // Apply rotations
    rotatedGeo.rotateX(THREE.MathUtils.degToRad(rotation.x));
    rotatedGeo.rotateY(THREE.MathUtils.degToRad(rotation.y));
    rotatedGeo.rotateZ(THREE.MathUtils.degToRad(rotation.z));

    // Standard Z-up to Y-up conversion
    rotatedGeo.rotateX(-Math.PI / 2);

    rotatedGeo.computeBoundingBox();
    const box = rotatedGeo.boundingBox;
    const size = new THREE.Vector3();
    box.getSize(size);

    // Center and place on bed
    rotatedGeo.center();
    rotatedGeo.translate(0, size.y / 2, 0);

    setDimensions({ x: size.x, y: size.y, z: size.z });
    onDimensionsChange?.({ x: size.x, y: size.y, z: size.z });
    setGeometry(rotatedGeo);

  }, [originalGeometry, rotation, onDimensionsChange]);

  useEffect(() => {
    let cancelled = false;
    if (!url) return undefined;

    setLoading(true);
    const loader = new STLLoader();
    loader.load(
      url,
      (geo) => {
        if (cancelled) return;
        try {
          geo.computeVertexNormals?.();
          geo.computeBoundingBox();

          // Store original geometry for rotation calculations
          setOriginalGeometry(geo.clone());

          // Apply initial rotation (Z-up to Y-up)
          geo.rotateX(-Math.PI / 2);
          geo.computeBoundingBox();

          const box = geo.boundingBox;
          const size = new THREE.Vector3();
          box.getSize(size);

          setDimensions({ x: size.x, y: size.y, z: size.z });
          onDimensionsChange?.({ x: size.x, y: size.y, z: size.z });

          // Center and place on bed
          geo.center();
          geo.translate(0, size.y / 2, 0);

        } catch (e) {
          console.error('Geometry processing error:', e);
        }
        setGeometry(geo);
        setLoading(false);
      },
      undefined,
      (err) => {
        if (cancelled) return;
        console.error('STL load error:', err);
        setGeometry(null);
        setLoading(false);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [url, onDimensionsChange]);

  if (loading || !geometry) {
    return (
      <div className="h-[450px] flex flex-col items-center justify-center bg-gray-900 rounded-lg border-2 border-gray-700">
        <div className="animate-pulse text-4xl mb-2">🧊</div>
        <p className="text-zinc-400 text-sm">{loading ? 'Loading 3D Model...' : 'Select a file'}</p>
      </div>
    );
  }

  // Calculate camera position based on bed size
  const camDist = Math.max(bedSize.x, bedSize.y, bedSize.z) * 1.5;

  return (
    <div className="h-[450px] w-full bg-gray-900 rounded-lg overflow-hidden shadow-inner border-2 border-gray-700 relative">
      <Canvas
        shadows
        camera={{ position: [camDist * 0.7, camDist * 0.5, camDist * 0.7], fov: 45 }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[100, 200, 100]} intensity={0.8} castShadow />
        <directionalLight position={[-100, 100, -100]} intensity={0.3} />

        {/* Printer bed */}
        <PrinterBed bedSize={bedSize} />

        {/* The STL model */}
        <mesh geometry={geometry} castShadow receiveShadow>
          <meshStandardMaterial
            color="#3b82f6"
            roughness={0.35}
            metalness={0.1}
          />
        </mesh>

        <OrbitControls
          makeDefault
          minDistance={50}
          maxDistance={camDist * 3}
          target={[0, bedSize.z * 0.3, 0]}
        />
      </Canvas>

      {/* Model dimensions overlay */}
      <ModelInfo
        dimensions={dimensions}
        bedSize={bedSize}
        rotation={rotation}
        onAutoRotate={handleAutoRotate}
      />

      {/* Printer info */}
      <div className="absolute top-2 right-2 bg-gray-900/95 text-white px-3 py-2 rounded-lg text-xs border border-gray-700">
        <div className="font-bold">{bedSize.name}</div>
        <div className="text-zinc-400">{bedSize.x}×{bedSize.y}×{bedSize.z}mm</div>
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-2 right-2 text-[10px] text-zinc-500 pointer-events-none">
        Left Click: Rotate • Right Click: Pan • Scroll: Zoom
      </div>
    </div>
  );
};

const STLSlicer = () => {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [sliceResult, setSliceResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [slicing, setSlicing] = useState(false);
  const [message, setMessage] = useState(null);
  const [printers, setPrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [_modelDimensions, setModelDimensions] = useState(null);  // eslint-disable-line no-unused-vars
  const [modelRotation, setModelRotation] = useState({ x: 0, y: 0, z: 0 });
  const [slicerStatus, setSlicerStatus] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState('standard');
  const fileInputRef = useRef(null);

  const [settings, setSettings] = useState({
    material: 'PLA',
    layer_height: 0.2,
    infill_percent: 20,
    wall_count: 3,
    nozzle_temp: 210,
    bed_temp: 60,
    supports: false,
    support_type: 'tree',
    support_angle: 45,
    brim: false,
    print_speed: 120,
  });

  const fetchFiles = useCallback(async () => {
    try {
      const res = await api.listSlicingFiles();
      const data = unwrap(res) || {};
      setFiles(data.files || []);
    } catch (err) {
      console.error('Error fetching files:', err);
    }
  }, []);

  const fetchPrinters = useCallback(async () => {
    try {
      const res = await api.getPrinters();
      const data = unwrap(res) || {};
      setPrinters(data.printers || data || []);
    } catch (err) {
      console.error('Error fetching printers:', err);
    }
  }, []);

  const fetchSlicerStatus = useCallback(async () => {
    try {
      const status = await api.getSlicerStatus();
      setSlicerStatus(status);
    } catch (err) {
      console.error('Error fetching slicer status:', err);
      setSlicerStatus({ available: false, slicer_type: 'none' });
    }
  }, []);

  useEffect(() => {
    fetchFiles();
    fetchPrinters();
    fetchSlicerStatus();
  }, [fetchFiles, fetchPrinters, fetchSlicerStatus]);

  useEffect(() => {
    if (analysis?.recommendations) {
      setSettings((prev) => ({
        ...prev,
        infill_percent: analysis.recommendations.infill_percent ?? prev.infill_percent,
        layer_height: analysis.recommendations.layer_height_mm ?? prev.layer_height,
        supports: Boolean(analysis.recommendations.supports ?? prev.supports),
        brim: Boolean(analysis.recommendations.brim ?? prev.brim),
      }));
    }
  }, [analysis]);

  // Apply preset when changed
  const applyPreset = useCallback((presetKey) => {
    const preset = QUALITY_PRESETS[presetKey];
    if (preset) {
      setSelectedPreset(presetKey);
      setSettings(prev => ({
        ...prev,
        layer_height: preset.layer_height,
        infill_percent: preset.infill_percent,
        wall_count: preset.wall_count,
        print_speed: preset.print_speed,
      }));
    }
  }, []);

  const stlPreviewUrl = useMemo(() => {
    if (!selectedFile) return null;
    return api.slicingDownloadUrl(selectedFile);
  }, [selectedFile]);

  // Get printer type for bed visualization
  const selectedPrinterType = useMemo(() => {
    if (!selectedPrinter) return 'default';
    const printer = printers.find(p => p.name === selectedPrinter);
    return printer?.printer_type || 'default';
  }, [selectedPrinter, printers]);

  const onSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    // Clear preset selection if user changes settings manually
    setSelectedPreset(null);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setMessage(null);
    setAnalysis(null);
    setSliceResult(null);
    setModelRotation({ x: 0, y: 0, z: 0 });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('layer_height', String(settings.layer_height));

    try {
      const res = await api.uploadSlicingFile(formData);
      const data = unwrap(res) || {};
      setAnalysis(data.analysis || null);
      setSelectedFile(data.file_path || data.file_id || null);
      setMessage({ type: 'success', text: 'File uploaded and analyzed!' });
      fetchFiles();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Upload failed' });
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSelectFile = async (filePath) => {
    setLoading(true);
    setSelectedFile(filePath);
    setSliceResult(null);
    setAnalysis(null);
    setMessage(null);
    setModelRotation({ x: 0, y: 0, z: 0 });

    try {
      const res = await api.analyzeSlicingFile(filePath, settings.layer_height);
      const data = unwrap(res) || {};
      setAnalysis(data.analysis || data || null);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.response?.data?.error || 'Analysis failed' });
    } finally {
      setLoading(false);
    }
  };

  // Use OrcaSlicer for accurate slicing
  const handleSlice = async () => {
    if (!selectedFile) return;
    setSlicing(true);
    setMessage(null);

    try {
      // Try OrcaSlicer first if available
      if (slicerStatus?.available) {
        const result = await api.sliceExistingFile(selectedFile, {
          layer_height: settings.layer_height,
          infill_percent: settings.infill_percent,
          wall_count: settings.wall_count,
          material: settings.material,
          supports: settings.supports,
          support_type: settings.support_type,
          brim: settings.brim,
          nozzle_temp: settings.nozzle_temp,
          bed_temp: settings.bed_temp,
          print_speed: settings.print_speed,
        }, false); // don't keep gcode by default

        const sliceData = result?.result || result;
        setSliceResult(sliceData);
        
        const sourceLabel = sliceData?.source === 'orcaslicer' ? 'OrcaSlicer' : 
                          sliceData?.source === 'bambu_studio' ? 'Bambu Studio' : 'estimation';
        setMessage({ type: 'success', text: `Slicing complete via ${sourceLabel}!` });
      } else {
        // Fallback to backend slicing
        const res = await api.sliceFile(selectedFile, { ...settings, rotation: modelRotation });
        const data = unwrap(res) || {};
        setSliceResult(data.slice_result || data || null);
        setMessage({ type: 'success', text: 'Slicing complete (estimated)!' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || err.message || 'Slicing failed' });
    } finally {
      setSlicing(false);
    }
  };

  // Quick estimate without full slicing
  const handleQuickEstimate = async () => {
    if (!selectedFile) return;
    setSlicing(true);
    setMessage(null);

    try {
      // Get file as blob for quick estimate
      const response = await fetch(api.slicingDownloadUrl(selectedFile));
      const blob = await response.blob();
      const file = new File([blob], selectedFile.split('/').pop() || 'model.stl', { type: 'application/octet-stream' });

      const result = await api.getQuickEstimate(file, {
        material: settings.material,
        layer_height: settings.layer_height,
        infill_percent: settings.infill_percent,
      });

      const estimate = result?.estimate || result;
      setSliceResult({
        ...estimate,
        source: 'quick_estimate',
      });
      setMessage({ type: 'success', text: 'Quick estimate complete!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Estimation failed' });
    } finally {
      setSlicing(false);
    }
  };

  const handlePrint = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setMessage(null);

    try {
      const res = await api.createPrintJobFromSlice({
        file_path: selectedFile,
        printer_name: selectedPrinter || null,
        job_name: analysis?.filename?.replace(/\.[^/.]+$/, '') || 'Print Job',
        settings: { ...settings, rotation: modelRotation },
      });
      setMessage({ type: 'success', text: `Job ${(unwrap(res)||{}).job_id || res?.data?.job_id || 'created'} created!` });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Print job creation failed' });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    if (!seconds) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="max-w-[1600px] mx-auto p-4 space-y-6">
      {/* Header */}
      <div 
        className="bg-gray-900 rounded-xl border border-gray-800 p-6"
        style={{ borderLeft: '4px solid #3b82f6' }}
      >
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <span>🧊</span> STL Analyzer & Slicer
            </h2>
            <p className="text-zinc-400">Visual inspection with auto-rotation & OrcaSlicer integration</p>
          </div>
          
          {/* Slicer Status Badge */}
          <div className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
            slicerStatus?.available 
              ? 'bg-green-900/30 border border-green-700 text-green-400' 
              : slicerStatus?.slicer_installed
                ? 'bg-yellow-900/30 border border-yellow-700 text-yellow-400'
                : 'bg-zinc-900/30 border border-zinc-700 text-zinc-400'
          }`}>
            {slicerStatus?.available ? (
              <>
                <span>🔪</span>
                <span>{slicerStatus.slicer_type === 'orcaslicer' ? 'OrcaSlicer' : 'Bambu Studio'} Ready</span>
              </>
            ) : slicerStatus?.slicer_installed ? (
              <>
                <span>⚠️</span>
                <span>Profiles Missing</span>
              </>
            ) : (
              <>
                <span>📊</span>
                <span>Using Estimates</span>
              </>
            )}
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg border ${
            message.type === 'error'
              ? 'bg-red-900/30 border-red-700 text-red-400'
              : 'bg-green-900/30 border-green-700 text-green-400'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: File List */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 h-fit">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-white">📁 Library</h3>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1 rounded text-sm text-white font-medium transition"
              style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)' }}
            >
              + Upload
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".stl,.STL"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
            {files.length === 0 ? (
              <p className="text-zinc-500 text-sm text-center py-4">No files yet</p>
            ) : (
              files.map((file) => (
                <button
                  type="button"
                  key={file.path}
                  onClick={() => handleSelectFile(file.path)}
                  className={`w-full text-left p-3 rounded-lg cursor-pointer border transition-all ${
                    selectedFile === file.path 
                      ? 'border-blue-500 bg-blue-900/30' 
                      : 'border-gray-700 bg-gray-800/50 hover:bg-gray-800'
                  }`}
                >
                  <p className="font-medium text-xs truncate text-zinc-200">{file.name}</p>
                  <p className="text-[10px] text-zinc-500 mt-1">{file.size_mb} MB</p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Center: Preview & Analysis */}
        <div className="lg:col-span-2 space-y-6">
          {/* 3D PREVIEW BLOCK */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-zinc-200 flex items-center gap-2">
                <span>👁️</span> 3D Preview
              </h3>
              
              {/* Printer selector for bed reference */}
              <select
                value={selectedPrinter}
                onChange={(e) => setSelectedPrinter(e.target.value)}
                className="text-sm bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-zinc-200"
              >
                <option value="">Select printer bed...</option>
                {printers.map(p => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
                <option value="bambu_p1s">Bambu P1S (256³)</option>
                <option value="creality_k1">Creality K1 (220×220×250)</option>
                <option value="creality_k1_max">Creality K1 Max (300³)</option>
              </select>
            </div>

            <STLViewer 
              url={stlPreviewUrl} 
              printerType={selectedPrinterType}
              onDimensionsChange={setModelDimensions}
              rotation={modelRotation}
              onRotationChange={setModelRotation}
            />
            
            {/* Manual Rotation Controls */}
            {selectedFile && (
              <div className="mt-3 p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
                <div className="text-xs font-bold text-zinc-400 mb-2">🔄 Manual Rotation</div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-zinc-500">X°</label>
                    <input
                      type="number"
                      step="15"
                      value={modelRotation.x}
                      onChange={(e) => setModelRotation(prev => ({ ...prev, x: Number(e.target.value) }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-sm text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500">Y°</label>
                    <input
                      type="number"
                      step="15"
                      value={modelRotation.y}
                      onChange={(e) => setModelRotation(prev => ({ ...prev, y: Number(e.target.value) }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-sm text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500">Z°</label>
                    <input
                      type="number"
                      step="15"
                      value={modelRotation.z}
                      onChange={(e) => setModelRotation(prev => ({ ...prev, z: Number(e.target.value) }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-sm text-zinc-200"
                    />
                  </div>
                </div>
                <button
                  onClick={() => setModelRotation({ x: 0, y: 0, z: 0 })}
                  className="mt-2 text-xs text-blue-400 hover:underline"
                >
                  Reset rotation
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
              <div className="animate-spin text-4xl mb-4">🌀</div>
              <p className="text-zinc-400 font-medium">Processing...</p>
            </div>
          ) : analysis ? (
            <>
              {/* Metrics Grid */}
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                <h3 className="font-bold mb-4 text-white">📊 Analysis</h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div 
                    className="p-3 rounded-lg border"
                    style={{ 
                      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)',
                      borderColor: 'rgba(59, 130, 246, 0.3)'
                    }}
                  >
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Volume</p>
                    <p className="text-lg font-black text-blue-400">
                      {analysis.volume_cm3} <span className="text-xs font-normal">cm³</span>
                    </p>
                  </div>

                  <div 
                    className="p-3 rounded-lg border"
                    style={{ 
                      background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)',
                      borderColor: 'rgba(34, 197, 94, 0.3)'
                    }}
                  >
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Surface</p>
                    <p className="text-lg font-black text-green-400">
                      {analysis.surface_area_cm2 
                        ? analysis.surface_area_cm2 
                        : ((analysis.surface_area_mm2 || 0) / 100).toFixed(1)
                      } <span className="text-xs font-normal">cm²</span>
                    </p>
                  </div>

                  <div 
                    className="p-3 rounded-lg border"
                    style={{ 
                      background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(168, 85, 247, 0.05) 100%)',
                      borderColor: 'rgba(168, 85, 247, 0.3)'
                    }}
                  >
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Complexity</p>
                    <p className="text-lg font-black text-purple-400 capitalize">{analysis.complexity?.level || 'N/A'}</p>
                  </div>

                  <div 
                    className="p-3 rounded-lg border"
                    style={{ 
                      background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.1) 0%, rgba(249, 115, 22, 0.05) 100%)',
                      borderColor: 'rgba(249, 115, 22, 0.3)'
                    }}
                  >
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Triangles</p>
                    <p className="text-lg font-black text-orange-400">
                      {Number(analysis.triangle_count || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Slice Result */}
              {sliceResult && (
                <div 
                  className="bg-gray-900 rounded-xl border p-6"
                  style={{ borderColor: 'rgba(34, 197, 94, 0.5)' }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-green-400">✓ Slice Complete</h3>
                    <span className={`text-xs px-2 py-1 rounded ${
                      sliceResult.source === 'orcaslicer' || sliceResult.source === 'bambu_studio'
                        ? 'bg-green-900/50 text-green-400'
                        : 'bg-yellow-900/50 text-yellow-400'
                    }`}>
                      {sliceResult.source === 'orcaslicer' ? '🔪 OrcaSlicer' :
                       sliceResult.source === 'bambu_studio' ? '🔪 Bambu Studio' :
                       '📊 Estimated'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <p className="text-[10px] uppercase text-zinc-500 font-bold">Print Time</p>
                      <p className="text-xl font-black text-blue-400">
                        {sliceResult.print_time_formatted || formatTime(sliceResult.print_time_seconds)}
                      </p>
                    </div>
                    
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <p className="text-[10px] uppercase text-zinc-500 font-bold">Filament</p>
                      <p className="text-xl font-black text-green-400">
                        {(sliceResult.filament_used_g || 0).toFixed(1)}g
                      </p>
                    </div>
                    
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <p className="text-[10px] uppercase text-zinc-500 font-bold">Length</p>
                      <p className="text-xl font-black text-purple-400">
                        {(sliceResult.filament_used_m || 0).toFixed(2)}m
                      </p>
                    </div>
                    
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <p className="text-[10px] uppercase text-zinc-500 font-bold">Layers</p>
                      <p className="text-xl font-black text-orange-400">
                        {sliceResult.layer_count || '—'}
                      </p>
                    </div>
                  </div>

                  {(sliceResult.source === 'estimate' || sliceResult.source === 'quick_estimate') && (
                    <p className="mt-3 text-xs text-yellow-400 flex items-center gap-1">
                      <span>⚠️</span>
                      Install OrcaSlicer for more accurate print time estimates
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="bg-gray-900 rounded-xl border-2 border-dashed border-gray-700 p-16 text-center text-zinc-500">
              <p className="text-5xl mb-4">📥</p>
              <p className="font-medium">Select or upload an STL file</p>
            </div>
          )}
        </div>

        {/* Right: Controls */}
        <div className="space-y-6">
          {/* Quality Presets */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h3 className="font-bold mb-3 text-white">⚡ Quality Preset</h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(QUALITY_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  className={`p-2 rounded-lg text-xs font-medium border transition ${
                    selectedPreset === key
                      ? 'border-blue-500 bg-blue-900/30 text-blue-400'
                      : 'border-gray-700 bg-gray-800/50 text-zinc-300 hover:bg-gray-800'
                  }`}
                >
                  <div className="font-bold">{preset.name}</div>
                  <div className="text-[10px] text-zinc-500">{preset.layer_height}mm</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h3 className="font-bold mb-4 text-white">⚙️ Print Settings</h3>

            <div className="space-y-3">
              <label className="block">
                <div className="text-xs font-semibold text-zinc-400 mb-1">Material</div>
                <select
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-zinc-200"
                  value={settings.material}
                  onChange={(e) => onSetting('material', e.target.value)}
                >
                  {MATERIALS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-xs font-semibold text-zinc-400 mb-1">Layer (mm)</div>
                  <input
                    type="number"
                    step="0.04"
                    min="0.04"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-zinc-200"
                    value={settings.layer_height}
                    onChange={(e) => onSetting('layer_height', Number(e.target.value))}
                  />
                </label>

                <label className="block">
                  <div className="text-xs font-semibold text-zinc-400 mb-1">Infill %</div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-zinc-200"
                    value={settings.infill_percent}
                    onChange={(e) => onSetting('infill_percent', Number(e.target.value))}
                  />
                </label>

                <label className="block">
                  <div className="text-xs font-semibold text-zinc-400 mb-1">Walls</div>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-zinc-200"
                    value={settings.wall_count}
                    onChange={(e) => onSetting('wall_count', Number(e.target.value))}
                  />
                </label>

                <label className="block">
                  <div className="text-xs font-semibold text-zinc-400 mb-1">Speed mm/s</div>
                  <input
                    type="number"
                    min="20"
                    max="300"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-zinc-200"
                    value={settings.print_speed}
                    onChange={(e) => onSetting('print_speed', Number(e.target.value))}
                  />
                </label>

                <label className="block">
                  <div className="text-xs font-semibold text-zinc-400 mb-1">Nozzle °C</div>
                  <input
                    type="number"
                    min="0"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-zinc-200"
                    value={settings.nozzle_temp}
                    onChange={(e) => onSetting('nozzle_temp', Number(e.target.value))}
                  />
                </label>

                <label className="block">
                  <div className="text-xs font-semibold text-zinc-400 mb-1">Bed °C</div>
                  <input
                    type="number"
                    min="0"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-zinc-200"
                    value={settings.bed_temp}
                    onChange={(e) => onSetting('bed_temp', Number(e.target.value))}
                  />
                </label>
              </div>

              {/* Support Settings */}
              <div className="pt-3 border-t border-gray-700">
                <div className="text-xs font-semibold text-zinc-400 mb-2">🏗️ Supports</div>
                
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="supports-toggle"
                    checked={settings.supports}
                    onChange={(e) => onSetting('supports', e.target.checked)}
                    className="rounded bg-gray-800 border-gray-600"
                  />
                  <label htmlFor="supports-toggle" className="text-sm text-zinc-300">Enable Supports</label>
                </div>
                
                {settings.supports && (
                  <div className="space-y-2 pl-4 border-l-2 border-blue-500/50">
                    <div>
                      <label className="text-[10px] text-zinc-500">Support Type</label>
                      <div className="flex gap-1 flex-wrap">
                        {SUPPORT_TYPES.filter(s => s.value !== 'none').map(type => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => onSetting('support_type', type.value)}
                            className={`px-2 py-1 text-xs rounded border ${
                              settings.support_type === type.value 
                                ? 'bg-blue-600 text-white border-blue-500' 
                                : 'bg-gray-800 border-gray-700 text-zinc-300 hover:bg-gray-700'
                            }`}
                          >
                            {type.icon} {type.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-[10px] text-zinc-500">Overhang Angle: {settings.support_angle}°</label>
                      <input
                        type="range"
                        min="30"
                        max="75"
                        value={settings.support_angle}
                        onChange={(e) => onSetting('support_angle', Number(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <input 
                    type="checkbox" 
                    checked={settings.brim} 
                    onChange={(e) => onSetting('brim', e.target.checked)}
                    className="rounded bg-gray-800 border-gray-600"
                  />
                  Brim
                </label>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleQuickEstimate}
                  disabled={!selectedFile || slicing || loading}
                  className="w-full py-2 rounded-lg font-medium text-white transition disabled:opacity-50 bg-gray-700 hover:bg-gray-600"
                >
                  {slicing ? '⏳ Estimating...' : '⚡ Quick Estimate'}
                </button>

                <button
                  type="button"
                  onClick={handleSlice}
                  disabled={!selectedFile || slicing || loading}
                  className="w-full py-3 rounded-xl font-bold text-white transition disabled:opacity-50 shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
                >
                  {slicing ? '🔪 Slicing...' : slicerStatus?.available ? `🔪 Slice with ${slicerStatus.slicer_type === 'orcaslicer' ? 'OrcaSlicer' : 'Bambu Studio'}` : '🔪 Slice (Estimate)'}
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={!selectedFile || slicing || loading}
                  className="w-full py-3 rounded-xl font-bold text-white transition disabled:opacity-50 shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #22c55e 0%, #06b6d4 100%)' }}
                >
                  {loading ? '⏳ Creating...' : '🖨️ Create Print Job'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

PrinterBed.propTypes = {
  bedSize: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    z: PropTypes.number.isRequired,
    name: PropTypes.string
  }).isRequired
};

ModelInfo.propTypes = {
  dimensions: PropTypes.shape({
    x: PropTypes.number,
    y: PropTypes.number,
    z: PropTypes.number
  }),
  bedSize: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    z: PropTypes.number.isRequired
  }).isRequired,
  rotation: PropTypes.shape({
    x: PropTypes.number,
    y: PropTypes.number,
    z: PropTypes.number
  }),
  onAutoRotate: PropTypes.func
};

STLViewer.propTypes = {
  url: PropTypes.string,
  printerType: PropTypes.string,
  onDimensionsChange: PropTypes.func,
  rotation: PropTypes.shape({
    x: PropTypes.number,
    y: PropTypes.number,
    z: PropTypes.number
  }),
  onRotationChange: PropTypes.func
};

export default STLSlicer;
