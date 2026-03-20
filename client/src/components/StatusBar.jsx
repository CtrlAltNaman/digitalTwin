export default function StatusBar({ data, isConnected }) {
  const lastUpdate = data?.createdAt
    ? new Date(data.createdAt).toLocaleTimeString()
    : "No data";

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 bg-panel-800/50 border-b border-panel-500/20">
      <div className="flex items-center gap-6">
        {/* Device ID */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-gray-500">Device</span>
          <span className="text-xs font-mono text-accent-cyan">{data?.deviceId || "—"}</span>
        </div>

        {/* Last update timestamp */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-gray-500">Last Update</span>
          <span className="text-xs font-mono text-gray-300">{lastUpdate}</span>
        </div>

        {/* ML prediction status */}
        {data?.status && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-gray-500">ML Status</span>
            <span
              className={`text-xs font-mono uppercase font-bold ${
                data.status === "critical"
                  ? "text-status-critical"
                  : data.status === "warning"
                  ? "text-status-warning"
                  : "text-status-normal"
              }`}
            >
              {data.status}
            </span>
          </div>
        )}
      </div>

      {/* Socket connection indicator */}
      <div className="flex items-center gap-2">
        <div
          className={`w-1.5 h-1.5 rounded-full ${
            isConnected ? "bg-status-normal animate-pulse-slow" : "bg-status-critical"
          }`}
        />
        <span className="text-[10px] uppercase tracking-widest text-gray-500">
          Socket.io {isConnected ? "Connected" : "Disconnected"}
        </span>
      </div>
    </div>
  );
}
