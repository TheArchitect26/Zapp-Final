import { Server } from "socket.io";
import { logger } from "../lib/logger.js";

let io;

export function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: (process.env.FRONTEND_URL || "http://localhost:5173")
        .split(",")
        .map((o) => o.trim()),
    },
  });

  logger.info("Real-time socket server initialized");

  io.on("connection", (socket) => {
    logger.info("Client connected", { socketId: socket.id });

    socket.on("join", (channel) => {
      socket.join(channel);
      logger.info("Client joined channel", { socketId: socket.id, channel });
    });

    socket.on("leave", (channel) => {
      socket.leave(channel);
      logger.info("Client left channel", { socketId: socket.id, channel });
    });

    socket.on("disconnect", () => {
      logger.info("Client disconnected", { socketId: socket.id });
    });
  });
}

export function broadcast(event, data) {
  if (!io) {
    logger.warn("Socket not initialized — broadcast skipped", { event });
    return;
  }
  io.emit(event, { ...data, timestamp: new Date() });
}

export function broadcastTo(channel, event, data) {
  if (!io) return;
  io.to(channel).emit(event, { ...data, timestamp: new Date() });
}
