const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const app=document.querySelector("#app");
let ME=null, DEPARTMENTS=[], CATEGORIES=[], SERVICES=[];

const roleIsStaff=()=>ME && ["Administrador","Supervisor","Agente"].includes(ME.role);
const isRequester=()=>ME && !roleIsStaff();
const toast=(message,ok=false)=>{
  const e=document.querySelector("#toast");
  e.textContent=message;
  e.className="toast show";
  e.style.background=ok?"#147D4B":"#30343B";
  setTimeout(()=>e.className="toast",3500);
};
const fmt=d=>d?new Date(d).toLocaleString("pt-MZ"):"—";
const statusText=s=>s||"—";

async function loadLookups(){
  DEPARTMENTS=await API.request("/auth/departments");
  if(ME){
    CATEGORIES=await API.request("/admin/categories").catch(()=>[]);
    SERVICES=await API.request("/admin/services").catch(()=>[]);
  }
}

function logout(){
  API.logout().catch(()=>{}).finally(()=>{
    localStorage.removeItem("sd_token");
    localStorage.removeItem("sd_refresh");
    API.token=null; API.refreshToken=null; ME=null;
    renderLogin();
  });
}

function shell(title,content){
  const staff=roleIsStaff();
  app.innerHTML=
    "<header class='topbar'><div class='brand'><div class='brand-placeholder'>ISPOTEC</div><span>Service Desk ISPOTEC</span></div>"+
    "<div class='top-user'>"+esc(ME.full_name||ME.name||"Utilizador")+" <button class='btn secondary' id='logoutBtn'>Sair</button></div></header>"+
    "<div class='layout'><aside><nav class='nav'>"+
    "<a href='#' id='navHome'>🏠 Painel</a>"+
    (isRequester()?"<a href='#' id='navNew'>➕ Novo Pedido</a>":"")+
    "<a href='#' id='navTickets'>🎫 "+(staff?"Caixa de entrada":"Meus pedidos")+"</a>"+
    "<a href='#' id='navNotifications'>🔔 Notificações</a>"+
    "<a href='#' id='navProfile'>👤 Meu perfil</a>"+
    (ME.role==="Administrador"?"<a href='#' id='navPending'>⏳ Utilizadores pendentes</a><a href='#' id='navUsers'>👥 Utilizadores</a><a href='#' id='navDepartments'>🏢 Departamentos</a><a href='#' id='navCategories'>🗂 Categorias e serviços</a><a href='#' id='navAdmin'>📊 Central de Atendimento</a>":"")+
    "</nav></aside><main><div class='page-title'><h1>"+esc(title)+"</h1></div>"+content+"</main></div>";
  document.querySelector("#logoutBtn").onclick=logout;
  document.querySelector("#navHome").onclick=e=>{e.preventDefault();dashboard();};
  const n=document.querySelector("#navNew"); if(n)n.onclick=e=>{e.preventDefault();newTicket();};
  document.querySelector("#navTickets").onclick=e=>{e.preventDefault();ticketsPage();};
  document.querySelector("#navNotifications").onclick=e=>{e.preventDefault();notificationsPage();};
  document.querySelector("#navProfile").onclick=e=>{e.preventDefault();profilePage();};
  const p=document.querySelector("#navPending"); if(p)p.onclick=e=>{e.preventDefault();pendingPage();};
  const u=document.querySelector("#navUsers"); if(u)u.onclick=e=>{e.preventDefault();usersPage();};
  const d=document.querySelector("#navDepartments"); if(d)d.onclick=e=>{e.preventDefault();departmentsPage();};
  const c=document.querySelector("#navCategories"); if(c)c.onclick=e=>{e.preventDefault();catalogPage();};
  const a=document.querySelector("#navAdmin"); if(a)a.onclick=e=>{e.preventDefault();adminDashboard();};
}

