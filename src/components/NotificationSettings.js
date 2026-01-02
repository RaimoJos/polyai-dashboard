import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api, unwrap } from "../services/api";

/**
 * NotificationSettings
 * - Minimal, compile-safe preferences UI.
 * - Saves to backend if available; otherwise keeps local state functional.
 */
export default function NotificationSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [desktopEnabled, setDesktopEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);

  const [enabledTypes, setEnabledTypes] = useState({
    job_failed: true,
    job_completed: true,
    temp_alert: true,
    printer_offline: true,
  });

  const typeKeys = useMemo(() => Object.keys(enabledTypes), [enabledTypes]);

  const loadPrefs = useCallback(async () => {
    setLoading(true);
    setError("");
    setOkMsg("");
    try {
      const resp = await api.getNotificationPreferences?.();
      const prefs = unwrap(resp) || resp?.data || {};

      setSoundEnabled(Boolean(prefs.sound_enabled ?? prefs.soundEnabled ?? true));
      setDesktopEnabled(Boolean(prefs.desktop_enabled ?? prefs.desktopEnabled ?? false));
      setEmailEnabled(Boolean(prefs.email_enabled ?? prefs.emailEnabled ?? false));

      // IMPORTANT: this is the correct merge
      if (prefs.enabled_types && typeof prefs.enabled_types === "object") {
        setEnabledTypes((prev) => ({ ...prev, ...prefs.enabled_types }));
      } else if (prefs.enabledTypes && typeof prefs.enabledTypes === "object") {
        setEnabledTypes((prev) => ({ ...prev, ...prefs.enabledTypes }));
      }
    } catch (e) {
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.message ||
        "Failed to load notification preferences";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrefs();
  }, [loadPrefs]);

  const toggleType = (k) => {
    setEnabledTypes((prev) => ({ ...prev, [k]: !prev[k] }));
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setOkMsg("");
    try {
      const payload = {
        sound_enabled: soundEnabled,
        desktop_enabled: desktopEnabled,
        email_enabled: emailEnabled,
        enabled_types: enabledTypes,
      };
      await api.saveNotificationPreferences?.(payload);
      setOkMsg("Saved.");
    } catch (e) {
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.message ||
        "Failed to save preferences";
      setError(String(msg));
    } finally {
      setSaving(false);
      setTimeout(() => setOkMsg(""), 3000);
    }
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Notification Settings</h2>
        <div className="panel-subheader">Alerts, channels and event types</div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button className="btn btn-secondary" onClick={loadPrefs} disabled={loading || saving}>
          Refresh
        </button>
        <button className="btn btn-primary" onClick={save} disabled={loading || saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {error ? <div className="notice notice-error">{error}</div> : null}
      {okMsg ? <div className="notice notice-success">{okMsg}</div> : null}

      {loading ? (
        <div style={{ opacity: 0.85 }}>Loading…</div>
      ) : (
        <>
          <div className="section">
            <h3>Channels</h3>
            <label style={{ display: "block", marginTop: 8 }}>
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
              />{" "}
              Sound alerts
            </label>
            <label style={{ display: "block", marginTop: 8 }}>
              <input
                type="checkbox"
                checked={desktopEnabled}
                onChange={(e) => setDesktopEnabled(e.target.checked)}
              />{" "}
              Desktop notifications
            </label>
            <label style={{ display: "block", marginTop: 8 }}>
              <input
                type="checkbox"
                checked={emailEnabled}
                onChange={(e) => setEmailEnabled(e.target.checked)}
              />{" "}
              Email notifications
            </label>
          </div>

          <div className="section" style={{ marginTop: 18 }}>
            <h3>Enabled event types</h3>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th style={{ width: 120 }}>Enabled</th>
                  </tr>
                </thead>
                <tbody>
                  {typeKeys.map((k) => (
                    <tr key={k}>
                      <td>{k}</td>
                      <td>
                        <input
                          type="checkbox"
                          checked={Boolean(enabledTypes[k])}
                          onChange={() => toggleType(k)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ opacity: 0.8, marginTop: 10 }}>
              If you add new notification types on the backend later, this UI will automatically
              merge them into the list.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
