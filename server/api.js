import {saveManual,archiveManual} from './manual-trades.js';
import {login,logout} from './password-auth.js';
import {provisionOwner} from './provision.js';
import {HTTPError,fail,json,id,now,text,email,number,date,secret,hash,checkOrigin,readJSON,body} from './security.js';
import {auth,admin,owner,account,authorize,accountData,publicUser,settings,one,rows,run,statement,auditStatement,hydrate} from './store.js';
import {commit,undo,parseUpload} from './imports.js';
import * as cloudflare from './cloudflare.js';
import {parseMT5File} from '../src/importer.js';
export async function api(request,env,ctx={waitUntil:()=>{}}){try{
 if(!env.DB)fail(503,'Cloud database is not configured.');const path=new URL(request.url).pathname;
 if(path==='/api/session'||path==='/api/auth/login')await provisionOwner(env);
 if(path==='/api/auth/login')return await login(request,env);
 if(path==='/api/auth/logout')return await logout(request,env);
 if(path==='/api/ea/ingest')return await ingest(request,env,ctx);
 const u=await auth(request,env);if(request.method==='GET'){
  if(path==='/api/session')return json({user:publicUser(u),provider:u.authMethod||'chatgpt',storage:'Cloudflare D1',cloudflare:u.role==='admin'?await cloudflare.status(env):undefined});
  if(path==='/api/workspace')return json({db:await hydrate(env,u)});
  if(path==='/api/cloudflare'){admin(u);return json(await cloudflare.status(env));}
  fail(404,'Endpoint not found.');
 }
 if(request.method!=='POST')fail(405,'Method not allowed.');checkOrigin(request);
 if(path==='/api/imports'){
  const bytes=await body(request,11*1024*1024);const {report,options}=await parseUpload(new Request(request.url,{method:'POST',headers:request.headers,body:bytes}));
  const result=await commit(env,u,report,options);ctx.waitUntil(cloudflare.flush(env,u).catch(()=>{}));return json({...result,db:await hydrate(env,u)});
 }
 const input=await readJSON(request);
 if(path==='/api/cloudflare/connect'){admin(u);const result=await cloudflare.connect(env,input);for(const v of await rows(env,'SELECT id FROM users'))await cloudflare.queue(env,v.id);ctx.waitUntil(cloudflare.flush(env,u).catch(()=>{}));await run(env,'INSERT INTO activity(id,owner_id,actor_id,time,type,text) VALUES(?,?,?,?,?,?)',id(),u.id,u.id,now(),'security','Connected Cloudflare KV namespace');return json(result);}
 if(path==='/api/cloudflare/sync'){admin(u);return json({...await cloudflare.flush(env,u),...await cloudflare.status(env)});}
 if(path==='/api/cloudflare/disconnect'){admin(u);await run(env,"DELETE FROM configuration WHERE key='cloudflare'");return json(await cloudflare.status(env));}
 if(path!=='/api/action')fail(404,'Endpoint not found.');const result=await action(env,u,input);ctx.waitUntil(cloudflare.flush(env,u).catch(()=>{}));return json({...result,db:await hydrate(env,u)});
 }catch(error){if(error instanceof HTTPError)return json({error:error.message},error.status);console.error('Journal API failed',{name:error.name});return json({error:'The server could not complete this request. Refresh and retry.'},500);}}
