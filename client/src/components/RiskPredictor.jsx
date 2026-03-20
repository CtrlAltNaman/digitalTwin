import { useState } from "react";

const FIELDS = [
  { key: "temperature",  label: "Temperature-1", unit: "°C",    min: 0,  max: 120,  step: 0.1, placeholder: "e.g. 65.0",  node: "Slave-1" },
  { key: "vibration",    label: "Vibration",     unit: "mm/s",  min: 0,  max: 10,   step: 0.01,placeholder: "e.g. 3.5",   node: "Slave-1" },
  { key: "rpm",          label: "RPM",           unit: "RPM",   min: 0,  max: 2000, step: 1,   placeholder: "e.g. 1450",  node: "Slave-1" },
  { key: "temperature2", label: "Temperature-2", unit: "°C",    min: 0,  max: 120,  step: 0.1, placeholder: "e.g. 60.0",  node: "Slave-2" },
  { key: "humidity",     label: "Humidity",      unit: "%",     min: 0,  max: 100,  step: 0.1, placeholder: "e.g. 45.0",  node: "Slave-2" },
  { key: "flowRate",     label: "Flow Rate",     unit: "L/min", min: 0,  max: 200,  step: 0.1, placeholder: "e.g. 120.0", node: "Slave-2" },
];

const STATUS_STYLE = {
  normal:   { color: "#22c55e", bg: "rgba(34,197,94,0.08)",   border: "rgba(34,197,94,0.3)",   label: "NO FAILURE RISK",  icon: "✓" },
  warning:  { color: "#eab308", bg: "rgba(234,179,8,0.08)",   border: "rgba(234,179,8,0.3)",   label: "CAUTION",          icon: "⚠" },
  critical: { color: "#ef4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.3)",   label: "FAILURE RISK",     icon: "✕" },
};

