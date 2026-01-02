import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api, unwrap, clearMissingEndpointCache } from '../services/api';
import { generateSTLThumbnail, getCachedThumbnail, cacheThumbnail } from '../utils/stlThumbnail';
import { useLanguage } from '../i18n';

// Material pricing for quick estimates (same as InstantSTLQuote)
const MATERIAL_PRICES = {
  PLA: { pricePerGram: 0.12, density: 1.24 },
  PETG: { pricePerGram: 0.15, density: 1.27 },
  ABS: { pricePerGram: 0.14, density: 1.04 },
};

// Global lock to prevent concurrent downloads
let isDownloading = false;
let downloadQueue = [];

const waitForDownloadSlot = () => {
  return new Promise(resolve => {
    const check = () => {
      if (!isDownloading) {
        isDownloading = true;
        resolve();
      } else {
        setTimeout(check, 500);
      }
    };
    check();
  });
};

const releaseDownloadSlot = () => {
  isDownloading = false;
};

// Quick STL analysis for pricing preview
const analyzeSTLForPricing = async (fileUrl, fileSizeMb = 0) => {
  try {
    console.log('Analyzing STL:', fileUrl, 'size:', fileSizeMb, 'MB');
    
    // Wait for download slot to avoid rate limiting
    await waitForDownloadSlot();
    
    const response = await fetch(fileUrl);
    releaseDownloadSlot();
    
    if (!response.ok) {
      console.error('Failed to fetch STL:', response.status);
      return estimateFromFileSize(fileSizeMb);
    }
    
    const buffer = await response.arrayBuffer();
    console.log('STL buffer size:', buffer.byteLength);
    
    if (buffer.byteLength < 84) {
      console.error('STL file too small');
      return estimateFromFileSize(fileSizeMb);
    }
    
    const dataView = new DataView(buffer);
    
    // Check if binary STL
    const triangleCount = dataView.getUint32(80, true);
    const expectedSize = 84 + triangleCount * 50;
    const isBinary = buffer.byteLength > 100 && Math.abs(buffer.byteLength - expectedSize) < 1000;
    
    console.log('Triangle count:', triangleCount, 'isBinary:', isBinary);
    
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    let totalVolume = 0;
    let triangles = 0;
    let validVertices = 0;
    
    if (isBinary && triangleCount > 0 && triangleCount < 10000000) {
      triangles = triangleCount;
      let offset = 84;
      const maxTris = Math.min(triangles, 200000);
      
      for (let i = 0; i < maxTris; i++) {
        if (offset + 50 > buffer.byteLength) break;
        
        offset += 12; // Skip normal
        
        const vertices = [];
        for (let v = 0; v < 3; v++) {
          const x = dataView.getFloat32(offset, true);
          const y = dataView.getFloat32(offset + 4, true);
          const z = dataView.getFloat32(offset + 8, true);
          offset += 12;
          
          if (isFinite(x) && isFinite(y) && isFinite(z) && 
              Math.abs(x) < 100000 && Math.abs(y) < 100000 && Math.abs(z) < 100000) {
            vertices.push({ x, y, z });
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            minZ = Math.min(minZ, z);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            maxZ = Math.max(maxZ, z);
            validVertices++;
          }
        }
        offset += 2;
        
        if (vertices.length === 3) {
          const [v0, v1, v2] = vertices;
          const vol = (
            v0.x * (v1.y * v2.z - v2.y * v1.z) -
            v1.x * (v0.y * v2.z - v2.y * v0.z) +
            v2.x * (v0.y * v1.z - v1.y * v0.z)
          ) / 6.0;
          if (isFinite(vol) && Math.abs(vol) < 1e12) {
            totalVolume += vol;
          }
        }
      }
      
      if (maxTris < triangles) {
        totalVolume *= (triangles / maxTris);
      }
    } else {
      // ASCII STL
      const text = new TextDecoder().decode(buffer.slice(0, Math.min(buffer.byteLength, 5000000)));
      const vertexRegex = /vertex\s+([\-\d.e+]+)\s+([\-\d.e+]+)\s+([\-\d.e+]+)/gi;
      let match;
      
      while ((match = vertexRegex.exec(text)) !== null && validVertices < 600000) {
        const x = parseFloat(match[1]);
        const y = parseFloat(match[2]);
        const z = parseFloat(match[3]);
        
        if (isFinite(x) && isFinite(y) && isFinite(z)) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          minZ = Math.min(minZ, z);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          maxZ = Math.max(maxZ, z);
          validVertices++;
        }
      }
      triangles = Math.floor(validVertices / 3);
    }
    
    console.log('Valid vertices:', validVertices, 'Bounds:', { minX, maxX, minY, maxY, minZ, maxZ });
    
    // Check if we got valid bounds
    if (validVertices < 3 || !isFinite(minX) || !isFinite(maxX) || minX >= maxX) {
      console.error('Invalid STL bounds after parsing, using file size fallback');
      return estimateFromFileSize(fileSizeMb);
    }
    
    const width = maxX - minX;
    const depth = maxY - minY;
    const height = maxZ - minZ;
    
    // Volume in cm³
    let volume_cm3 = Math.abs(totalVolume) / 1000;
    
    if (!isFinite(volume_cm3) || volume_cm3 < 0.01) {
      // Fallback: ~30% of bounding box
      volume_cm3 = (width * depth * height * 0.3) / 1000;
    }
    
    // Clamp to reasonable values
    volume_cm3 = Math.max(0.1, Math.min(volume_cm3, 100000));
    
    // Calculate weight & price - REALISTIC PRICING
    // Based on actual quote: 5MB file ≈ €110 before VAT
    const infill = 0.20;
    const shellRatio = 0.25;
    const effectiveVolume = volume_cm3 * shellRatio + volume_cm3 * (1 - shellRatio) * infill;
    const mat = MATERIAL_PRICES.PLA;
    const weight_g = Math.max(1, effectiveVolume * mat.density);
    
    // Pricing: material + labor + setup
    // €0.12/g material + €0.08/g labor/service = €0.20/g effective rate
    // + €8 setup fee
    // + complexity fee for high triangle counts
    const materialCost = weight_g * 0.12;
    const laborCost = weight_g * 0.08;
    const setupFee = 8;
    const complexityFee = triangles > 100000 ? (triangles / 100000) * 5 : 0;
    
    const basePrice = materialCost + laborCost + setupFee + complexityFee;
    const priceBeforeVat = Math.max(10, basePrice);
    const priceWithVat = priceBeforeVat * 1.24;
    
    // Print time
    const layers = Math.max(1, height / 0.2);
    const perimeter = 2 * (width + depth);
    const perimeterTime = (perimeter * 3) / 175;
    const infillArea = Math.max(1, width * depth * infill);
    const infillTime = (infillArea / 0.4) / 250;
    const layerTimeMin = (perimeterTime + infillTime + 1.5);
    const printTimeHours = Math.max(0.1, (layers * layerTimeMin) / 60);
    
    const result = {
      dimensions: { width, depth, height },
      volume_cm3: volume_cm3.toFixed(1),
      weight_g: Math.round(weight_g),
      triangles,
      estimated_price: priceWithVat.toFixed(2),
      estimated_price_no_vat: priceBeforeVat.toFixed(2),
      estimated_time_hours: printTimeHours,
      estimated_time_formatted: printTimeHours >= 1 
        ? `${Math.floor(printTimeHours)}h ${Math.round((printTimeHours % 1) * 60)}m`
        : `${Math.round(printTimeHours * 60)}m`,
    };
    
    console.log('Analysis result:', result);
    return result;
  } catch (err) {
    console.error('STL analysis error:', err);
    releaseDownloadSlot();
    return estimateFromFileSize(fileSizeMb);
  }
};

