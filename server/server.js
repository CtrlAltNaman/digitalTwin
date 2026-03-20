const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const connectDB = require("./config/db");
const sensorRoutes = require("./routes/sensorRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const errorHandler = require("./middleware/errorHandler");
const setupSocket = require("./socket/socketHandler");

const app = express();
const server = http.createServer(app);

// ================= SOCKET.IO =================
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// Make io accessible everywhere (controllers)
app.set("io", io);

// ================= MIDDLEWARE =================
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json());

// Static folder for uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ================= ROUTES =================
app.use("/api", sensorRoutes);
app.use("/api", uploadRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// ================= ERROR HANDLER =================
app.use(errorHandler);

// ================= SOCKET HANDLER =================
setupSocket(io);

// ================= SERVER START =================
const PORT = process.env.PORT || 5000;

let activeServer;

connectDB().then(() => {
  activeServer = server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📡 Socket.io ready for connections`);
  });
});

// ================= GRACEFUL SHUTDOWN =================
const shutdown = () => {
  console.log("🛑 Shutting down server...");

  if (activeServer) {
    activeServer.close(() => {
      console.log("✅ Server closed successfully");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);