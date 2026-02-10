import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";

import app from "./app.js";
import connectDB from "./src/db/db.connect.js";

dotenv.config();

// Allowed frontend origins
const allowedOrigins = [
  "http://localhost:5173",
  "https://blockverse-iota.vercel.app",
  process.env.FRONTEND_URL,
].filter(Boolean);

const PORT = process.env.PORT || 8080;

// Create HTTP server
const server = http.createServer(app);

// Create Socket.IO server
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

// Make io available in routes/controllers
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Socket handling
io.on("connection", (socket) => {
  console.log("✅ Socket connected:", socket.id);

  // Join leaderboard room
  socket.join("leaderboard");

  // Send confirmation (optional)
  socket.emit("socket:connected", {
    id: socket.id,
  });

  socket.on("disconnect", (reason) => {
    console.log("❌ Socket disconnected:", socket.id, reason);
  });
});

// Start server
const startServer = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI not defined in .env");
    }

    await connectDB(process.env.MONGO_URI);

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("🔥 Server failed:", error.message);
    process.exit(1);
  }
};

startServer();
