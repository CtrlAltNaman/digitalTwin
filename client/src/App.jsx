import { useEffect, useState, useRef, useCallback } from "react";
import socket from "./socket";
import Topbar from "./components/Topbar";
import StatusBar from "./components/StatusBar";
import SensorCard, { SENSOR_KEYS } from "./components/SensorCard";
import SensorGraph from "./components/SensorGraph";
import Factory3D from "./components/Factory3D";
import RiskPredictor from "./components/RiskPredictor";

const MAX_HISTORY = 20;
const GRAPH_KEYS = ["temperature", "vibration", "rpm", "temperature2", "humidity", "flowRate"];

// Which node owns each sensor — used to pass per-node ML status to SensorCard
const SENSOR_NODE = {
  temperature:  "Slave-1",
  vibration:    "Slave-1",
  rpm:          "Slave-1",
  temperature2: "Slave-2",
  humidity:     "Slave-2",
  flowRate:     "Slave-2",
};

export default function App() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const historyRef = useRef([]);

  // Stable callback to push new data into history buffer
  const pushHistory = useCallback((point) => {
    const next = [...historyRef.current, point].slice(-MAX_HISTORY);
    historyRef.current = next;
    setHistory(next);
  }, []);

  useEffect(() => {
    socket.on("connect", () => {
      console.log("[Socket] Connected:", socket.id);
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("[Socket] Disconnected");
      setIsConnected(false);
    });

    socket.on("sensorUpdate", (newData) => {
      setData(newData);
      pushHistory(newData);
    });

    // Fetch initial history to pre-fill graphs
    fetch("/api/sensor-history?limit=20")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data.length > 0) {
          // API returns newest-first, reverse for chronological order
          const sorted = [...json.data].reverse();
          historyRef.current = sorted;
          setHistory(sorted);
          setData(sorted[sorted.length - 1]);
        }
      })
      .catch((err) => console.error("[API] Fetch failed:", err));

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("sensorUpdate");
    };
  }, [pushHistory]);

  return (
    <div className="min-h-screen flex flex-col bg-panel-900">
      <div className="scanline-overlay" />

      <Topbar isConnected={isConnected} />
      <StatusBar data={data} isConnected={isConnected} />

      <main className="flex-1 p-6 grid-bg">
        {/* ── Section: Sensor Cards ── */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
              Live Sensor Readings
            </h2>
            <div className="mt-1 h-px bg-gradient-to-r from-accent-blue/50 to-transparent" />
          </div>
          <button
            onClick={() => window.open("/api/export-csv", "_blank")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-blue/10 border border-accent-blue/30 text-accent-blue text-xs font-medium uppercase tracking-wider hover:bg-accent-blue/20 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SENSOR_KEYS.map((key) => (
            <SensorCard
              key={key}
              type={key}
              value={data?.[key] ?? null}
              status={data?.nodeStatus?.[SENSOR_NODE[key]] ?? data?.status}
            />
          ))}
        </div>

        {/* ── Section: Real-Time Graphs ── */}
        <div className="mt-8 mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
            Trend Analysis
          </h2>
          <div className="mt-1 h-px bg-gradient-to-r from-accent-blue/50 to-transparent" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {GRAPH_KEYS.map((key) => (
            <SensorGraph key={key} sensorKey={key} history={history} />
          ))}
        </div>

        {/* ── Section: 3D Factory ── */}
        <div className="mt-8 mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
            Digital Twin — Factory Floor
          </h2>
          <div className="mt-1 h-px bg-gradient-to-r from-accent-blue/50 to-transparent" />
        </div>

        <Factory3D data={data} />

        {/* ── Section: Risk Predictor ── */}
        <RiskPredictor />

        {/* ── Legend ── */}
        <div className="mt-8 flex items-center gap-6 text-[10px] uppercase tracking-widest text-gray-600">
          <div className="flex items-center gap-2">
            <span className="w-3 h-1 rounded-full bg-status-normal" />
            Normal
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-1 rounded-full bg-status-warning" />
            Warning
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-1 rounded-full bg-status-critical" />
            Critical
          </div>
        </div>
      </main>

      <footer className="px-6 py-3 text-center border-t border-panel-500/20">
        <p className="text-[11px] text-gray-600 tracking-wide">
          HEXORCISTS DIGITAL TWIN v1.0.0 — FACTORY MONITORING SYSTEM
        </p>
      </footer>
    </div>
  );
}
