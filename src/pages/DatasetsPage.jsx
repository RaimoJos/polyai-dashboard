import React, { useEffect, useState } from "react";
import { DatasetsAPI } from "../services/polyaiApi";

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState([]);
  const [readyOnly, setReadyOnly] = useState(true);
  const [selected, setSelected] = useState("");
  const [checkRes, setCheckRes] = useState(null);
  const [inspectRes, setInspectRes] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const [inspectOpts, setInspectOpts] = useState({
    split: "train",
    sample_len: 400,
    sample_start: "",
    include_file_list: true,
    max_list_files: 200,
  });

  async function load() {
    setBusy(true);
    setErr(null);
    try {
      const res = await DatasetsAPI.list({ ready_only: readyOnly });
      setDatasets(res.datasets || []);
      if (!selected && (res.datasets?.[0]?.name || res.datasets?.[0])) {
        const first = res.datasets[0];
        setSelected(first.name || first);
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); }, [readyOnly]); // eslint-disable-line

  async function doCheck() {
    setBusy(true);
    setErr(null);
    try {
      const res = await DatasetsAPI.check({ dataset: selected });
      setCheckRes(res);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function doInspect() {
    setBusy(true);
    setErr(null);
    try {
      const res = await DatasetsAPI.inspect({
        dataset: selected,
        ...inspectOpts,
        sample_start: inspectOpts.sample_start === "" ? "" : Number(inspectOpts.sample_start),
        sample_len: Number(inspectOpts.sample_len),
        max_list_files: Number(inspectOpts.max_list_files),
      });
      setInspectRes(res);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h2 style={{ margin: 0 }}>Datasets</h2>
        <button disabled={busy} onClick={load}>Refresh</button>

        <label style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={readyOnly}
            onChange={(e) => setReadyOnly(e.target.checked)}
          />
          ready_only
        </label>
      </div>

      {err && <div style={{ color: "crimson", marginTop: 10 }}>{err}</div>}

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "320px 1fr", gap: 16 }}>
        <div>
          <h3 style={{ marginTop: 0 }}>Available</h3>
          <select
            style={{ width: "100%" }}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {datasets.map((d) => {
              const name = d.name || d;
              const label = d.name ? `${d.name}  (${d.ready ? "ready" : "not ready"})` : name;
              return <option key={name} value={name}>{label}</option>;
            })}
          </select>

          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button disabled={busy || !selected} onClick={doCheck}>Check</button>
            <button disabled={busy || !selected} onClick={doInspect}>Inspect</button>
          </div>

          <h3 style={{ marginTop: 16 }}>Inspect options</h3>
          <div style={{ display: "grid", gap: 8 }}>
            <label>
              Split:
              <select
                value={inspectOpts.split}
                onChange={(e) => setInspectOpts(o => ({ ...o, split: e.target.value }))}
                style={{ width: "100%" }}
              >
                <option value="train">train</option>
                <option value="val">val</option>
              </select>
            </label>

            <label>
              sample_len:
              <input
                style={{ width: "100%" }}
                value={inspectOpts.sample_len}
                onChange={(e) => setInspectOpts(o => ({ ...o, sample_len: e.target.value }))}
              />
            </label>

            <label>
              sample_start (blank=random):
              <input
                style={{ width: "100%" }}
                value={inspectOpts.sample_start}
                onChange={(e) => setInspectOpts(o => ({ ...o, sample_start: e.target.value }))}
              />
            </label>

            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={inspectOpts.include_file_list}
                onChange={(e) => setInspectOpts(o => ({ ...o, include_file_list: e.target.checked }))}
              />
              include_file_list
            </label>

            <label>
              max_list_files:
              <input
                style={{ width: "100%" }}
                value={inspectOpts.max_list_files}
                onChange={(e) => setInspectOpts(o => ({ ...o, max_list_files: e.target.value }))}
              />
            </label>
          </div>
        </div>

        <div>
          <h3 style={{ marginTop: 0 }}>Results</h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <h4 style={{ marginTop: 0 }}>Check</h4>
              <pre style={{ padding: 12, background: "#111", color: "#eee", borderRadius: 8, overflow: "auto" }}>
                {JSON.stringify(checkRes, null, 2)}
              </pre>
            </div>

            <div>
              <h4 style={{ marginTop: 0 }}>Inspect</h4>
              <pre style={{ padding: 12, background: "#111", color: "#eee", borderRadius: 8, overflow: "auto" }}>
                {JSON.stringify(inspectRes, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