function renderLogin(){
  app.innerHTML="<div class='login'><div class='login-box'><div class='login-logo'><div class='brand-placeholder' style='margin:auto'>ISPOTEC</div><h1>Service Desk</h1><p class='muted'>Instituto Superior Politécnico e Tecnologias</p></div>"+
  "<form id='loginForm'><div class='field'><label>Email</label><input id='loginEmail' type='email' autocomplete='username' required></div>"+
  "<div class='field'><label>Palavra-passe</label><input id='loginPassword' type='password' autocomplete='current-password' required></div>"+
  "<div id='loginError' class='error'></div><button class='btn yellow' style='width:100%'>Iniciar sessão</button></form>"+
  "<p style='text-align:center;margin-top:18px'>Ainda não tem conta? <a href='#' id='registerLink'><b>Criar acesso</b></a></p></div></div>";
  document.querySelector("#registerLink").onclick=e=>{e.preventDefault();renderRegister();};
  document.querySelector("#loginForm").onsubmit=async e=>{
    e.preventDefault();
    const err=document.querySelector("#loginError"); err.textContent="";
    try{
      const x=await API.login(document.querySelector("#loginEmail").value,document.querySelector("#loginPassword").value);
      API.token=x.access_token; API.refreshToken=x.refresh_token;
      localStorage.setItem("sd_token",API.token); localStorage.setItem("sd_refresh",API.refreshToken);
      ME=x.user; await loadLookups(); dashboard();
    }catch(error){err.textContent=error.message;}
  };
}

async function renderRegister(){
  DEPARTMENTS=await API.request("/auth/departments").catch(()=>[]);
  app.innerHTML="<div class='login'><div class='login-box' style='max-width:720px'><h1>Criar acesso</h1><p class='muted'>O cadastro ficará aguardando confirmação do administrador.</p>"+
  "<form id='registerForm'><div class='grid grid-2'>"+
  "<div class='field'><label>Nome completo *</label><input id='rName' required></div>"+
  "<div class='field'><label>Número de celular *</label><input id='rPhone' placeholder='+258 84 123 4567' required></div>"+
  "<div class='field'><label>Email *</label><input id='rEmail' type='email' required></div>"+
  "<div class='field'><label>Tipo de utilizador *</label><select id='rType' required><option value=''>Selecione</option><option value='ESTUDANTE'>Estudante</option><option value='COLABORADOR'>Colaborador</option></select></div>"+
  "<div class='field'><label>Departamento *</label><select id='rDept' required><option value=''>Selecione</option>"+DEPARTMENTS.map(d=>"<option value='"+d.id+"'>"+esc(d.name)+"</option>").join("")+"</select></div>"+
  "<div class='field hidden' id='studentNumberWrap'><label>Número de estudante *</label><input id='rStudentNumber'></div>"+
  "<div class='field hidden' id='courseWrap'><label>Curso *</label><input id='rCourse'></div>"+
  "<div class='field hidden' id='positionWrap'><label>Função/cargo</label><input id='rPosition'></div>"+
  "<div class='field'><label>Senha *</label><input id='rPassword' type='password' minlength='8' required></div>"+
  "<div class='field'><label>Confirmar senha *</label><input id='rPasswordConfirm' type='password' minlength='8' required></div>"+
  "</div><div id='registerError' class='error'></div><div class='actions'><button class='btn yellow'>Criar acesso</button><button type='button' class='btn secondary' id='backLogin'>Voltar ao login</button></div></form></div></div>";
  document.querySelector("#backLogin").onclick=renderLogin;
  document.querySelector("#rType").onchange=e=>{
    const student=e.target.value==="ESTUDANTE";
    document.querySelector("#studentNumberWrap").classList.toggle("hidden",!student);
    document.querySelector("#courseWrap").classList.toggle("hidden",!student);
    document.querySelector("#positionWrap").classList.toggle("hidden",e.target.value!=="COLABORADOR");
  };
  document.querySelector("#registerForm").onsubmit=async e=>{
    e.preventDefault();
    const err=document.querySelector("#registerError");err.textContent="";
    try{
      const r=await API.register({
        name:document.querySelector("#rName").value,phone:document.querySelector("#rPhone").value,
        email:document.querySelector("#rEmail").value,userType:document.querySelector("#rType").value,
        departmentId:document.querySelector("#rDept").value,studentNumber:document.querySelector("#rStudentNumber").value,
        course:document.querySelector("#rCourse").value,position:document.querySelector("#rPosition").value,
        password:document.querySelector("#rPassword").value,passwordConfirm:document.querySelector("#rPasswordConfirm").value
      });
      renderPending(r.notice,r.detail);
    }catch(error){err.textContent=error.message;}
  };
}

