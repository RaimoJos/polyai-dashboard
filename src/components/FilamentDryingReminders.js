import React, { useEffect, useState, useCallback } from "react";
import { api, unwrap } from "../services/api";

/**
 * FilamentDryingReminders
 * - Tracks moisture exposure time for filament spools
 * - Shows alerts for spools needing drying
 * - Allows marking spools as dried or sealed
 */
export default function FilamentDryingReminders() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [alerts, setAlerts] = useState([]);
  const [exposureRecords, setExposureRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [activeTab, setActiveTab] = useState("alerts");
  const [actionLoading, setActionLoading] = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      // Load alerts, records, and summary in parallel
      const [alertsResp, recordsResp, summaryResp] = await Promise.all([
        api.getDryingAlerts(),
        api.getExposureRecords(),
        api.getExposureSummary(),
      ]);

      const alertsData = unwrap(alertsResp);
      const recordsData = unwrap(recordsResp);
      const summaryData = unwrap(summaryResp);

      setAlerts(alertsData?.alerts || []);
      setExposureRecords(recordsData?.records || []);
      setSummary(summaryData);
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to load drying data";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Auto-refresh every 60 seconds
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleMarkDried = async (spoolId) => {
    setActionLoading((prev) => ({ ...prev, [spoolId]: "drying" }));
    try {
      await api.markSpoolDried(spoolId);
      await loadData();
    } catch (err) {
      console.error("Failed to mark spool as dried:", err);
    } finally {
      setActionLoading((prev) => ({ ...prev, [spoolId]: null }));
    }
  };

  const handleStartDrying = async (spoolId) => {
    setActionLoading((prev) => ({ ...prev, [spoolId]: "starting" }));
    try {
      await api.startSpoolDrying(spoolId);
      await loadData();
    } catch (err) {
      console.error("Failed to start drying:", err);
    } finally {
      setActionLoading((prev) => ({ ...prev, [spoolId]: null }));
    }
  };

  const handleSealSpool = async (spoolId) => {
    setActionLoading((prev) => ({ ...prev, [spoolId]: "sealing" }));
    try {
      await api.stopExposureTracking(spoolId, "sealed");
      await loadData();
    } catch (err) {
      console.error("Failed to seal spool:", err);
    } finally {
      setActionLoading((prev) => ({ ...prev, [spoolId]: null }));
    }
  };

  const formatHours = (hours) => {
    if (hours === undefined || hours === null) return "N/A";
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours.toFixed(0)}h`;
  };

  const getStatusBadge = (status) => {
    const badges = {
      dry: { className: "badge-success", label: "Dry" },
      exposed: { className: "badge-warning", label: "Exposed" },
      needs_drying: { className: "badge-danger", label: "Needs Drying" },
      drying: { className: "badge-info", label: "Drying" },
      unknown: { className: "badge-secondary", label: "Unknown" },
    };
    const badge = badges[status] || badges.unknown;
    return <span className={`badge ${badge.className}`}>{badge.label}</span>;
  };

  const getExposureLevelBadge = (level) => {
    const badges = {
      safe: { className: "badge-success", label: "Safe" },
      warning: { className: "badge-warning", label: "Warning" },
      critical: { className: "badge-danger", label: "Critical" },
    };
    const badge = badges[level] || badges.safe;
    return <span className={`badge ${badge.className}`}>{badge.label}</span>;
  };

  if (loading && !alerts.length && !exposureRecords.length) {
    return <div className="panel">Loading filament drying data...</div>;
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Filament Drying Reminders</h2>
        {summary && (
          <div className="panel-subheader">
            Tracked: <strong>{summary.total_tracked || 0}</strong>
            {summary.spools_needing_drying > 0 && (
              <span className="text-danger ml-2">
                {summary.spools_needing_drying} need drying
              </span>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="notice notice-error">
          {error}
          <div className="notice-hint">
            Ensure the drying API endpoints are available at{" "}
            <code>/api/materials/drying/*</code>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs mb-3">
        <button
          className={`tab ${activeTab === "alerts" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("alerts")}
        >
          Alerts
          {alerts.length > 0 && (
            <span className="badge badge-danger ml-1">{alerts.length}</span>
          )}
        </button>
        <button
          className={`tab ${activeTab === "tracking" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("tracking")}
        >
          Exposure Tracking
        </button>
        <button
          className={`tab ${activeTab === "summary" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("summary")}
        >
          Summary
        </button>
      </div>

      {/* Alerts Tab */}
      {activeTab === "alerts" && (
        <div className="alerts-list">
          {alerts.length === 0 ? (
            <div className="notice notice-success">
              No filaments currently need drying.
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.spool_id}
                className={`alert-card ${
                  alert.level === "critical" ? "alert-critical" : "alert-warning"
                }`}
              >
                <div className="alert-header">
                  <span className="alert-title">
                    {alert.spool_name || alert.spool_id}
                  </span>
                  <span
                    className={`badge ${
                      alert.level === "critical"
                        ? "badge-danger"
                        : "badge-warning"
                    }`}
                  >
                    {alert.level}
                  </span>
                </div>
                <div className="alert-body">
                  <p>{alert.message}</p>
                  <div className="alert-details">
                    <span>Material: {alert.material_type}</span>
                    <span>Exposed: {formatHours(alert.exposure_hours)}</span>
                  </div>
                  {alert.recommended_action && (
                    <div className="alert-recommendation">
                      {alert.recommended_action}
                    </div>
                  )}
                </div>
                <div className="alert-actions">
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => handleStartDrying(alert.spool_id)}
                    disabled={actionLoading[alert.spool_id]}
                  >
                    {actionLoading[alert.spool_id] === "starting"
                      ? "..."
                      : "Start Drying"}
                  </button>
                  <button
                    className="btn btn-sm btn-success"
                    onClick={() => handleMarkDried(alert.spool_id)}
                    disabled={actionLoading[alert.spool_id]}
                  >
                    {actionLoading[alert.spool_id] === "drying"
                      ? "..."
                      : "Mark Dried"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Exposure Tracking Tab */}
      {activeTab === "tracking" && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Spool</th>
                <th>Material</th>
                <th>Status</th>
                <th>Exposure</th>
                <th>Level</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {exposureRecords.map((record) => (
                <tr key={record.spool_id}>
                  <td>{record.spool_name || record.spool_id}</td>
                  <td>{record.material_type}</td>
                  <td>{getStatusBadge(record.status)}</td>
                  <td>
                    {record.status === "exposed"
                      ? formatHours(record.current_exposure_hours)
                      : "-"}
                  </td>
                  <td>
                    {record.status === "exposed"
                      ? getExposureLevelBadge(record.exposure_level)
                      : "-"}
                  </td>
                  <td>
                    {record.status === "exposed" && (
                      <>
                        <button
                          className="btn btn-xs btn-primary mr-1"
                          onClick={() => handleStartDrying(record.spool_id)}
                          disabled={actionLoading[record.spool_id]}
                          title="Put in dryer"
                        >
                          Dry
                        </button>
                        <button
                          className="btn btn-xs btn-secondary"
                          onClick={() => handleSealSpool(record.spool_id)}
                          disabled={actionLoading[record.spool_id]}
                          title="Seal spool"
                        >
                          Seal
                        </button>
                      </>
                    )}
                    {record.status === "drying" && (
                      <button
                        className="btn btn-xs btn-success"
                        onClick={() => handleMarkDried(record.spool_id)}
                        disabled={actionLoading[record.spool_id]}
                        title="Mark as dried"
                      >
                        Done
                      </button>
                    )}
                    {record.status === "dry" && (
                      <span className="text-muted">Ready</span>
                    )}
                  </td>
                </tr>
              ))}
              {exposureRecords.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ opacity: 0.8 }}>
                    No spools being tracked. Exposure tracking starts
                    automatically when spools are used.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary Tab */}
      {activeTab === "summary" && summary && (
        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-value">{summary.total_tracked || 0}</div>
            <div className="summary-label">Total Tracked</div>
          </div>
          <div className="summary-card">
            <div className="summary-value text-danger">
              {summary.spools_needing_drying || 0}
            </div>
            <div className="summary-label">Need Drying</div>
          </div>
          <div className="summary-card">
            <div className="summary-value text-warning">
              {summary.active_alerts || 0}
            </div>
            <div className="summary-label">Active Alerts</div>
          </div>

          {summary.by_status && Object.keys(summary.by_status).length > 0 && (
            <div className="summary-section">
              <h4>By Status</h4>
              <div className="status-breakdown">
                {Object.entries(summary.by_status).map(([status, count]) => (
                  <div key={status} className="status-item">
                    {getStatusBadge(status)}: {count}
                  </div>
                ))}
              </div>
            </div>
          )}

          {summary.by_material && Object.keys(summary.by_material).length > 0 && (
            <div className="summary-section">
              <h4>By Material</h4>
              <div className="table-wrap">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Total</th>
                      <th>Exposed</th>
                      <th>Need Drying</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(summary.by_material).map(([material, data]) => (
                      <tr key={material}>
                        <td>{material}</td>
                        <td>{data.count}</td>
                        <td>{data.exposed_count}</td>
                        <td
                          className={
                            data.needs_drying_count > 0 ? "text-danger" : ""
                          }
                        >
                          {data.needs_drying_count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        .tabs {
          display: flex;
          gap: 0.5rem;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 0.5rem;
        }
        .tab {
          padding: 0.5rem 1rem;
          border: none;
          background: none;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s;
        }
        .tab:hover {
          background: #f3f4f6;
        }
        .tab-active {
          background: #3b82f6;
          color: white;
        }
        .tab-active:hover {
          background: #2563eb;
        }
        .badge {
          display: inline-block;
          padding: 0.2rem 0.5rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 500;
        }
        .badge-success {
          background: #d1fae5;
          color: #065f46;
        }
        .badge-warning {
          background: #fef3c7;
          color: #92400e;
        }
        .badge-danger {
          background: #fee2e2;
          color: #991b1b;
        }
        .badge-info {
          background: #dbeafe;
          color: #1e40af;
        }
        .badge-secondary {
          background: #e5e7eb;
          color: #374151;
        }
        .alert-card {
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1rem;
          border-left: 4px solid;
        }
        .alert-critical {
          background: #fef2f2;
          border-color: #ef4444;
        }
        .alert-warning {
          background: #fffbeb;
          border-color: #f59e0b;
        }
        .alert-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }
        .alert-title {
          font-weight: 600;
          font-size: 1.1rem;
        }
        .alert-body p {
          margin: 0.5rem 0;
        }
        .alert-details {
          display: flex;
          gap: 1rem;
          font-size: 0.875rem;
          color: #6b7280;
          margin-top: 0.5rem;
        }
        .alert-recommendation {
          background: #f3f4f6;
          padding: 0.5rem;
          border-radius: 4px;
          font-size: 0.875rem;
          margin-top: 0.5rem;
        }
        .alert-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: 1rem;
        }
        .btn {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }
        .btn-sm {
          padding: 0.375rem 0.75rem;
          font-size: 0.875rem;
        }
        .btn-xs {
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
        }
        .btn-primary {
          background: #3b82f6;
          color: white;
        }
        .btn-primary:hover {
          background: #2563eb;
        }
        .btn-success {
          background: #10b981;
          color: white;
        }
        .btn-success:hover {
          background: #059669;
        }
        .btn-secondary {
          background: #6b7280;
          color: white;
        }
        .btn-secondary:hover {
          background: #4b5563;
        }
        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 1rem;
        }
        .summary-card {
          background: #f9fafb;
          border-radius: 8px;
          padding: 1rem;
          text-align: center;
        }
        .summary-value {
          font-size: 2rem;
          font-weight: bold;
        }
        .summary-label {
          color: #6b7280;
          font-size: 0.875rem;
        }
        .summary-section {
          grid-column: 1 / -1;
          margin-top: 1rem;
        }
        .summary-section h4 {
          margin-bottom: 0.5rem;
        }
        .status-breakdown {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .status-item {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }
        .text-danger {
          color: #dc2626;
        }
        .text-warning {
          color: #d97706;
        }
        .text-muted {
          color: #9ca3af;
        }
        .ml-1 {
          margin-left: 0.25rem;
        }
        .ml-2 {
          margin-left: 0.5rem;
        }
        .mr-1 {
          margin-right: 0.25rem;
        }
        .mb-3 {
          margin-bottom: 0.75rem;
        }
        .notice {
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1rem;
        }
        .notice-success {
          background: #d1fae5;
          color: #065f46;
        }
        .notice-error {
          background: #fee2e2;
          color: #991b1b;
        }
        .notice-hint {
          font-size: 0.875rem;
          margin-top: 0.5rem;
          opacity: 0.8;
        }
      `}</style>
    </div>
  );
}
