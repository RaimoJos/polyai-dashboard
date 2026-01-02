import React, { useEffect, useState } from "react";
import { DatasetsAPI, DatasetVersionsAPI } from "../services/polyaiApi";
import toast from '../utils/toast';

export default function DatasetVersionsPage() {
  const [dataset, setDataset] = useState("3d_models");
  const [datasets, setDatasets] = useState([]);
  const [versions, setVersions] = useState([]);
  const [active, setActive] = useState(null);

  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const [buildForm, setBuildForm] = useState({
    version: "",
    activate_after: true,
    // 3d_models params (others are snapshot-only)
    input_dir: "",
    precision: 2,
    train_split: 0.95,
    max_files: "",
    incremental: true,
    reuse_if_unchanged: true,
    hash_mode: "fast",
    deduplicate_geom: true,
  });

  async function loadDatasets() {
    const res = await DatasetsAPI.list({ ready_only: false });
    setDatasets(res.datasets || []);
  }

  async function loadVersions() {
    setBusy(true);
    setErr(null);
    try {
      const res = await DatasetVersionsAPI.list({ dataset });
      setActive(res.active_version || null);
      setVersions(res.versions || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadDatasets();
  }, []);

  useEffect(() => {
    loadVersions();
  }, [dataset]); // eslint-disable-line

  async function doBuild() {
    setBusy(true);
    setErr(null);
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

      await DatasetVersionsAPI.build(payload);
      await loadVersions();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function doActivate(v) {
    setBusy(true);
    setErr(null);
    try {
      await DatasetVersionsAPI.activate({ dataset, version: v });
      await loadVersions();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function doDelete(v) {
    setBusy(true);
    setErr(null);
    try {
      await DatasetVersionsAPI.delete({ dataset, version: v });
      await loadVersions();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function doCleanup(dry_run) {
    setBusy(true);
    setErr(null);
    try {
      const res = await DatasetVersionsAPI.cleanup({ dataset, keep_count: 5, dry_run });
      const message = dry_run
        ? `Dry run: ${res?.versions_to_remove || 0} versions would be removed`
        : `Cleanup complete: ${res?.versions_removed || 0} versions removed`;
      toast.success(message);
      await loadVersions();
    } catch (e) {
      toast.error(e.message || 'Cleanup failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Dataset Versions</h2>
        <button disabled={busy} onClick={loadVersions}>Refresh</button>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ opacity: 0.8 }}>Dataset:</span>
          <select value={dataset} onChange={(e) => setDataset(e.target.value)}>
            {datasets.map((d) => {
              const name = d.name || d;
              return <option key={name} value={name}>{name}</option>;
            })}
          </select>
        </div>
      </div>

      {err && <div style={{ color: "crimson", marginTop: 10 }}>{err}</div>}

      <div style={{ marginTop: 12, opacity: 0.85 }}>
        Active version: <b>{active || "(none)"}</b>
      </div>

      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <h3 style={{ marginTop: 0 }}>Build / Snapshot</h3>
          <div style={{ display: "grid", gap: 8 }}>
            <label>
              version (optional):
              <input style={{ width: "100%" }} value={buildForm.version}
                     onChange={(e) => setBuildForm(f => ({ ...f, version: e.target.value }))} />
            </label>

            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={buildForm.activate_after}
                     onChange={(e) => setBuildForm(f => ({ ...f, activate_after: e.target.checked }))} />
              activate_after
            </label>

            {dataset === "3d_models" && (
              <>
                <label>
                  input_dir (optional):
                  <input style={{ width: "100%" }} value={buildForm.input_dir}
                         onChange={(e) => setBuildForm(f => ({ ...f, input_dir: e.target.value }))} />
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <label>
                    precision:
                    <input style={{ width: "100%" }} value={buildForm.precision}
                           onChange={(e) => setBuildForm(f => ({ ...f, precision: e.target.value }))} />
                  </label>

                  <label>
                    train_split:
                    <input style={{ width: "100%" }} value={buildForm.train_split}
                           onChange={(e) => setBuildForm(f => ({ ...f, train_split: e.target.value }))} />
                  </label>

                  <label>
                    max_files (blank=unlimited):
                    <input style={{ width: "100%" }} value={buildForm.max_files}
                           onChange={(e) => setBuildForm(f => ({ ...f, max_files: e.target.value }))} />
                  </label>

                  <label>
                    hash_mode:
                    <input style={{ width: "100%" }} value={buildForm.hash_mode}
                           onChange={(e) => setBuildForm(f => ({ ...f, hash_mode: e.target.value }))} />
                  </label>
                </div>

                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="checkbox" checked={buildForm.incremental}
                         onChange={(e) => setBuildForm(f => ({ ...f, incremental: e.target.checked }))} />
                  incremental
                </label>

                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="checkbox" checked={buildForm.reuse_if_unchanged}
                         onChange={(e) => setBuildForm(f => ({ ...f, reuse_if_unchanged: e.target.checked }))} />
                  reuse_if_unchanged
                </label>

                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="checkbox" checked={buildForm.deduplicate_geom}
                         onChange={(e) => setBuildForm(f => ({ ...f, deduplicate_geom: e.target.checked }))} />
                  deduplicate_geom
                </label>
              </>
            )}

            <button disabled={busy} onClick={doBuild}>
              {busy ? "Working..." : (dataset === "3d_models" ? "Build version" : "Snapshot dataset")}
            </button>

            <div style={{ display: "flex", gap: 8 }}>
              <button disabled={busy} onClick={() => doCleanup(true)}>Cleanup (dry-run)</button>
              <button disabled={busy} onClick={() => doCleanup(false)}>Cleanup (delete)</button>
            </div>
          </div>
        </div>

        <div>
          <h3 style={{ marginTop: 0 }}>Versions</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">Version</th>
                <th align="left">Active</th>
                <th align="left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.version}>
                  <td style={{ padding: "6px 4px" }}>{v.version}</td>
                  <td style={{ padding: "6px 4px" }}>{v.active ? "yes" : ""}</td>
                  <td style={{ padding: "6px 4px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button disabled={busy} onClick={() => doActivate(v.version)}>Activate</button>
                    <button disabled={busy} onClick={() => doDelete(v.version)}>Delete</button>
                  </td>
                </tr>
              ))}
              {versions.length === 0 && (
                <tr><td colSpan={3} style={{ padding: 8, opacity: 0.7 }}>No versions</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