async function action(env,u,input){const f=input.fields||{},type=input.type;let ownerId=u.id,result={};
 switch(type){
 case'manual.save':return saveManual(env,u,f,input.id);
 case'manual.archive':return archiveManual(env,u,input.id,f.revision);
 case'manual.restore':return archiveManual(env,u,input.id,f.revision,true);
 case'profile':case'risk':case'preferences':{
  const target=await owner(env,u,input.ownerId);ownerId=target.id;const current=settings(target);
  if(type==='profile'){const name=text(f.name,70),timezone=text(f.timezone,70);try{new Intl.DateTimeFormat('en',{timeZone:timezone});}catch{fail(400,'Choose a valid timezone.');}current.profile={name,email:target.email,timezone,currency:'USD'};await run(env,'UPDATE users SET name=?,settings=? WHERE id=?',name,JSON.stringify(current),target.id);}
  else if(type==='risk'){current.risk={perTrade:number(f.perTrade,.1,100),dailyLoss:number(f.dailyLoss,.1,100),maxTrades:number(f.maxTrades,1,100)};await run(env,'UPDATE users SET settings=? WHERE id=?',JSON.stringify(current),target.id);}
  else{current.preferences={email:!!f.email,sync:!!f.sync,weekly:!!f.weekly};await run(env,'UPDATE users SET settings=? WHERE id=?',JSON.stringify(current),target.id);}break;
 }
 case'review':{if(f.grade!==undefined&&!['','A+','A','B','C'].includes(f.grade))fail(400,'Choose a supported setup quality grade.');const t=await one(env,"SELECT t.* FROM trades t JOIN batches b ON b.id=t.batch_id WHERE t.id=? AND b.state='committed'",input.id);if(!t)fail(404,'Execution not found.');authorize(u,t.owner_id);ownerId=t.owner_id;const existing=JSON.parse(t.data);await run(env,"UPDATE trades SET data=json_set(data,'$.notes',?,'$.reviewed',json(?),'$.grade',?,'$.revision',CASE WHEN json_extract(data,'$.source')='Manual entry' THEN coalesce(json_extract(data,'$.revision'),1)+1 ELSE coalesce(json_extract(data,'$.revision'),0) END) WHERE id=?",text(f.notes??'',10000,false),JSON.stringify(!!f.reviewed),f.grade??existing.grade??'',t.id);break;}
 case'entry.save':{const target=await owner(env,u,input.ownerId);ownerId=target.id;const old=input.id?await one(env,'SELECT * FROM entries WHERE id=?',input.id):null;if(input.id&&!old)fail(404,'Reflection not found.');if(old&&old.owner_id!==target.id)fail(403,'This reflection belongs to another owner.');const entry={id:old?.id||id(),userId:target.id,date:date(f.date),title:text(f.title,120),content:text(f.content,20000),mood:['Focused','Calm','Confident','Impatient','Anxious'].includes(f.mood)?f.mood:'Focused',rating:number(f.rating,1,5)};await run(env,'INSERT INTO entries(id,owner_id,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',entry.id,target.id,JSON.stringify(entry));break;}
 case'entry.delete':{const entry=await one(env,'SELECT * FROM entries WHERE id=?',input.id);if(!entry)fail(404,'Reflection not found.');authorize(u,entry.owner_id);ownerId=entry.owner_id;await run(env,'DELETE FROM entries WHERE id=?',entry.id);break;}
 case'users.create':{admin(u);const mail=email(f.email),name=text(f.name,70),newId=id();if(await one(env,'SELECT id FROM users WHERE email=?',mail))fail(409,'A user with this email already exists.');await run(env,"INSERT INTO users(id,email,name,role,status,created,settings) VALUES(?,?,?,'user','Invited',?,'{}')",newId,mail,name,now());ownerId=newId;if(f.license)await issue(env,u,{userId:newId,name:name.split(' ')[0]+' · Trading account',balance:0,expiry:new Date(Date.now()+365*86400000).toISOString().slice(0,10),type:'Live'});result.message='User added. Ask them to sign in with this exact email; no invitation email is sent.';break;}
 case'users.status':{admin(u);const target=await owner(env,u,input.id);if(target.id===u.id||target.role==='admin')fail(403,'Administrator access cannot be suspended from this screen.');ownerId=target.id;const status=target.status==='Suspended'?'Active':'Suspended';await env.DB.batch([statement(env,'UPDATE users SET status=? WHERE id=?',status,target.id),auditStatement(env,u,target.id,`${status==='Active'?'Restored':'Suspended'} user · ${target.name}`,'security')]);break;}
 case'license.issue':admin(u);ownerId=(await owner(env,u,f.userId)).id;result.account=await issue(env,u,f);break;
 case'license.activate':{const license=text(f.license,90).toUpperCase(),a=await one(env,'SELECT * FROM accounts WHERE license=?',license);if(!a||a.owner_id!==u.id)fail(403,'This license is not assigned to you. Contact your administrator.');if(a.status!=='Active'||a.expires<now().slice(0,10))fail(403,'This license is inactive or expired.');await run(env,"UPDATE accounts SET data=json_set(data,'$.name',?) WHERE id=?",text(f.name,70),a.id);break;}
 case'account.update':{const a=await account(env,u,input.id);ownerId=a.owner_id;const data=accountData(a);data.name=text(f.name,70);let status=a.status,expires=a.expires;if(u.role==='admin'&&a.license){if(!['Active','Suspended','Revoked'].includes(f.status))fail(400,'Choose a license status.');status=f.status;expires=date(f.expiry);}await run(env,'UPDATE accounts SET status=?,expires=?,data=? WHERE id=?',status,expires,JSON.stringify(data),a.id);break;}
 case'account.bind':{const a=await account(env,u,input.id);ownerId=a.owner_id;if(!a.license||a.status!=='Active'||a.expires<now().slice(0,10))fail(403,'Use an active license to connect an EA.');const login=text(f.number,20),server=text(f.server,100),broker=text(f.broker,70);if(!/^\d{4,20}$/.test(login))fail(400,'Enter a numeric MT5 account number.');if(a.number&&(a.number!==login||a.server.toLowerCase()!==server.toLowerCase()))fail(409,'This license is already bound to another MT5 account.');if(await one(env,'SELECT id FROM accounts WHERE number=? AND server=? AND id<>?',login,server,a.id))fail(409,'This MT5 account already has a journal account.');await run(env,"UPDATE accounts SET number=?,server=?,data=json_set(data,'$.broker',?,'$.connection','Awaiting heartbeat') WHERE id=?",login,server,broker,a.id);break;}
 case'account.rotate':{const a=await account(env,u,input.id);ownerId=a.owner_id;if(!a.license||a.status!=='Active')fail(403,'Use an active license.');const token=secret();await run(env,"UPDATE accounts SET token_hash=?,data=json_set(data,'$.connection','Awaiting heartbeat') WHERE id=?",await hash(token),a.id);result.connectorToken=token;result.accountId=a.id;break;}
 case'account.disconnect':{const a=await account(env,u,input.id);ownerId=a.owner_id;await run(env,"UPDATE accounts SET token_hash=NULL,data=json_set(data,'$.connection','Disconnected') WHERE id=?",a.id);break;}
 case'import.undo':await undo(env,u,input.id);return {};
 default:fail(400,'Unknown action.');
 }
 await env.DB.batch([auditStatement(env,u,ownerId,type,type.startsWith('license')?'license':'update'),statement(env,'INSERT INTO kv_outbox(id,owner_id,batch_id,updated) VALUES(?,?,?,?)',id(),ownerId,'',now())]);return result;
}
async function issue(env,u,f){const target=await owner(env,u,f.userId),data={id:id(),userId:target.id,name:text(f.name,70),type:['Live','Funded','Demo'].includes(f.type)?f.type:'Live',balance:number(f.balance||0),balanceKnown:String(f.balance??'').trim()!=='',currency:'USD',mode:'ea',demo:false,broker:'Not connected',connection:'Not connected',created:now().slice(0,10),lastSync:null};const expires=date(f.expiry);if(expires<now().slice(0,10))fail(400,'Choose a future expiry date.');const license='STRC-'+secret().slice(0,24).toUpperCase();await run(env,'INSERT INTO accounts(id,owner_id,license,status,expires,data) VALUES(?,?,?,?,?,?)',data.id,target.id,license,'Active',expires,JSON.stringify(data));return {...data,license,status:'Active',expiry:expires};}
async function ingest(request,env,ctx){
 if(request.method!=='POST')fail(405,'Use POST.');const bearer=request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/i)?.[1];if(!bearer)fail(401,'Connector credential required.');const a=await one(env,'SELECT * FROM accounts WHERE token_hash=?',await hash(bearer));if(!a)fail(401,'Connector credential is invalid or revoked.');const u=await one(env,'SELECT * FROM users WHERE id=?',a.owner_id);if(u.status!=='Active'||a.status!=='Active'||a.expires<now().slice(0,10))fail(403,'This owner or license is inactive.');
 const input=await readJSON(request,1024*1024);if(String(input.account)!==a.number||String(input.server).toLowerCase()!==a.server.toLowerCase())fail(403,'Connector account does not match the license binding.');if(input.currency!=='USD')fail(400,'USD accounts are required.');
 if(!Array.isArray(input.positions)||input.positions.length>500)fail(400,'Send up to 500 closed positions.');
 if(!input.positions.length){await run(env,"UPDATE accounts SET data=json_set(data,'$.lastSync',?,'$.connection','Connected') WHERE id=?",now(),a.id);return json({accepted:0,heartbeat:true});}
 const columns=['Ticket','Symbol','Type','Volume','Open Time','Open Price','Close Time','Close Price','Profit','Commission','Swap','Fee','Magic'];const csv=[columns];
 for(const p of input.positions){if(!/^\d{1,25}$/.test(String(p.ticket))||!['Buy','Sell'].includes(p.side)||!Number.isFinite(Number(p.magic))||Number(p.magic)<=0)fail(400,'Only closed EA positions with a non-zero magic number are accepted.');if(!/^\d{4}[-.]\d{2}[-.]\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(p.openTime)||!/^\d{4}[-.]\d{2}[-.]\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(p.closeTime))fail(400,'Send valid broker timestamps.');csv.push([String(p.ticket),text(p.symbol,30),p.side,number(p.lots,.000001,1e6),p.openTime,number(p.entry,.00000001),p.closeTime,number(p.exit,.00000001),number(p.pnl,-1e10,1e10),number(p.commission||0,-1e10,1e10),number(p.swap||0,-1e10,1e10),number(p.fee||0,-1e10,1e10),p.magic]);}
 const file=new File([csv.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n')],'ea-closed-positions.csv');const report=await parseMT5File(file);report.metadata.account=a.number;report.metadata.server=a.server;
 let result;try{result=await commit(env,u,report,{userId:u.id,accountId:a.id,number:a.number,server:a.server},'EA sync');}catch(e){if(e.status===400&&e.message.startsWith('All these trades')){await run(env,"UPDATE accounts SET data=json_set(data,'$.lastSync',?,'$.connection','Connected') WHERE id=?",now(),a.id);return json({accepted:0,duplicates:true});}throw e;}
 ctx.waitUntil(cloudflare.flush(env,u).catch(()=>{}));return json({accepted:result.batch.count,duplicates:result.batch.duplicates});
}
