// Headless DOM-contract tests exercise real routing, rendering, and event handlers.
// They do not substitute for browser layout or accessibility verification.
import test from 'node:test';import assert from 'node:assert/strict';
const events={},nodes={app:{innerHTML:''},overlay:{innerHTML:'',firstChild:null,querySelector:()=>null},toast:{innerHTML:''}};
globalThis.document={documentElement:{dataset:{}},body:{classList:{add(){},remove(){}},append(){}},activeElement:null,querySelector:s=>s==='#app'?nodes.app:s==='#overlay-root'?nodes.overlay:s==='#toast-root'?nodes.toast:null,addEventListener:(name,fn)=>events[name]=fn,getElementById:()=>null};
const windowEvents={};globalThis.window={addEventListener:(n,fn)=>windowEvents[n]=fn,scrollTo(){}};globalThis.location={hash:''};
const saved=new Map();globalThis.localStorage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
globalThis.FormData=class{constructor(form){return Object.entries(form.fields)[Symbol.iterator]();}};
await import('../src/app.js');
function route(hash){location.hash=hash;windowEvents.hashchange();}
async function click(action){await events.click({target:{closest:()=>({dataset:{action},disabled:false}),classList:{contains:()=>false}}});}
function submit(id,fields,dataset={}){events.submit({preventDefault(){},target:{id,dataset,fields,checkValidity:()=>true}});}
const db=()=>JSON.parse(saved.get('structure-v1'));
test('all user and admin pages render without runtime errors',()=>{for(const role of ['user','admin'])for(const page of role==='user'?['overview','trades','calendar','analytics','journal','playbook','accounts','reports','settings','help']:['overview','users','licenses','accounts','analytics','calendar','connections','activity','settings','help']){route(`#/${role}/${page}`);assert.match(nodes.app.innerHTML,/<main/);assert.ok(!nodes.app.innerHTML.includes('NaN'));assert.ok(nodes.app.innerHTML.includes('page-heading'));}for(const page of ['login','register','forgot','onboarding']){route('#/'+page);assert.ok(nodes.app.innerHTML.includes('auth-layout'));}});
test('role routes keep administrator pages out of the user workspace',()=>{route('#/user/users');assert.ok(nodes.app.innerHTML.includes('Every trade tells a story'));assert.ok(!nodes.app.innerHTML.includes('User management'));});
test('trade detail opens a review form and persists edits',async()=>{route('#/user/trades');await click('trade:t1');assert.ok(nodes.overlay.innerHTML.includes('trade-review-form'));submit('trade-review-form',{setup:'Liquidity sweep',emotion:'Calm',notes:'Reviewed in flow test',reviewed:'on'},{id:'t1'});assert.equal(db().trades.find(t=>t.id==='t1').notes,'Reviewed in flow test');});
test('user route cannot mutate another user trade',()=>{route('#/user/trades');const t=db().trades.find(t=>t.accountId==='a4');submit('trade-review-form',{setup:'Liquidity sweep',emotion:'Calm',notes:'Forbidden edit'},{id:t.id});assert.notEqual(db().trades.find(x=>x.id===t.id).notes,'Forbidden edit');});
test('calendar day opens its actual trades and reflection action',async()=>{route('#/user/calendar');await click('day:2026-10-16');assert.ok(nodes.overlay.innerHTML.includes('Net result'));assert.ok(nodes.overlay.innerHTML.includes('Daily reflection'));await click('entry-date:2026-10-16');assert.ok(nodes.overlay.innerHTML.includes('entry-form'));});
test('daily reflection create and delete persists',async()=>{route('#/user/journal');submit('entry-form',{date:'2026-10-17',title:'Flow test reflection',mood:'Focused',rating:'4',content:'Waited for my setup.'},{id:''});const entry=db().entries.find(x=>x.title==='Flow test reflection');assert.ok(entry);await click('confirm-delete-entry:'+entry.id);assert.ok(!db().entries.some(x=>x.id===entry.id));});
test('admin can create a user and their first single-account license',()=>{route('#/admin/users');submit('user-form',{name:'Test Trader',email:'test@example.com',status:'Active',license:'on'});const u=db().users.find(u=>u.email==='test@example.com');assert.ok(u);assert.equal(db().accounts.filter(a=>a.userId===u.id).length,1);const before=db().users.length;submit('user-form',{name:'Duplicate',email:'test@example.com',status:'Active'});assert.equal(db().users.length,before);});
test('admin-issued licenses belong to their selected owner',()=>{route('#/admin/licenses');submit('license-form',{userId:'u2',name:'Test license',type:'Demo',balance:'5000',expiry:'2027-10-18'});assert.equal(db().accounts.find(a=>a.name==='Test license').userId,'u2');});
test('non-admin cannot issue licenses or add users through handlers',()=>{route('#/user/accounts');const before=db();submit('license-form',{userId:'u1',name:'Unauthorized',balance:'1'});submit('user-form',{name:'Unauthorized',email:'forbidden@example.com'});assert.equal(db().accounts.length,before.accounts.length);assert.equal(db().users.length,before.users.length);});
test('sample license activation and full connection wizard complete',async()=>{route('#/user/accounts');submit('activate-form',{license:'STRC-DEMO-2026',name:'Connected test',type:'Demo'});const a=db().accounts.find(a=>a.license==='STRC-DEMO-2026');assert.ok(a);submit('connect-form',{number:'12345678',broker:'Test broker',server:'Test-MT5'},{id:a.id});assert.ok(nodes.overlay.innerHTML.includes('Set up your terminal connector'));await click('connect-verify:'+a.id);assert.ok(nodes.overlay.innerHTML.includes('Simulate successful connection'));await click('connect-finish:'+a.id);const current=db().accounts.find(x=>x.id===a.id);assert.equal(current.connection,'Connected');assert.equal(current.number,'12345678');assert.equal(current.server,'Test-MT5');});
test('suspending a user suspends active licenses and disconnects them',async()=>{route('#/admin/users');await click('confirm-toggle-user:u2');assert.equal(db().users.find(u=>u.id==='u2').status,'Suspended');assert.ok(db().accounts.filter(a=>a.userId==='u2').every(a=>a.status!=='Active'&&a.connection==='Disconnected'));});
test('manual trade creation is included in filtered account metrics',()=>{route('#/user/trades');submit('add-trade-form',{accountId:'a1',symbol:'XAUUSD',side:'Buy',date:'2026-10-16',entry:'2600',exit:'2610',lots:'0.1',pnl:'100',fees:'2',r:'2',session:'London',setup:'Liquidity sweep',notes:'Flow test manual trade'});const t=db().trades.find(t=>t.notes==='Flow test manual trade');assert.ok(t);assert.equal(t.pnl-t.fees,98);assert.equal(t.source,'Manual');});
test('setup renaming updates existing trade associations',()=>{route('#/user/playbook');submit('playbook-form',{name:'Liquidity sweep revised',description:'Revised setup',timeframe:'4H',color:'gold',rules:'Wait\nConfirm'},{id:'p1'});assert.ok(db().trades.some(t=>t.setup==='Liquidity sweep revised'));assert.ok(!db().trades.some(t=>['a1','a2','a3'].includes(t.accountId)&&t.setup==='Liquidity sweep'));assert.ok(db().trades.some(t=>t.accountId==='a4'&&t.setup==='Liquidity sweep'));});
test('settings save local risk preferences',()=>{route('#/user/settings');submit('risk-form',{perTrade:'0.5',dailyLoss:'2',maxTrades:'2'});assert.deepEqual(db().risk,{perTrade:.5,dailyLoss:2,maxTrades:2});});