function RiskBar({ score }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.6 ? "#ef4444" : score >= 0.35 ? "#eab308" : "#22c55e";
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">Risk Score</span>
        <span className="text-xs font-mono font-bold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-panel-900/80 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function RiskPredictor() {
  const [values, setValues] = useState({
    temperature: "", vibration: "", rpm: "",
    temperature2: "", humidity: "", flowRate: "",
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);

  const handleChange = (key, val) => {
    setValues((prev) => ({ ...prev, [key]: val }));
    setResult(null);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const adjusted = {
        temperature:  (parseFloat(values.temperature)  || 0) - 28.00,
        vibration:    (parseFloat(values.vibration)    || 0) - 6.00,
        rpm:          (parseFloat(values.rpm)          || 0) - 130.00,
        temperature2: (parseFloat(values.temperature2) || 0) - 27.50,
        humidity:     (parseFloat(values.humidity)     || 0) - 60.00,
        flowRate:     (parseFloat(values.flowRate)     || 0) - 2.00,
      };

      const resp = await fetch("/api/predict", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(adjusted),
      });
      const json = await resp.json();
      if (!json.success) throw new Error(json.error || "Prediction failed");
      setResult(json.predictions);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const masterStyle  = result ? STATUS_STYLE[result["Master"]?.status  || "normal"] : null;
  const slave1Style  = result ? STATUS_STYLE[result["Slave-1"]?.status || "normal"] : null;
  const slave2Style  = result ? STATUS_STYLE[result["Slave-2"]?.status || "normal"] : null;

  return (
    <section className="mt-10 mb-6">
      {/* Section header */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
          Failure Risk Predictor
        </h2>
        <div className="mt-1 h-px bg-gradient-to-r from-accent-blue/50 to-transparent" />
        <p className="mt-2 text-xs text-gray-600">
          Enter sensor values manually to query the XGBoost model and check failure risk.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* ── Input form ── */}
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-panel-500/20 bg-panel-700/50 backdrop-blur-sm p-6"
        >
          {/* Slave-1 group */}
          <p className="text-[10px] font-mono uppercase tracking-widest text-blue-400 mb-3">
            ● Slave-1 — Temperature · Vibration · RPM
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            {FIELDS.filter((f) => f.node === "Slave-1").map((f) => (
              <div key={f.key}>
                <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                  {f.label} <span className="text-gray-700">({f.unit})</span>
                </label>
                <input
                  type="number"
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  placeholder={f.placeholder}
                  value={values[f.key]}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  className="w-full bg-panel-900/60 border border-panel-500/30 rounded-lg px-3 py-2
                             text-sm font-mono text-gray-200 placeholder-gray-700
                             focus:outline-none focus:border-accent-blue/60 focus:ring-1 focus:ring-accent-blue/30
                             transition-colors"
                />
              </div>
            ))}
          </div>

          {/* Slave-2 group */}
          <p className="text-[10px] font-mono uppercase tracking-widest text-blue-400 mb-3">
            ● Slave-2 — Temperature · Humidity · Flow Rate
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {FIELDS.filter((f) => f.node === "Slave-2").map((f) => (
              <div key={f.key}>
                <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                  {f.label} <span className="text-gray-700">({f.unit})</span>
                </label>
                <input
                  type="number"
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  placeholder={f.placeholder}
                  value={values[f.key]}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  className="w-full bg-panel-900/60 border border-panel-500/30 rounded-lg px-3 py-2
                             text-sm font-mono text-gray-200 placeholder-gray-700
                             focus:outline-none focus:border-accent-blue/60 focus:ring-1 focus:ring-accent-blue/30
                             transition-colors"
                />
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg font-semibold text-sm uppercase tracking-widest
                       bg-accent-blue/20 border border-accent-blue/40 text-accent-blue
                       hover:bg-accent-blue/30 active:scale-[0.98]
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-all duration-150"
          >
            {loading ? "Running Model…" : "Run Prediction"}
          </button>

          {error && (
            <p className="mt-3 text-xs text-red-400 font-mono text-center">{error}</p>
          )}
        </form>

        {/* ── Result panel ── */}
        <div className="rounded-xl border border-panel-500/20 bg-panel-700/50 backdrop-blur-sm p-6 flex flex-col">

          {!result && !loading && (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-14 h-14 rounded-full bg-panel-900/60 border border-panel-500/20 flex items-center justify-center">
                <span className="text-2xl text-gray-700">⚙</span>
              </div>
              <p className="text-xs text-gray-600 uppercase tracking-widest">
                Enter values and run prediction
              </p>
            </div>
          )}

          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
              <p className="text-xs text-gray-500 uppercase tracking-widest">Querying XGBoost model…</p>
            </div>
          )}

          {result && masterStyle && (
            <div className="flex flex-col gap-5">

              {/* Master verdict — big banner */}
              <div
                className="rounded-xl p-5 text-center"
                style={{ background: masterStyle.bg, border: `1px solid ${masterStyle.border}` }}
              >
                <div
                  className="text-4xl font-black mb-1"
                  style={{ color: masterStyle.color }}
                >
                  {masterStyle.icon}
                </div>
                <p
                  className="text-lg font-bold tracking-widest uppercase"
                  style={{ color: masterStyle.color }}
                >
                  {masterStyle.label}
                </p>
                <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider">
                  Overall System Assessment
                </p>
                <div className="mt-4">
                  <RiskBar score={result["Master"]?.risk_score ?? 0} />
                </div>
              </div>

              {/* Per-node breakdown */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "Slave-1", style: slave1Style },
                  { key: "Slave-2", style: slave2Style },
                ].map(({ key, style }) => (
                  <div
                    key={key}
                    className="rounded-lg p-4"
                    style={{ background: style.bg, border: `1px solid ${style.border}` }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                        {key}
                      </span>
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: style.color }}
                      >
                        {style.label}
                      </span>
                    </div>
                    <RiskBar score={result[key]?.risk_score ?? 0} />
                  </div>
                ))}
              </div>

              {/* Confidence detail */}
              <div className="rounded-lg border border-panel-500/20 bg-panel-900/40 p-3">
                <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Model Detail</p>
                <div className="space-y-1">
                  {["Master", "Slave-1", "Slave-2"].map((k) => {
                    const p = result[k];
                    const s = STATUS_STYLE[p?.status || "normal"];
                    return (
                      <div key={k} className="flex items-center justify-between text-xs font-mono">
                        <span className="text-gray-500">{k}</span>
                        <span style={{ color: s.color }}>{(p?.status || "normal").toUpperCase()}</span>
                        <span className="text-gray-600">
                          risk {Math.round((p?.risk_score ?? 0) * 100)}%
                          {p?.confidence != null
                            ? `  conf ${Math.round(p.confidence * 100)}%`
                            : ""}
                        </span>
                        <span className="text-gray-700 text-[9px]">
                          {p?.source === "fallback" ? "threshold" : "xgboost"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </section>
  );
}
