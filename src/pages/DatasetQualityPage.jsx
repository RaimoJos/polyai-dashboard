import React, { useEffect, useState } from "react";
import { DatasetVersionsAPI, DatasetQualityAPI } from "../services/polyaiApi";

export default function DatasetQualityPage() {
  // backend enforces dataset=3d_models
  const dataset = "3d_models";

  const [versions, setVersions] = useState([]);
  const [version, setVersion] = useState("");
  const [gate, setGate] = useState({
    min_verts: "",
    max_verts: "",
    min_faces: "",
    max_faces: "",
    max_size_mb: "",
  });

  const [rescan, setRescan] = useState(false);
  const [report, setReport] = useState(null);
  const [failures, setFailures] = useState(null);
  const [exclusions, setExclusions] = useState(null);

  const [exText, setExText] = useState("");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  async function loadVersions() {
    const v = await DatasetVersionsAPI.list({ dataset });
    setVersions(v.versions || []);
    if (!version) setVersion(v.active_version || v.versions?.[0]?.version || "");
  }

  useEffect(() => { loadVersions(); }, []); // eslint-disable-line

  async function loadReport() {
    if (!version) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await DatasetQualityAPI.quality({ dataset, version, rescan, gate });
      setReport(r);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadFailures() {
    if (!version) return;
    setBusy(true);
    setErr(null);
    try {
      const f = await DatasetQualityAPI.failures({ dataset, version, limit: 5000, gate });
      setFailures(f);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadExclusions() {
    setBusy(true);
    setErr(null);
    try {
      const ex = await DatasetQualityAPI.exclusionsGet({ dataset });
      setExclusions(ex);
      setExText((ex.relpaths || []).join("\n"));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    // auto reload when version changes
    if (version) {
      loadReport();
      loadExclusions();
      setFailures(null);
    }
  }, [version]); // eslint-disable-line

  async function saveExclusions(mode) {
    setBusy(true);
    setErr(null);
    try {
      const relpaths = exText
        .split("\n")
        .map(s => s.trim())
        .filter(Boolean);

      const res = await DatasetQualityAPI.exclusionsSet({ dataset, mode, relpaths });
      setExclusions(res);
      if (mode === "clear" || mode === "reset") setExText("");
      await loadReport();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h2 style={{ margin: 0 }}>Dataset Quality (3d_models)</h2>
        <button disabled={busy} onClick={loadReport}>Refresh report</button>
        <button disabled={busy} onClick={loadFailures}>Load failures</button>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ opacity: 0.8 }}>Version:</span>
          <select value={version} onChange={(e) => setVersion(e.target.value)}>
            {versions.map(v => <option key={v.version} value={v.version}>{v.version}{v.active ? " (active)" : ""}</option>)}
          </select>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={rescan} onChange={(e) => setRescan(e.target.checked)} />
            rescan
          </label>
        </div>
      </div>

      {err && <div style={{ color: "crimson", marginTop: 10 }}>{err}</div>}

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <h3 style={{ marginTop: 0 }}>Quality gate</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {Object.keys(gate).map((k) => (
              <label key={k}>
                {k}:
                <input
                  style={{ width: "100%" }}
                  value={gate[k]}
                  onChange={(e) => setGate(g => ({ ...g, [k]: e.target.value }))}
                />
              </label>
            ))}
          </div>

          <h3 style={{ marginTop: 16 }}>Exclusions</h3>
          <div style={{ opacity: 0.8, marginBottom: 6 }}>
            Current count: <b>{exclusions?.count ?? "?"}</b>
          </div>

          <textarea
            style={{ width: "100%", minHeight: 220, fontFamily: "monospace" }}
            value={exText}
            onChange={(e) => setExText(e.target.value)}
            placeholder={"one relpath per line\nexample: category/model.stl"}
          />

          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button disabled={busy} onClick={() => saveExclusions("set")}>Set list</button>
            <button disabled={busy} onClick={() => saveExclusions("add")}>Add</button>
            <button disabled={busy} onClick={() => saveExclusions("remove")}>Remove</button>
            <button disabled={busy} onClick={() => saveExclusions("clear")}>Clear</button>
          </div>
        </div>

        <div>
          <h3 style={{ marginTop: 0 }}>Report</h3>
          <pre style={{ padding: 12, background: "#111", color: "#eee", borderRadius: 8, overflow: "auto" }}>
            {JSON.stringify(report, null, 2)}
          </pre>

          <h3 style={{ marginTop: 16 }}>Failures</h3>
          {!failures ? (
            <div style={{ opacity: 0.7 }}>Click “Load failures” to fetch relpaths.</div>
          ) : (
            <pre style={{ padding: 12, background: "#111", color: "#eee", borderRadius: 8, overflow: "auto" }}>
              {JSON.stringify(failures, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
