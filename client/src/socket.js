import { io } from "socket.io-client";

// In dev the Vite proxy forwards /socket.io → Express on port 5000.
// In production set VITE_API_URL to the backend origin.
const SERVER_URL = import.meta.env.VITE_API_URL || "";

const socket = io(SERVER_URL, {
  transports: ["websocket", "polling"],
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
});

export default socket;
