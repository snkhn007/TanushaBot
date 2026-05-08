// server.js — BrainForge Backend Entry Point
// =============================================================

require("dotenv").config();

const express  = require("express");
const mongoose = require("mongoose");
const cors     = require("cors");
const path     = require("path");

const chatRoute = require("./routes/chat");

const app = express();

// =============================================================
// MIDDLEWARE
// =============================================================
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "DELETE"],
}));

app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, "../frontend")));

// =============================================================
// ROUTES
// =============================================================
app.get("/", (req, res) => {
  res.json({
    status: "✅ BrainForge API is running!",
    version: "2.0.0",
    project: "BrainForge — Academic AI Companion",
    endpoints: {
      chat:    "POST /api/chat",
      history: "GET  /api/chat/history/:sessionId",
      clear:   "DELETE /api/chat/clear/:sessionId",
    },
  });
});

app.use("/api/chat", chatRoute);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

// =============================================================
// DB + SERVER START
// =============================================================
const PORT       = process.env.PORT || 5000;
// const MONGODB_URI = process.env.MONGODB_URI;
// const MONGODB_URI = process.env.MONGO_URI;
// const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://sana952205_db_user:studybot123@cluster0.ckwlhkt.mongodb.net/brainforge?retryWrites=true&w=majority";

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("✅ Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`🔥 BrainForge backend running → http://localhost:${PORT}`);
      console.log(`📡 API ready at → http://localhost:${PORT}/api/chat`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });
