const setupSocket = (io) => {
  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Client can join a device-specific room
    socket.on("joinDevice", (deviceId) => {
      socket.join(deviceId);
      console.log(`Socket ${socket.id} joined room: ${deviceId}`);
    });

    // Client can leave a device-specific room
    socket.on("leaveDevice", (deviceId) => {
      socket.leave(deviceId);
      console.log(`Socket ${socket.id} left room: ${deviceId}`);
    });

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
};

module.exports = setupSocket;
