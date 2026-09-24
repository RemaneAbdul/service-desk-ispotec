const { adminClient } = require("../utils/supabase");
const { audit } = require("../utils/audit");

exports.dashboard = async (req,res) => {
  const {data:tickets}=await adminClient.from("tickets").select("status,priority,due_at,assignee_id");
  const {count:pending_users}=await adminClient.from("profiles").select("id",{count:"exact",head:true}).eq("status","Pendente");
  const {count:users}=await adminClient.from("profiles").select("id",{count:"exact",head:true});
  const rows=tickets || [];
  const now=Date.now();
  res.json({
    total:rows.length,
    new:rows.filter(t=>t.status==="Novo").length,
    in_progress:rows.filter(t=>["Em análise","Em atendimento","Aguardando utilizador","Aguardando departamento","Escalado","Reaberto"].includes(t.status)).length,
    waiting_user:rows.filter(t=>t.status==="Aguardando utilizador").length,
    unassigned:rows.filter(t=>!t.assignee_id && !["Fechado","Cancelado"].includes(t.status)).length,
    overdue:rows.filter(t=>t.due_at && new Date(t.due_at).getTime()<now && !["Resolvido","Fechado","Cancelado"].includes(t.status)).length,
    sla_risk:rows.filter(t=>t.due_at && new Date(t.due_at).getTime()>now && new Date(t.due_at).getTime()-now<=4*3600000 && !["Resolvido","Fechado","Cancelado"].includes(t.status)).length,
    resolved:rows.filter(t=>t.status==="Resolvido").length,
    closed:rows.filter(t=>t.status==="Fechado").length,
    pending_users:pending_users || 0,
    users:users || 0
  });
};

exports.pendingUsers = async (req,res) => {
  const {data,error}=await adminClient.from("profiles").select("*").eq("status","Pendente").order("created_at",{ascending:false});
  if(error) return res.status(400).json({error:"Não foi possível carregar os utilizadores pendentes."});
  res.json(data || []);
};

exports.users = async (req,res) => {
  const {data,error}=await adminClient.from("profiles").select("*").order("created_at",{ascending:false});
  if(error) return res.status(400).json({error:"Não foi possível carregar os utilizadores."});
  res.json(data || []);
};

exports.createUser = async (req,res) => {
  const b=req.body;
  if(!b.name || !b.email || !b.phone || !b.user_type || !b.department_id) return res.status(400).json({error:"Preencha os campos obrigatórios."});
  if(!["ESTUDANTE","COLABORADOR","ADMINISTRADOR"].includes(b.user_type)) return res.status(400).json({error:"Tipo de utilizador inválido."});
  if(b.user_type==="ADMINISTRADOR" && req.profile.role!=="Administrador") return res.status(403).json({error:"Não pode criar administradores."});
  if(b.user_type==="ESTUDANTE" && (!b.student_number || !b.course)) return res.status(400).json({error:"Número de estudante e curso são obrigatórios."});

  const password=String(b.password || "");
  if(password.length<8) return res.status(400).json({error:"A palavra-passe deve ter pelo menos 8 caracteres."});
  const email=String(b.email).trim().toLowerCase();

  const {data:existing}=await adminClient.from("profiles").select("id").eq("email",email).maybeSingle();
  if(existing) return res.status(409).json({error:"Este email já está registado."});

  const {data:authData,error:authError}=await adminClient.auth.admin.createUser({
    email,password,email_confirm:true,user_metadata:{full_name:b.name,user_type:b.user_type}
  });
  if(authError || !authData.user) return res.status(409).json({error:authError?.message || "Não foi possível criar o utilizador."});

  const role=b.user_type==="ADMINISTRADOR" ? "Administrador" : "Solicitante";
  const status=["Activo","Inactivo","Bloqueado","Pendente"].includes(b.status) ? b.status : "Activo";
  const {data:profile,error}=await adminClient.from("profiles").insert({
    id:authData.user.id,full_name:String(b.name).trim(),email,phone:String(b.phone).trim(),
    role,user_type:b.user_type,status,department_id:b.department_id,
    student_number:b.user_type==="ESTUDANTE" ? b.student_number : null,
    course:b.user_type==="ESTUDANTE" ? b.course : null,
    position:b.user_type==="COLABORADOR" ? (b.position || null) : null
  }).select("*").single();

  if(error){
    await adminClient.auth.admin.deleteUser(authData.user.id,true).catch(()=>{});
    return res.status(400).json({error:"Não foi possível criar o perfil."});
  }
  await audit({actorId:req.profile.id,action:"UTILIZADOR_CRIADO",entityType:"profile",entityId:profile.id,metadata:{user_type:b.user_type,status}});
  res.status(201).json(profile);
};

