const { adminClient } = require("../utils/supabase");
const { audit } = require("../utils/audit");
const { notify, notifyStaff } = require("../utils/notifications");

const STAFF = ["Administrador", "Supervisor", "Agente"];
const TICKET_TYPES = ["Incidente", "Pedido de serviço", "Reclamação", "Dúvida", "Sugestão"];
const STATUSES = ["Novo","Em análise","Em atendimento","Aguardando utilizador","Aguardando departamento","Escalado","Resolvido","Fechado","Reaberto","Cancelado"];

async function profilesByIds(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const { data } = await adminClient.from("profiles")
    .select("id,full_name,email,phone,role,user_type,department_id")
    .in("id", unique);
  return new Map((data || []).map(p => [p.id, p]));
}

async function enrichTickets(tickets) {
  if (!tickets.length) return [];
  const userMap = await profilesByIds(tickets.flatMap(t => [t.requester_id, t.assignee_id]));
  const departmentIds = [...new Set(tickets.flatMap(t => [t.department_id, t.assigned_department_id]).filter(Boolean))];
  const categoryIds = [...new Set(tickets.map(t => t.category_id).filter(Boolean))];
  const serviceIds = [...new Set(tickets.map(t => t.service_id).filter(Boolean))];

  const [deps, cats, services] = await Promise.all([
    departmentIds.length ? adminClient.from("departments").select("id,name,status").in("id", departmentIds) : Promise.resolve({data:[]}),
    categoryIds.length ? adminClient.from("categories").select("id,name,status").in("id", categoryIds) : Promise.resolve({data:[]}),
    serviceIds.length ? adminClient.from("services").select("id,name,category_id,department_id,sla_hours,status").in("id", serviceIds) : Promise.resolve({data:[]})
  ]);

  const dm = new Map((deps.data || []).map(x => [x.id,x]));
  const cm = new Map((cats.data || []).map(x => [x.id,x]));
  const sm = new Map((services.data || []).map(x => [x.id,x]));

  return tickets.map(t => ({
    ...t,
    ticket_number_display: t.ticket_code || ("ISP-" + new Date(t.created_at).getFullYear() + "-" + String(t.ticket_number).padStart(6,"0")),
    requester: userMap.get(t.requester_id) || null,
    assignee: userMap.get(t.assignee_id) || null,
    department: dm.get(t.department_id) || null,
    assigned_department: dm.get(t.assigned_department_id) || null,
    category: cm.get(t.category_id) || null,
    service: sm.get(t.service_id) || null
  }));
}

function isStaff(req) { return STAFF.includes(req.profile.role); }

async function getTicket(id) {
  const { data, error } = await adminClient.from("tickets").select("*").eq("id", id).single();
  return { data, error };
}

function canAccess(req, ticket) {
  return Boolean(ticket && (isStaff(req) || ticket.requester_id === req.profile.id));
}

async function event(req, ticketId, type, oldValue = null, newValue = null, metadata = {}) {
  await adminClient.from("ticket_events").insert({
    ticket_id: ticketId, actor_id: req.profile.id, event_type: type,
    old_value: oldValue, new_value: newValue, metadata
  });
  await audit({ actorId:req.profile.id, action:type, entityType:"ticket", entityId:ticketId, metadata });
}

exports.list = async (req,res) => {
  let query = adminClient.from("tickets").select("*").order("created_at",{ascending:false}).limit(200);
  if (!isStaff(req)) query = query.eq("requester_id", req.profile.id);
  if (req.query.status) query = query.eq("status",req.query.status);
  if (req.query.priority) query = query.eq("priority",req.query.priority);
  if (req.query.category_id) query = query.eq("category_id",req.query.category_id);
  if (req.query.department_id) query = query.eq("department_id",req.query.department_id);
  if (req.query.search) query = query.ilike("ticket_code","%" + String(req.query.search).trim() + "%");
  const {data,error}=await query;
  if(error) return res.status(400).json({error:"Não foi possível carregar os pedidos."});
  res.json(await enrichTickets(data || []));
};

exports.get = async (req,res) => {
  const {data:ticket,error}=await getTicket(req.params.id);
  if(error || !ticket) return res.status(404).json({error:"Pedido não encontrado."});
  if(!canAccess(req,ticket)) return res.status(403).json({error:"Não tem permissão para consultar este pedido."});

  let mq=adminClient.from("ticket_messages").select("*").eq("ticket_id",ticket.id).order("created_at",{ascending:true});
  if(!isStaff(req)) mq=mq.eq("visibility","Pública");
  const {data:messages}=await mq;
  const {data:attachments}=await adminClient.from("ticket_attachments").select("*").eq("ticket_id",ticket.id).order("created_at",{ascending:true});
  const result=(await enrichTickets([ticket]))[0];
  result.messages=messages || [];
  result.attachments=attachments || [];
  if(result.attachments.length){
    result.attachments=await Promise.all(result.attachments.map(async a=>{
      const {data}=await adminClient.storage.from("ticket-attachments").createSignedUrl(a.storage_path,3600);
      return {...a,signed_url:data?.signedUrl || null};
    }));
  }
  const {data:rating}=await adminClient.from("ticket_ratings").select("*").eq("ticket_id",ticket.id).maybeSingle();
  result.rating=rating || null;
  res.json(result);
};

