import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";

import app from "./app.js";
import connectDB from "./src/db/db.connect.js";

dotenv.config();

const allowedOrigins = [
  "http://localhost:5173",
  "https://blockverse-iota.vercel.app",
  process.env.FRONTEND_URL,
].filter(Boolean);

const PORT = process.env.PORT || 8080;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

// Attach socket to every request
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Socket lifecycle
io.on("connection", async (socket) => {
  console.log("✅ Socket connected:", socket.id);

  socket.join("leaderboard");

  socket.on("disconnect", (reason) => {
    console.log("❌ Socket disconnected:", reason);
  });
});

const startServer = async () => {
  await connectDB(process.env.MONGO_URI);

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
};

startServer();