const { createClient } = require("@supabase/supabase-js");

const url = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !publishableKey || !secretKey) {
  throw new Error("SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY e SUPABASE_SECRET_KEY são obrigatórios.");
}

const authClient = createClient(url, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
});

const adminClient = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
});

async function userFromToken(token) {
  const { data, error } = await adminClient.auth.getUser(token);
  if (error || !data.user) return { user: null, profile: null, error: error || new Error("Utilizador não autenticado.") };
  const { data: profile, error: profileError } = await adminClient.from("profiles").select("*").eq("id", data.user.id).single();
  if (profileError || !profile) return { user: data.user, profile: null, error: profileError || new Error("Perfil não encontrado.") };
  return { user: data.user, profile, error: null };
}

module.exports = { authClient, adminClient, userFromToken };
