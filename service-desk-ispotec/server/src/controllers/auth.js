const prisma = require("../utils/db");
const { signToken, hashPassword, comparePassword } = require("../utils/auth");

exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "E-mail e palavra-passe são obrigatórios." });
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !user.active || !(await comparePassword(password, user.passwordHash))) {
    return res.status(401).json({ error: "Credenciais inválidas." });
  }
  res.json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department } });
};

exports.me = async (req, res) => {
  res.json({ id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role, department: req.user.department, phone: req.user.phone });
};

exports.register = async (req, res) => {
  const { name, email, password, department, phone } = req.body;
  if (!name || !email || !password || !department) return res.status(400).json({ error: "Preencha os campos obrigatórios." });
  if (password.length < 8) return res.status(400).json({ error: "A palavra-passe deve ter pelo menos 8 caracteres." });
  try {
    const user = await prisma.user.create({
      data: { name, email: email.toLowerCase().trim(), passwordHash: await hashPassword(password), department, phone }
    });
    res.status(201).json({ id: user.id, message: "Conta criada com sucesso." });
  } catch {
    res.status(409).json({ error: "Este e-mail já está registado." });
  }
};
