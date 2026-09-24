const { authClient, adminClient } = require("../utils/supabase");
const { audit } = require("../utils/audit");
const { sendMail } = require("../utils/mailer");
const { notify, notifyStaff } = require("../utils/notifications");

function normalizePhone(phone) {
  return String(phone || "").trim().replace(/[()\-]/g, "").replace(/\s+/g, "");
}

function validateRegistration(b) {
  if (!b.name || !b.email || !b.phone || !b.password || !b.passwordConfirm || !b.userType || !b.departmentId) return "Preencha todos os campos obrigatórios.";
  if (b.password.length < 8) return "A palavra-passe deve ter pelo menos 8 caracteres.";
  if (b.password !== b.passwordConfirm) return "A confirmação da palavra-passe não coincide.";
  if (!["ESTUDANTE", "COLABORADOR"].includes(b.userType)) return "Tipo de utilizador inválido.";
  if (!/^\+2588\d{8}$/.test(normalizePhone(b.phone))) return "Indique um número de celular válido de Moçambique.";
  if (b.userType === "ESTUDANTE" && (!b.studentNumber || !b.course)) return "Número de estudante e curso são obrigatórios para estudantes.";
  return null;
}

function statusMessage(status) {
  return ({
    Pendente: "Aguarda a confirmação do administrador",
    Recusado: "O seu cadastro foi recusado. Contacte o administrador.",
    Inactivo: "A sua conta está inactiva. Contacte o administrador.",
    Bloqueado: "A sua conta está bloqueada. Contacte o administrador."
  })[status];
}

exports.login = async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!email || !password) return res.status(400).json({ error: "E-mail e palavra-passe são obrigatórios." });

  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error || !data.user || !data.session) return res.status(401).json({ error: "Credenciais inválidas." });

  const { data: profile, error: pErr } = await adminClient.from("profiles").select("*").eq("id", data.user.id).single();
  if (pErr || !profile) return res.status(403).json({ error: "Perfil de utilizador não encontrado." });

  if (profile.status !== "Activo") {
    await adminClient.auth.admin.signOut(data.session.access_token, { scope: "local" }).catch(() => {});
    return res.status(403).json({ error: statusMessage(profile.status) || "A sua conta não está activa." });
  }

  await adminClient.from("profiles").update({ last_login: new Date().toISOString() }).eq("id", data.user.id);
  res.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    user: {
      id: profile.id, name: profile.full_name, email: profile.email, phone: profile.phone,
      role: profile.role, user_type: profile.user_type, department_id: profile.department_id, status: profile.status
    }
  });
};

exports.refresh = async (req, res) => {
  const refreshToken = String(req.body.refresh_token || "");
  if (!refreshToken) return res.status(400).json({ error: "Refresh token em falta." });
  const { data, error } = await authClient.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) return res.status(401).json({ error: "Sessão expirada. Inicie sessão novamente." });
  const { data: profile } = await adminClient.from("profiles").select("status").eq("id", data.user.id).single();
  if (!profile || profile.status !== "Activo") return res.status(403).json({ error: statusMessage(profile?.status) || "A sua conta não está activa." });
  res.json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token, expires_at: data.session.expires_at });
};

exports.logout = async (req, res) => {
  await adminClient.auth.admin.signOut(req.token, { scope: "local" }).catch(() => {});
  res.status(204).end();
};

exports.me = async (req, res) => {
  let department = null;
  if (req.profile.department_id) {
    const { data } = await adminClient.from("departments").select("id,name").eq("id", req.profile.department_id).maybeSingle();
    department = data;
  }
  res.json({ ...req.profile, department });
};

exports.register = async (req, res) => {
  const b = req.body;
  const invalid = validateRegistration(b);
  if (invalid) return res.status(400).json({ error: invalid });

  const email = String(b.email).trim().toLowerCase();
  const { data: existing } = await adminClient.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing) return res.status(409).json({ error: "Este email já está registado." });

  if (b.userType === "ESTUDANTE") {
    const { data: existingStudent } = await adminClient.from("profiles").select("id").eq("student_number", String(b.studentNumber).trim()).maybeSingle();
    if (existingStudent) return res.status(409).json({ error: "Este número de estudante já está registado." });
  }

  const { data: dept } = await adminClient.from("departments").select("id,status").eq("id", b.departmentId).single();
  if (!dept || dept.status !== "Activo") return res.status(400).json({ error: "Departamento inválido." });

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email, password: b.password, email_confirm: true,
    user_metadata: { full_name: String(b.name).trim(), user_type: b.userType }
  });
  if (authError || !authData.user) return res.status(409).json({ error: authError?.message || "Não foi possível criar a conta." });

  const { error: profileError } = await adminClient.from("profiles").insert({
    id: authData.user.id, full_name: String(b.name).trim(), email, phone: normalizePhone(b.phone),
    role: "Solicitante", user_type: b.userType, status: "Pendente", department_id: b.departmentId,
    student_number: b.userType === "ESTUDANTE" ? String(b.studentNumber).trim() : null,
    course: b.userType === "ESTUDANTE" ? String(b.course).trim() : null,
    position: b.userType === "COLABORADOR" ? (b.position || null) : null
  });

  if (profileError) {
    await adminClient.auth.admin.deleteUser(authData.user.id, true).catch(() => {});
    return res.status(400).json({ error: profileError.message.includes("profiles_student_number_unique") ? "Este número de estudante já está registado." : "Não foi possível criar o perfil." });
  }

  await audit({ action: "CADASTRO_PUBLICO", entityType: "profile", entityId: authData.user.id, metadata: { user_type: b.userType } });
  await notifyStaff("Novo cadastro pendente", String(b.name).trim() + " solicitou acesso ao Service Desk.", "user_approval");

  res.status(201).json({
    message: "Cadastro realizado com sucesso",
    status: "Pendente",
    notice: "Aguarda a confirmação do administrador",
    detail: "O seu pedido de acesso foi enviado para análise. Assim que o administrador aprovar o seu cadastro, poderá entrar no Service Desk."
  });
};