function renderPending(notice,detail){
  app.innerHTML="<div class='login'><div class='login-box' style='text-align:center'><div class='brand-placeholder' style='margin:auto'>ISPOTEC</div><h1>Cadastro realizado com sucesso</h1><div class='card' style='margin-top:18px'><h2>"+esc(notice||"Aguarda a confirmação do administrador")+"</h2><p>"+esc(detail||"O seu pedido de acesso foi enviado para análise. Assim que o administrador aprovar o seu cadastro, poderá entrar no Service Desk.")+"</p><p><b>Estado: Aguardando aprovação</b></p></div><button class='btn yellow' id='pendingBack' style='margin-top:18px'>Voltar ao login</button></div></div>";
  document.querySelector("#pendingBack").onclick=renderLogin;
}

async function dashboard(){
  const ts=await API.tickets();
  if(roleIsStaff()) return staffDashboard(ts);
  const counts={
    total:ts.length,new:ts.filter(t=>t.status==="Novo").length,
    progress:ts.filter(t=>["Em análise","Em atendimento","Aguardando departamento","Escalado","Reaberto"].includes(t.status)).length,
    waiting:ts.filter(t=>t.status==="Aguardando utilizador").length,
    resolved:ts.filter(t=>t.status==="Resolvido").length,closed:ts.filter(t=>t.status==="Fechado").length
  };
  shell("Meu Service Desk",
    "<div class='welcome'><h2>Olá, "+esc(ME.full_name)+"</h2><p class='muted'>Acompanhe os seus pedidos de atendimento.</p></div>"+
    "<div class='grid grid-4'>"+stat("Meus pedidos",counts.total)+stat("Pedidos abertos",counts.new)+stat("Em atendimento",counts.progress)+stat("Aguardando resposta",counts.waiting)+
    "</div><div class='actions' style='margin:18px 0'><button class='btn yellow' id='newMain'>+ Novo Pedido</button></div>"+
    "<div class='card'><h2>Pedidos recentes</h2>"+ticketTable(ts.slice(0,8),false)+"</div>");
  document.querySelector("#newMain").onclick=newTicket;
}

function staffDashboard(ts){
  const c={
    n:ts.filter(t=>t.status==="Novo").length,
    p:ts.filter(t=>["Em análise","Em atendimento","Aguardando utilizador","Aguardando departamento","Escalado","Reaberto"].includes(t.status)).length,
    w:ts.filter(t=>t.status==="Aguardando utilizador").length,
    o:ts.filter(t=>t.due_at&&new Date(t.due_at)<new Date()&&!["Resolvido","Fechado","Cancelado"].includes(t.status)).length,
    r:ts.filter(t=>t.status==="Resolvido").length,cl:ts.filter(t=>t.status==="Fechado").length
  };
  shell("Central de Atendimento",
    "<div class='grid grid-4'>"+stat("Novos pedidos",c.n)+stat("Em atendimento",c.p)+stat("Aguardando utilizador",c.w)+stat("Atrasados",c.o)+
    "</div><div class='grid grid-2' style='margin-top:18px'>"+stat("Resolvidos",c.r)+stat("Fechados",c.cl)+"</div>"+
    "<div class='card' style='margin-top:18px'><h2>Caixa de entrada</h2>"+ticketTable(ts.slice(0,12),true)+"</div>");
}

function stat(label,value){return "<div class='card stat'><span class='muted'>"+esc(label)+"</span><strong>"+value+"</strong></div>";}

