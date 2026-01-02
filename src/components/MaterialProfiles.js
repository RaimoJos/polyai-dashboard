import React, { useState, useEffect } from 'react';
import { api, unwrap } from '../services/api';

/**
 * Material Profiles - View and apply print settings for different filaments
 */
function MaterialProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [printerType, setPrinterType] = useState('generic');
  const [optimizedSettings, setOptimizedSettings] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [customSettings, setCustomSettings] = useState({
    nozzle_temp: 200,
    bed_temp: 60,
    print_speed: 60
  });

  // Fetch profiles
  useEffect(() => {
    setLoading(true);
    api.getMaterialProfiles(selectedCategory)
      .then(res => {
        const data = unwrap(res) || {};
        setProfiles(Array.isArray(data.profiles) ? data.profiles : []);
        setCategories(Array.isArray(data.categories) ? data.categories : []);
      })
      .catch(err => console.error('Failed to load profiles:', err))
      .finally(() => setLoading(false));
  }, [selectedCategory]);

  // Get optimized settings when profile or printer type changes
  useEffect(() => {
    if (selectedProfile && printerType) {
      api.getMaterialSettings(selectedProfile.code, printerType)
        .then(res => {
          const data = unwrap(res) || {};
          const settings = data.settings || data;
          setOptimizedSettings(settings || null);
          setCustomSettings({
            nozzle_temp: settings?.nozzle_temp ?? selectedProfile?.temperatures?.nozzle?.default ?? 200,
            bed_temp: settings?.bed_temp ?? selectedProfile?.temperatures?.bed?.default ?? 60,
            print_speed: settings?.print_speed ?? selectedProfile?.speeds?.print_default ?? 60
          });
        })
        .catch(err => console.error('Failed to get settings:', err));
    }
  }, [selectedProfile, printerType]);

  // Validate custom settings
  const validateSettings = async () => {
    if (!selectedProfile) return;

    try {
      const res = await api.validateMaterialSettings(selectedProfile.code, customSettings);
      setValidationResult(unwrap(res) || null);
    } catch (err) {
      console.error('Validation failed:', err);
    }
  };

  // Category icons
  const categoryIcons = {
    standard: '🎯',
    engineering: '⚙️',
    flexible: '🔄',
    specialty: '✨',
    support: '🏗️'
  };

  const requirementBadgeClasses = {
    blue: 'bg-blue-900/50 text-blue-400 border-blue-700/50',
    orange: 'bg-orange-900/50 text-orange-400 border-orange-700/50',
    yellow: 'bg-yellow-900/50 text-yellow-400 border-yellow-700/50',
    green: 'bg-green-900/50 text-green-400 border-green-700/50',
    red: 'bg-red-900/50 text-red-400 border-red-700/50',
    gray: 'bg-gray-800 text-zinc-400 border-gray-700'
  };

  // Get requirements badges
  const getRequirementBadges = (profile) => {
    const badges = [];
    if (profile.requirements?.heated_bed) badges.push({ label: 'Heated Bed', color: 'blue' });
    if (profile.requirements?.enclosure) badges.push({ label: 'Enclosure', color: 'orange' });
    if (profile.requirements?.drying) badges.push({ label: 'Needs Drying', color: 'yellow' });
    return badges;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-2xl font-bold text-white mb-2">🧵 Material Profiles</h2>
        <p className="text-zinc-400">
          Recommended print settings for different filament types
        </p>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedCategory === null
                ? 'text-white'
                : 'bg-gray-800 border border-gray-700 text-zinc-300 hover:bg-gray-700'
            }`}
            style={selectedCategory === null ? { background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)' } : {}}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedCategory === cat
                  ? 'text-white'
                  : 'bg-gray-800 border border-gray-700 text-zinc-300 hover:bg-gray-700'
              }`}
              style={selectedCategory === cat ? { background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)' } : {}}
            >
              {categoryIcons[cat]} {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-zinc-400">Loading profiles...</p>
        </div>
      )}

      {/* Profiles Grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.map(profile => (
            <div
              key={profile.code}
              onClick={() => setSelectedProfile(profile)}
              className={`bg-gray-900 rounded-xl border p-4 cursor-pointer transition-all hover:border-gray-600 ${
                selectedProfile?.code === profile.code 
                  ? 'border-blue-500 ring-2 ring-blue-500/20' 
                  : 'border-gray-800'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg text-white">{profile.code}</h3>
                  <p className="text-sm text-zinc-500">{profile.name}</p>
                </div>
                <span className="text-2xl">
                  {categoryIcons[profile.category]}
                </span>
              </div>

              <p className="text-sm text-zinc-400 mt-2 line-clamp-2">
                {profile.description}
              </p>

              {/* Quick Stats */}
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div 
                  className="rounded-lg p-2 border"
                  style={{ 
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%)',
                    borderColor: 'rgba(239, 68, 68, 0.3)'
                  }}
                >
                  <span className="text-zinc-500">Nozzle</span>
                  <p className="font-bold text-red-400">
                    {profile.temperatures?.nozzle?.default ?? '--'}°C
                  </p>
                </div>
                <div 
                  className="rounded-lg p-2 border"
                  style={{ 
                    background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.1) 0%, rgba(249, 115, 22, 0.05) 100%)',
                    borderColor: 'rgba(249, 115, 22, 0.3)'
                  }}
                >
                  <span className="text-zinc-500">Bed</span>
                  <p className="font-bold text-orange-400">
                    {profile.temperatures?.bed?.default ?? '--'}°C
                  </p>
                </div>
              </div>

              {/* Requirements Badges */}
              <div className="mt-3 flex flex-wrap gap-1">
                {getRequirementBadges(profile).map(badge => (
                  <span
                    key={badge.label}
                    className={`px-2 py-0.5 rounded-full text-xs border ${requirementBadgeClasses[badge.color] || requirementBadgeClasses.gray}`}
                  >
                    {badge.label}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected Profile Details */}
      {selectedProfile && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-bold text-white">{selectedProfile.name}</h3>
              <p className="text-zinc-400">{selectedProfile.description}</p>
            </div>
            <button
              onClick={() => setSelectedProfile(null)}
              className="text-zinc-500 hover:text-zinc-300 text-xl"
            >
              ✕
            </button>
          </div>

          {/* Printer Type Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-zinc-400 mb-1">
              Optimize for Printer:
            </label>
            <select
              value={printerType}
              onChange={(e) => setPrinterType(e.target.value)}
              className="w-full max-w-xs bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-zinc-200"
            >
              <option value="generic">Generic</option>
              <option value="k1">Creality K1</option>
              <option value="bambu">Bambu Lab</option>
              <option value="ender">Ender 3</option>
              <option value="prusa">Prusa</option>
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recommended Settings */}
            <div>
              <h4 className="font-bold text-white mb-3">📋 Recommended Settings</h4>
              <div className="space-y-3">
                {/* Temperatures */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                  <h5 className="font-medium text-zinc-200 mb-2">🌡️ Temperatures</h5>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-zinc-500">Nozzle</span>
                      <p className="font-mono font-bold text-red-400">
                        {selectedProfile.temperatures?.nozzle?.default ?? '--'}°C
                        <span className="text-zinc-500 text-sm ml-1">
                          ({selectedProfile.temperatures?.nozzle?.min ?? '--'}-{selectedProfile.temperatures?.nozzle?.max ?? '--'})
                        </span>
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-zinc-500">Bed</span>
                      <p className="font-mono font-bold text-orange-400">
                        {selectedProfile.temperatures?.bed?.default ?? '--'}°C
                        <span className="text-zinc-500 text-sm ml-1">
                          ({selectedProfile.temperatures?.bed?.min ?? '--'}-{selectedProfile.temperatures?.bed?.max ?? '--'})
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Speeds */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                  <h5 className="font-medium text-zinc-200 mb-2">⚡ Speeds</h5>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-zinc-500">Print Speed</span>
                      <p className="font-bold text-zinc-200">{selectedProfile.speeds?.print_default ?? '--'} mm/s</p>
                    </div>
                    <div>
                      <span className="text-zinc-500">Max Speed</span>
                      <p className="font-bold text-zinc-200">{selectedProfile.speeds?.print_max ?? '--'} mm/s</p>
                    </div>
                    <div>
                      <span className="text-zinc-500">First Layer</span>
                      <p className="font-bold text-zinc-200">{selectedProfile.speeds?.first_layer ?? '--'} mm/s</p>
                    </div>
                    <div>
                      <span className="text-zinc-500">Travel</span>
                      <p className="font-bold text-zinc-200">{selectedProfile.speeds?.travel ?? '--'} mm/s</p>
                    </div>
                  </div>
                </div>

                {/* Cooling */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                  <h5 className="font-medium text-zinc-200 mb-2">💨 Cooling</h5>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-zinc-500">Fan Speed</span>
                      <p className="font-bold text-zinc-200">{selectedProfile.cooling?.fan_default ?? '--'}%</p>
                    </div>
                    <div>
                      <span className="text-zinc-500">Disable First Layers</span>
                      <p className="font-bold text-zinc-200">{selectedProfile.cooling?.disable_first_layers ?? '--'}</p>
                    </div>
                  </div>
                </div>

                {/* Retraction */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                  <h5 className="font-medium text-zinc-200 mb-2">↩️ Retraction</h5>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-zinc-500">Distance</span>
                      <p className="font-bold text-zinc-200">{selectedProfile.retraction?.distance ?? '--'} mm</p>
                    </div>
                    <div>
                      <span className="text-zinc-500">Speed</span>
                      <p className="font-bold text-zinc-200">{selectedProfile.retraction?.speed ?? '--'} mm/s</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tips & Warnings + Validator */}
            <div className="space-y-4">
              {/* Optimized Settings */}
              {optimizedSettings && (
                <div 
                  className="rounded-lg p-4 border"
                  style={{ 
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)',
                    borderColor: 'rgba(59, 130, 246, 0.3)'
                  }}
                >
                  <h4 className="font-bold text-blue-400 mb-2">🎯 Optimized for {printerType}</h4>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-zinc-500">Nozzle</span>
                      <p className="font-bold text-zinc-200">{optimizedSettings.nozzle_temp}°C</p>
                    </div>
                    <div>
                      <span className="text-zinc-500">Bed</span>
                      <p className="font-bold text-zinc-200">{optimizedSettings.bed_temp}°C</p>
                    </div>
                    <div>
                      <span className="text-zinc-500">Speed</span>
                      <p className="font-bold text-zinc-200">{optimizedSettings.print_speed} mm/s</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Settings Validator */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <h4 className="font-bold text-white mb-3">🔍 Settings Validator</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-zinc-500">Nozzle Temp (°C)</label>
                    <input
                      type="number"
                      value={customSettings.nozzle_temp}
                      onChange={(e) => setCustomSettings(prev => ({
                        ...prev,
                        nozzle_temp: parseInt(e.target.value)
                      }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-zinc-500">Bed Temp (°C)</label>
                    <input
                      type="number"
                      value={customSettings.bed_temp}
                      onChange={(e) => setCustomSettings(prev => ({
                        ...prev,
                        bed_temp: parseInt(e.target.value)
                      }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-zinc-500">Print Speed (mm/s)</label>
                    <input
                      type="number"
                      value={customSettings.print_speed}
                      onChange={(e) => setCustomSettings(prev => ({
                        ...prev,
                        print_speed: parseInt(e.target.value)
                      }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-zinc-200"
                    />
                  </div>
                  <button
                    onClick={validateSettings}
                    className="w-full rounded-lg py-2 text-white font-medium"
                    style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)' }}
                  >
                    Validate Settings
                  </button>

                  {validationResult && (
                    <div className={`p-3 rounded-lg border ${
                      validationResult.valid 
                        ? 'bg-green-900/30 border-green-700/50' 
                        : 'bg-yellow-900/30 border-yellow-700/50'
                    }`}>
                      <p className={`font-medium ${validationResult.valid ? 'text-green-400' : 'text-yellow-400'}`}>
                        {validationResult.valid ? '✅ Settings look good!' : '⚠️ Warnings:'}
                      </p>
                      {validationResult.warnings?.map((w, i) => (
                        <p key={i} className="text-sm text-yellow-400 mt-1">• {w}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Tips */}
              {selectedProfile.tips?.length > 0 && (
                <div 
                  className="rounded-lg p-4 border"
                  style={{ 
                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)',
                    borderColor: 'rgba(34, 197, 94, 0.3)'
                  }}
                >
                  <h4 className="font-bold text-green-400 mb-2">💡 Tips</h4>
                  <ul className="text-sm text-green-300 space-y-1">
                    {selectedProfile.tips.map((tip, i) => (
                      <li key={i}>• {tip}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warnings */}
              {selectedProfile.warnings?.length > 0 && (
                <div 
                  className="rounded-lg p-4 border"
                  style={{ 
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%)',
                    borderColor: 'rgba(239, 68, 68, 0.3)'
                  }}
                >
                  <h4 className="font-bold text-red-400 mb-2">⚠️ Warnings</h4>
                  <ul className="text-sm text-red-300 space-y-1">
                    {selectedProfile.warnings.map((warning, i) => (
                      <li key={i}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MaterialProfiles;
