const prisma = require("../utils/db");

const defaults = {
  BAIXA: { first: 48, resolution: 120 },
  MEDIA: { first: 24, resolution: 72 },
  ALTA: { first: 8, resolution: 24 },
  CRITICA: { first: 2, resolution: 4 }
};

async function getSla(priority) {
  const setting = await prisma.setting.findUnique({ where: { key: "SLA_RULES" } });
  const rules = setting ? JSON.parse(setting.value) : defaults;
  return rules[priority] || defaults[priority];
}

async function calculateDue(priority, createdAt = new Date()) {
  const rule = await getSla(priority);
  return {
    first: new Date(createdAt.getTime() + rule.first * 3600000),
    resolution: new Date(createdAt.getTime() + rule.resolution * 3600000)
  };
}

module.exports = { calculateDue, defaults };