exports.updateUser = async (req,res) => {
  const id=req.params.id;
  const {data:before}=await adminClient.from("profiles").select("*").eq("id",id).single();
  if(!before) return res.status(404).json({error:"Utilizador não encontrado."});
  const patch={};
  for(const key of ["full_name","phone","department_id","student_number","course","position","user_type"]){
    if(req.body[key]!==undefined) patch[key]=req.body[key];
  }
  if(req.body.role!==undefined){
    if(req.profile.role!=="Administrador") return res.status(403).json({error:"Só o administrador pode alterar perfis."});
    if(!["Administrador","Supervisor","Agente","Solicitante"].includes(req.body.role)) return res.status(400).json({error:"Perfil inválido."});
    patch.role=req.body.role;
  }
  const {data,error}=await adminClient.from("profiles").update(patch).eq("id",id).select("*").single();
  if(error) return res.status(400).json({error:"Não foi possível actualizar o utilizador."});
  await audit({actorId:req.profile.id,action:"UTILIZADOR_EDITADO",entityType:"profile",entityId:id,metadata:{changed:Object.keys(patch)}});
  res.json(data);
};

exports.departments = async (req,res) => {
  const {data,error}=await adminClient.from("departments").select("*").order("name");
  if(error) return res.status(400).json({error:"Não foi possível carregar departamentos."});
  res.json(data || []);
};

exports.createDepartment = async (req,res) => {
  const name=String(req.body.name || "").trim();
  if(!name) return res.status(400).json({error:"Nome do departamento é obrigatório."});
  const {data,error}=await adminClient.from("departments").insert({name,description:req.body.description || null,status:"Activo"}).select("*").single();
  if(error) return res.status(409).json({error:"Já existe um departamento com esse nome."});
  await audit({actorId:req.profile.id,action:"DEPARTAMENTO_CRIADO",entityType:"department",entityId:data.id,metadata:{name}});
  res.status(201).json(data);
};

exports.updateDepartment = async (req,res) => {
  const {data,error}=await adminClient.from("departments").update({
    name:req.body.name,description:req.body.description,status:req.body.status
  }).eq("id",req.params.id).select("*").single();
  if(error || !data) return res.status(400).json({error:"Não foi possível actualizar o departamento."});
  await audit({actorId:req.profile.id,action:"DEPARTAMENTO_EDITADO",entityType:"department",entityId:data.id});
  res.json(data);
};

exports.categories = async (req,res) => {
  const {data,error}=await adminClient.from("categories").select("*").order("name");
  if(error) return res.status(400).json({error:"Não foi possível carregar categorias."});
  res.json(data || []);
};

exports.createCategory = async (req,res) => {
  const name=String(req.body.name || "").trim();
  if(!name) return res.status(400).json({error:"Nome da categoria é obrigatório."});
  const {data,error}=await adminClient.from("categories").insert({name,description:req.body.description || null,status:"Activo"}).select("*").single();
  if(error) return res.status(409).json({error:"Já existe uma categoria com esse nome."});
  await audit({actorId:req.profile.id,action:"CATEGORIA_CRIADA",entityType:"category",entityId:data.id,metadata:{name}});
  res.status(201).json(data);
};

exports.updateCategory = async (req,res) => {
  const {data,error}=await adminClient.from("categories").update({
    name:req.body.name,description:req.body.description,status:req.body.status
  }).eq("id",req.params.id).select("*").single();
  if(error || !data) return res.status(400).json({error:"Não foi possível actualizar a categoria."});
  res.json(data);
};

exports.services = async (req,res) => {
  const {data,error}=await adminClient.from("services").select("*").order("name");
  if(error) return res.status(400).json({error:"Não foi possível carregar serviços."});
  res.json(data || []);
};

exports.createService = async (req,res) => {
  const name=String(req.body.name || "").trim();
  if(!name || !req.body.category_id) return res.status(400).json({error:"Nome e categoria são obrigatórios."});
  const {data,error}=await adminClient.from("services").insert({
    name,category_id:req.body.category_id,department_id:req.body.department_id || null,
    sla_hours:Number(req.body.sla_hours || 48),status:"Activo"
  }).select("*").single();
  if(error) return res.status(400).json({error:"Não foi possível criar o serviço."});
  res.status(201).json(data);
};

exports.updateService = async (req,res) => {
  const {data,error}=await adminClient.from("services").update({
    name:req.body.name,category_id:req.body.category_id,department_id:req.body.department_id || null,
    sla_hours:Number(req.body.sla_hours || 48),status:req.body.status
  }).eq("id",req.params.id).select("*").single();
  if(error || !data) return res.status(400).json({error:"Não foi possível actualizar o serviço."});
  res.json(data);
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