function ticketTable(ts,staff){
  if(!ts.length)return "<p class='muted'>Não existem pedidos neste momento.</p>";
  return "<div class='table-wrap'><table><thead><tr><th>Pedido</th><th>Solicitante</th><th>Assunto</th><th>Categoria</th><th>Prioridade</th><th>Estado</th><th>SLA</th></tr></thead><tbody>"+
    ts.map(t=>"<tr><td><a href='#' data-ticket='"+t.id+"' class='ticket-link'><b>"+esc(t.ticket_number_display)+"</b></a></td>"+
    "<td>"+esc(t.requester?.full_name||ME.full_name)+"</td><td>"+esc(t.subject)+"</td><td>"+esc(t.category?.name||"—")+"</td>"+
    "<td><span class='badge "+priorityClass(t.priority)+"'>"+esc(t.priority)+"</span></td><td><span class='badge'>"+esc(t.status)+"</span></td><td>"+(t.due_at?fmt(t.due_at):"—")+"</td></tr>").join("")+
    "</tbody></table></div>";
}

function priorityClass(p){return p==="Crítica"||p==="Alta"?"CRITICA":"";}

function bindTicketLinks(){
  document.querySelectorAll(".ticket-link").forEach(a=>a.onclick=e=>{e.preventDefault();viewTicket(a.dataset.ticket);});
}

async function ticketsPage(){
  const ts=await API.tickets();
  shell(roleIsStaff()?"Caixa de entrada":"Meus pedidos",
    "<div class='card'><div class='grid grid-2'><div class='field'><label>Pesquisar número</label><input id='searchTicket' placeholder='ISP-2026-000001'></div><div class='field'><label>Estado</label><select id='filterStatus'><option value=''>Todos</option>"+["Novo","Em análise","Em atendimento","Aguardando utilizador","Aguardando departamento","Escalado","Resolvido","Fechado","Reaberto","Cancelado"].map(s=>"<option>"+s+"</option>").join("")+"</select></div></div><div id='ticketList'>"+ticketTable(ts,roleIsStaff())+"</div></div>");
  bindTicketLinks();
  const reload=async()=>{const data=await API.tickets({status:document.querySelector("#filterStatus").value,search:document.querySelector("#searchTicket").value});document.querySelector("#ticketList").innerHTML=ticketTable(data,roleIsStaff());bindTicketLinks();};
  document.querySelector("#filterStatus").onchange=reload;
  document.querySelector("#searchTicket").oninput=()=>{clearTimeout(window.__search);window.__search=setTimeout(reload,350);};
}

