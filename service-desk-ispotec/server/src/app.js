require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const path = require("path");
const rateLimit = require("express-rate-limit");
const authRoutes = require("./routes/auth");
const ticketRoutes = require("./routes/tickets");
const adminRoutes = require("./routes/admin");

const app = express();
app.disable("x-powered-by");
app.use(helmet({contentSecurityPolicy:false}));
app.use(cors());
app.use(express.json({limit:"2mb"}));
app.use(express.urlencoded({extended:true}));
app.use("/api/auth", authRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/admin", adminRoutes);

const client=path.join(__dirname,"../../client");
app.use("/assets",express.static(path.join(__dirname,"../../assets")));
app.use(express.static(client));

app.get("/health",(req,res)=>res.json({ok:true,service:"service-desk-ispotec"}));

app.get("/{*splat}",(req,res,next)=>{
  if(req.path.startsWith("/api/")) return res.status(404).json({error:"Rota não encontrada."});
  res.sendFile(path.join(client,"index.html"));
});

app.use((err,req,res,next)=>{
  console.error(err);
  if(err.code==="LIMIT_FILE_SIZE") return res.status(400).json({error:"O ficheiro não pode ultrapassar 10 MB."});
  res.status(500).json({error:"Erro interno do servidor."});
});

module.exports=app;
