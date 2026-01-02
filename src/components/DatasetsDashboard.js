import React, { useEffect, useMemo, useState } from "react";
import { api, unwrap } from "../services/api";
import toast from '../utils/toast';

export default function DatasetsDashboard() {
  const [subTab, setSubTab] = useState("overview"); // overview | versions | quality
  const [readyOnly, setReadyOnly] = useState(true);

  const [datasets, setDatasets] = useState([]);
  const [dataset, setDataset] = useState("3d_models");

  const [versions, setVersions] = useState([]);
  const [activeVersion, setActiveVersion] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const [checkRes, setCheckRes] = useState(null);
  const [inspectRes, setInspectRes] = useState(null);

  const [inspectOpts, setInspectOpts] = useState({
    split: "train",
    sample_len: 400,
    sample_start: "",
    include_file_list: true,
    max_list_files: 200,
  });

  const [buildForm, setBuildForm] = useState({
    version: "",
    activate_after: true,
    input_dir: "",
    precision: 2,
    train_split: 0.95,
    max_files: "",
    incremental: true,
    reuse_if_unchanged: true,
    hash_mode: "fast",
    deduplicate_geom: true,
  });

  const [qualityVersion, setQualityVersion] = useState("");
  const [rescan, setRescan] = useState(false);
  const [gate, setGate] = useState({
    min_verts: "",
    max_verts: "",
    min_faces: "",
    max_faces: "",
    max_size_mb: "",
  });
  const [qualityReport, setQualityReport] = useState(null);
  const [qualityFailures, setQualityFailures] = useState(null);

  const [exclusions, setExclusions] = useState([]);
  const [exText, setExText] = useState("");

  const tabs = useMemo(() => ([
    { id: "overview", label: "Overview" },
    { id: "versions", label: "Versions" },
    { id: "quality", label: "Quality (3d_models)" },
  ]), []);

  async function loadDatasets() {
    const res = await api.listDatasets(readyOnly);
    const data = unwrap(res);
    const list = data?.datasets || [];
    setDatasets(list);

    // auto-select if needed
    if (!dataset && list.length) {
      const first = list[0];
      setDataset(first?.name || first);
    }
  }

  async function loadVersions(ds = dataset) {
    const res = await api.listDatasetVersions(ds);
    const data = unwrap(res);
    setVersions(data?.versions || []);
    setActiveVersion(data?.active_version || "");
    const chosen = data?.active_version || data?.versions?.[0]?.version || "";
    if (!qualityVersion) setQualityVersion(chosen);
  }

  async function refreshAll() {
    setBusy(true);
    setErr(null);
    try {
      await loadDatasets();
      await loadVersions(dataset);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyOnly]);

  useEffect(() => {
    if (!dataset) return;
    loadVersions(dataset).catch(e => setErr(e?.message || String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset]);

  // -------- Overview actions --------
  async function doCheck() {
    setBusy(true); setErr(null);
    try {
      const res = await api.checkDataset(dataset);
      setCheckRes(unwrap(res));
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function doInspect() {
    setBusy(true); setErr(null);
    try {
      const res = await api.inspectDataset({ dataset, ...inspectOpts });
      setInspectRes(unwrap(res));
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  // -------- Versions actions --------
  async function doBuildVersion() {
    setBusy(true); setErr(null);
    try {
      const payload = {
        dataset,
        version: buildForm.version.trim() || null,
        activate_after: !!buildForm.activate_after,
      };

      if (dataset === "3d_models") {
        payload.input_dir = buildForm.input_dir.trim() || null;
        payload.precision = Number(buildForm.precision);
        payload.train_split = Number(buildForm.train_split);
        payload.max_files = buildForm.max_files === "" ? null : Number(buildForm.max_files);
        payload.incremental = !!buildForm.incremental;
        payload.reuse_if_unchanged = !!buildForm.reuse_if_unchanged;
        payload.hash_mode = String(buildForm.hash_mode || "fast");
        payload.deduplicate_geom = !!buildForm.deduplicate_geom;
      }

      await api.buildDatasetVersion(payload);
      await loadVersions(dataset);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function doActivateVersion(v) {
    setBusy(true); setErr(null);
    try {
      await api.activateDatasetVersion(dataset, v);
      await loadVersions(dataset);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function doDeleteVersion(v) {
    setBusy(true); setErr(null);
    try {
      await api.deleteDatasetVersion(dataset, v);
      await loadVersions(dataset);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function doCleanup(dryRun) {
    setBusy(true); setErr(null);
    try {
      const res = await api.cleanupDatasetVersions(dataset, 5, dryRun);
      const result = unwrap(res);
      const message = dryRun
        ? `Dry run: ${result?.versions_to_remove || 0} versions would be removed`
        : `Cleanup complete: ${result?.versions_removed || 0} versions removed`;
      toast.success(message);
      await loadVersions(dataset);
    } catch (e) {
      toast.error(e?.message || 'Cleanup failed');
    } finally {
      setBusy(false);
    }
  }

  // -------- Quality actions (3d_models) --------
  async function loadExclusions() {
    const res = await api.getDatasetExclusions("3d_models");
    const data = unwrap(res);
    const relpaths = data?.relpaths || [];
    setExclusions(relpaths);
    setExText(relpaths.join("\n"));
  }

  async function doQualityReport() {
    if (!qualityVersion) return;
    setBusy(true); setErr(null);
    try {
      const res = await api.getDatasetQuality({
        dataset: "3d_models",
        version: qualityVersion,
        rescan,
        gate,
      });
      setQualityReport(unwrap(res));
      setQualityFailures(null);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function doQualityFailures() {
    if (!qualityVersion) return;
    setBusy(true); setErr(null);
    try {
      const res = await api.getDatasetQualityFailures({
        dataset: "3d_models",
        version: qualityVersion,
        limit: 5000,
        gate,
      });
      setQualityFailures(unwrap(res));
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveExclusions(mode) {
    setBusy(true); setErr(null);
    try {
      const relpaths = exText
        .split("\n")
        .map(s => s.trim())
        .filter(Boolean);

      await api.setDatasetExclusions({
        dataset: "3d_models",
        mode,
        relpaths,
      });

      await loadExclusions();
      await doQualityReport();
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    // auto-refresh quality when switching into Quality tab
    if (subTab === "quality") {
      loadExclusions().catch(() => {});
      if (!qualityVersion && activeVersion) setQualityVersion(activeVersion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab]);

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Datasets</h2>
          <p className="text-xs text-gray-500">Inspect • Version • Quality-gate your datasets</p>
        </div>

        <div className="lg:ml-auto flex flex-wrap items-center gap-3">
          <button
            onClick={refreshAll}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-800 text-sm disabled:opacity-50"
          >
            Refresh
          </button>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={readyOnly}
              onChange={(e) => setReadyOnly(e.target.checked)}
            />
            ready_only
          </label>

          <select
            className="px-3 py-2 rounded-lg border bg-white text-sm"
            value={dataset}
            onChange={(e) => setDataset(e.target.value)}
          >
            {datasets.map((d) => {
              const name = d?.name || d;
              const label = d?.name ? `${d.name}${d.ready ? " (ready)" : ""}` : name;
              return <option key={name} value={name}>{label}</option>;
            })}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border rounded-xl p-2 flex gap-2 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap ${
              subTab === t.id ? "bg-blue-600 text-white" : "bg-gray-50 text-gray-700 hover:bg-gray-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {err && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
          {err}
        </div>
      )}

      {/* Overview */}
      {subTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">Quick actions</h3>
              <div className="ml-auto flex gap-2">
                <button
                  onClick={doCheck}
                  disabled={busy || !dataset}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm disabled:opacity-50"
                >
                  Check
                </button>
                <button
                  onClick={doInspect}
                  disabled={busy || !dataset}
                  className="px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-800 text-sm disabled:opacity-50"
                >
                  Inspect
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm text-gray-700">
                split
                <select
                  className="mt-1 w-full px-3 py-2 rounded-lg border"
                  value={inspectOpts.split}
                  onChange={(e) => setInspectOpts(o => ({ ...o, split: e.target.value }))}
                >
                  <option value="train">train</option>
                  <option value="val">val</option>
                </select>
              </label>

              <label className="text-sm text-gray-700">
                sample_len
                <input
                  className="mt-1 w-full px-3 py-2 rounded-lg border"
                  value={inspectOpts.sample_len}
                  onChange={(e) => setInspectOpts(o => ({ ...o, sample_len: e.target.value }))}
                />
              </label>

              <label className="text-sm text-gray-700">
                sample_start (blank=random)
                <input
                  className="mt-1 w-full px-3 py-2 rounded-lg border"
                  value={inspectOpts.sample_start}
                  onChange={(e) => setInspectOpts(o => ({ ...o, sample_start: e.target.value }))}
                />
              </label>

              <label className="text-sm text-gray-700">
                max_list_files
                <input
                  className="mt-1 w-full px-3 py-2 rounded-lg border"
                  value={inspectOpts.max_list_files}
                  onChange={(e) => setInspectOpts(o => ({ ...o, max_list_files: e.target.value }))}
                />
              </label>

              <label className="text-sm text-gray-700 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={inspectOpts.include_file_list}
                  onChange={(e) => setInspectOpts(o => ({ ...o, include_file_list: e.target.checked }))}
                />
                include_file_list
              </label>
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-4 space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900">Results</h3>
              <p className="text-xs text-gray-500">Works even if backend wraps payloads</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <div className="text-sm font-medium text-gray-800">Check</div>
                <pre className="mt-2 text-xs bg-gray-900 text-gray-100 rounded-xl p-3 overflow-auto">
                  {JSON.stringify(checkRes, null, 2)}
                </pre>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-800">Inspect</div>
                <pre className="mt-2 text-xs bg-gray-900 text-gray-100 rounded-xl p-3 overflow-auto">
                  {JSON.stringify(inspectRes, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Versions */}
      {subTab === "versions" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border rounded-2xl p-4 space-y-4">
            <div className="flex items-center">
              <h3 className="font-semibold text-gray-900">Build / Snapshot</h3>
              <div className="ml-auto text-xs text-gray-500">
                Active: <span className="font-mono">{activeVersion || "(none)"}</span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm text-gray-700">
                version (optional)
                <input
                  className="mt-1 w-full px-3 py-2 rounded-lg border"
                  value={buildForm.version}
                  onChange={(e) => setBuildForm(f => ({ ...f, version: e.target.value }))}
                />
              </label>

              <label className="text-sm text-gray-700 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={buildForm.activate_after}
                  onChange={(e) => setBuildForm(f => ({ ...f, activate_after: e.target.checked }))}
                />
                activate_after
              </label>

              {dataset === "3d_models" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-sm text-gray-700 sm:col-span-2">
                    input_dir (optional)
                    <input
                      className="mt-1 w-full px-3 py-2 rounded-lg border"
                      value={buildForm.input_dir}
                      onChange={(e) => setBuildForm(f => ({ ...f, input_dir: e.target.value }))}
                    />
                  </label>

                  <label className="text-sm text-gray-700">
                    precision
                    <input
                      className="mt-1 w-full px-3 py-2 rounded-lg border"
                      value={buildForm.precision}
                      onChange={(e) => setBuildForm(f => ({ ...f, precision: e.target.value }))}
                    />
                  </label>

                  <label className="text-sm text-gray-700">
                    train_split
                    <input
                      className="mt-1 w-full px-3 py-2 rounded-lg border"
                      value={buildForm.train_split}
                      onChange={(e) => setBuildForm(f => ({ ...f, train_split: e.target.value }))}
                    />
                  </label>

                  <label className="text-sm text-gray-700">
                    max_files (blank=all)
                    <input
                      className="mt-1 w-full px-3 py-2 rounded-lg border"
                      value={buildForm.max_files}
                      onChange={(e) => setBuildForm(f => ({ ...f, max_files: e.target.value }))}
                    />
                  </label>

                  <label className="text-sm text-gray-700">
                    hash_mode
                    <input
                      className="mt-1 w-full px-3 py-2 rounded-lg border"
                      value={buildForm.hash_mode}
                      onChange={(e) => setBuildForm(f => ({ ...f, hash_mode: e.target.value }))}
                    />
                  </label>

                  <label className="text-sm text-gray-700 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={buildForm.incremental}
                      onChange={(e) => setBuildForm(f => ({ ...f, incremental: e.target.checked }))}
                    />
                    incremental
                  </label>

                  <label className="text-sm text-gray-700 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={buildForm.reuse_if_unchanged}
                      onChange={(e) => setBuildForm(f => ({ ...f, reuse_if_unchanged: e.target.checked }))}
                    />
                    reuse_if_unchanged
                  </label>

                  <label className="text-sm text-gray-700 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={buildForm.deduplicate_geom}
                      onChange={(e) => setBuildForm(f => ({ ...f, deduplicate_geom: e.target.checked }))}
                    />
                    deduplicate_geom
                  </label>
                </div>
              )}

              <button
                onClick={doBuildVersion}
                disabled={busy}
                className="w-full px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm disabled:opacity-50"
              >
                {busy ? "Working..." : (dataset === "3d_models" ? "Build version" : "Snapshot dataset")}
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => doCleanup(true)}
                  disabled={busy}
                  className="flex-1 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm disabled:opacity-50"
                >
                  Cleanup (dry-run)
                </button>
                <button
                  onClick={() => doCleanup(false)}
                  disabled={busy}
                  className="flex-1 px-3 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 text-sm disabled:opacity-50"
                >
                  Cleanup (delete)
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-4">
            <div className="flex items-center mb-3">
              <h3 className="font-semibold text-gray-900">Versions</h3>
              <button
                onClick={() => loadVersions(dataset)}
                disabled={busy}
                className="ml-auto px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm disabled:opacity-50"
              >
                Refresh
              </button>
            </div>

            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-2">Version</th>
                    <th className="py-2">Active</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {versions.map(v => (
                    <tr key={v.version} className="border-t">
                      <td className="py-2 font-mono">{v.version}</td>
                      <td className="py-2">{v.active ? "yes" : ""}</td>
                      <td className="py-2 flex gap-2 flex-wrap">
                        <button
                          onClick={() => doActivateVersion(v.version)}
                          disabled={busy}
                          className="px-2 py-1 rounded bg-gray-900 text-white hover:bg-gray-800 text-xs disabled:opacity-50"
                        >
                          Activate
                        </button>
                        <button
                          onClick={() => doDeleteVersion(v.version)}
                          disabled={busy}
                          className="px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600 text-xs disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {versions.length === 0 && (
                    <tr><td className="py-3 text-gray-500" colSpan={3}>No versions</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Quality */}
      {subTab === "quality" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-gray-900">Quality gate</h3>

              <div className="ml-auto flex items-center gap-2">
                <select
                  className="px-3 py-2 rounded-lg border bg-white text-sm"
                  value={qualityVersion}
                  onChange={(e) => setQualityVersion(e.target.value)}
                >
                  {versions
                    .filter(v => v.version)
                    .map(v => (
                      <option key={v.version} value={v.version}>
                        {v.version}{v.active ? " (active)" : ""}
                      </option>
                    ))}
                </select>

                <label className="text-sm text-gray-700 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rescan}
                    onChange={(e) => setRescan(e.target.checked)}
                  />
                  rescan
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.keys(gate).map(k => (
                <label key={k} className="text-sm text-gray-700">
                  {k}
                  <input
                    className="mt-1 w-full px-3 py-2 rounded-lg border"
                    value={gate[k]}
                    onChange={(e) => setGate(g => ({ ...g, [k]: e.target.value }))}
                  />
                </label>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={doQualityReport}
                disabled={busy || !qualityVersion}
                className="flex-1 px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm disabled:opacity-50"
              >
                Refresh report
              </button>
              <button
                onClick={doQualityFailures}
                disabled={busy || !qualityVersion}
                className="flex-1 px-3 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 text-sm disabled:opacity-50"
              >
                Load failures
              </button>
            </div>

            <div>
              <div className="flex items-center mb-2">
                <div className="text-sm font-medium text-gray-800">
                  Exclusions <span className="text-gray-500">({exclusions.length})</span>
                </div>
                <div className="ml-auto flex gap-2">
                  <button
                    onClick={() => saveExclusions("add")}
                    disabled={busy}
                    className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-xs disabled:opacity-50"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => saveExclusions("remove")}
                    disabled={busy}
                    className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-xs disabled:opacity-50"
                  >
                    Remove
                  </button>
                  <button
                    onClick={() => saveExclusions("set")}
                    disabled={busy}
                    className="px-2 py-1 rounded bg-gray-900 text-white hover:bg-gray-800 text-xs disabled:opacity-50"
                  >
                    Set list
                  </button>
                  <button
                    onClick={() => saveExclusions("clear")}
                    disabled={busy}
                    className="px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600 text-xs disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <textarea
                className="w-full min-h-[220px] p-3 rounded-xl border font-mono text-xs"
                value={exText}
                onChange={(e) => setExText(e.target.value)}
                placeholder={"one relpath per line\nexample: category/model.stl"}
              />
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-4 space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900">Report</h3>
              <pre className="mt-2 text-xs bg-gray-900 text-gray-100 rounded-xl p-3 overflow-auto">
                {JSON.stringify(qualityReport, null, 2)}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900">Failures</h3>
              {!qualityFailures ? (
                <div className="text-sm text-gray-500">Click “Load failures” to fetch relpaths</div>
              ) : (
                <pre className="mt-2 text-xs bg-gray-900 text-gray-100 rounded-xl p-3 overflow-auto">
                  {JSON.stringify(qualityFailures, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