async function newTicket(){
  if(!isRequester())return toast("O administrador trabalha sobre os pedidos recebidos.");
  await loadLookups();
  shell("Novo Pedido",
    "<div class='card'><form id='ticketForm'><div class='grid grid-2'>"+
    "<div class='field'><label>Tipo *</label><select id='tType' required><option value=''>Selecione</option>"+["Incidente","Pedido de serviço","Reclamação","Dúvida","Sugestão"].map(x=>"<option>"+x+"</option>").join("")+"</select></div>"+
    "<div class='field'><label>Categoria *</label><select id='tCat' required><option value=''>Selecione</option>"+CATEGORIES.filter(c=>c.status==="Activo").map(c=>"<option value='"+c.id+"'>"+esc(c.name)+"</option>").join("")+"</select></div>"+
    "<div class='field'><label>Serviço</label><select id='tService'><option value=''>Seleccione primeiro a categoria</option></select></div>"+
    "<div class='field'><label>Departamento</label><select id='tDept'><option value=''>Automático</option>"+DEPARTMENTS.map(d=>"<option value='"+d.id+"'>"+esc(d.name)+"</option>").join("")+"</select></div>"+
    "<div class='field'><label>Prioridade</label><select id='tPriority'><option>Baixa</option><option selected>Normal</option><option>Alta</option><option>Crítica</option></select></div></div>"+
    "<div class='field'><label>Assunto *</label><input id='tSubject' required></div><div class='field'><label>Descrição *</label><textarea id='tDescription' required></textarea></div>"+
    "<div class='field'><label>Anexo opcional</label><input id='tFile' type='file' accept='.jpg,.jpeg,.png,.webp,.pdf,.txt,.doc,.docx,.xls,.xlsx'></div>"+
    "<div id='ticketError' class='error'></div><button class='btn yellow'>Enviar pedido</button></form></div>");
  document.querySelector("#tCat").onchange=e=>{
    const cat=e.target.value;
    const options=SERVICES.filter(s=>s.status==="Activo"&&String(s.category_id)===String(cat));
    document.querySelector("#tService").innerHTML="<option value=''>Nenhum serviço específico</option>"+options.map(s=>"<option value='"+s.id+"'>"+esc(s.name)+"</option>").join("");
  };
  document.querySelector("#ticketForm").onsubmit=async e=>{
    e.preventDefault();
    const err=document.querySelector("#ticketError");err.textContent="";
    try{
      const t=await API.createTicket({type:document.querySelector("#tType").value,category_id:document.querySelector("#tCat").value,service_id:document.querySelector("#tService").value||null,department_id:document.querySelector("#tDept").value||null,priority:document.querySelector("#tPriority").value,subject:document.querySelector("#tSubject").value,description:document.querySelector("#tDescription").value});
      const file=document.querySelector("#tFile").files[0]; if(file) await API.upload(t.id,file);
      toast("Pedido "+t.ticket_number_display+" criado com sucesso.",true);viewTicket(t.id);
    }catch(error){err.textContent=error.message;}
  };
}

async function viewTicket(id){
  const t=await API.ticket(id);
  const staff=roleIsStaff();
  let messages=t.messages||[];
  shell("Pedido "+t.ticket_number_display,
    "<div class='grid grid-2'><div class='card'><p class='muted'>Assunto</p><h2>"+esc(t.subject)+"</h2><p>"+esc(t.description).replaceAll("\\n","<br>")+"</p>"+
    "<p><b>Tipo:</b> "+esc(t.type)+"</p><p><b>Categoria:</b> "+esc(t.category?.name||"—")+"</p><p><b>Serviço:</b> "+esc(t.service?.name||"—")+"</p></div>"+
    "<div class='card'><p><b>Solicitante:</b> "+esc(t.requester?.full_name||"—")+"</p><p><b>Departamento:</b> "+esc(t.department?.name||"—")+"</p><p><b>Responsável:</b> "+esc(t.assignee?.full_name||"Não atribuído")+"</p>"+
    "<p><b>Prioridade:</b> "+esc(t.priority)+"</p><p><b>Estado:</b> <span class='badge'>"+esc(t.status)+"</span></p><p><b>SLA:</b> "+fmt(t.due_at)+"</p></div></div>"+
    (staff?staffActions(t):"")+
    "<div class='card' style='margin-top:18px'><h2>Mensagens</h2><div id='messages'>"+messages.map(m=>"<div class='message "+(m.visibility==="Interna"?"internal":"")+"'><b>"+esc(m.author_id===ME.id?"Você":"Utilizador/Agente")+"</b> <span class='muted'>"+fmt(m.created_at)+"</span><p>"+esc(m.body).replaceAll("\\n","<br>")+"</p><small>"+esc(m.visibility)+"</small></div>").join("")||"<p class='muted'>Sem mensagens.</p>"+"</div>"+
    "<form id='replyForm' style='margin-top:16px'><div class='field'><label>"+(staff?"Resposta / nota interna":"Resposta")+"</label><textarea id='replyBody' required></textarea></div>"+
    (staff?"<label class='check'><input type='checkbox' id='internalReply'> Nota interna</label>":"")+
    "<button class='btn' style='margin-top:8px'>Enviar mensagem</button></form></div>"+
    (t.attachments?.length?"<div class='card' style='margin-top:18px'><h2>Anexos</h2>"+t.attachments.map(a=>"<p><a target='_blank' href='"+esc(a.signed_url||"#")+"'>"+esc(a.file_name)+"</a></p>").join("")+"</div>":"")+
    (isRequester()&&["Resolvido","Fechado"].includes(t.status)?"<div class='card' style='margin-top:18px'><h2>Avaliação</h2>"+(t.rating?"<p>Avaliação: <b>"+t.rating.rating+"/5</b></p>":"<form id='ratingForm'><div class='field'><label>Estrelas</label><select id='rating'><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select></div><div class='field'><label>Comentário</label><textarea id='ratingComment'></textarea></div><button class='btn yellow'>Avaliar atendimento</button></form>")+"</div>":"")+
    (isRequester()&&["Resolvido","Fechado"].includes(t.status)?"<div class='actions' style='margin-top:18px'><button class='btn secondary' id='reopenBtn'>Reabrir pedido</button></div>":""));
  document.querySelector("#replyForm").onsubmit=async e=>{
    e.preventDefault();
    const body=document.querySelector("#replyBody").value;
    const visibility=staff&&document.querySelector("#internalReply")?.checked?"Interna":"Pública";
    try{await API.reply(id,{message:body,visibility});viewTicket(id);}catch(error){toast(error.message);}
  };
  const rb=document.querySelector("#reopenBtn");if(rb)rb.onclick=async()=>{try{await API.reopen(id);viewTicket(id);}catch(e){toast(e.message);}};
  const rf=document.querySelector("#ratingForm");if(rf)rf.onsubmit=async e=>{e.preventDefault();try{await API.rate(id,{rating:Number(document.querySelector("#rating").value),comment:document.querySelector("#ratingComment").value});viewTicket(id);}catch(x){toast(x.message);}};
  if(staff){
    const save=document.querySelector("#saveTicket");
    if(save)save.onclick=async()=>{try{await API.updateTicket(id,{status:document.querySelector("#editStatus").value,priority:document.querySelector("#editPriority").value,assignee_id:document.querySelector("#editAssignee").value||null,assigned_department_id:document.querySelector("#editAssignedDept").value||null});viewTicket(id);}catch(e){toast(e.message);}};
  }
}

