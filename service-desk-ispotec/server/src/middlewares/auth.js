const { userFromToken } = require("../utils/supabase");

async function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return res.status(401).json({ error: "Não autenticado." });

  try {
    const { user, profile, error } = await userFromToken(token);
    if (error || !user || !profile) {
      return res.status(401).json({ error: "Sessão inválida ou expirada." });
    }

    if (profile.status !== "Activo") {
      return res.status(403).json({
        error: "A sua conta não está activa."
      });
    }

    req.user = user;
    req.profile = profile;
    req.token = token;
    next();
  } catch (error) {
    console.error("auth middleware:", error);
    return res.status(401).json({ error: "Sessão inválida ou expirada." });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.profile || !roles.includes(req.profile.role)) {
      return res.status(403).json({ error: "Sem permissão." });
    }
    next();
  };
}

function requireStaff(req, res, next) {
  return requireRole("Administrador", "Supervisor", "Agente")(req, res, next);
}

function requireAdmin(req, res, next) {
  return requireRole("Administrador")(req, res, next);
}

module.exports = { auth, requireRole, requireStaff, requireAdmin };
