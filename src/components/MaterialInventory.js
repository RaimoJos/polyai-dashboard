import React, { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import toast from "../utils/toast";

/**
 * MaterialInventory
 * - Displays filament spool inventory from backend /materials/spools
 * - Renders a simple, resilient table + summary
 * - Allows adding new materials
 */
export default function MaterialInventory() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [materials, setMaterials] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [newMaterial, setNewMaterial] = useState({
    name: "",
    manufacturer: "",
    material_type: "PLA",
    color: "",
    diameter_mm: 1.75,
    initial_weight_g: 1000,
    remaining_weight_g: 1000,
    cost_usd: 25,
    location: "",
    notes: ""
  });

  const totalSpools = materials.length;
  const totalKg = useMemo(() => {
    return materials.reduce((sum, m) => sum + (Number(m.remainingKg) || 0), 0);
  }, [materials]);

  const loadMaterials = async () => {
    setLoading(true);
    setError("");

    try {
      const resp = await api.getMaterialInventory();
      const data = resp || {};
      const list = Array.isArray(data) 
        ? data 
        : (data.spools || data.materials || data.data || []);

      const normalized = list.map((m) => ({
        id: m.spool_id || m.id || m.material_id || `${m.manufacturer || "Spool"}-${m.color || ""}`,
        name: m.name || `${m.manufacturer || ""} ${m.material_type || ""}`.trim() || "Spool",
        brand: m.manufacturer || m.brand || "",
        type: m.material_type || m.type || "",
        color: m.color || "",
        diameter: m.diameter_mm || m.diameter || 1.75,
        remainingKg: m.remaining_weight_g != null 
          ? Number(m.remaining_weight_g) / 1000 
          : (m.remainingKg ?? m.remaining_kg ?? 0),
        initialKg: m.initial_weight_g != null
          ? Number(m.initial_weight_g) / 1000
          : (m.initialKg ?? m.initial_kg ?? 1),
        remainingPercent: m.remaining_percent ?? 100,
        location: m.location || "",
        notes: m.notes || "",
        isActive: m.is_active !== false,
        costUsd: m.cost_usd || 0,
      }));

      const activeSpools = normalized.filter(m => m.isActive);
      setMaterials(activeSpools);
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to load material inventory";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaterials();
  }, []);

  const handleAddMaterial = async (e) => {
    e.preventDefault();
    setAddLoading(true);

    try {
      await api.addMaterial(newMaterial);
      toast.success("Material added successfully!");
      setShowAddModal(false);
      setNewMaterial({
        name: "",
        manufacturer: "",
        material_type: "PLA",
        color: "",
        diameter_mm: 1.75,
        initial_weight_g: 1000,
        remaining_weight_g: 1000,
        cost_usd: 25,
        location: "",
        notes: ""
      });
      loadMaterials();
    } catch (err) {
      toast.error(err?.message || "Failed to add material");
    } finally {
      setAddLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-700 rounded w-1/3 mb-6"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 bg-gray-800 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            📦 Material Inventory
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Spools: <strong className="text-white">{totalSpools}</strong> • 
            Remaining: <strong className="text-white">{totalKg.toFixed(2)} kg</strong>
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
        >
          ➕ Add Material
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-4">
          <p className="text-red-400">{error}</p>
          <p className="text-xs text-zinc-500 mt-1">
            Backend endpoint: <code className="bg-gray-800 px-1 rounded">GET /api/v1/materials/spools</code>
          </p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-2 text-zinc-400 font-medium">Name</th>
              <th className="text-left py-3 px-2 text-zinc-400 font-medium">Type</th>
              <th className="text-left py-3 px-2 text-zinc-400 font-medium">Color</th>
              <th className="text-center py-3 px-2 text-zinc-400 font-medium">Ø (mm)</th>
              <th className="text-right py-3 px-2 text-zinc-400 font-medium">Remaining</th>
              <th className="text-left py-3 px-2 text-zinc-400 font-medium">Location</th>
              <th className="text-left py-3 px-2 text-zinc-400 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((m) => (
              <tr key={m.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="py-3 px-2 text-white">{m.name}</td>
                <td className="py-3 px-2">
                  <span className="px-2 py-1 rounded-full text-xs bg-purple-900/50 text-purple-400 border border-purple-700/50">
                    {m.type}
                  </span>
                </td>
                <td className="py-3 px-2">
                  <span className="inline-flex items-center gap-2">
                    <span 
                      className="w-4 h-4 rounded-full border border-gray-600" 
                      style={{ backgroundColor: m.color?.toLowerCase() || '#888' }}
                      title={m.color}
                    />
                    <span className="text-zinc-300">{m.color}</span>
                  </span>
                </td>
                <td className="py-3 px-2 text-center text-zinc-300">{m.diameter}</td>
                <td className="py-3 px-2 text-right">
                  <div className="flex flex-col items-end">
                    <span className="text-white font-medium">
                      {Number(m.remainingKg || 0).toFixed(2)} kg
                    </span>
                    <span className={`text-xs ${
                      m.remainingPercent < 20 ? 'text-red-400' : 
                      m.remainingPercent < 50 ? 'text-yellow-400' : 
                      'text-green-400'
                    }`}>
                      {m.remainingPercent?.toFixed(0) || '—'}%
                    </span>
                  </div>
                </td>
                <td className="py-3 px-2 text-zinc-300">{m.location || '—'}</td>
                <td className="py-3 px-2 text-zinc-400 text-xs max-w-[150px] truncate" title={m.notes}>
                  {m.notes || '—'}
                </td>
              </tr>
            ))}
            {materials.length === 0 && !error && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-zinc-500">
                  No materials found. Add spools to track your inventory.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Material Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-700 w-full max-w-lg mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">➕ Add Material</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMaterial} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Name</label>
                  <input
                    type="text"
                    value={newMaterial.name}
                    onChange={(e) => setNewMaterial({...newMaterial, name: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-gray-800 border border-gray-700 text-zinc-200 placeholder-zinc-500"
                    placeholder="e.g. Bambu PLA Basic"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Manufacturer</label>
                  <input
                    type="text"
                    value={newMaterial.manufacturer}
                    onChange={(e) => setNewMaterial({...newMaterial, manufacturer: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-gray-800 border border-gray-700 text-zinc-200 placeholder-zinc-500"
                    placeholder="e.g. Bambu Lab"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Material Type</label>
                  <select
                    value={newMaterial.material_type}
                    onChange={(e) => setNewMaterial({...newMaterial, material_type: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-gray-800 border border-gray-700 text-zinc-200"
                  >
                    <option value="PLA">PLA</option>
                    <option value="PETG">PETG</option>
                    <option value="ABS">ABS</option>
                    <option value="TPU">TPU</option>
                    <option value="ASA">ASA</option>
                    <option value="Nylon">Nylon</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Color</label>
                  <input
                    type="text"
                    value={newMaterial.color}
                    onChange={(e) => setNewMaterial({...newMaterial, color: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-gray-800 border border-gray-700 text-zinc-200 placeholder-zinc-500"
                    placeholder="e.g. Black, White, Red"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Diameter (mm)</label>
                  <select
                    value={newMaterial.diameter_mm}
                    onChange={(e) => setNewMaterial({...newMaterial, diameter_mm: parseFloat(e.target.value)})}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-gray-800 border border-gray-700 text-zinc-200"
                  >
                    <option value={1.75}>1.75mm</option>
                    <option value={2.85}>2.85mm</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Weight (g)</label>
                  <input
                    type="number"
                    value={newMaterial.initial_weight_g}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1000;
                      setNewMaterial({...newMaterial, initial_weight_g: val, remaining_weight_g: val});
                    }}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-gray-800 border border-gray-700 text-zinc-200"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Cost (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newMaterial.cost_usd}
                    onChange={(e) => setNewMaterial({...newMaterial, cost_usd: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-gray-800 border border-gray-700 text-zinc-200"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Location</label>
                  <input
                    type="text"
                    value={newMaterial.location}
                    onChange={(e) => setNewMaterial({...newMaterial, location: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-gray-800 border border-gray-700 text-zinc-200 placeholder-zinc-500"
                    placeholder="e.g. Shelf A1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Notes</label>
                <textarea
                  value={newMaterial.notes}
                  onChange={(e) => setNewMaterial({...newMaterial, notes: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-gray-800 border border-gray-700 text-zinc-200 placeholder-zinc-500"
                  rows={2}
                  placeholder="Optional notes..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-zinc-300 hover:bg-gray-700 border border-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
                >
                  {addLoading ? 'Adding...' : 'Add Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