function staffActions(t){
  return "<div class='card' style='margin-top:18px'><h2>Gestão do pedido</h2><div class='grid grid-2'>"+
    "<div class='field'><label>Estado</label><select id='editStatus'>"+["Novo","Em análise","Em atendimento","Aguardando utilizador","Aguardando departamento","Escalado","Resolvido","Fechado","Reaberto","Cancelado"].map(s=>"<option "+(s===t.status?"selected":"")+">"+s+"</option>").join("")+"</select></div>"+
    "<div class='field'><label>Prioridade</label><select id='editPriority'>"+["Baixa","Normal","Alta","Crítica"].map(s=>"<option "+(s===t.priority?"selected":"")+">"+s+"</option>").join("")+"</select></div>"+
    "<div class='field'><label>Responsável</label><select id='editAssignee'><option value=''>Sem responsável</option></select></div>"+
    "<div class='field'><label>Departamento responsável</label><select id='editAssignedDept'><option value=''>Nenhum</option>"+DEPARTMENTS.map(d=>"<option value='"+d.id+"' "+(String(d.id)===String(t.assigned_department_id||"")?"selected":"")+">"+esc(d.name)+"</option>").join("")+"</select></div>"+
    "</div><button class='btn yellow' id='saveTicket'>Guardar alterações</button></div>";
}

