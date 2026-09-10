const prisma = require("../utils/db");
const { hashPassword } = require("../utils/auth");

exports.dashboard = async (req, res) => {
  const [total, statuses, priorities, categories, unassigned, overdue] = await Promise.all([
    prisma.ticket.count(),
    prisma.ticket.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.ticket.groupBy({ by: ["priority"], _count: { _all: true } }),
    prisma.ticket.groupBy({ by: ["categoryId"], _count: { _all: true } }),
    prisma.ticket.count({ where: { assigneeId: null, status: { notIn: ["FECHADO", "CANCELADO"] } } }),
    prisma.ticket.count({ where: { dueResolution: { lt: new Date() }, status: { notIn: ["RESOLVIDO", "FECHADO", "CANCELADO"] } } })
  ]);
  res.json({ total, statuses, priorities, categories, unassigned, overdue });
};

exports.users = async (req, res) => res.json(await prisma.user.findMany({ select: { id: true, name: true, email: true, department: true, phone: true, role: true, active: true, createdAt: true }, orderBy: { createdAt: "desc" } }));

exports.createUser = async (req, res) => {
  const { name, email, password, department, phone, role } = req.body;
  if (!name || !email || !password || !department || !role) return res.status(400).json({ error: "Dados obrigatórios em falta." });
  try {
    const u = await prisma.user.create({ data: { name, email: email.toLowerCase(), passwordHash: await hashPassword(password), department, phone, role } });
    res.status(201).json({ id: u.id, message: "Utilizador criado." });
  } catch { res.status(409).json({ error: "E-mail já registado." }); }
};

exports.updateUser = async (req, res) => {
  const data = { name: req.body.name, department: req.body.department, phone: req.body.phone, role: req.body.role, active: req.body.active };
  if (req.body.password) data.passwordHash = await hashPassword(req.body.password);
  res.json(await prisma.user.update({ where: { id: Number(req.params.id) }, data, select: { id: true, name: true, email: true, department: true, role: true, active: true } }));
};

exports.deleteUser = async (req, res) => {
  await prisma.user.update({ where: { id: Number(req.params.id) }, data: { active: false } });
  res.json({ message: "Utilizador desativado." });
};

exports.categories = async (req, res) => res.json(await prisma.category.findMany({ orderBy: { name: "asc" } }));
exports.createCategory = async (req, res) => res.status(201).json(await prisma.category.create({ data: { name: req.body.name } }));
exports.updateCategory = async (req, res) => res.json(await prisma.category.update({ where: { id: Number(req.params.id) }, data: { name: req.body.name, active: req.body.active } }));
exports.deleteCategory = async (req, res) => { await prisma.category.update({ where: { id: Number(req.params.id) }, data: { active: false } }); res.json({ message: "Categoria desativada." }); };

exports.settings = async (req, res) => res.json(await prisma.setting.findMany());
exports.updateSettings = async (req, res) => {
  for (const [key, value] of Object.entries(req.body)) await prisma.setting.upsert({ where: { key }, update: { value: String(value) }, create: { key, value: String(value) } });
  res.json(await prisma.setting.findMany());
};

exports.exportCsv = async (req, res) => {
  const tickets = await prisma.ticket.findMany({ include: { requester: true, category: true, assignee: true }, orderBy: { createdAt: "desc" } });
  const headers = ["ticket","data","solicitante","email","assunto","categoria","urgencia","responsavel","estado"];
  const rows = tickets.map(t => [t.number,t.createdAt.toISOString(),t.requester.name,t.requester.email,t.subject,t.category.name,t.priority,t.assignee?.name || "",t.status]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=tickets.csv");
  res.send("\ufeff" + csv);
};
