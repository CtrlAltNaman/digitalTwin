/* ─── Sensor config: thresholds + display info ─── */
export const SENSORS = {
  temperature:  { label: "Temperature-1", unit: "°C",   icon: "T1", min: 0, max: 120,  warn: 70,   crit: 80   },
  vibration:    { label: "Vibration",     unit: "mm/s", icon: "VB", min: 0, max: 10,   warn: 4,    crit: 6    },
  rpm:          { label: "RPM",           unit: "RPM",  icon: "R",  min: 0, max: 2000, warn: 1600, crit: 1800 },
  temperature2: { label: "Temperature-2", unit: "°C",   icon: "T2", min: 0, max: 120,  warn: 70,   crit: 80   },
  humidity:     { label: "Humidity",      unit: "%",    icon: "H",  min: 0, max: 100,  warn: 65,   crit: 80   },
  flowRate:     { label: "Flow Rate",     unit: "L/min",icon: "F",  min: 0, max: 200,  warn: 150,  crit: 180  },
};

export const SENSOR_KEYS = Object.keys(SENSORS);

function pct(value, min, max) {
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

const STATUS_COLORS = {
  normal:   { bar: "bg-status-normal",                     text: "text-status-normal",   border: "border-status-normal/20",   dot: "bg-status-normal" },
  warning:  { bar: "bg-status-warning",                    text: "text-status-warning",  border: "border-status-warning/30",  dot: "bg-status-warning" },
  critical: { bar: "bg-status-critical animate-pulse",     text: "text-status-critical", border: "border-status-critical/30", dot: "bg-status-critical animate-pulse" },
  offline:  { bar: "bg-gray-700",                          text: "text-gray-500",        border: "border-gray-700/30",        dot: "bg-gray-600" },
};

export default function SensorCard({ type, value, status }) {
  const cfg = SENSORS[type];
  if (!cfg) return null;

  // Use ML status from backend if available, otherwise derive from thresholds
  const displayStatus = status || (value == null ? "offline" : value >= cfg.crit ? "critical" : value >= cfg.warn ? "warning" : "normal");
  const c = STATUS_COLORS[displayStatus] || STATUS_COLORS.offline;
  const fill = value != null ? pct(value, cfg.min, cfg.max) : 0;
  const warnPos = pct(cfg.warn, cfg.min, cfg.max);
  const critPos = pct(cfg.crit, cfg.min, cfg.max);

  return (
    <div className={`relative rounded-xl border ${c.border} bg-panel-700/50 backdrop-blur-sm p-5 transition-all duration-300 hover:scale-[1.02]`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center">
            <span className="text-accent-blue font-mono font-bold text-sm">{cfg.icon}</span>
          </div>
          <span className="text-xs font-medium uppercase tracking-wider text-gray-400">{cfg.label}</span>
        </div>
        <span className={`w-2 h-2 rounded-full ${c.dot}`} />
      </div>

      {/* Value */}
      <div className="mb-4">
        <span className={`text-3xl font-mono font-bold ${c.text} transition-colors duration-300`}>
          {value != null ? value.toFixed(1) : "--"}
        </span>
        <span className="ml-2 text-sm text-gray-500 font-mono">{cfg.unit}</span>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 bg-panel-900/80 rounded-full overflow-visible">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${c.bar} transition-all duration-700 ease-out`}
          style={{ width: `${fill}%` }}
        />
        <div
          className="absolute top-[-3px] w-0.5 h-[14px] bg-status-warning/60 rounded-full"
          style={{ left: `${warnPos}%` }}
        />
        <div
          className="absolute top-[-3px] w-0.5 h-[14px] bg-status-critical/60 rounded-full"
          style={{ left: `${critPos}%` }}
        />
      </div>

      {/* Range + status label */}
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] text-gray-600 font-mono">{cfg.min}</span>
        <span className={`text-[10px] font-mono uppercase tracking-wider ${displayStatus === "normal" ? "text-gray-600" : c.text}`}>
          {displayStatus}
        </span>
        <span className="text-[10px] text-gray-600 font-mono">{cfg.max}</span>
      </div>
    </div>
  );
}