exports.create = async (req,res) => {
  if(isStaff(req)) return res.status(403).json({error:"O administrador/agente não cria pedidos pelo fluxo normal."});
  if(req.profile.role!=="Solicitante" || !["ESTUDANTE","COLABORADOR"].includes(req.profile.user_type)) {
    return res.status(403).json({error:"O seu perfil não pode criar pedidos."});
  }

  const b=req.body;
  if(!b.type || !b.category_id || !b.subject || !b.description) return res.status(400).json({error:"Preencha tipo, categoria, assunto e descrição."});
  if(!TICKET_TYPES.includes(b.type)) return res.status(400).json({error:"Tipo de pedido inválido."});

  const {data:category}=await adminClient.from("categories").select("id,name,status").eq("id",b.category_id).single();
  if(!category || category.status!=="Activo") return res.status(400).json({error:"Categoria inválida."});

  let service=null;
  if(b.service_id){
    const {data}=await adminClient.from("services").select("*").eq("id",b.service_id).single();
    if(!data || data.status!=="Activo") return res.status(400).json({error:"Serviço inválido."});
    service=data;
    if(String(service.category_id)!==String(b.category_id)) return res.status(400).json({error:"O serviço não pertence à categoria seleccionada."});
  }

  const due=new Date(Date.now()+Number(service?.sla_hours || 48)*3600000).toISOString();
  const {data:ticket,error}=await adminClient.from("tickets").insert({
    requester_id:req.profile.id,
    category_id:b.category_id,
    service_id:b.service_id || null,
    department_id:b.department_id || service?.department_id || req.profile.department_id || null,
    type:b.type,
    subject:String(b.subject).trim(),
    description:String(b.description).trim(),
    priority:["Baixa","Normal","Alta","Crítica"].includes(b.priority) ? b.priority : "Normal",
    status:"Novo",
    due_at:due
  }).select("*").single();

  if(error) return res.status(400).json({error:"Não foi possível criar o pedido."});

  await event(req,ticket.id,"PEDIDO_CRIADO",null,"Novo");
  await notifyStaff("Novo pedido recebido",req.profile.full_name + " criou o pedido " + ticket.ticket_code,"ticket");
  res.status(201).json((await enrichTickets([ticket]))[0]);
};

exports.reply = async (req,res) => {
  const {data:ticket}=await getTicket(req.params.id);
  if(!canAccess(req,ticket)) return res.status(403).json({error:"Não tem permissão para responder a este pedido."});
  const body=String(req.body.message || "").trim();
  if(!body) return res.status(400).json({error:"A mensagem não pode estar vazia."});

  const visibility=isStaff(req) && req.body.visibility==="Interna" ? "Interna" : "Pública";
  const {data:msg,error}=await adminClient.from("ticket_messages").insert({
    ticket_id:ticket.id, author_id:req.profile.id, body, visibility
  }).select("*").single();
  if(error) return res.status(400).json({error:"Não foi possível enviar a mensagem."});

  if(isStaff(req)){
    const patch={first_response_at:ticket.first_response_at || new Date().toISOString()};
    if(ticket.status==="Novo") patch.status="Em atendimento";
    await adminClient.from("tickets").update(patch).eq("id",ticket.id);
    await notify(ticket.requester_id,"Nova resposta no seu pedido","Há uma nova resposta no pedido " + ticket.ticket_code + ".","ticket_message");
  }else{
    await notifyStaff("Nova resposta de utilizador",req.profile.full_name + " respondeu ao pedido " + ticket.ticket_code + ".","ticket_message");
    if(ticket.status==="Aguardando utilizador") await adminClient.from("tickets").update({status:"Em atendimento"}).eq("id",ticket.id);
  }

  await event(req,ticket.id,visibility==="Interna" ? "NOTA_INTERNA" : "MENSAGEM_PUBLICA");
  res.status(201).json(msg);
};

exports.update = async (req,res) => {
  const {data:ticket}=await getTicket(req.params.id);
  if(!ticket) return res.status(404).json({error:"Pedido não encontrado."});

  const changes={};
  for(const key of ["status","priority","assignee_id","assigned_department_id","category_id","service_id"]){
    if(req.body[key]!==undefined) changes[key]=req.body[key] || null;
  }
  if(changes.status && !STATUSES.includes(changes.status)) return res.status(400).json({error:"Estado de pedido inválido."});
  if(changes.status && changes.status!==ticket.status){
    if(changes.status==="Resolvido") changes.resolved_at=new Date().toISOString();
    if(changes.status==="Fechado") changes.closed_at=new Date().toISOString();
    if(changes.status==="Reaberto"){changes.resolved_at=null;changes.closed_at=null;}
  }

  const {data:updated,error}=await adminClient.from("tickets").update(changes).eq("id",ticket.id).select("*").single();
  if(error) return res.status(400).json({error:"Não foi possível actualizar o pedido."});

  for(const [key,value] of Object.entries(changes)){
    if(String(ticket[key])!==String(value)) await event(req,ticket.id,"ALTERAÇÃO_" + key.toUpperCase(),String(ticket[key] ?? ""),String(value ?? ""));
  }
  if(changes.status && changes.status!==ticket.status){
    await notify(ticket.requester_id,"Estado do pedido actualizado","O estado do pedido " + ticket.ticket_code + ' mudou para "' + changes.status + '".',"ticket_status");
  }
  res.json((await enrichTickets([updated]))[0]);
};

