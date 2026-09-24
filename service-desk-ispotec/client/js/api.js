const API={
  token:localStorage.getItem("sd_token"),
  refreshToken:localStorage.getItem("sd_refresh"),
  async request(path,opts={}){
    const headers=opts.body instanceof FormData?{}:{"Content-Type":"application/json"};
    if(this.token) headers.Authorization="Bearer "+this.token;
    let r=await fetch("/api"+path,{...opts,headers:{...headers,...(opts.headers||{})}});
    if(r.status===401&&this.refreshToken&&!path.startsWith("/auth/")){
      const rr=await fetch("/api/auth/refresh",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({refresh_token:this.refreshToken})});
      if(rr.ok){
        const x=await rr.json();
        this.token=x.access_token; this.refreshToken=x.refresh_token||this.refreshToken;
        localStorage.setItem("sd_token",this.token); localStorage.setItem("sd_refresh",this.refreshToken);
        r=await fetch("/api"+path,{...opts,headers:{...headers,Authorization:"Bearer "+this.token}});
      }
    }
    if(r.status===204)return null;
    const ct=r.headers.get("content-type")||"";
    const data=ct.includes("application/json")?await r.json():await r.text();
    if(!r.ok) throw new Error(data?.error||data||"Erro na operação");
    return data;
  },
  login:(email,password)=>API.request("/auth/login",{method:"POST",body:JSON.stringify({email,password})}),
  register:data=>API.request("/auth/register",{method:"POST",body:JSON.stringify(data)}),
  refresh:()=>API.request("/auth/refresh",{method:"POST",body:JSON.stringify({refresh_token:API.refreshToken})}),
  logout:()=>API.request("/auth/logout",{method:"POST"}),
  me:()=>API.request("/auth/me"),
  tickets:params=>{const q=new URLSearchParams(params||{});return API.request("/tickets"+(q.toString()?"?"+q:""));},
  ticket:id=>API.request("/tickets/"+id),
  createTicket:data=>API.request("/tickets",{method:"POST",body:JSON.stringify(data)}),
  reply:(id,data)=>API.request("/tickets/"+id+"/replies",{method:"POST",body:JSON.stringify(data)}),
  updateTicket:(id,data)=>API.request("/tickets/"+id,{method:"PATCH",body:JSON.stringify(data)}),
  reopen:id=>API.request("/tickets/"+id+"/reopen",{method:"POST"}),
  rate:(id,data)=>API.request("/tickets/"+id+"/rating",{method:"POST",body:JSON.stringify(data)}),
  upload:(id,file)=>{const fd=new FormData();fd.append("file",file);return API.request("/tickets/"+id+"/attachments",{method:"POST",body:fd});},
  admin:(path,opts={})=>API.request("/admin"+path,opts)
};