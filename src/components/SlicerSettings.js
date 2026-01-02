import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';

/**
 * OrcaSlicer Configuration Component
 * 
 * Allows users to:
 * - View slicer detection status
 * - Manually set slicer path
 * - Re-detect slicer installation
 * - Test slicing with a sample file
 * - Manage slicer profiles
 */
const SlicerSettings = () => {
  const [status, setStatus] = useState({
    available: false,
    slicer_type: 'none',
    slicer_path: null,
    version: null,
  });
  const [profiles, setProfiles] = useState([]);
  const [presets, setPresets] = useState({});
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [manualPath, setManualPath] = useState('');
  const [message, setMessage] = useState(null);
  const [testFile, setTestFile] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  // New profile form
  const [showNewProfile, setShowNewProfile] = useState(false);
  const [newProfile, setNewProfile] = useState({
    id: '',
    name: '',
    description: '',
    layer_height: 0.2,
    infill_percent: 20,
    wall_count: 3,
    material: 'PLA',
  });

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const [statusData, profilesData, presetsData] = await Promise.all([
        api.getSlicerStatus(),
        api.getSlicerProfiles(),
        api.getSlicerPresets(),
      ]);
      
      setStatus(statusData || { available: false, slicer_type: 'none' });
      setProfiles(profilesData?.profiles || []);
      setPresets(presetsData?.presets || {});
    } catch (err) {
      console.error('Error loading slicer status:', err);
      showMessage('Failed to load slicer status', 'error');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleDetect = async () => {
    setDetecting(true);
    try {
      const result = await api.detectSlicer();
      setStatus(result || { available: false, slicer_type: 'none' });
      if (result?.available) {
        showMessage(`Found ${result.slicer_type} at ${result.slicer_path}`, 'success');
      } else {
        showMessage('No slicer found. Install OrcaSlicer or set path manually.', 'warning');
      }
    } catch (err) {
      showMessage('Detection failed: ' + err.message, 'error');
    }
    setDetecting(false);
  };

  const handleSetPath = async () => {
    if (!manualPath.trim()) {
      showMessage('Please enter a path', 'error');
      return;
    }

    try {
      const result = await api.setSlicerPath(manualPath.trim());
      setStatus(result || { available: false });
      if (result?.available) {
        showMessage('Slicer path set successfully!', 'success');
        setManualPath('');
      } else {
        showMessage('Path is not valid or slicer not found', 'error');
      }
    } catch (err) {
      showMessage('Failed to set path: ' + err.message, 'error');
    }
  };

  const handleTestSlice = async () => {
    if (!testFile) {
      showMessage('Please select an STL file to test', 'error');
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.sliceModel(testFile, {
        layer_height: 0.2,
        infill_percent: 20,
        wall_count: 3,
        material: 'PLA',
      });

      setTestResult(result?.result || result);
      showMessage('Test slice completed!', 'success');
    } catch (err) {
      showMessage('Test slice failed: ' + err.message, 'error');
    }
    setTesting(false);
  };

  const handleQuickEstimate = async () => {
    if (!testFile) {
      showMessage('Please select an STL file', 'error');
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.getQuickEstimate(testFile, {
        material: 'PLA',
        layer_height: 0.2,
        infill_percent: 20,
      });

      setTestResult(result?.estimate || result);
      showMessage('Quick estimate completed!', 'success');
    } catch (err) {
      showMessage('Estimation failed: ' + err.message, 'error');
    }
    setTesting(false);
  };

  const handleCreateProfile = async () => {
    if (!newProfile.id || !newProfile.name) {
      showMessage('Profile ID and name are required', 'error');
      return;
    }

    try {
      await api.createSlicerProfile({
        id: newProfile.id,
        name: newProfile.name,
        description: newProfile.description,
        settings: {
          layer_height: newProfile.layer_height,
          infill_percent: newProfile.infill_percent,
          wall_count: newProfile.wall_count,
          material: newProfile.material,
        },
      });

      showMessage('Profile created successfully!', 'success');
      setShowNewProfile(false);
      setNewProfile({
        id: '',
        name: '',
        description: '',
        layer_height: 0.2,
        infill_percent: 20,
        wall_count: 3,
        material: 'PLA',
      });
      loadStatus();
    } catch (err) {
      showMessage('Failed to create profile: ' + err.message, 'error');
    }
  };

  const formatTime = (seconds) => {
    if (!seconds) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 text-center">
        <div className="animate-spin text-4xl mb-4">⚙️</div>
        <p className="text-zinc-400">Loading slicer configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Message Toast */}
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
          message.type === 'error' ? 'bg-red-600' : 
          message.type === 'warning' ? 'bg-yellow-600' : 'bg-green-600'
        } text-white`}>
          {message.text}
        </div>
      )}

      {/* Status Card */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>🔪</span> OrcaSlicer Integration
            </h2>
            {status.slicer_path && (
              <p className="text-xs text-zinc-500 mt-1 font-mono">{status.slicer_path}</p>
            )}
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-bold ${
            status.available 
              ? 'bg-green-900/50 text-green-400 border border-green-700' 
              : status.slicer_installed
                ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-700'
                : 'bg-red-900/50 text-red-400 border border-red-700'
          }`}>
            {status.available ? '✓ Ready' : status.slicer_installed ? '⚠️ Needs Profiles' : '✗ Not Installed'}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 mb-6">
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Slicer</p>
            <p className="text-lg font-bold text-white capitalize">
              {status.slicer_type === 'orcaslicer' ? '🟢 OrcaSlicer' :
               status.slicer_type === 'bambu_studio' ? '🟠 Bambu Studio' :
               '⚪ Not Detected'}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {status.slicer_installed || status.slicer_path ? `v${status.version || '?'}` : 'Not installed'}
            </p>
          </div>
          
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Profiles</p>
            <p className={`text-lg font-bold ${status.profiles_configured ? 'text-green-400' : 'text-yellow-400'}`}>
              {status.profiles_configured ? '✓ Configured' : '⚠️ Not Found'}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {status.profiles_configured 
                ? 'Ready for accurate slicing' 
                : 'Open OrcaSlicer to create profiles'}
            </p>
          </div>
          
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Profile Details</p>
            <div className="space-y-1 text-xs mt-1">
              <p className={status.profiles?.machine ? 'text-green-400' : 'text-red-400'}>
                🖨️ Printer: {status.profiles?.machine ? '✓' : '✗'}
              </p>
              <p className={status.profiles?.filament ? 'text-green-400' : 'text-red-400'}>
                🧵 Filament: {status.profiles?.filament ? '✓' : '✗'}
              </p>
              <p className={status.profiles?.process ? 'text-green-400' : 'text-zinc-500'}>
                ⚙️ Process: {status.profiles?.process ? '✓' : 'optional'}
              </p>
            </div>
          </div>
          
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Status</p>
            <p className={`text-lg font-bold ${status.available ? 'text-green-400' : status.slicer_installed || status.slicer_path ? 'text-yellow-400' : 'text-red-400'}`}>
              {status.available ? '🚀 Ready' : status.slicer_installed || status.slicer_path ? '⚠️ Config Needed' : '❌ Not Found'}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {status.available 
                ? 'Full slicer integration' 
                : status.slicer_installed || status.slicer_path
                  ? 'Configure profiles in OrcaSlicer'
                  : 'Install OrcaSlicer for accurate times'}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleDetect}
            disabled={detecting}
            className="px-4 py-2 rounded-lg font-medium text-white transition disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)' }}
          >
            {detecting ? '🔍 Detecting...' : '🔍 Re-detect Slicer'}
          </button>
        </div>
      </div>

      {/* Manual Path Setting */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h3 className="text-lg font-bold text-white mb-4">📁 Manual Path Configuration</h3>
        
        <p className="text-sm text-zinc-400 mb-4">
          If auto-detection fails, you can manually specify the path to OrcaSlicer or Bambu Studio executable.
        </p>

        <div className="flex gap-3">
          <input
            type="text"
            value={manualPath}
            onChange={(e) => setManualPath(e.target.value)}
            placeholder="C:\Program Files\OrcaSlicer\orca-slicer.exe"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-zinc-500"
          />
          <button
            onClick={handleSetPath}
            className="px-4 py-2 rounded-lg font-medium text-white bg-purple-600 hover:bg-purple-700 transition"
          >
            Set Path
          </button>
        </div>

        <div className="mt-3 text-xs text-zinc-500">
          <p><strong>Common paths:</strong></p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li><code>C:\Program Files\OrcaSlicer\orca-slicer.exe</code></li>
            <li><code>C:\Program Files\Bambu Studio\bambu-studio.exe</code></li>
            <li><code>%LOCALAPPDATA%\Programs\OrcaSlicer\orca-slicer.exe</code></li>
          </ul>
        </div>
      </div>

      {/* Test Slicing */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h3 className="text-lg font-bold text-white mb-4">🧪 Test Slicing</h3>
        
        <p className="text-sm text-zinc-400 mb-4">
          Upload an STL file to test the slicer integration and verify accurate print time estimates.
        </p>

        <div className="flex gap-3 items-center mb-4">
          <input
            type="file"
            accept=".stl,.STL"
            onChange={(e) => setTestFile(e.target.files?.[0] || null)}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-blue-600 file:text-white file:cursor-pointer"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleQuickEstimate}
            disabled={testing || !testFile}
            className="px-4 py-2 rounded-lg font-medium text-white transition disabled:opacity-50 bg-gray-700 hover:bg-gray-600"
          >
            {testing ? '⏳ Processing...' : '⚡ Quick Estimate'}
          </button>
          
          {status.available && (
            <button
              onClick={handleTestSlice}
              disabled={testing || !testFile}
              className="px-4 py-2 rounded-lg font-medium text-white transition disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #22c55e 0%, #06b6d4 100%)' }}
            >
              {testing ? '⏳ Slicing...' : '🔪 Full Slice Test'}
            </button>
          )}
        </div>

        {/* Test Results */}
        {testResult && (
          <div className="mt-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-lg ${testResult.success !== false ? '✅' : '❌'}`}>
                {testResult.success !== false ? '✅' : '❌'}
              </span>
              <span className="font-bold text-white">
                {testResult.source === 'orcaslicer' ? 'OrcaSlicer Result' :
                 testResult.source === 'bambu_studio' ? 'Bambu Studio Result' :
                 testResult.source === 'estimate' ? 'Estimated Result' : 'Result'}
              </span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-zinc-500">Print Time</p>
                <p className="text-lg font-bold text-blue-400">
                  {testResult.print_time_formatted || formatTime(testResult.print_time_seconds)}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Filament</p>
                <p className="text-lg font-bold text-green-400">
                  {(testResult.filament_used_g || 0).toFixed(1)}g
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Length</p>
                <p className="text-lg font-bold text-purple-400">
                  {(testResult.filament_used_m || 0).toFixed(1)}m
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Layers</p>
                <p className="text-lg font-bold text-orange-400">
                  {testResult.layer_count || 0}
                </p>
              </div>
            </div>

            {testResult.source === 'estimate' && (
              <p className="mt-3 text-xs text-yellow-400">
                ⚠️ Using built-in estimates. Install OrcaSlicer for more accurate results.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Quality Presets */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h3 className="text-lg font-bold text-white mb-4">📋 Quality Presets</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(presets).map(([key, preset]) => (
            <div 
              key={key}
              className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 hover:border-blue-500 transition cursor-pointer"
            >
              <h4 className="font-bold text-white mb-2">{preset.name}</h4>
              <p className="text-xs text-zinc-400 mb-3">{preset.description}</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Layer Height</span>
                  <span className="text-cyan-400">{preset.layer_height}mm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Infill</span>
                  <span className="text-cyan-400">{preset.infill_percent}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Walls</span>
                  <span className="text-cyan-400">{preset.wall_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Speed</span>
                  <span className="text-cyan-400">{preset.print_speed}mm/s</span>
                </div>
              </div>
              <p className="mt-3 text-[10px] text-zinc-500">{preset.best_for}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Profiles */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">🎨 Custom Profiles</h3>
          <button
            onClick={() => setShowNewProfile(!showNewProfile)}
            className="px-3 py-1 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition"
          >
            {showNewProfile ? '✕ Cancel' : '+ New Profile'}
          </button>
        </div>

        {/* New Profile Form */}
        {showNewProfile && (
          <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <h4 className="font-bold text-white mb-3">Create New Profile</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Profile ID *</label>
                <input
                  type="text"
                  value={newProfile.id}
                  onChange={(e) => setNewProfile({ ...newProfile, id: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') })}
                  placeholder="my-custom-profile"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Display Name *</label>
                <input
                  type="text"
                  value={newProfile.name}
                  onChange={(e) => setNewProfile({ ...newProfile, name: e.target.value })}
                  placeholder="My Custom Profile"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-zinc-400 mb-1">Description</label>
                <input
                  type="text"
                  value={newProfile.description}
                  onChange={(e) => setNewProfile({ ...newProfile, description: e.target.value })}
                  placeholder="Describe this profile's use case"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Layer Height (mm)</label>
                <input
                  type="number"
                  step="0.04"
                  min="0.04"
                  max="0.4"
                  value={newProfile.layer_height}
                  onChange={(e) => setNewProfile({ ...newProfile, layer_height: parseFloat(e.target.value) })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Infill %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={newProfile.infill_percent}
                  onChange={(e) => setNewProfile({ ...newProfile, infill_percent: parseInt(e.target.value) })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Wall Count</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={newProfile.wall_count}
                  onChange={(e) => setNewProfile({ ...newProfile, wall_count: parseInt(e.target.value) })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Material</label>
                <select
                  value={newProfile.material}
                  onChange={(e) => setNewProfile({ ...newProfile, material: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="PLA">PLA</option>
                  <option value="PETG">PETG</option>
                  <option value="ABS">ABS</option>
                  <option value="TPU">TPU</option>
                  <option value="Nylon">Nylon</option>
                  <option value="ASA">ASA</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleCreateProfile}
                className="px-4 py-2 rounded-lg font-medium text-white"
                style={{ background: 'linear-gradient(135deg, #22c55e 0%, #06b6d4 100%)' }}
              >
                💾 Create Profile
              </button>
            </div>
          </div>
        )}

        {/* Profile List */}
        {profiles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {profiles.map((profile) => (
              <div 
                key={profile.id}
                className="bg-gray-800/50 rounded-lg p-4 border border-gray-700"
              >
                <h4 className="font-bold text-white">{profile.name}</h4>
                <p className="text-xs text-zinc-400 mt-1">{profile.description || 'No description'}</p>
                <div className="mt-2 flex gap-2 text-xs">
                  <span className="px-2 py-1 bg-gray-700 rounded text-zinc-300">
                    {profile.layer_height}mm
                  </span>
                  <span className="px-2 py-1 bg-gray-700 rounded text-zinc-300">
                    {profile.material || 'PLA'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-zinc-500">
            <p>No custom profiles yet. Create one above!</p>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
        <h4 className="font-bold text-blue-400 mb-2">💡 About OrcaSlicer Integration</h4>
        <ul className="text-sm text-zinc-400 space-y-1 list-disc list-inside">
          <li>OrcaSlicer provides accurate print time and filament estimates</li>
          <li>Works with Bambu Lab printers and most other FDM printers</li>
          <li>Falls back to built-in estimates when slicer is unavailable</li>
          <li>Download OrcaSlicer from <a href="https://github.com/SoftFever/OrcaSlicer" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">github.com/SoftFever/OrcaSlicer</a></li>
        </ul>
        
        {/* Profile Search Paths */}
        {status.searched_paths && status.searched_paths.length > 0 && (
          <div className="mt-4 pt-3 border-t border-blue-800/50">
            <p className="text-xs text-zinc-500 mb-2">Profile search locations:</p>
            <div className="space-y-1">
              {status.searched_paths.map((path, i) => (
                <code key={i} className="block text-[10px] text-zinc-500 font-mono truncate">
                  {path}
                </code>
              ))}
            </div>
          </div>
        )}
        
        {status.hint && (
          <p className="mt-3 text-xs text-yellow-400">
            ⚠️ {status.hint}
          </p>
        )}
      </div>
    </div>
  );
};

export default SlicerSettings;