async function pendingPage(){
  const rows=await API.admin("/pending-users");
  shell("Utilizadores pendentes","<div class='card'>"+(rows.length?rows.map(u=>"<div class='pending-row'><div><b>"+esc(u.full_name)+"</b><br><span class='muted'>"+esc(u.email)+" · "+esc(u.user_type)+"</span><br><span>"+esc(u.student_number||u.position||"")+" </span></div><div class='actions'><button class='btn success' data-approve='"+u.id+"'>Aprovar</button><button class='btn danger' data-reject='"+u.id+"'>Recusar</button></div></div>").join(""):"<p class='muted'>Não existem utilizadores pendentes.</p>")+"</div>");
  document.querySelectorAll("[data-approve]").forEach(b=>b.onclick=async()=>{if(!confirm("Tem certeza que deseja aprovar este utilizador?"))return;try{await API.admin("/users/"+b.dataset.approve+"/approve",{method:"POST"});toast("Utilizador aprovado com sucesso.",true);pendingPage();}catch(e){toast(e.message);}});
  document.querySelectorAll("[data-reject]").forEach(b=>b.onclick=async()=>{const reason=prompt("Motivo da recusa (opcional):");try{await API.admin("/users/"+b.dataset.reject+"/reject",{method:"POST",body:JSON.stringify({reason})});toast("Cadastro recusado.",true);pendingPage();}catch(e){toast(e.message);}});
}

async function usersPage(){
  const rows=await API.admin("/users");
  shell("Utilizadores","<div class='card'><div class='actions'><button class='btn yellow' id='newUser'>+ Criar utilizador</button></div><div class='table-wrap' style='margin-top:16px'><table><thead><tr><th>Nome</th><th>Email</th><th>Tipo</th><th>Departamento</th><th>Estado</th><th>Acções</th></tr></thead><tbody>"+rows.map(u=>"<tr><td>"+esc(u.full_name)+"</td><td>"+esc(u.email)+"</td><td>"+esc(u.user_type)+"</td><td>"+esc(u.department_id||"—")+"</td><td>"+esc(u.status)+"</td><td><button class='btn secondary' data-block='"+u.id+"'>Alterar estado</button></td></tr>").join("")+"</tbody></table></div></div>");
  document.querySelector("#newUser").onclick=createUser;
  document.querySelectorAll("[data-block]").forEach(b=>b.onclick=async()=>{const s=prompt("Novo estado: Activo, Inactivo ou Bloqueado","Inactivo");if(!s)return;try{await API.admin("/users/"+b.dataset.block+"/status",{method:"PATCH",body:JSON.stringify({status:s})});usersPage();}catch(e){toast(e.message);}});
}

async function createUser(){
  await loadLookups();
  const name=prompt("Nome completo");if(!name)return;
  const email=prompt("Email");if(!email)return;
  const phone=prompt("Celular");if(!phone)return;
  const type=prompt("Tipo: ESTUDANTE, COLABORADOR ou ADMINISTRADOR","COLABORADOR");if(!type)return;
  const dept=prompt("ID do departamento. Veja a página Departamentos.");if(!dept)return;
  const password=prompt("Palavra-passe inicial (mínimo 8 caracteres)");if(!password)return;
  try{await API.admin("/users",{method:"POST",body:JSON.stringify({name,email,phone,user_type:type,department_id:dept,password,status:"Activo"})});toast("Utilizador criado.",true);usersPage();}catch(e){toast(e.message);}
}

async function departmentsPage(){
  const rows=await API.admin("/departments");
  shell("Departamentos","<div class='card'><button class='btn yellow' id='newDept'>+ Novo departamento</button><div class='table-wrap' style='margin-top:16px'><table><thead><tr><th>Nome</th><th>Estado</th></tr></thead><tbody>"+rows.map(d=>"<tr><td>"+esc(d.name)+"</td><td>"+esc(d.status)+"</td></tr>").join("")+"</tbody></table></div></div>");
  document.querySelector("#newDept").onclick=async()=>{const name=prompt("Nome do departamento");if(!name)return;try{await API.admin("/departments",{method:"POST",body:JSON.stringify({name})});departmentsPage();}catch(e){toast(e.message);}};
}

