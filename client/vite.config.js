import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // REST API — forward /api/* to Express server
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      // Socket.io — forward WS upgrade to Express server
      "/socket.io": {
        target: "http://localhost:5000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
