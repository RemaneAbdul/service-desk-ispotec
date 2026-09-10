const prisma = require("../utils/db");

async function getPrintConfig() {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ["LIMITE_PAGINAS", "ANTECEDENCIA_MINIMA_HORAS"] } }
  });
  const map = Object.fromEntries(rows.map(r => [r.key, Number(r.value)]));
  return {
    limit: map.LIMITE_PAGINAS ?? 10,
    minHours: map.ANTECEDENCIA_MINIMA_HORAS ?? 48
  };
}

async function validatePrint({ pages, scheduledAt }) {
  const cfg = await getPrintConfig();
  const when = new Date(scheduledAt);
  const hours = (when.getTime() - Date.now()) / 3600000;
  if (pages > cfg.limit && hours < cfg.minHours) {
    return {
      ok: false,
      message: `Documentos com mais de ${cfg.limit} páginas devem ser submetidos com, no mínimo, ${cfg.minHours} horas de antecedência. Ajuste a data prevista ou contacte o sector responsável.`
    };
  }
  return { ok: true, approvalRequired: pages > cfg.limit };
}

module.exports = { getPrintConfig, validatePrint };
