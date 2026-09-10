const jwt = require("jsonwebtoken");
const prisma = require("../utils/db");

async function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Não autenticado." });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) } });
    if (!user || !user.active) return res.status(401).json({ error: "Sessão inválida." });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Sessão inválida ou expirada." });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Sem permissão." });
    next();
  };
}

module.exports = { auth, requireRole };