exports.approve = async (req, res) => {
  const id = req.params.id;
  const { data: target } = await adminClient.from("profiles").select("*").eq("id", id).single();
  if (!target) return res.status(404).json({ error: "Utilizador não encontrado." });
  const { error } = await adminClient.from("profiles").update({
    status: "Activo", approved_by: req.profile.id, approved_at: new Date().toISOString(), rejection_reason: null
  }).eq("id", id);
  if (error) return res.status(400).json({ error: "Não foi possível aprovar o utilizador." });

  await audit({ actorId: req.profile.id, action: "UTILIZADOR_APROVADO", entityType: "profile", entityId: id, metadata: { user_type: target.user_type } });
  await notify(id, "Acesso aprovado", "O seu acesso ao Service Desk ISPOTEC foi aprovado.", "user_approval");
  await sendMail({ to: target.email, subject: "Acesso ao Service Desk ISPOTEC aprovado", text: "O seu acesso ao Service Desk ISPOTEC foi aprovado. Já pode iniciar sessão utilizando as credenciais cadastradas." }).catch(() => {});
  res.json({ message: "Utilizador aprovado com sucesso." });
};

exports.reject = async (req, res) => {
  const id = req.params.id;
  const reason = String(req.body.reason || "").trim();
  const { data: target } = await adminClient.from("profiles").select("*").eq("id", id).single();
  if (!target) return res.status(404).json({ error: "Utilizador não encontrado." });
  const { error } = await adminClient.from("profiles").update({
    status: "Recusado", rejection_reason: reason || null, approved_by: req.profile.id, approved_at: null
  }).eq("id", id);
  if (error) return res.status(400).json({ error: "Não foi possível recusar o cadastro." });

  await audit({ actorId: req.profile.id, action: "UTILIZADOR_RECUSADO", entityType: "profile", entityId: id, metadata: { reason } });
  await notify(id, "Cadastro não aprovado", reason ? "O seu pedido de acesso não foi aprovado. Motivo: " + reason : "O seu pedido de acesso ao Service Desk não foi aprovado.", "user_approval");
  await sendMail({ to: target.email, subject: "Acesso ao Service Desk ISPOTEC", text: reason ? "O seu pedido de acesso ao Service Desk ISPOTEC não foi aprovado. Motivo: " + reason : "O seu pedido de acesso ao Service Desk ISPOTEC não foi aprovado." }).catch(() => {});
  res.json({ message: "Cadastro recusado." });
};

exports.setStatus = async (req, res) => {
  const id = req.params.id;
  const status = String(req.body.status || "");
  if (!["Activo", "Inactivo", "Bloqueado"].includes(status)) return res.status(400).json({ error: "Estado inválido." });
  if (id === req.profile.id && status !== "Activo") return res.status(400).json({ error: "Não pode desactivar ou bloquear a sua própria conta." });
  const { data: target } = await adminClient.from("profiles").select("status").eq("id", id).single();
  if (!target) return res.status(404).json({ error: "Utilizador não encontrado." });
  const { error } = await adminClient.from("profiles").update({ status }).eq("id", id);
  if (error) return res.status(400).json({ error: "Não foi possível actualizar o estado." });
  await audit({ actorId: req.profile.id, action: "ESTADO_UTILIZADOR_ALTERADO", entityType: "profile", entityId: id, metadata: { from: target.status, to: status } });
  res.json({ message: "Estado actualizado com sucesso." });
};


exports.departments = async (req,res) => {
  const {data,error}=await adminClient.from("departments").select("id,name").eq("status","Activo").order("name");
  if(error) return res.status(400).json({error:"Não foi possível carregar departamentos."});
  res.json(data || []);
};


exports.notifications = async (req,res) => {
  const {data,error}=await adminClient.from("notifications").select("*").eq("user_id",req.profile.id).order("created_at",{ascending:false}).limit(50);
  if(error) return res.status(400).json({error:"Não foi possível carregar notificações."});
  res.json(data || []);
};

exports.markNotificationRead = async (req,res) => {
  const {error}=await adminClient.from("notifications").update({read_at:new Date().toISOString()}).eq("id",req.params.id).eq("user_id",req.profile.id);
  if(error) return res.status(400).json({error:"Não foi possível actualizar a notificação."});
  res.json({message:"Notificação marcada como lida."});
};
