import React, { useState } from "react";
import { api, unwrap } from "../services/api";

export default function AIDashboard() {
  const [subTab, setSubTab] = useState("text"); // text | prediction | stats

  // Text generation
  const [prompt, setPrompt] = useState("ROMEO:");
  const [dataset, setDataset] = useState("shakespeare_char");
  const [maxTokens, setMaxTokens] = useState(256);
  const [temperature, setTemperature] = useState(0.8);
  const [genBusy, setGenBusy] = useState(false);
  const [genOut, setGenOut] = useState("");
  const [genErr, setGenErr] = useState(null);

  // Prediction
  const [jobId, setJobId] = useState("");
  const [includeTelemetry, setIncludeTelemetry] = useState(false);
  const [storePrediction, setStorePrediction] = useState(true);
  const [predBusy, setPredBusy] = useState(false);
  const [predOut, setPredOut] = useState(null);
  const [predErr, setPredErr] = useState(null);

  // Stats
  const [days, setDays] = useState(7);
  const [topN, setTopN] = useState(20);
  const [statsBusy, setStatsBusy] = useState(false);
  const [statsOut, setStatsOut] = useState(null);
  const [featOut, setFeatOut] = useState(null);
  const [modelOut, setModelOut] = useState(null);
  const [statsErr, setStatsErr] = useState(null);

  async function runGenerate() {
    setGenBusy(true);
    setGenErr(null);
    setGenOut("");
    try {
      // Matches backend fields: prompt/dataset/max_tokens/temperature
      const res = await api.generateText({
        prompt,
        dataset,
        max_tokens: Number(maxTokens),
        temperature: Number(temperature),
      });
      const data = unwrap(res);
      setGenOut(String(data?.text ?? ""));
    } catch (e) {
      setGenErr(e?.message || String(e));
    } finally {
      setGenBusy(false);
    }
  }

  async function runPredict() {
    setPredBusy(true);
    setPredErr(null);
    setPredOut(null);
    try {
      const id = String(jobId).trim();
      if (!id) throw new Error("job_id is required");
      const res = await api.predictJobQuality(id, {
        include_telemetry: includeTelemetry,
        store: storePrediction,
      });
      setPredOut(unwrap(res));
    } catch (e) {
      setPredErr(e?.message || String(e));
    } finally {
      setPredBusy(false);
    }
  }

  async function loadStats() {
    setStatsBusy(true);
    setStatsErr(null);
    try {
      const [s, f, m] = await Promise.all([
        api.getPredictionStats(Number(days)),
        api.getFeatureImportance(),
        api.getPredictionModelInfo(),
      ]);
      setStatsOut(unwrap(s));
      setFeatOut(unwrap(f));
      setModelOut(unwrap(m));
    } catch (e) {
      setStatsErr(e?.message || String(e));
    } finally {
      setStatsBusy(false);
    }
  }

  const tabs = [
    { id: "text", label: "Text generator" },
    { id: "prediction", label: "Quality prediction" },
    { id: "stats", label: "Prediction stats" },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-900">AI Lab</h2>
          <div className="text-xs text-gray-500">
            Text generation + quality predictor UI
          </div>
        </div>

        <div className="mt-3 flex gap-2 flex-wrap">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`px-3 py-2 rounded-lg text-sm ${
                subTab === t.id
                  ? "bg-blue-600 text-white"
                  : "bg-gray-50 text-gray-700 hover:bg-gray-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {subTab === "text" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border rounded-2xl p-4 space-y-4">
            <h3 className="font-semibold text-gray-900">Text generation</h3>

            <label className="block text-sm text-gray-700">
              dataset
              <input
                className="mt-1 w-full px-3 py-2 rounded-lg border"
                value={dataset}
                onChange={(e) => setDataset(e.target.value)}
                placeholder="shakespeare_char"
              />
            </label>

            <label className="block text-sm text-gray-700">
              prompt
              <textarea
                className="mt-1 w-full min-h-[160px] px-3 py-2 rounded-lg border font-mono text-sm"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm text-gray-700">
                max_tokens
                <input
                  className="mt-1 w-full px-3 py-2 rounded-lg border"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(e.target.value)}
                />
              </label>
              <label className="block text-sm text-gray-700">
                temperature
                <input
                  className="mt-1 w-full px-3 py-2 rounded-lg border"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                />
              </label>
            </div>

            {genErr && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                {genErr}
              </div>
            )}

            <button
              onClick={runGenerate}
              disabled={genBusy}
              className="w-full px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {genBusy ? "Generating…" : "Generate"}
            </button>
          </div>

          <div className="bg-white border rounded-2xl p-4">
            <h3 className="font-semibold text-gray-900">Output</h3>
            <pre className="mt-2 text-xs bg-gray-900 text-gray-100 rounded-xl p-3 overflow-auto min-h-[320px] whitespace-pre-wrap">
              {genOut}
            </pre>
          </div>
        </div>
      )}

      {subTab === "prediction" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border rounded-2xl p-4 space-y-4">
            <h3 className="font-semibold text-gray-900">Predict by job_id</h3>

            <label className="block text-sm text-gray-700">
              job_id
              <input
                className="mt-1 w-full px-3 py-2 rounded-lg border"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                placeholder="123"
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={includeTelemetry}
                onChange={(e) => setIncludeTelemetry(e.target.checked)}
              />
              include_telemetry
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={storePrediction}
                onChange={(e) => setStorePrediction(e.target.checked)}
              />
              store prediction in DB
            </label>

            {predErr && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                {predErr}
              </div>
            )}

            <button
              onClick={runPredict}
              disabled={predBusy}
              className="w-full px-3 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {predBusy ? "Predicting…" : "Predict"}
            </button>
          </div>

          <div className="bg-white border rounded-2xl p-4">
            <h3 className="font-semibold text-gray-900">Result</h3>
            <pre className="mt-2 text-xs bg-gray-900 text-gray-100 rounded-xl p-3 overflow-auto min-h-[320px]">
              {JSON.stringify(predOut, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {subTab === "stats" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border rounded-2xl p-4 space-y-4">
            <h3 className="font-semibold text-gray-900">Prediction stats</h3>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm text-gray-700">
                days
                <input
                  className="mt-1 w-full px-3 py-2 rounded-lg border"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                />
              </label>
              <label className="block text-sm text-gray-700">
                top (feature importance)
                <input
                  className="mt-1 w-full px-3 py-2 rounded-lg border"
                  value={topN}
                  onChange={(e) => setTopN(e.target.value)}
                />
              </label>
            </div>

            {statsErr && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                {statsErr}
              </div>
            )}

            <button
              onClick={loadStats}
              disabled={statsBusy}
              className="w-full px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {statsBusy ? "Loading…" : "Load stats"}
            </button>

            <div className="text-xs text-gray-500">
              Endpoints: /prediction/stats • /prediction/feature-importance • /prediction/model/info
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-4 space-y-4">
            <div>
              <div className="font-semibold text-gray-900">Stats</div>
              <pre className="mt-2 text-xs bg-gray-900 text-gray-100 rounded-xl p-3 overflow-auto max-h-[220px]">
                {JSON.stringify(statsOut, null, 2)}
              </pre>
            </div>
            <div>
              <div className="font-semibold text-gray-900">Feature importance</div>
              <pre className="mt-2 text-xs bg-gray-900 text-gray-100 rounded-xl p-3 overflow-auto max-h-[220px]">
                {JSON.stringify(featOut, null, 2)}
              </pre>
            </div>
            <div>
              <div className="font-semibold text-gray-900">Model info</div>
              <pre className="mt-2 text-xs bg-gray-900 text-gray-100 rounded-xl p-3 overflow-auto max-h-[220px]">
                {JSON.stringify(modelOut, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