async function catalogPage(){
  const [cats,services]=await Promise.all([API.admin("/categories"),API.admin("/services")]);
  shell("Categorias e serviços","<div class='grid grid-2'><div class='card'><h2>Categorias</h2><button class='btn yellow' id='newCat'>+ Nova categoria</button><div class='table-wrap' style='margin-top:12px'><table><tbody>"+cats.map(c=>"<tr><td>"+esc(c.name)+"</td><td>"+esc(c.status)+"</td></tr>").join("")+"</tbody></table></div></div><div class='card'><h2>Serviços</h2><button class='btn yellow' id='newSvc'>+ Novo serviço</button><div class='table-wrap' style='margin-top:12px'><table><tbody>"+services.map(s=>"<tr><td>"+esc(s.name)+"</td><td>"+esc(s.sla_hours)+" h</td><td>"+esc(s.status)+"</td></tr>").join("")+"</tbody></table></div></div></div>");
  document.querySelector("#newCat").onclick=async()=>{const name=prompt("Nome da categoria");if(!name)return;try{await API.admin("/categories",{method:"POST",body:JSON.stringify({name})});catalogPage();}catch(e){toast(e.message);}};
  document.querySelector("#newSvc").onclick=async()=>{const name=prompt("Nome do serviço");if(!name)return;const category_id=prompt("ID da categoria");if(!category_id)return;try{await API.admin("/services",{method:"POST",body:JSON.stringify({name,category_id,sla_hours:48})});catalogPage();}catch(e){toast(e.message);}};
}

async function adminDashboard(){
  const d=await API.admin("/dashboard");
  shell("Central de Atendimento","<div class='grid grid-4'>"+stat("Novos pedidos",d.new)+stat("Em atendimento",d.in_progress)+stat("Aguardando utilizador",d.waiting_user)+stat("Atrasados",d.overdue)+
  "</div><div class='grid grid-4' style='margin-top:18px'>"+stat("SLA em risco",d.sla_risk)+stat("Resolvidos",d.resolved)+stat("Fechados",d.closed)+stat("Utilizadores pendentes",d.pending_users)+"</div>"+
  "<div class='actions' style='margin-top:18px'><button class='btn yellow' id='goPending'>Ver utilizadores pendentes</button><button class='btn secondary' id='goTickets'>Ver caixa de entrada</button></div>");
  document.querySelector("#goPending").onclick=pendingPage;
  document.querySelector("#goTickets").onclick=ticketsPage;
}

async function notificationsPage(){
  const rows=await API.admin("/notifications").catch(()=>[]);
  shell("Notificações","<div class='card'>"+(rows.length?rows.map(n=>"<div class='pending-row'><div><b>"+esc(n.title)+"</b><p>"+esc(n.body)+"</p><small>"+fmt(n.created_at)+"</small></div>"+(!n.read_at?"<button class='btn secondary' data-read='"+n.id+"'>Marcar como lida</button>":"<span class='muted'>Lida</span>")+"</div>").join(""):"<p class='muted'>Não existem notificações.</p>")+"</div>");
  document.querySelectorAll("[data-read]").forEach(b=>b.onclick=async()=>{await API.admin("/notifications/"+b.dataset.read+"/read",{method:"PATCH"});notificationsPage();});
}

async function profilePage(){
  shell("Meu perfil","<div class='card'><div class='grid grid-2'><p><b>Nome:</b><br>"+esc(ME.full_name)+"</p><p><b>Email:</b><br>"+esc(ME.email)+"</p><p><b>Celular:</b><br>"+esc(ME.phone||"—")+"</p><p><b>Tipo:</b><br>"+esc(ME.user_type)+"</p><p><b>Estado:</b><br>"+esc(ME.status)+"</p><p><b>Departamento:</b><br>"+esc(ME.department?.name||"—")+"</p><p><b>Número de estudante:</b><br>"+esc(ME.student_number||"—")+"</p><p><b>Curso:</b><br>"+esc(ME.course||"—")+"</p></div></div>");
}

async function boot(){
  if(!API.token)return renderLogin();
  try{ME=await API.me();await loadLookups();dashboard();}
  catch(e){localStorage.removeItem("sd_token");localStorage.removeItem("sd_refresh");API.token=null;API.refreshToken=null;renderLogin();}
}
boot();
