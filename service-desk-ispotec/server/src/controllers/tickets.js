const prisma = require("../utils/db");
const { calculateDue } = require("../services/sla");
const { validatePrint } = require("../services/printRules");

const include = {
  requester: { select: { id: true, name: true, email: true, department: true, phone: true } },
  category: true,
  assignee: { select: { id: true, name: true, email: true, role: true } },
  print: true,
  attachments: true,
  comments: { include: { author: { select: { name: true, role: true } } }, orderBy: { createdAt: "asc" } },
  history: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } }
};

async function nextNumber() {
  const year = new Date().getFullYear();
  const count = await prisma.ticket.count({ where: { createdAt: { gte: new Date(`${year}-01-01`) } } });
  return `SD-${year}-${String(count + 1).padStart(6, "0")}`;
}

exports.create = async (req, res) => {
  const b = req.body;
  if (!b.type || !b.categoryId || !b.priority || !b.subject || !b.description) return res.status(400).json({ error: "Preencha todos os campos obrigatórios." });

  const category = await prisma.category.findUnique({ where: { id: Number(b.categoryId) } });
  if (!category || !category.active) return res.status(400).json({ error: "Categoria inválida." });

  let occurrenceAt = b.occurrenceAt ? new Date(b.occurrenceAt) : null;
  if (b.type === "INCIDENTE" && !occurrenceAt) return res.status(400).json({ error: "A data/hora da ocorrência é obrigatória para incidentes." });

  let printData;
  if (category.name === "Impressão e Documentos") {
    if (!b.print || !b.print.documentType || !b.print.pages || !b.print.scheduledAt) {
      return res.status(400).json({ error: "Preencha os dados de impressão." });
    }
    const validation = await validatePrint(b.print);
    if (!validation.ok) return res.status(422).json({ error: validation.message });
    printData = { ...b.print, pages: Number(b.print.pages), copies: Number(b.print.copies || 1), scheduledAt: new Date(b.print.scheduledAt), approvalRequired: validation.approvalRequired };
  }

  const number = await nextNumber();
  const due = await calculateDue(b.priority);
  const ticket = await prisma.ticket.create({
    data: {
      number, requesterId: req.user.id, department: b.department || req.user.department,
      type: b.type, categoryId: Number(b.categoryId), priority: b.priority,
      subject: b.subject.trim(), description: b.description.trim(),
      affectedService: b.affectedService || null, occurrenceAt,
      dueFirstResponse: due.first, dueResolution: due.resolution,
      ...(printData ? { print: { create: printData } } : {})
    }
  });
  await prisma.ticketHistory.create({ data: { ticketId: ticket.id, authorId: req.user.id, action: "CRIAÇÃO", newValue: "ABERTO", note: "Ticket criado." } });
  res.status(201).json(await prisma.ticket.findUnique({ where: { id: ticket.id }, include }));
};

exports.list = async (req, res) => {
  const where = req.user.role === "COLABORADOR" ? { requesterId: req.user.id } : {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.priority) where.priority = req.query.priority;
  if (req.query.categoryId) where.categoryId = Number(req.query.categoryId);
  const tickets = await prisma.ticket.findMany({ where, include, orderBy: { createdAt: "desc" }, take: 200 });
  res.json(tickets);
};

exports.get = async (req, res) => {
  const ticket = await prisma.ticket.findUnique({ where: { id: Number(req.params.id) }, include });
  if (!ticket) return res.status(404).json({ error: "Ticket não encontrado." });
  if (req.user.role === "COLABORADOR" && ticket.requesterId !== req.user.id) return res.status(403).json({ error: "Sem permissão." });
  res.json(ticket);
};

exports.update = async (req, res) => {
  const id = Number(req.params.id);
  const old = await prisma.ticket.findUnique({ where: { id } });
  if (!old) return res.status(404).json({ error: "Ticket não encontrado." });

  const allowed = {};
  for (const key of ["status", "priority", "categoryId", "assigneeId"]) {
    if (req.body[key] !== undefined) allowed[key] = key === "categoryId" || key === "assigneeId" ? Number(req.body[key]) : req.body[key];
  }
  if (req.body.comment) {
    await prisma.comment.create({ data: { ticketId: id, authorId: req.user.id, body: req.body.comment, visibility: req.body.visibility === "INTERNA" ? "INTERNA" : "PUBLICA" } });
  }

  const updated = await prisma.ticket.update({ where: { id }, data: allowed, include });
  for (const key of Object.keys(allowed)) {
    if (String(old[key]) !== String(allowed[key])) {
      await prisma.ticketHistory.create({ data: { ticketId: id, authorId: req.user.id, action: `ALTERAÇÃO_${key.toUpperCase()}`, oldValue: String(old[key]), newValue: String(allowed[key]) } });
    }
  }
  if (allowed.status === "RESOLVIDO") await prisma.ticket.update({ where: { id }, data: { resolvedAt: new Date() } });
  if (allowed.status === "FECHADO") await prisma.ticket.update({ where: { id }, data: { closedAt: new Date() } });
  res.json(await prisma.ticket.findUnique({ where: { id }, include }));
};

exports.comment = async (req, res) => {
  const ticket = await prisma.ticket.findUnique({ where: { id: Number(req.params.id) } });
  if (!ticket) return res.status(404).json({ error: "Ticket não encontrado." });
  if (req.user.role === "COLABORADOR" && ticket.requesterId !== req.user.id) return res.status(403).json({ error: "Sem permissão." });
  const comment = await prisma.comment.create({ data: { ticketId: ticket.id, authorId: req.user.id, body: req.body.body, visibility: req.body.visibility === "INTERNA" && req.user.role !== "COLABORADOR" ? "INTERNA" : "PUBLICA" } });
  if (comment.visibility === "PUBLICA" && !ticket.firstRespondedAt && req.user.role !== "COLABORADOR") {
    await prisma.ticket.update({ where: { id: ticket.id }, data: { firstRespondedAt: new Date(), status: ticket.status === "ABERTO" ? "EM_ATENDIMENTO" : undefined } });
  }
  res.status(201).json(comment);
};
