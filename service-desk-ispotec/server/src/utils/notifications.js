const { adminClient } = require("./supabase");

async function notify(userId, title, message, type = "info") {
  if (!userId) return;
  const { error } = await adminClient.from("notifications").insert({
    user_id: userId, title, body: message, notification_type: type
  });
  if (error) console.error("notification:", error.message);
}

async function notifyStaff(title, message, type = "ticket") {
  const { data, error } = await adminClient.from("profiles")
    .select("id").in("role", ["Administrador", "Supervisor", "Agente"]).eq("status", "Activo");
  if (error) return console.error("notifyStaff:", error.message);
  await Promise.all((data || []).map(p => notify(p.id, title, message, type)));
}

module.exports = { notify, notifyStaff };
