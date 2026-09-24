const { adminClient } = require("./supabase");

async function audit({ actorId = null, action, entityType, entityId = null, metadata = {} }) {
  const { error } = await adminClient.from("audit_logs").insert({
    actor_id: actorId, action, entity_type: entityType, entity_id: entityId, metadata
  });
  if (error) console.error("audit_log:", error.message);
}

module.exports = { audit };
