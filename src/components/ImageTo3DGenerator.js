import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, unwrap, API_BASE } from '../services/api';

/**
 * Image to 3D Generator Component
 *
 * Allows users to upload an image and generate a 3D model via the AI backend.
 */

export default function ImageTo3DGenerator({ onGenerated }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const [backend, setBackend] = useState('mock');
  const [backends, setBackends] = useState([]);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // Load available backends
  useEffect(() => {
    let cancelled = false;

    const loadBackends = async () => {
      try {
        const res = await api.getAIGenerationBackends();
        const payload = unwrap(res) || {};

        const raw = payload.backends || payload.available_backends || payload.availableBackends || [];
        const normalized = Array.isArray(raw)
          ? raw.map((b) => (typeof b === 'string' ? { name: b, available: true } : b))
          : [{ name: 'mock', available: true }];

        if (cancelled) return;

        setBackends(normalized);

        const active =
          payload.active_backend ||
          payload.default_backend ||
          normalized.find((b) => b.available)?.name ||
          normalized[0]?.name ||
          'mock';

        setBackend(active);
      } catch (e) {
        if (cancelled) return;
        setBackends([{ name: 'mock', available: true }]);
        setBackend('mock');
      }
    };

    loadBackends();
    return () => {
      cancelled = true;
    };
  }, []);

  // Preview URL lifecycle
  useEffect(() => {
    if (!selectedFile) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile]);

  const backendOptions = useMemo(() => {
    return (backends || []).map((b) => ({
      name: b?.name || String(b),
      available: b?.available !== false,
      label: b?.display_name || b?.label || b?.name || String(b),
    }));
  }, [backends]);

  const handleFileSelect = useCallback((e) => {
    setError(null);
    setResult(null);

    const file = e.target.files?.[0] || null;
    setSelectedFile(file || null);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!selectedFile) {
      setError('Please select an image first');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('backend', backend);

      const res = await api.generate3DFromImage(formData, { backend });
      const payload = unwrap(res);

      const ok = payload?.success !== false;
      const data = payload?.data ?? payload;

      if (!ok) {
        throw new Error(payload?.error || data?.error || 'Generation failed');
      }

      setResult(data);
      if (onGenerated) onGenerated(data);
    } catch (e) {
      setError(e?.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }, [selectedFile, backend, onGenerated]);

  const meshPath = result?.generation?.mesh_path || result?.mesh_path || result?.meshPath || '';
  const downloadUrl = meshPath
    ? `${API_BASE}/ai/generation/download/${encodeURIComponent(meshPath)}`
    : null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Image → 3D Generator</h2>
          <p className="text-gray-600 mt-1">
            Upload an image and generate a 3D mesh using the selected backend.
          </p>
        </div>

        <div className="min-w-[220px]">
          <label className="block text-sm font-medium text-gray-700 mb-2">Backend</label>
          <select
            value={backend}
            onChange={(e) => setBackend(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            disabled={generating}
          >
            {backendOptions.length === 0 ? (
              <option value="mock">mock</option>
            ) : (
              backendOptions.map((b) => (
                <option key={b.name} value={b.name} disabled={!b.available}>
                  {b.label}{!b.available ? ' (unavailable)' : ''}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upload */}
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">1) Select Image</h3>

          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="w-full text-sm"
            disabled={generating}
          />

          {previewUrl && (
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2">Preview</p>
              <img
                src={previewUrl}
                alt="preview"
                className="w-full max-h-64 object-contain rounded border"
              />
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={!selectedFile || generating}
            className={`mt-4 w-full px-4 py-2 rounded font-medium ${
              generating || !selectedFile
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {generating ? 'Generating…' : '2) Generate 3D'}
          </button>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Result */}
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">3) Result</h3>

          {!result ? (
            <div className="text-sm text-gray-500">
              No result yet. Generate a model to see details here.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm">
                <div className="font-medium text-gray-700">Status</div>
                <div className="text-gray-600">
                  {result.status || result.state || 'done'}
                </div>
              </div>

              {meshPath && (
                <div className="text-sm">
                  <div className="font-medium text-gray-700">Mesh</div>
                  <div className="text-gray-600 break-all">{meshPath}</div>
                </div>
              )}

              {result.generation?.stats && (
                <div className="text-sm">
                  <div className="font-medium text-gray-700">Stats</div>
                  <pre className="bg-gray-50 border rounded p-3 text-xs overflow-auto">
{JSON.stringify(result.generation.stats, null, 2)}
                  </pre>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                {downloadUrl && (
                  <a
                    href={downloadUrl}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                  >
                    ⬇️ Download
                  </a>
                )}

                {downloadUrl && (
                  <button
                    onClick={() => window.open(downloadUrl, '_blank', 'noopener,noreferrer')}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                  >
                    👁️ Preview
                  </button>
                )}
              </div>

              {result.feedback_id && (
                <p className="mt-2 text-xs text-gray-400">Feedback ID: {result.feedback_id}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
