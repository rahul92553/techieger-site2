// Techieger website + admin panel. No dependencies. Run: ADMIN_PASSWORD=yourpass node server.js
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
// Serves from ./public if it exists, otherwise from the main folder (only these 3 files, never server.js or data)
const ROOT=fs.existsSync(path.join(__dirname,'public'))?path.join(__dirname,'public'):__dirname,OK=['index.html','admin.html','logo.png'];
const PORT=process.env.PORT||3000,DIR=process.env.DATA_DIR||path.join(__dirname,'data'),FILE=path.join(DIR,'inquiries.json');
let PASS=process.env.ADMIN_PASSWORD;
if(!PASS){PASS=crypto.randomBytes(6).toString('hex');console.log('No ADMIN_PASSWORD set. Temporary admin password: '+PASS)}
const SECRET=process.env.SESSION_SECRET||crypto.createHash('sha256').update('tg:'+PASS).digest('hex');
try{fs.mkdirSync(DIR,{recursive:true})}catch(e){console.log('Local data folder unavailable:',e.code)}
// Optional free online storage (Upstash Redis) so enquiries survive restarts on free hosting
const UURL=process.env.UPSTASH_REDIS_REST_URL,UTOK=process.env.UPSTASH_REDIS_REST_TOKEN;
const remote=async cmd=>{const r=await fetch(UURL,{method:'POST',headers:{Authorization:'Bearer '+UTOK},body:JSON.stringify(cmd)});const j=await r.json();if(j.error)throw new Error(j.error);return j.result};
let db=[];try{db=JSON.parse(fs.readFileSync(FILE,'utf8'))}catch(e){}
const save=async()=>{try{fs.writeFileSync(FILE+'.tmp',JSON.stringify(db,null,1));fs.renameSync(FILE+'.tmp',FILE)}catch(e){}
 if(UURL)await remote(['SET','tg:inquiries',JSON.stringify(db)])};
const hits={};const limited=(k,max,ms)=>{const n=Date.now();hits[k]=(hits[k]||[]).filter(t=>n-t<ms);if(hits[k].length>=max)return true;hits[k].push(n);return false};
const sign=v=>crypto.createHmac('sha256',SECRET).update(v).digest('hex');
const token=()=>{const e=Date.now()+12*3600e3;return e+'.'+sign(''+e)};
const authed=req=>{const m=/(?:^|; )tgs=([^;]+)/.exec(req.headers.cookie||'');if(!m)return false;const[e,s]=m[1].split('.');return +e>Date.now()&&s&&s.length===64&&crypto.timingSafeEqual(Buffer.from(s),Buffer.from(sign(e)))};
const ip=req=>(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].trim();
const json=(res,c,o)=>{res.writeHead(c,{'Content-Type':'application/json'});res.end(JSON.stringify(o))};
const body=req=>new Promise(r=>{let b='';req.on('data',d=>{b+=d;if(b.length>20000)req.destroy()});req.on('end',()=>{try{r(JSON.parse(b))}catch(e){r({})}})});
const clip=(v,n)=>String(v||'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').trim().slice(0,n);
const types={'.html':'text/html; charset=utf-8','.png':'image/png','.css':'text/css','.js':'text/javascript','.ico':'image/x-icon','.svg':'image/svg+xml'};
const csv=v=>'"'+String(v==null?'':v).replace(/"/g,'""').replace(/^([=+\-@])/,"'$1")+'"';
const ALLOWED=['https://techieger.com','https://www.techieger.com'];
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://x'),p=u.pathname;
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
  const origin=req.headers.origin;
 if(origin&&ALLOWED.includes(origin)){
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Credentials','true');
  res.setHeader('Vary','Origin');
 }
 if(req.method==='OPTIONS'){
  res.writeHead(204,{'Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'86400'});
  return res.end();
 }
 try{
 if(p==='/api/inquiries'&&req.method==='POST'){
  if(limited('q'+ip(req),5,600000))return json(res,429,{error:'Too many requests. Please try again later.'});
  const b=await body(req);if(b.website)return json(res,200,{ok:true});
  const r={id:crypto.randomUUID(),name:clip(b.name,100),phone:clip(b.phone,30),email:clip(b.email,120),need:clip(b.need,60),budget:clip(b.budget,60),message:clip(b.message,2000),status:'new',note:'',created:new Date().toISOString()};
  if(!r.name||r.phone.replace(/\D/g,'').length<7)return json(res,400,{error:'Please enter your name and a valid phone number.'});
  db.unshift(r);await save();return json(res,200,{ok:true});
 }
 if(p==='/api/admin/login'&&req.method==='POST'){
  if(limited('l'+ip(req),8,600000))return json(res,429,{error:'Too many attempts. Wait a few minutes.'});
  const b=await body(req),a=Buffer.from(sign(clip(b.password,200))),c=Buffer.from(sign(PASS));
  if(!crypto.timingSafeEqual(a,c))return json(res,401,{error:'Wrong password'});
  res.setHeader('Set-Cookie','tgs='+token()+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200'+(req.headers['x-forwarded-proto']==='https'?'; Secure':''));return json(res,200,{ok:true});
 }
 if(p.startsWith('/api/admin/')){
  if(!authed(req))return json(res,401,{error:'Not signed in'});
  if(p==='/api/admin/logout'){res.setHeader('Set-Cookie','tgs=; Max-Age=0; Path=/');return json(res,200,{ok:true})}
  if(p==='/api/admin/inquiries'&&req.method==='GET')return json(res,200,db);
  if(p==='/api/admin/export.csv'){
   const h=['created','name','phone','email','need','budget','message','status','note'];
   res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="techieger-customers.csv"'});
   return res.end('\ufeff'+h.join(',')+'\n'+db.map(r=>h.map(k=>csv(r[k])).join(',')).join('\n'));
  }
  const m=/^\/api\/admin\/inquiries\/([\w-]+)$/.exec(p);
  if(m){const i=db.findIndex(r=>r.id===m[1]);if(i<0)return json(res,404,{error:'Not found'});
   if(req.method==='DELETE'){db.splice(i,1);await save();return json(res,200,{ok:true})}
   if(req.method==='PATCH'){const b=await body(req);if(['new','contacted','closed'].includes(b.status))db[i].status=b.status;if(typeof b.note==='string')db[i].note=clip(b.note,1000);await save();return json(res,200,db[i])}}
  return json(res,404,{error:'Not found'});
 }
 const f=p==='/'?'index.html':p==='/admin'||p==='/admin/'?'admin.html':p.slice(1);
 const fp=path.join(ROOT,path.normalize(f));
 if(!OK.includes(f)||!fs.existsSync(fp)||!fs.statSync(fp).isFile()){res.writeHead(404);return res.end('Not found')}
 const h={'Content-Type':types[path.extname(fp)]||'application/octet-stream'};if(f==='admin.html')h['X-Robots-Tag']='noindex';
 res.writeHead(200,h);fs.createReadStream(fp).pipe(res);
 }catch(e){console.error(e);if(!res.headersSent)json(res,500,{error:'Server error'})}
});
(async()=>{
 if(UURL){try{db=JSON.parse(await remote(['GET','tg:inquiries'])||'[]');console.log('Loaded '+db.length+' enquiries from online storage')}catch(e){console.error('Could not reach online storage:',e.message);process.exit(1)}}
 server.listen(PORT,()=>console.log('Techieger running on http://localhost:'+PORT+'  (admin: /admin)'));
})();
