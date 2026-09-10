require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");
const authRoutes = require("./routes/auth");
const ticketRoutes = require("./routes/tickets");
const adminRoutes = require("./routes/admin");

const app = express();
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/api/auth/login", rateLimit({ windowMs: 15 * 60 * 1000, limit: 20 }));
app.use("/api/auth", authRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/admin", adminRoutes);

const client = path.join(__dirname, "../../client");
app.use("/assets", express.static(path.join(__dirname, "../../assets")));
app.use(express.static(client));

app.get("/health", (req, res) => res.json({ ok: true, service: "service-desk-ispotec" }));

// Express 5 requires a named wildcard. This also matches the root path.
app.get("/{*splat}", (req, res, next) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Rota não encontrada." });
  res.sendFile(path.join(client, "index.html"));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Erro interno do servidor." });
});

module.exports = app;