// Fallback estimation based on file size
// Calibrated to match real quotes: 5MB ≈ €110
const estimateFromFileSize = (sizeMb) => {
  if (!sizeMb || sizeMb <= 0) return null;
  
  // Based on real quote: 5MB file ≈ €110 before VAT
  // So roughly €22/MB for larger files, with minimum €10
  const basePrice = Math.max(10, sizeMb * 22);
  const priceBeforeVat = basePrice;
  const priceWithVat = priceBeforeVat * 1.24;
  
  // Estimate weight: ~100g per MB
  const estimatedWeight = Math.max(5, sizeMb * 100);
  
  // Estimate print time: ~1h per 50g
  const printTimeHours = Math.max(0.25, estimatedWeight / 50);
  
  return {
    dimensions: null,
    volume_cm3: (estimatedWeight / 0.5).toFixed(1),
    weight_g: Math.round(estimatedWeight),
    triangles: Math.round(sizeMb * 20000),
    estimated_price: priceWithVat.toFixed(2),
    estimated_price_no_vat: priceBeforeVat.toFixed(2),
    estimated_time_hours: printTimeHours,
    estimated_time_formatted: printTimeHours >= 1 
      ? `${Math.floor(printTimeHours)}h ${Math.round((printTimeHours % 1) * 60)}m`
      : `${Math.round(printTimeHours * 60)}m`,
    isEstimate: true,
  };
};

/**
 * FileLibrary - Organized file management with real files from API
 * Features: Folders, Tags, Batch Operations, STL Thumbnails
 */
function FileLibrary({ onFileSelect }) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState([]);
  const [fileMetadata, setFileMetadata] = useState({});
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('name');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFileDetails, setShowFileDetails] = useState(null);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [filterTag, setFilterTag] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  
  // Batch selection
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [showBatchTagModal, setShowBatchTagModal] = useState(false);
  const [showBatchMoveModal, setShowBatchMoveModal] = useState(false);
  
  // Thumbnails
  const [thumbnails, setThumbnails] = useState({});
  const [generatingThumbnails, setGeneratingThumbnails] = useState(false);
  
  // STL Analysis for pricing
  const [stlAnalysis, setStlAnalysis] = useState({});
  const [analyzingFiles, setAnalyzingFiles] = useState(false);
  
  const fileInputRef = useRef(null);
  const hasRunInitialLoad = useRef(false);

  const loadData = useCallback(async () => {
    // Clear cached 404s to ensure fresh checks
    clearMissingEndpointCache();
    
    setLoading(true);
    try {
      const res = await api.listSlicingFiles();
      const data = unwrap(res) || {};
      const apiFiles = data.files || [];
      setFiles(apiFiles);

      const savedMetadata = localStorage.getItem('polywerk_file_metadata');
      const savedFolders = localStorage.getItem('polywerk_folders');
      
      setFileMetadata(savedMetadata ? JSON.parse(savedMetadata) : {});
      setFolders(savedFolders ? JSON.parse(savedFolders) : getDefaultFolders());
      
      // Load cached thumbnails
      const cachedThumbs = {};
      apiFiles.forEach(file => {
        const cached = getCachedThumbnail(file.path);
        if (cached) {
          cachedThumbs[file.path] = cached;
        }
      });
      setThumbnails(cachedThumbs);
      
    } catch (err) {
      console.error('Failed to load files:', err);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Generate missing thumbnails for visible STL files
  const generateMissingThumbnails = useCallback(async (fileList) => {
    const stlFiles = fileList.filter(f => {
      const ext = f.name?.split('.').pop()?.toLowerCase();
      return ext === 'stl' && !getCachedThumbnail(f.path);
    });
    
    if (stlFiles.length === 0) return;
    
    console.log('Generating thumbnails for', stlFiles.length, 'files');
    setGeneratingThumbnails(true);
    
    // Process ONE file at a time with download lock
    for (const file of stlFiles.slice(0, 3)) {
      try {
        await waitForDownloadSlot();
        
        const url = api.slicingDownloadUrl(file.path);
        console.log('Fetching thumbnail for:', file.name);
        const thumbnail = await generateSTLThumbnail(url);
        
        releaseDownloadSlot();
        
        if (thumbnail) {
          cacheThumbnail(file.path, thumbnail);
          setThumbnails(prev => ({ ...prev, [file.path]: thumbnail }));
        }
        
        await new Promise(r => setTimeout(r, 1000));
      } catch (err) {
        console.error('Thumbnail generation failed for', file.name, err);
        releaseDownloadSlot();
      }
    }
    
    setGeneratingThumbnails(false);
  }, []);

  // Analyze STL files for pricing (cached in localStorage)
  const analyzeSTLFiles = useCallback(async (fileList) => {
    const stlFiles = fileList.filter(f => {
      const ext = f.name?.split('.').pop()?.toLowerCase();
      return ext === 'stl';
    });
    
    if (stlFiles.length === 0) return;
    
    // Load cached analysis from localStorage
    const cached = localStorage.getItem('polywerk_stl_analysis');
    let cachedAnalysis = cached ? JSON.parse(cached) : {};
    
    // Clear invalid cached entries
    let hasBadCache = false;
    Object.keys(cachedAnalysis).forEach(key => {
      const entry = cachedAnalysis[key];
      if (!entry || !entry.weight_g || entry.weight_g < 0 || !isFinite(entry.weight_g) ||
          (typeof entry.estimated_time_formatted === 'string' && entry.estimated_time_formatted.includes('Infinity'))) {
        delete cachedAnalysis[key];
        hasBadCache = true;
      }
    });
    
    if (hasBadCache) {
      console.log('Cleared invalid STL analysis cache');
      localStorage.setItem('polywerk_stl_analysis', JSON.stringify(cachedAnalysis));
    }
    
    // Apply cached data first
    const updatedAnalysis = {};
    stlFiles.forEach(f => {
      if (cachedAnalysis[f.path]) {
        updatedAnalysis[f.path] = cachedAnalysis[f.path];
      }
    });
    if (Object.keys(updatedAnalysis).length > 0) {
      setStlAnalysis(prev => ({ ...prev, ...updatedAnalysis }));
    }
    
    // Find files that need analysis
    const needsAnalysis = stlFiles.filter(f => !cachedAnalysis[f.path]);
    
    if (needsAnalysis.length === 0) {
      console.log('All STL files already cached');
      return;
    }
    
    console.log('Analyzing', needsAnalysis.length, 'STL files for pricing');
    setAnalyzingFiles(true);
    
    for (const file of needsAnalysis.slice(0, 3)) {
      try {
        const url = api.slicingDownloadUrl(file.path);
        console.log('Analyzing:', file.name);
        const analysis = await analyzeSTLForPricing(url, file.size_mb || 0);
        
        if (analysis && analysis.weight_g > 0 && isFinite(analysis.weight_g)) {
          cachedAnalysis[file.path] = analysis;
          setStlAnalysis(prev => ({ ...prev, [file.path]: analysis }));
        }
        
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        console.error('Analysis failed for', file.name, err);
      }
    }
    
    localStorage.setItem('polywerk_stl_analysis', JSON.stringify(cachedAnalysis));
    setAnalyzingFiles(false);
  }, []);

  // Run thumbnail generation and analysis ONCE when files first load
  useEffect(() => {
    if (files.length > 0 && !loading && !hasRunInitialLoad.current) {
      hasRunInitialLoad.current = true;
      console.log('Running initial STL processing for', files.length, 'files');
      
      // Run sequentially: thumbnails first, then analysis
      (async () => {
        await generateMissingThumbnails(files);
        await analyzeSTLFiles(files);
      })();
    }
  }, [files, loading, generateMissingThumbnails, analyzeSTLFiles]);

  const saveMetadata = (newMetadata) => {
    localStorage.setItem('polywerk_file_metadata', JSON.stringify(newMetadata));
    setFileMetadata(newMetadata);
  };

  const saveFolders = (newFolders) => {
    localStorage.setItem('polywerk_folders', JSON.stringify(newFolders));
    setFolders(newFolders);
  };

  const getDefaultFolders = () => [
    { id: 'folder-clients', name: 'Client Projects', icon: '👥', color: '#a855f7' },
    { id: 'folder-internal', name: 'Internal', icon: '🏠', color: '#06b6d4' },
    { id: 'folder-templates', name: 'Templates', icon: '📋', color: '#22c55e' },
    { id: 'folder-archive', name: 'Archive', icon: '📦', color: '#64748b' },
  ];

  const getFileMeta = (filePath) => {
    return fileMetadata[filePath] || {
      folder_id: null,
      tags: [],
      versions: [],
      print_count: 0,
      last_printed: null,
      notes: '',
    };
  };

  const updateFileMeta = (filePath, updates) => {
    const currentMeta = getFileMeta(filePath);
    const newMetadata = {
      ...fileMetadata,
      [filePath]: { ...currentMeta, ...updates },
    };
    saveMetadata(newMetadata);
  };

  // ============ BATCH OPERATIONS ============
  
  const toggleFileSelection = (filePath) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(filePath)) {
      newSelection.delete(filePath);
    } else {
      newSelection.add(filePath);
    }
    setSelectedFiles(newSelection);
  };

  const selectAll = () => {
    const allPaths = filteredFiles.map(f => f.path);
    setSelectedFiles(new Set(allPaths));
  };

  const clearSelection = () => {
    setSelectedFiles(new Set());
    setSelectionMode(false);
  };

  const batchMove = (folderId) => {
    selectedFiles.forEach(path => {
      updateFileMeta(path, { folder_id: folderId });
    });
    clearSelection();
    setShowBatchMoveModal(false);
  };

  const batchAddTag = (tag) => {
    selectedFiles.forEach(path => {
      const meta = getFileMeta(path);
      if (!meta.tags.includes(tag)) {
        updateFileMeta(path, { tags: [...meta.tags, tag] });
      }
    });
    setShowBatchTagModal(false);
  };

  const batchDelete = async () => {
    if (!window.confirm(`${t('common.delete')} ${selectedFiles.size} ${t('files.title').toLowerCase()}?`)) return;
    
    // Delete files from server
    for (const path of selectedFiles) {
      try {
        await api.deleteSlicingFile(path);
      } catch (err) {
        console.error('Failed to delete file:', path, err);
      }
    }
    
    // Clean up local metadata
    const newMetadata = { ...fileMetadata };
    selectedFiles.forEach(path => {
      delete newMetadata[path];
    });
    saveMetadata(newMetadata);
    clearSelection();
    loadData();
  };

  const batchPrint = () => {
    const selectedArray = Array.from(selectedFiles);
    if (selectedArray.length > 0 && onFileSelect) {
      const firstFile = files.find(f => f.path === selectedArray[0]);
      if (firstFile) onFileSelect(firstFile);
    }
    clearSelection();
  };

  // ============ FILE OPERATIONS ============

  const handleFileUpload = async (e) => {
    const uploadedFiles = Array.from(e.target.files);
    if (uploadedFiles.length === 0) return;

    setUploadProgress({ current: 0, total: uploadedFiles.length });

    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      setUploadProgress({ current: i + 1, total: uploadedFiles.length, name: file.name });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('layer_height', '0.2');

      try {
        const res = await api.uploadSlicingFile(formData);
        const data = unwrap(res) || {};
        
        if (data.file_path) {
          updateFileMeta(data.file_path, {
            folder_id: currentFolder,
            tags: [],
            versions: [{ 
              version: 1, 
              date: new Date().toISOString().split('T')[0], 
              notes: 'Initial upload',
            }],
          });
        }
      } catch (err) {
        console.error('Upload failed:', file.name, err);
      }
    }

    setUploadProgress(null);
    loadData();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreateFolder = (name, icon, color) => {
    const newFolder = {
      id: `folder-${Date.now()}`,
      name,
      icon: icon || '📁',
      color: color || '#64748b',
    };
    saveFolders([...folders, newFolder]);
    setShowNewFolderModal(false);
  };

  const handleDeleteFolder = (folderId) => {
    if (window.confirm(t('files.deleteFolder'))) {
      const updated = { ...fileMetadata };
      Object.keys(updated).forEach(path => {
        if (updated[path].folder_id === folderId) {
          updated[path].folder_id = null;
        }
      });
      saveMetadata(updated);
      saveFolders(folders.filter(f => f.id !== folderId));
      if (currentFolder === folderId) setCurrentFolder(null);
    }
  };

  const handleMoveFile = (filePath, targetFolderId) => {
    updateFileMeta(filePath, { folder_id: targetFolderId });
  };

  const handleAddTag = (filePath, tag) => {
    const meta = getFileMeta(filePath);
    if (!meta.tags.includes(tag)) {
      updateFileMeta(filePath, { tags: [...meta.tags, tag] });
    }
  };

  const handleRemoveTag = (filePath, tag) => {
    const meta = getFileMeta(filePath);
    updateFileMeta(filePath, { tags: meta.tags.filter(t => t !== tag) });
  };

  // ============ FILTERING & SORTING ============

  const filesWithMeta = files.map(file => ({
    ...file,
    meta: getFileMeta(file.path),
    thumbnail: thumbnails[file.path] || null,
    analysis: stlAnalysis[file.path] || null,
  }));

  const filteredFiles = filesWithMeta
    .filter(f => !currentFolder || f.meta.folder_id === currentFolder)
    .filter(f => !searchTerm || 
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.meta.tags.some(tg => tg.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .filter(f => !filterTag || f.meta.tags.includes(filterTag))
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'size') return (b.size_mb || 0) - (a.size_mb || 0);
      if (sortBy === 'prints') return (b.meta.print_count || 0) - (a.meta.print_count || 0);
      return a.name.localeCompare(b.name);
    });

  const allTags = [...new Set(Object.values(fileMetadata).flatMap(m => m.tags || []))];

  const folderCounts = folders.reduce((acc, folder) => {
    acc[folder.id] = filesWithMeta.filter(f => f.meta.folder_id === folder.id).length;
    return acc;
  }, {});

  const formatFileSize = (sizeMb) => {
    if (!sizeMb) return '-';
    if (sizeMb < 1) return `${(sizeMb * 1024).toFixed(0)} KB`;
    return `${sizeMb.toFixed(1)} MB`;
  };

  const getFileIcon = (name) => {
    const ext = name?.split('.').pop()?.toLowerCase();
    const icons = { stl: '🔷', obj: '🔶', step: '⬡', stp: '⬡', '3mf': '📦', gcode: '📄' };
    return icons[ext] || '📁';
  };

  const isSTLFile = (name) => {
    const ext = name?.split('.').pop()?.toLowerCase();
    return ext === 'stl';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upload Progress */}
      {uploadProgress && (
        <div className="p-4 rounded-xl border bg-purple-500/10 border-purple-500/30">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="flex-1">
              <p className="text-sm font-medium text-purple-400">
                {t('files.uploading')} {uploadProgress.current}/{uploadProgress.total}
              </p>
              <p className="text-xs text-purple-400/70">{uploadProgress.name}</p>
            </div>
          </div>
        </div>
      )}

      {/* Thumbnail Generation Indicator */}
      {generatingThumbnails && (
        <div className="p-3 rounded-xl border bg-cyan-500/10 border-cyan-500/30 flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-cyan-400">{t('files.generatingPreviews')}</span>
        </div>
      )}

      {/* STL Analysis Indicator */}
      {analyzingFiles && (
        <div className="p-3 rounded-xl border bg-purple-500/10 border-purple-500/30 flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-purple-400">💰 Analysing STL prices...</span>
        </div>
      )}

      {/* Batch Selection Bar */}
      {selectedFiles.size > 0 && (
        <div 
          className="p-3 rounded-xl border flex flex-wrap items-center gap-3 sticky top-0 z-20"
          style={{ backgroundColor: '#7c3aed', borderColor: '#8b5cf6' }}
        >
          <span className="text-white font-medium">
            {selectedFiles.size} {t('common.selected')}
          </span>
          <div className="flex-1" />
          <button
            onClick={() => setShowBatchMoveModal(true)}
            className="px-3 py-1.5 rounded-lg text-sm bg-white/20 text-white hover:bg-white/30"
          >
            📁 {t('files.move')}
          </button>
          <button
            onClick={() => setShowBatchTagModal(true)}
            className="px-3 py-1.5 rounded-lg text-sm bg-white/20 text-white hover:bg-white/30"
          >
            🏷️ {t('files.tag')}
          </button>
          <button
            onClick={batchPrint}
            className="px-3 py-1.5 rounded-lg text-sm bg-white/20 text-white hover:bg-white/30"
          >
            🖨️ {t('common.print')}
          </button>
          <button
            onClick={batchDelete}
            className="px-3 py-1.5 rounded-lg text-sm bg-red-500/50 text-white hover:bg-red-500/70"
          >
            🗑️ {t('common.delete')}
          </button>
          <button
            onClick={clearSelection}
            className="px-3 py-1.5 rounded-lg text-sm text-white/70 hover:text-white"
          >
            ✕ {t('common.cancel')}
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            📁 {t('files.title')}
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            {files.length} {t('files.filesCount')} • {folders.length} {t('files.foldersCount')}
            {Object.keys(thumbnails).length > 0 && (
              <span className="text-cyan-400 ml-2">• {Object.keys(thumbnails).length} {t('files.previews')}</span>
            )}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              // Force clear ALL STL analysis cache and re-analyze
              console.log('Force clearing STL analysis cache...');
              localStorage.removeItem('polywerk_stl_analysis');
              setStlAnalysis({});
              // Reset the ref so it runs again
              hasRunInitialLoad.current = false;
              // Trigger reload
              loadData();
            }}
            className="px-3 py-2 rounded-lg text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/10 text-sm flex items-center gap-2"
            title="Clear price cache and re-analyze"
          >
            💰 Uuenda hinnad
          </button>
          <button
            onClick={() => {
              setSelectionMode(!selectionMode);
              if (selectionMode) clearSelection();
            }}
            className={`px-3 py-2 rounded-lg text-sm border transition ${
              selectionMode 
                ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' 
                : 'text-slate-400 border-slate-600 hover:bg-slate-700'
            }`}
          >
            ☑️ {t('common.select')}
          </button>
          <button
            onClick={() => setShowNewFolderModal(true)}
            className="px-3 py-2 rounded-lg text-slate-400 border border-slate-600 hover:bg-slate-700 text-sm"
          >
            📁 {t('files.newFolder')}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-lg font-medium text-white text-sm"
            style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
          >
            ⬆️ {t('files.upload')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".stl,.obj,.3mf,.step,.stp,.gcode,.STL,.OBJ,.3MF,.STEP,.STP,.GCODE"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Folders */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCurrentFolder(null)}
          className={`px-3 py-2 rounded-lg text-sm transition flex items-center gap-2 ${
            !currentFolder 
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
              : 'text-slate-400 hover:text-white bg-slate-800'
          }`}
        >
          🏠 {t('files.allFiles')}
          <span className="text-xs opacity-60">({files.length})</span>
        </button>
        {folders.map(folder => (
          <div
            key={folder.id}
            onClick={() => setCurrentFolder(folder.id)}
            className={`px-3 py-2 rounded-lg text-sm transition flex items-center gap-2 group cursor-pointer ${
              currentFolder === folder.id 
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
                : 'text-slate-400 hover:text-white bg-slate-800'
            }`}
          >
            {folder.icon} {folder.name}
            <span className="text-xs opacity-60">({folderCounts[folder.id] || 0})</span>
            <span
              onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }}
              className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 ml-1 cursor-pointer"
            >
              ✕
            </span>
          </div>
        ))}
      </div>

      {/* Search, Filter, View */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={`${t('common.search')}...`}
          className="flex-1 px-4 py-2 rounded-lg text-white text-sm"
          style={{ backgroundColor: '#334155' }}
        />
        
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2 rounded-lg text-white text-sm"
          style={{ backgroundColor: '#334155' }}
        >
          <option value="name">{t('files.sortName')}</option>
          <option value="size">{t('files.sortSize')}</option>
          <option value="prints">{t('files.sortPrints')}</option>
        </select>

        <div className="flex gap-1 p-1 rounded-lg bg-slate-800">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1 rounded text-sm ${viewMode === 'grid' ? 'bg-purple-500 text-white' : 'text-slate-400'}`}
          >
            ⊞
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1 rounded text-sm ${viewMode === 'list' ? 'bg-purple-500 text-white' : 'text-slate-400'}`}
          >
            ☰
          </button>
        </div>

        {selectionMode && filteredFiles.length > 0 && (
          <button
            onClick={selectAll}
            className="px-3 py-2 rounded-lg text-purple-400 text-sm hover:bg-purple-500/10"
          >
            {t('common.selectAll')} ({filteredFiles.length})
          </button>
        )}

        <button
          onClick={() => {
            hasRunInitialLoad.current = false;
            loadData();
          }}
          className="px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
          title={t('common.refresh')}
        >
          🔄
        </button>
      </div>

      {/* Tags Filter */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-slate-500">{t('files.tags')}:</span>
          {allTags.slice(0, 10).map(tag => (
            <button
              key={tag}
              onClick={() => setFilterTag(filterTag === tag ? null : tag)}
              className={`px-2 py-0.5 rounded-full text-xs transition ${
                filterTag === tag
                  ? 'bg-purple-500 text-white'
                  : 'bg-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              #{tag}
            </button>
          ))}
          {filterTag && (
            <button
              onClick={() => setFilterTag(null)}
              className="px-2 py-0.5 rounded-full text-xs text-red-400 hover:text-red-300"
            >
              ✕ {t('common.clear')}
            </button>
          )}
        </div>
      )}

      {/* Files Display */}
      {filteredFiles.length === 0 ? (
        <div 
          className="p-12 text-center rounded-xl border"
          style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
        >
          <p className="text-4xl mb-3">📭</p>
          <p className="text-slate-400 mb-4">
            {files.length === 0 ? t('files.noFiles') : t('files.noMatches')}
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-purple-400 hover:text-purple-300"
          >
            {t('files.uploadFirst')} →
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredFiles.map(file => {
            const hasAnalysis = file.analysis && isSTLFile(file.name) && file.analysis.weight_g > 0;
            
            return (
              <div
                key={file.path}
                onClick={() => selectionMode ? toggleFileSelection(file.path) : setShowFileDetails(file)}
                className={`rounded-2xl border cursor-pointer transition group relative overflow-hidden ${
                  selectedFiles.has(file.path)
                    ? 'border-purple-500 bg-purple-500/10 ring-2 ring-purple-500/50'
                    : 'hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10'
                }`}
                style={{ backgroundColor: '#1e293b', borderColor: selectedFiles.has(file.path) ? '#a855f7' : '#334155' }}
              >
                {/* Selection Checkbox */}
                {selectionMode && (
                  <div className={`absolute top-3 left-3 w-6 h-6 rounded-lg border-2 flex items-center justify-center z-10 ${
                    selectedFiles.has(file.path) 
                      ? 'bg-purple-500 border-purple-500' 
                      : 'border-slate-500 bg-slate-800/80 backdrop-blur'
                  }`}>
                    {selectedFiles.has(file.path) && <span className="text-white text-sm">✓</span>}
                  </div>
                )}
                
                {/* Large Thumbnail */}
                <div 
                  className="aspect-square flex items-center justify-center overflow-hidden"
                  style={{ backgroundColor: '#0f172a' }}
                >
                  {file.thumbnail && isSTLFile(file.name) ? (
                    <img 
                      src={file.thumbnail} 
                      alt={file.name}
                      className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <span className="text-6xl opacity-40">{getFileIcon(file.name)}</span>
                  )}
                </div>
                
                {/* Info Section */}
                <div className="p-4">
                  <p className="text-sm font-medium text-white truncate mb-1" title={file.name}>
                    {file.name}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                    <span>{formatFileSize(file.size_mb)}</span>
                    {file.meta.tags?.length > 0 && (
                      <span className="text-purple-400">🏷️ {file.meta.tags.length}</span>
                    )}
                  </div>
                  
                  {/* STL Pricing Preview - Better Layout */}
                  {hasAnalysis ? (
                    <div className={`p-3 rounded-xl border ${file.analysis.isOrderPrice 
                      ? 'bg-gradient-to-r from-green-500/10 to-cyan-500/10 border-green-500/30'
                      : file.analysis.isEstimate 
                        ? 'bg-slate-800/50 border-slate-700' 
                        : 'bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border-cyan-500/20'}`}
                    >
                      {/* Price without VAT */}
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-lg font-bold text-white">
                          {file.analysis.isEstimate ? '~' : ''}€{file.analysis.estimated_price_no_vat}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${file.analysis.isOrderPrice
                          ? 'text-green-400 bg-green-500/20'
                          : file.analysis.isEstimate 
                            ? 'text-slate-400 bg-slate-700' 
                            : 'text-slate-400 bg-slate-800'}`}
                        >
                          {file.analysis.isOrderPrice ? '✓ tellimus' : file.analysis.isEstimate ? 'hinnang' : 'ilma KM'}
                        </span>
                      </div>
                      {/* VAT line */}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2">
                        <span>+ KM 24%</span>
                        <span className="text-cyan-400 font-medium">€{file.analysis.estimated_price}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="p-1.5 rounded-lg bg-slate-800/50">
                          <p className="text-xs font-medium text-purple-400">{file.analysis.estimated_time_formatted}</p>
                          <p className="text-[10px] text-slate-500">aeg</p>
                        </div>
                        <div className="p-1.5 rounded-lg bg-slate-800/50">
                          <p className="text-xs font-medium text-white">{file.analysis.weight_g}g</p>
                          <p className="text-[10px] text-slate-500">kaal</p>
                        </div>
                      </div>
                      {file.analysis.dimensions && (
                        <p className="text-[10px] text-slate-500 text-center mt-2">
                          📏 {file.analysis.dimensions.width.toFixed(0)}×{file.analysis.dimensions.depth.toFixed(0)}×{file.analysis.dimensions.height.toFixed(0)}mm
                        </p>
                      )}
                    </div>
                  ) : isSTLFile(file.name) ? (
                    <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700 text-center">
                      <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin mx-auto mb-1"></div>
                      <p className="text-[10px] text-slate-500">Analüüsin...</p>
                    </div>
                  ) : null}
                  
                  {file.meta.print_count > 0 && (
                    <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                      🖨️ {file.meta.print_count}× prinditud
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div 
          className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
        >
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: '#334155' }}>
                {selectionMode && <th className="w-10 px-3 py-3"></th>}
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">{t('common.name')}</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400 hidden sm:table-cell">{t('files.size')}</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-cyan-400 hidden md:table-cell">Hind</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-purple-400 hidden lg:table-cell">Aeg</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400 hidden xl:table-cell">{t('files.tags')}</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#334155' }}>
              {filteredFiles.map(file => (
                <tr 
                  key={file.path}
                  onClick={() => selectionMode ? toggleFileSelection(file.path) : setShowFileDetails(file)}
                  className={`cursor-pointer transition ${
                    selectedFiles.has(file.path) ? 'bg-purple-500/10' : 'hover:bg-slate-800/50'
                  }`}
                >
                  {selectionMode && (
                    <td className="px-3 py-3">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        selectedFiles.has(file.path) 
                          ? 'bg-purple-500 border-purple-500' 
                          : 'border-slate-500'
                      }`}>
                        {selectedFiles.has(file.path) && <span className="text-white text-xs">✓</span>}
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {file.thumbnail && isSTLFile(file.name) ? (
                        <img src={file.thumbnail} alt="" className="w-8 h-8 rounded object-contain bg-slate-900" />
                      ) : (
                        <span className="text-xl">{getFileIcon(file.name)}</span>
                      )}
                      <span className="font-medium text-white truncate">{file.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-sm hidden sm:table-cell">
                    {formatFileSize(file.size_mb)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm hidden md:table-cell">
                    {file.analysis && file.analysis.weight_g > 0 ? (
                      <div>
                        <span className="text-white font-medium">
                          {file.analysis.isEstimate ? '~' : ''}€{file.analysis.estimated_price_no_vat}
                        </span>
                        <span className="text-[10px] text-cyan-400 block">
                          +KM €{(parseFloat(file.analysis.estimated_price) - parseFloat(file.analysis.estimated_price_no_vat)).toFixed(2)}
                        </span>
                      </div>
                    ) : isSTLFile(file.name) ? (
                      <div className="w-3 h-3 border border-slate-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm hidden lg:table-cell">
                    {file.analysis && file.analysis.weight_g > 0 ? (
                      <span className="text-purple-400">{file.analysis.estimated_time_formatted}</span>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    <div className="flex gap-1">
                      {file.meta.tags?.slice(0, 2).map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 rounded text-xs bg-slate-700 text-slate-400">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* File Details Modal */}
      {showFileDetails && (
        <FileDetailsModal
          file={showFileDetails}
          folders={folders}
          t={t}
          onClose={() => setShowFileDetails(null)}
          onMove={(folderId) => {
            handleMoveFile(showFileDetails.path, folderId);
            setShowFileDetails({ ...showFileDetails, meta: { ...showFileDetails.meta, folder_id: folderId } });
          }}
          onAddTag={(tag) => {
            handleAddTag(showFileDetails.path, tag);
            setShowFileDetails({ 
              ...showFileDetails, 
              meta: { ...showFileDetails.meta, tags: [...(showFileDetails.meta.tags || []), tag] } 
            });
          }}
          onRemoveTag={(tag) => {
            handleRemoveTag(showFileDetails.path, tag);
            setShowFileDetails({ 
              ...showFileDetails, 
              meta: { ...showFileDetails.meta, tags: showFileDetails.meta.tags.filter(tg => tg !== tag) } 
            });
          }}
          onDelete={async () => {
            if (!window.confirm(t('files.confirmDelete'))) return;
            try {
              await api.deleteSlicingFile(showFileDetails.path);
              // Clean up local metadata
              const newMetadata = { ...fileMetadata };
              delete newMetadata[showFileDetails.path];
              saveMetadata(newMetadata);
              setShowFileDetails(null);
              loadData();
            } catch (err) {
              console.error('Failed to delete file:', err);
              alert(t('files.deleteFailed'));
            }
          }}
          onSelect={() => {
            onFileSelect?.(showFileDetails);
            setShowFileDetails(null);
          }}
          getFileIcon={getFileIcon}
          formatFileSize={formatFileSize}
        />
      )}

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <NewFolderModal
          t={t}
          onClose={() => setShowNewFolderModal(false)}
          onCreate={handleCreateFolder}
        />
      )}

      {/* Batch Move Modal */}
      {showBatchMoveModal && (
        <BatchMoveModal
          folders={folders}
          selectedCount={selectedFiles.size}
          t={t}
          onMove={batchMove}
          onClose={() => setShowBatchMoveModal(false)}
        />
      )}

      {/* Batch Tag Modal */}
      {showBatchTagModal && (
        <BatchTagModal
          existingTags={allTags}
          selectedCount={selectedFiles.size}
          t={t}
          onAddTag={batchAddTag}
          onClose={() => setShowBatchTagModal(false)}
        />
      )}
    </div>
  );
}

// ============ MODAL COMPONENTS ============

function FileDetailsModal({ file, folders, t, onClose, onMove, onAddTag, onRemoveTag, onDelete, onSelect, getFileIcon, formatFileSize }) {
  const [newTag, setNewTag] = useState('');
  const [activeTab, setActiveTab] = useState('info');

  const isSTL = file.name?.split('.').pop()?.toLowerCase() === 'stl';
  const analysis = file.analysis;
  const hasValidAnalysis = analysis && analysis.weight_g > 0 && isFinite(analysis.weight_g);
  const dims = hasValidAnalysis ? analysis.dimensions : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        className="relative w-full max-w-4xl max-h-[95vh] overflow-hidden rounded-2xl border shadow-2xl flex flex-col"
        style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-slate-900/50" style={{ borderColor: '#334155' }}>
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-purple-500/30">
              {file.thumbnail && isSTL ? (
                <img src={file.thumbnail} alt="" className="w-10 h-10 rounded-lg object-contain" />
              ) : (
                <span className="text-2xl">{getFileIcon(file.name)}</span>
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-white truncate">{file.name}</h2>
              <p className="text-sm text-slate-400">
                {formatFileSize(file.size_mb)}
                {hasValidAnalysis && ` • ${(analysis.triangles || 0).toLocaleString()} triangles`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 text-xl">✕</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
            
            {/* Left: Large Preview */}
            <div className="p-6 flex flex-col items-center justify-center bg-slate-900/30" style={{ minHeight: '400px' }}>
              <div 
                className="w-full aspect-square max-w-[350px] rounded-2xl flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-700"
                style={{ backgroundColor: '#0a0f1a' }}
              >
                {file.thumbnail && isSTL ? (
                  <img 
                    src={file.thumbnail} 
                    alt={file.name} 
                    className="max-w-full max-h-full object-contain p-4"
                    style={{ imageRendering: 'crisp-edges' }}
                  />
                ) : (
                  <span className="text-9xl opacity-50">{getFileIcon(file.name)}</span>
                )}
              </div>
              
              {/* Dimensions under preview */}
              {dims && (
                <div className="mt-4 text-center">
                  <p className="text-xl font-bold text-white">
                    {dims.width.toFixed(1)} × {dims.depth.toFixed(1)} × {dims.height.toFixed(1)} mm
                  </p>
                  <p className="text-sm text-slate-500">Mõõtmed (L × W × H)</p>
                </div>
              )}
            </div>

            {/* Right: Info & Actions */}
            <div className="p-6 space-y-5">
              
              {/* Big Price Card */}
              {hasValidAnalysis && isSTL ? (
                <div className={`p-5 rounded-2xl border ${analysis.isOrderPrice 
                  ? 'bg-gradient-to-br from-green-500/10 to-cyan-500/10 border-green-500/30'
                  : analysis.isEstimate 
                    ? 'bg-slate-800/50 border-slate-700' 
                    : 'bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border-cyan-500/30'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400">
                      {analysis.isOrderPrice 
                        ? `Tellimuse hind (${analysis.orderSettings || 'tegelik'})` 
                        : analysis.isEstimate 
                          ? 'Ligikaudne hinnang (faili suurus)' 
                          : 'Ligikaudne hind (PLA, 20% infill)'}
                    </span>
                    {analysis.isOrderPrice ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400">✓ tellimus</span>
                    ) : analysis.isEstimate && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-slate-700 text-slate-400">hinnang</span>
                    )}
                  </div>
                  
                  {/* Price without VAT - large */}
                  <div className="text-center mb-2">
                    <p className="text-4xl font-bold text-white">
                      {analysis.isEstimate ? '~' : ''}€{analysis.estimated_price_no_vat}
                    </p>
                    <p className="text-xs text-slate-500">ilma KM</p>
                  </div>
                  
                  {/* VAT breakdown */}
                  <div className="flex items-center justify-center gap-4 mb-4 text-sm">
                    <span className="text-slate-500">+ KM 24%</span>
                    <span className="text-cyan-400 font-bold text-lg">
                      = €{analysis.estimated_price}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-700">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-purple-400">{analysis.estimated_time_formatted}</p>
                      <p className="text-xs text-slate-500">Printimisaeg</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-white">{analysis.weight_g}g</p>
                      <p className="text-xs text-slate-500">Kaal</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-slate-300">{analysis.volume_cm3} cm³</p>
                      <p className="text-xs text-slate-500">Maht</p>
                    </div>
                  </div>
                </div>
              ) : isSTL ? (
                <div className="p-5 rounded-2xl bg-slate-800/30 border border-slate-700 text-center">
                  <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-sm text-slate-400">Analüüsin hinda...</p>
                  <p className="text-xs text-slate-600 mt-1">Vajuta "💰 Uuenda hinnad" kui see jääb liiga kauaks</p>
                </div>
              ) : null}

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700">
                  <p className="text-xs text-slate-500">{t('files.printCount')}</p>
                  <p className="text-lg font-bold text-white">{file.meta.print_count || 0}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700">
                  <p className="text-xs text-slate-500">{t('files.lastPrinted')}</p>
                  <p className="text-lg font-bold text-white">{file.meta.last_printed || '-'}</p>
                </div>
              </div>

              {/* Folder & Tags */}
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-500 mb-2">{t('files.folder')}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => onMove(null)}
                      className={`px-3 py-1.5 rounded-lg text-sm ${!file.meta.folder_id ? 'bg-purple-500/20 text-purple-400 border border-purple-500' : 'bg-slate-800 text-slate-400'}`}
                    >
                      🏠 Root
                    </button>
                    {folders.slice(0, 4).map(folder => (
                      <button
                        key={folder.id}
                        onClick={() => onMove(folder.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm ${file.meta.folder_id === folder.id ? 'bg-purple-500/20 text-purple-400 border border-purple-500' : 'bg-slate-800 text-slate-400'}`}
                      >
                        {folder.icon} {folder.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-slate-500 mb-2">{t('files.tags')}</p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {(file.meta.tags || []).map(tag => (
                      <span key={tag} className="px-2 py-1 rounded-full text-xs bg-purple-500/20 text-purple-400 flex items-center gap-1">
                        #{tag}
                        <button onClick={() => onRemoveTag(tag)} className="hover:text-red-400 ml-1">✕</button>
                      </span>
                    ))}
                    {(!file.meta.tags || file.meta.tags.length === 0) && (
                      <span className="text-sm text-slate-600">No tags</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newTag.trim()) {
                          onAddTag(newTag.trim().toLowerCase());
                          setNewTag('');
                        }
                      }}
                      placeholder="Lisa tag..."
                      className="flex-1 px-3 py-2 rounded-lg text-sm text-white bg-slate-800 border border-slate-700"
                    />
                    <button
                      onClick={() => { if (newTag.trim()) { onAddTag(newTag.trim().toLowerCase()); setNewTag(''); }}}
                      className="px-3 py-2 rounded-lg text-purple-400 bg-purple-500/10 hover:bg-purple-500/20"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* File Path */}
              <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700">
                <p className="text-xs text-slate-500 mb-1">{t('files.filePath')}</p>
                <p className="text-sm text-slate-300 font-mono truncate" title={file.path}>{file.path}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t bg-slate-900/50 flex flex-wrap gap-3" style={{ borderColor: '#334155' }}>
          <button
            onClick={onSelect}
            className="flex-1 py-3 rounded-xl font-medium text-white text-sm flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
          >
            🖨️ Ava sliceris
          </button>
          
          {isSTL && (
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('openQuoteWithFile', { detail: file }));
                onClose();
              }}
              className="flex-1 py-3 rounded-xl font-medium text-cyan-400 text-sm border-2 border-cyan-500/50 hover:bg-cyan-500/10 flex items-center justify-center gap-2"
            >
              💰 Täpne hinnapakkumine
            </button>
          )}
          
          <a
            href={api.slicingDownloadUrl(file.path)}
            download
            className="px-5 py-3 rounded-xl text-slate-300 border border-slate-600 hover:bg-slate-800 text-sm flex items-center gap-2"
          >
            ⬇️ Lae alla
          </a>
          
          <button
            onClick={onDelete}
            className="px-5 py-3 rounded-xl text-red-400 border border-red-500/30 hover:bg-red-500/10 text-sm flex items-center gap-2"
          >
            🗑️ Kustuta
          </button>
        </div>
      </div>
    </div>
  );
}

function NewFolderModal({ t, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📁');

  const icons = ['📁', '👥', '🏠', '📋', '📦', '⭐', '🔒', '🎨', '🔧', '💼'];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) onCreate(name.trim(), icon);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-xl border shadow-2xl" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#334155' }}>
          <h3 className="font-bold text-white">{t('files.newFolder')}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">{t('files.folderName')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('files.folderName')}
              className="w-full px-3 py-2 rounded-lg text-white"
              style={{ backgroundColor: '#334155' }}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">{t('common.icon')}</label>
            <div className="flex flex-wrap gap-2">
              {icons.map(i => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIcon(i)}
                  className={`w-10 h-10 rounded-lg text-xl transition ${
                    icon === i ? 'bg-purple-500/20 ring-2 ring-purple-500' : 'bg-slate-700'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg text-slate-300 border border-slate-600 hover:bg-slate-700">
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 py-2 rounded-lg font-medium text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
            >
              {t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BatchMoveModal({ folders, selectedCount, t, onMove, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-xl border shadow-2xl" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#334155' }}>
          <h3 className="font-bold text-white">{t('files.move')} {selectedCount} {t('files.filesCount')}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <div className="p-6 space-y-2">
          <button
            onClick={() => onMove(null)}
            className="w-full px-4 py-3 rounded-lg text-left bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center gap-3"
          >
            🏠 Root
          </button>
          {folders.map(folder => (
            <button
              key={folder.id}
              onClick={() => onMove(folder.id)}
              className="w-full px-4 py-3 rounded-lg text-left bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center gap-3"
            >
              {folder.icon} {folder.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BatchTagModal({ existingTags, selectedCount, t, onAddTag, onClose }) {
  const [newTag, setNewTag] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-xl border shadow-2xl" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#334155' }}>
          <h3 className="font-bold text-white">{t('files.tag')} {selectedCount} {t('files.filesCount')}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTag.trim()) {
                  onAddTag(newTag.trim().toLowerCase());
                  setNewTag('');
                }
              }}
              placeholder={`${t('common.add')} ${t('files.tag').toLowerCase()}...`}
              className="flex-1 px-3 py-2 rounded-lg text-white"
              style={{ backgroundColor: '#334155' }}
              autoFocus
            />
            <button
              onClick={() => {
                if (newTag.trim()) {
                  onAddTag(newTag.trim().toLowerCase());
                  setNewTag('');
                }
              }}
              className="px-4 py-2 rounded-lg font-medium text-white"
              style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
            >
              {t('common.add')}
            </button>
          </div>
          
          {existingTags.length > 0 && (
            <>
              <p className="text-sm text-slate-500">{t('files.existingTags')}:</p>
              <div className="flex flex-wrap gap-2">
                {existingTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => onAddTag(tag)}
                    className="px-3 py-1.5 rounded-full text-sm bg-slate-700 text-slate-300 hover:bg-purple-500/20 hover:text-purple-400"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default FileLibrary;