test('clicking a user opens a complete scoped workspace and preserves admin access',async()=>{
 route('#/admin/users');await click('user:u2');assert.equal(location.hash,'/admin/users/u2/overview');windowEvents.hashchange();
 assert.ok(nodes.app.innerHTML.includes('Viewing Sarah Chen’s panel'));
 assert.ok(nodes.app.innerHTML.includes('Back to admin'));
 assert.ok(nodes.app.innerHTML.includes('#/admin/users/u2/trades'));
 assert.ok(nodes.app.innerHTML.includes('Sarah · Funded'));
 assert.ok(!nodes.app.innerHTML.includes('Main trading account'));
 assert.ok(!nodes.app.innerHTML.includes('Swing portfolio'));
});
test('all user pages work inside an admin-selected user panel',()=>{
 for(const page of ['overview','trades','calendar','analytics','journal','playbook','accounts','reports','settings','help']){
  route('#/admin/users/u2/'+page);assert.ok(nodes.app.innerHTML.includes('Viewing Sarah Chen’s panel'));assert.ok(nodes.app.innerHTML.includes('page-heading'));assert.ok(!nodes.app.innerHTML.includes('NaN'));
 }
});
test('selected-user trades, calendar totals and analytics reconcile to that owner only',async()=>{
 route('#/admin/users/u2/trades');const {metrics,filterTrades,money}=await import('../src/data.js');
 const rows=filterTrades(db().trades,{accountIds:['a4'],range:'month'}),m=metrics(rows);
 assert.ok(nodes.app.innerHTML.includes(money(m.pnl,true)));assert.ok(!nodes.app.innerHTML.includes('Main trading account'));
 route('#/admin/users/u2/calendar');await click('day:2026-10-16');
 const day=metrics(rows.filter(t=>t.date==='2026-10-16'));assert.ok(nodes.overlay.innerHTML.includes(money(day.pnl,true)));
 route('#/admin/users/u2/analytics');assert.ok(nodes.app.innerHTML.includes('Beyond the P&L'));
});
test('journals are scoped by user and selected-user edits retain the owner',()=>{
 route('#/admin/users/u2/journal');assert.ok(nodes.app.innerHTML.includes('Protecting the funded account.'));assert.ok(!nodes.app.innerHTML.includes('Patience is the edge.'));
 submit('entry-form',{date:'2026-10-16',title:'Sarah private review',content:'Sarah only',mood:'Calm',rating:'5'},{id:''});
 assert.equal(db().entries.find(e=>e.title==='Sarah private review').userId,'u2');
 route('#/user/journal');assert.ok(!nodes.app.innerHTML.includes('Sarah private review'));
 const foreign=db().entries.find(e=>e.title==='Sarah private review');submit('entry-form',{date:'2026-10-16',title:'Wrong owner',content:'Forbidden',mood:'Calm',rating:'5'},{id:foreign.id});assert.equal(db().entries.find(e=>e.id===foreign.id).title,'Sarah private review');
});
test('selected user playbook rename never changes another owner’s trades or definitions',()=>{
 route('#/admin/users/u2/playbook');submit('playbook-form',{name:'Sarah liquidity plan',description:'Sarah setup',timeframe:'1H',color:'purple',rules:'Wait for sweep'},{id:'p1-u2'});
 assert.ok(db().trades.some(t=>t.accountId==='a4'&&t.setup==='Sarah liquidity plan'));
 assert.ok(!db().trades.some(t=>t.accountId!=='a4'&&t.setup==='Sarah liquidity plan'));
 assert.equal(db().playbooks.find(p=>p.id==='p1').name,'Liquidity sweep revised');
});
test('selected user settings do not overwrite the primary user profile or risk',()=>{
 route('#/admin/users/u3/settings');submit('risk-form',{perTrade:'0.25',dailyLoss:'1',maxTrades:'1'});
 assert.equal(db().userSettings.u3.risk.perTrade,.25);assert.equal(db().risk.perTrade,.5);
 submit('profile-form',{name:'James Updated',email:'james-new@example.com',timezone:'UTC',currency:'USD'});
 assert.equal(db().users.find(u=>u.id==='u3').name,'James Updated');assert.equal(db().profile.name,'Anas Ayub');
});
test('empty and unknown users do not fall back to another user’s statistics',()=>{
 route('#/admin/users/u4/overview');assert.ok(nodes.app.innerHTML.includes('Viewing Omar Khalid’s panel'));assert.ok(!nodes.app.innerHTML.includes('Main trading account'));assert.ok(nodes.app.innerHTML.includes('$0.00'));
 route('#/admin/users/no-such-user/overview');assert.ok(nodes.app.innerHTML.includes('User management'));assert.ok(!nodes.app.innerHTML.includes('admin-view-banner'));
 route('#/user/users/u2/overview');assert.ok(!nodes.app.innerHTML.includes('Viewing Sarah Chen’s panel'));
});
test('return control exits the selected panel and restores full admin navigation',async()=>{
 route('#/admin/users/u2/trades');await click('back-to-admin');assert.equal(location.hash,'/admin/users');windowEvents.hashchange();assert.ok(nodes.app.innerHTML.includes('User management'));assert.ok(!nodes.app.innerHTML.includes('admin-view-banner'));assert.ok(nodes.app.innerHTML.includes('#/admin/licenses'));
});
