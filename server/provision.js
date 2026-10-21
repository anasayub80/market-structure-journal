import {id,now,hash,number,text,fail} from './security.js';
import {one,run,statement} from './store.js';
export async function provisionOwner(env){
 if(!env.ADMIN_EMAIL||!env.OWNER_WORKSPACE_CONFIG)return;
 let config;try{config=JSON.parse(env.OWNER_WORKSPACE_CONFIG);}catch{fail(503,'Owner workspace configuration is invalid.');}
 const ownerEmail=env.ADMIN_EMAIL.toLowerCase(),key='owner-workspace:'+await hash(ownerEmail+':'+text(config.accountKey,80));
 if(await one(env,'SELECT key FROM configuration WHERE key=?',key))return;
 const accountId='goal-'+(await hash(key)).slice(0,28),name=text(config.name,70),accountName=text(config.accountName,70),start=number(config.initialBalance,1),target=number(config.targetBalance,start+1),risk=number(config.baseRisk,1),step=number(config.stepProfit,1);
 let user=await one(env,'SELECT * FROM users WHERE email=?',ownerEmail);if(!user){await run(env,"INSERT OR IGNORE INTO users(id,email,name,role,status,created,settings) VALUES(?,?,?,'admin','Active',?,?)",id(),ownerEmail,name,now(),JSON.stringify({profile:{timezone:config.timezone||'UTC',currency:'USD'},risk:{perTrade:risk/start*100,dailyLoss:risk/start*100,maxTrades:1},preferences:{email:false,sync:true,weekly:true}}));user=await one(env,'SELECT * FROM users WHERE email=?',ownerEmail);}
 const account={id:accountId,userId:user.id,name:accountName,type:'Live',balance:start,balanceKnown:true,currency:'USD',mode:'ea',demo:false,broker:'Not connected',connection:'Not connected',created:now().slice(0,10),lastSync:null,goal:{initialBalance:start,targetBalance:target,baseRisk:risk,stepProfit:step,multiplier:2,weeklyTradeLimit:1,requiredGrade:'A+',milestoneBasis:'net-profit',riskBasis:'current-closed-balance'}};
 const license='STRC-'+(await hash(accountId+':'+env.INTEGRATION_SECRET)).slice(0,24).toUpperCase();
 await env.DB.batch([statement(env,"UPDATE users SET role='admin',status='Active' WHERE id=?",user.id),statement(env,"INSERT OR IGNORE INTO accounts(id,owner_id,license,status,expires,data) VALUES(?,?,?,'Active','2099-12-31',?)",accountId,user.id,license,JSON.stringify(account)),statement(env,'INSERT OR IGNORE INTO configuration(key,value) VALUES(?,?)',key,JSON.stringify({ownerId:user.id,accountId,configuredAt:now()}))]);
}
