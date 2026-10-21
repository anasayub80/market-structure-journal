import {authenticateCookie} from './password-auth.js';
import {id,now,fail} from './security.js';
export const one=(env,sql,...args)=>env.DB.prepare(sql).bind(...args).first();
export const rows=async(env,sql,...args)=>(await env.DB.prepare(sql).bind(...args).all()).results;
export const run=(env,sql,...args)=>env.DB.prepare(sql).bind(...args).run();
export const statement=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
export function publicUser(u){return {id:u.id,name:u.name,email:u.email,role:u.role,status:u.status,joined:u.created.slice(0,10),color:u.role==='admin'?'purple':'gold'};}
export function settings(u){const saved=JSON.parse(u.settings||'{}');return {profile:{timezone:'UTC',currency:'USD',...saved.profile,name:u.name,email:u.email},risk:{perTrade:1,dailyLoss:3,maxTrades:3,...saved.risk},preferences:{email:false,sync:true,weekly:false,...saved.preferences}};}
export async function auth(request,env){
 const passwordUser=await authenticateCookie(request,env);if(passwordUser)return {...passwordUser,authMethod:'password'};
 const identity=request.headers.get('oai-authenticated-user-id'),mail=request.headers.get('oai-authenticated-user-email')?.toLowerCase();
 if(!identity||!mail)fail(401,'Sign in to open your journal.');
 let u=await one(env,'SELECT * FROM users WHERE auth_id = ?',identity);
 if(!u){u=await one(env,'SELECT * FROM users WHERE email = ?',mail);if(u){if(u.auth_id&&u.auth_id!==identity)fail(403,'This email is already linked to another identity.');await run(env,'UPDATE users SET auth_id = ?, status = CASE WHEN status = ? THEN ? ELSE status END WHERE id = ? AND (auth_id IS NULL OR auth_id = ?)',identity,'Invited','Active',u.id,identity);}else{
  const role=env.ADMIN_EMAIL&&mail===env.ADMIN_EMAIL.toLowerCase()?'admin':'user';
  const name=request.headers.get('oai-authenticated-user-full-name');let display=mail.split('@')[0];try{if(name)display=decodeURIComponent(name).slice(0,70);}catch{}
  await run(env,'INSERT OR IGNORE INTO users(id,auth_id,email,name,role,status,created,settings) VALUES(?,?,?,?,?,?,?,?)',id(),identity,mail,display,role,'Active',now(),'{}');
 }u=await one(env,'SELECT * FROM users WHERE auth_id = ?',identity);}
 if(!u||u.status==='Suspended')fail(403,'Your access is suspended. Contact your administrator.');return {...u,authMethod:'chatgpt'};
}
export const admin=u=>{if(u.role!=='admin')fail(403,'Administrator access is required.');};
export function authorize(u,owner){if(u.role!=='admin'&&u.id!==owner)fail(403,'This record belongs to another user.');}
export async function owner(env,u,value){const v=value||u.id;authorize(u,v);const target=await one(env,'SELECT * FROM users WHERE id = ?',v);if(!target)fail(404,'User not found.');return target;}
export async function account(env,u,value){const a=await one(env,'SELECT * FROM accounts WHERE id = ?',value);if(!a)fail(404,'Account not found.');authorize(u,a.owner_id);return a;}
export function accountData(a){const data=JSON.parse(a.data);if(data.connection==='Connected'&&(!data.lastSync||Date.now()-Date.parse(data.lastSync)>180000))data.connection='Offline';return {...data,id:a.id,userId:a.owner_id,license:a.license||'File import',status:a.status==='Active'&&a.expires&&a.expires<now().slice(0,10)?'Expired':a.status,expiry:a.expires,number:a.number,server:a.server};}
export const auditStatement=(env,u,ownerId,message,type='update')=>statement(env,'INSERT INTO activity(id,owner_id,actor_id,time,type,text) VALUES(?,?,?,?,?,?)',id(),ownerId,u.id,now(),type,message);
export async function hydrate(env,u,ownerId){
 const all=u.role==='admin'&&!ownerId;const target=all?null:ownerId||u.id;if(target)authorize(u,target);
 const [users,accounts,trades,entries,batches,activity,archived]=await Promise.all([
 rows(env,all?'SELECT * FROM users ORDER BY created':'SELECT * FROM users WHERE id = ?',...(all?[]:[target])),
 rows(env,all?'SELECT * FROM accounts':'SELECT * FROM accounts WHERE owner_id = ?',...(all?[]:[target])),
 rows(env,'SELECT t.data FROM trades t JOIN batches b ON b.id=t.batch_id WHERE b.state=\'committed\''+(all?'':' AND t.owner_id = ?'),...(all?[]:[target])),
 rows(env,all?'SELECT data FROM entries':'SELECT data FROM entries WHERE owner_id = ?',...(all?[]:[target])),
 rows(env,"SELECT data FROM batches WHERE state='committed' AND coalesce(json_extract(data,'$.source'),'')<>'Manual entry'"+(all?'':' AND owner_id = ?')+' ORDER BY created DESC',...(all?[]:[target])),
 rows(env,'SELECT id,owner_id as userId,time,type,text FROM activity'+(all?'':' WHERE owner_id = ?')+' ORDER BY time DESC LIMIT 200',...(all?[]:[target])),
 rows(env,"SELECT t.data FROM trades t JOIN batches b ON b.id=t.batch_id WHERE b.state='undone' AND json_extract(t.data,'$.source')='Manual entry'"+(all?'':' AND t.owner_id=?'),...(all?[]:[target]))]);
 const own=users.find(v=>v.id===u.id)||u;const config=settings(own);return {version:2,dataMode:'real',theme:'light',...config,userSettings:Object.fromEntries(users.map(v=>[v.id,settings(v)])),users:users.map(publicUser),accounts:accounts.map(accountData),trades:trades.map(v=>JSON.parse(v.data)),entries:entries.map(v=>JSON.parse(v.data)),deletedManualTrades:archived.map(v=>JSON.parse(v.data)),importBatches:batches.map(v=>JSON.parse(v.data)),activity};
}
