import React, { useEffect, useState } from "react";
import { PrintJobsAPI, PrintersAPI } from "../services/polyaiApi";

export default function PrintQueuePage() {
  const [active, setActive] = useState([]);
  const [recent, setRecent] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const [filterPrinter, setFilterPrinter] = useState("");
  const [newJob, setNewJob] = useState({ model_name: "", printer: "", stl_path: "" });

  async function load() {
    setErr(null);
    const [pRes, jRes] = await Promise.all([
      PrintersAPI.list(),
      PrintJobsAPI.list({ printer: filterPrinter }),
    ]);

    const ps = pRes.printers || [];
    setPrinters(ps);

    setActive(jRes.active_jobs || []);
    setRecent(jRes.recent_jobs || []);

    // auto-fill printer in new-job form if empty
    if (!newJob.printer && ps[0]?.name) {
      setNewJob(n => ({ ...n, printer: ps[0].name }));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterPrinter]);

  async function doAction(job_id, action) {
    setBusy(true);
    setErr(null);
    try {
      await PrintJobsAPI.action(job_id, action);
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function createJob(e) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await PrintJobsAPI.create({
        model_name: newJob.model_name.trim(),
        printer: newJob.printer,
        stl_path: newJob.stl_path.trim() || null,
        settings: {},
      });
      setNewJob(n => ({ ...n, model_name: "", stl_path: "" }));
      await load();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  const JobRow = ({ j }) => (
    <tr>
      <td>{j.job_id || j.id}</td>
      <td>{j.model_name}</td>
      <td>{j.printer_name || ""}</td>
      <td>{j.status}</td>
      <td>{(typeof j.progress === "number") ? `${Math.round(j.progress * 100)}%` : ""}</td>
      <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button disabled={busy} onClick={() => doAction(j.job_id || j.id, "start")}>Start</button>
        <button disabled={busy} onClick={() => doAction(j.job_id || j.id, "pause")}>Pause</button>
        <button disabled={busy} onClick={() => doAction(j.job_id || j.id, "resume")}>Resume</button>
        <button disabled={busy} onClick={() => doAction(j.job_id || j.id, "cancel")}>Cancel</button>
        <button disabled={busy} onClick={() => doAction(j.job_id || j.id, "complete")}>Complete</button>
        <button disabled={busy} onClick={() => doAction(j.job_id || j.id, "fail")}>Fail</button>
      </td>
    </tr>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h2 style={{ margin: 0 }}>Print Queue</h2>
        <button onClick={load} disabled={busy}>Refresh</button>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ opacity: 0.8 }}>Filter printer:</span>
          <select value={filterPrinter} onChange={(e) => setFilterPrinter(e.target.value)}>
            <option value="">All</option>
            {printers.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {err && <div style={{ color: "crimson", marginTop: 8 }}>{err}</div>}

      <h3 style={{ marginTop: 16 }}>Create job</h3>
      <form onSubmit={createJob} style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 8, maxWidth: 720 }}>
        <input placeholder="Model name" value={newJob.model_name}
               onChange={e => setNewJob(n => ({ ...n, model_name: e.target.value }))} />
        <select value={newJob.printer} onChange={e => setNewJob(n => ({ ...n, printer: e.target.value }))}>
          {printers.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
        <input style={{ gridColumn: "1 / span 2" }} placeholder="STL path (optional)" value={newJob.stl_path}
               onChange={e => setNewJob(n => ({ ...n, stl_path: e.target.value }))} />
        <button type="submit" disabled={busy} style={{ gridColumn: "1 / span 2" }}>
          {busy ? "Creating..." : "Create job"}
        </button>
      </form>

      <h3 style={{ marginTop: 18 }}>Active jobs</h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th align="left">Job</th>
            <th align="left">Model</th>
            <th align="left">Printer</th>
            <th align="left">Status</th>
            <th align="left">Progress</th>
            <th align="left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {active.map(j => <JobRow key={j.job_id || j.id} j={j} />)}
          {active.length === 0 && (
            <tr><td colSpan={6} style={{ padding: 8, opacity: 0.7 }}>No active jobs</td></tr>
          )}
        </tbody>
      </table>

      <h3 style={{ marginTop: 18 }}>Recent jobs</h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th align="left">Job</th>
            <th align="left">Model</th>
            <th align="left">Printer</th>
            <th align="left">Status</th>
            <th align="left">Progress</th>
            <th align="left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {recent.map(j => <JobRow key={j.job_id || j.id} j={j} />)}
          {recent.length === 0 && (
            <tr><td colSpan={6} style={{ padding: 8, opacity: 0.7 }}>No recent jobs</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
