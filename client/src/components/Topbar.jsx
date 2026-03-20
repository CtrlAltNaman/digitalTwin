export default function Topbar({ isConnected }) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 bg-panel-800/90 backdrop-blur-md border-b border-panel-500/30">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-accent-blue/10 border border-accent-blue/20">
          <span className="text-accent-blue font-bold text-lg">HX</span>
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-wide text-gray-100">
            Hexorcists Digital Twin
          </h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
            Factory Monitoring System
          </p>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-5">
        {/* Connection status badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-panel-600/50 border border-panel-500/30">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-status-normal animate-pulse-slow" : "bg-status-critical"
            }`}
          />
          <span
            className={`text-xs font-medium ${
              isConnected ? "text-status-normal" : "text-status-critical"
            }`}
          >
            {isConnected ? "ONLINE" : "OFFLINE"}
          </span>
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-panel-600/50 transition-colors">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <span className="absolute top-1 right-1 w-2 h-2 bg-status-critical rounded-full" />
        </button>

        {/* Settings */}
        <button className="p-2 rounded-lg hover:bg-panel-600/50 transition-colors">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}