exports.reopen = async (req,res) => {
  const {data:ticket}=await getTicket(req.params.id);
  if(!ticket || ticket.requester_id!==req.profile.id) return res.status(403).json({error:"Não tem permissão para reabrir este pedido."});
  if(!["Resolvido","Fechado"].includes(ticket.status)) return res.status(400).json({error:"Este pedido ainda não pode ser reaberto."});
  const {data:updated,error}=await adminClient.from("tickets").update({status:"Reaberto",resolved_at:null,closed_at:null}).eq("id",ticket.id).select("*").single();
  if(error) return res.status(400).json({error:"Não foi possível reabrir o pedido."});
  await event(req,ticket.id,"PEDIDO_REABERTO",ticket.status,"Reaberto");
  await notifyStaff("Pedido reaberto",req.profile.full_name + " reabriu o pedido " + ticket.ticket_code,"ticket_status");
  res.json((await enrichTickets([updated]))[0]);
};

exports.rate = async (req,res) => {
  const {data:ticket}=await getTicket(req.params.id);
  if(!ticket || ticket.requester_id!==req.profile.id) return res.status(403).json({error:"Não tem permissão para avaliar este pedido."});
  if(!["Resolvido","Fechado"].includes(ticket.status)) return res.status(400).json({error:"Só pode avaliar pedidos resolvidos ou fechados."});
  const rating=Number(req.body.rating);
  if(!Number.isInteger(rating) || rating<1 || rating>5) return res.status(400).json({error:"A avaliação deve ser de 1 a 5 estrelas."});
  const {data,error}=await adminClient.from("ticket_ratings").upsert({
    ticket_id:ticket.id,user_id:req.profile.id,rating,comment:req.body.comment || null
  },{onConflict:"ticket_id"}).select("*").single();
  if(error) return res.status(400).json({error:"Não foi possível guardar a avaliação."});
  await event(req,ticket.id,"PEDIDO_AVALIADO",null,String(rating));
  res.json(data);
};

exports.uploadAttachment = async (req,res) => {
  const {data:ticket}=await getTicket(req.params.id);
  if(!canAccess(req,ticket)) return res.status(403).json({error:"Não tem permissão para anexar ficheiros neste pedido."});
  if(!req.file) return res.status(400).json({error:"Seleccione um ficheiro."});

  const allowed=["image/jpeg","image/png","image/webp","application/pdf","text/plain","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/msword","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/vnd.ms-excel"];
  if(!allowed.includes(req.file.mimetype)) return res.status(400).json({error:"Tipo de ficheiro não permitido."});
  if(req.file.size>10*1024*1024) return res.status(400).json({error:"O ficheiro não pode ultrapassar 10 MB."});

  const safeName=req.file.originalname.replace(/[^a-zA-Z0-9._-]/g,"_");
  const path=ticket.id + "/" + Date.now() + "-" + safeName;
  const {error:uploadError}=await adminClient.storage.from("ticket-attachments").upload(path,req.file.buffer,{contentType:req.file.mimetype,upsert:false});
  if(uploadError) return res.status(400).json({error:"Não foi possível guardar o anexo."});

  const {data:row,error}=await adminClient.from("ticket_attachments").insert({
    ticket_id:ticket.id,uploaded_by:req.profile.id,storage_path:path,file_name:req.file.originalname,mime_type:req.file.mimetype,file_size:req.file.size
  }).select("*").single();
  if(error){
    await adminClient.storage.from("ticket-attachments").remove([path]).catch(()=>{});
    return res.status(400).json({error:"Não foi possível registar o anexo."});
  }
  await event(req,ticket.id,"ANEXO_ADICIONADO",null,row.file_name);
  res.status(201).json(row);
};


exports.lookups = async (req,res) => {
  const [categories,services,departments,staff] = await Promise.all([
    adminClient.from("categories").select("id,name,status").eq("status","Activo").order("name"),
    adminClient.from("services").select("id,name,category_id,department_id,sla_hours,status").eq("status","Activo").order("name"),
    adminClient.from("departments").select("id,name,status").eq("status","Activo").order("name"),
    isStaff(req) ? adminClient.from("profiles").select("id,full_name,email,role,user_type,department_id").in("role",STAFF).eq("status","Activo").order("full_name") : Promise.resolve({data:[]})
  ]);
  res.json({categories:categories.data||[],services:services.data||[],departments:departments.data||[],staff:staff.data||[]});
};
