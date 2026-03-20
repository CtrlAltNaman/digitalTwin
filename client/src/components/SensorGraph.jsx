import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const GRAPH_CONFIG = {
  temperature:  { color: "#ef4444", label: "Temperature-1", unit: "°C"    },
  vibration:    { color: "#a855f7", label: "Vibration",     unit: "mm/s"  },
  rpm:          { color: "#22c55e", label: "RPM",           unit: "RPM"   },
  temperature2: { color: "#f97316", label: "Temperature-2", unit: "°C"    },
  humidity:     { color: "#3b82f6", label: "Humidity",      unit: "%"     },
  flowRate:     { color: "#06b6d4", label: "Flow Rate",     unit: "L/min" },
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-panel-800 border border-panel-500/30 rounded-lg px-3 py-2 text-xs">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }} className="font-mono">
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

export default function SensorGraph({ history, sensorKey }) {
  const cfg = GRAPH_CONFIG[sensorKey];
  if (!cfg) return null;

  const chartData = history.map((point, i) => ({
    time: point.createdAt
      ? new Date(point.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : `#${i + 1}`,
    [cfg.label]: point[sensorKey] != null ? parseFloat(Number(point[sensorKey]).toFixed(1)) : null,
  }));

  return (
    <div className="rounded-xl border border-panel-500/20 bg-panel-700/50 backdrop-blur-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
          <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
            {cfg.label}
          </span>
        </div>
        <span className="text-[10px] text-gray-600 font-mono">{cfg.unit} / last 20</span>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 9, fill: "#6b7280" }}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 9, fill: "#6b7280" }}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey={cfg.label}
            stroke={cfg.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: cfg.color }}
            isAnimationActive={false}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
