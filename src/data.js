export const DEMO_TODAY = '2026-10-16';
export const money=(v,sign=false)=>`${v<0?'−':sign&&v>0?'+':''}$${Math.abs(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
export const shortMoney=v=>`${v<0?'−':''}$${(Math.abs(v)/1000).toFixed(1)}k`;
export const dateLabel=d=>new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
export const uid=()=>globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2);
export const seedUsers=[
{id:'u1',name:'Anas Ayub',email:'anas@example.com',initials:'AA',status:'Active',joined:'2026-08-12',color:'gold'},
{id:'u2',name:'Sarah Chen',email:'sarah@example.com',initials:'SC',status:'Active',joined:'2026-08-18',color:'purple'},
{id:'u3',name:'James Wilson',email:'james@example.com',initials:'JW',status:'Active',joined:'2026-09-02',color:'blue'},
{id:'u4',name:'Omar Khalid',email:'omar@example.com',initials:'OK',status:'Invited',joined:'2026-10-14',color:'green'},
{id:'u5',name:'Emma Davis',email:'emma@example.com',initials:'ED',status:'Suspended',joined:'2026-09-21',color:'rose'}];
export const seedAccounts=[
{id:'a1',userId:'u1',name:'Main trading account',broker:'Exness',number:'20891476',server:'Exness-MT5Real',license:'STRC-7X2K-9M4P',status:'Active',connection:'Connected',type:'Live',balance:25000,currency:'USD',lastSync:'2026-10-16T15:42:00',expiry:'2027-08-12',created:'2026-08-12'},
{id:'a2',userId:'u1',name:'Swing portfolio',broker:'IC Markets',number:'51420893',server:'ICMarketsSC-MT5',license:'STRC-4A8N-6Q2R',status:'Active',connection:'Connected',type:'Live',balance:10000,currency:'USD',lastSync:'2026-10-16T15:39:00',expiry:'2027-09-01',created:'2026-09-01'},
{id:'a3',userId:'u1',name:'Strategy lab',broker:'Not connected',number:'',server:'',license:'STRC-3D5F-8H1J',status:'Active',connection:'Not connected',type:'Demo',balance:5000,currency:'USD',lastSync:null,expiry:'2027-10-01',created:'2026-10-01'},
{id:'a4',userId:'u2',name:'Sarah · Funded',broker:'FTMO',number:'481926',server:'FTMO-Server',license:'STRC-2S4T-7U9V',status:'Active',connection:'Connected',type:'Funded',balance:50000,currency:'USD',lastSync:'2026-10-16T15:40:00',expiry:'2027-08-18',created:'2026-08-18'},
{id:'a5',userId:'u3',name:'James · Personal',broker:'Pepperstone',number:'819246',server:'Pepperstone-Live',license:'STRC-5W7X-1Y3Z',status:'Active',connection:'Disconnected',type:'Live',balance:20000,currency:'USD',lastSync:'2026-10-15T09:10:00',expiry:'2027-09-02',created:'2026-09-02'},
{id:'a6',userId:'u5',name:'Emma · Research',broker:'IC Markets',number:'920137',server:'ICMarketsSC-Demo',license:'STRC-6B8C-2D4E',status:'Revoked',connection:'Disconnected',type:'Demo',balance:10000,currency:'USD',lastSync:'2026-10-01T12:10:00',expiry:'2026-10-01',created:'2026-09-21'}];
const instruments=['XAUUSD','GBPUSD','EURUSD','BTCUSD'];
const setups=['Liquidity sweep','BOS continuation','NY range breakout'];
export const seedTrades=[];
let n=0;
for(let d=new Date('2026-08-03T12:00:00Z');d<=new Date(DEMO_TODAY+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1)){
 if(d.getUTCDay()===0||d.getUTCDay()===6)continue;
 const day=d.toISOString().slice(0,10);
 for(const a of seedAccounts.filter(x=>x.number&&x.id!=='a6')){
  const count=(d.getUTCDate()+a.id.charCodeAt(1))%3+1;
  for(let k=0;k<count;k++){
   n++;const win=(n*7%13)<8;const risk=a.id==='a4'?230:a.id==='a2'?65:125;
   const pnl=win?risk*(1.4+(n%7)*.27):-risk*(.65+(n%5)*.13);
   const symbol=instruments[(n*3+k)%4],side=n%3?'Buy':'Sell',entry=symbol==='XAUUSD'?2640+n%65:symbol==='BTCUSD'?68100+n%900:symbol==='GBPUSD'?1.302+n%100/10000:1.092+n%100/10000;
   seedTrades.push({id:'t'+n,ticket:8100000+n,accountId:a.id,date:day,time:['08:30','09:45','13:15','14:30'][n%4],symbol,side,entry,exit:entry+(side==='Buy'?1:-1)*(win?1:-1)*(symbol==='XAUUSD'?8.2:symbol==='BTCUSD'?210:.0018),lots:symbol==='XAUUSD'?.15:.5,pnl:Math.round(pnl*100)/100,fees:Math.round((2.1+n%4)*100)/100,r:Math.round(pnl/risk*100)/100,session:n%4<2?'London':n%4===2?'New York':'Asia',setup:setups[n%3],duration:15+n%170,source:n%5?'EA sync':'Manual',emotion:['Focused','Calm','Confident','Impatient'][n%4],notes:win?'Waited for the displacement and a clean retest. Entry followed the plan.':'Review entry timing. Keep risk consistent and wait for structure confirmation.',reviewed:n%4!==0});
  }
 }
}
export const seedEntries=[{id:'j1',date:'2026-10-16',title:'Patience is the edge.',mood:'Focused',rating:4,content:'Waited for the London liquidity sweep before entering. The cleanest trade came after the first hour. No need to catch every move.\n\nTomorrow: keep the same risk, wait for displacement, and stop after two losses.'},{id:'j2',date:'2026-10-15',title:'One good decision at a time.',mood:'Calm',rating:5,content:'Respected my daily risk limit. Passed on a messy GBPUSD setup and focused on gold. Quality over activity.'},{id:'j3',date:'2026-10-14',title:'A lesson in overtrading.',mood:'Impatient',rating:2,content:'Entered before the retest confirmed. Two losses were enough. Closed the terminal and reviewed my plan.'}];
export const seedPlaybooks=[{id:'p1',name:'Liquidity sweep',description:'Trade the reaction after liquidity is taken and structure shifts.',timeframe:'4H → 15M',color:'gold',rules:['Higher timeframe bias aligned','Liquidity swept and reclaimed','Displacement creates an FVG','Risk defined before entry']},{id:'p2',name:'BOS continuation',description:'Join an established trend on a clean structure retest.',timeframe:'4H → 1H',color:'purple',rules:['Clear HH/HL or LL/LH sequence','Body close through structure','Fresh retest of the origin','At least 1:3 planned reward']},{id:'p3',name:'NY range breakout',description:'A patient breakout and retest of the opening range.',timeframe:'15M → 1M',color:'blue',rules:['First 15-minute range closed','Breakout with displacement','Retest respects the range','One attempt per session']}];
export function metrics(trades,starting=25000){
 const pnl=trades.reduce((s,t)=>s+t.pnl-t.fees,0),wins=trades.filter(t=>t.pnl-t.fees>0),losses=trades.filter(t=>t.pnl-t.fees<=0),grossWin=wins.reduce((s,t)=>s+t.pnl-t.fees,0),grossLoss=Math.abs(losses.reduce((s,t)=>s+t.pnl-t.fees,0));
 let equity=starting,peak=starting,dd=0;const curve=[{date:'Start',value:starting}];
 for(const t of [...trades].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))){equity+=t.pnl-t.fees;peak=Math.max(peak,equity);dd=Math.max(dd,peak?((peak-equity)/peak)*100:0);curve.push({date:t.date,value:equity});}
 return {pnl,wins:wins.length,losses:losses.length,total:trades.length,winRate:trades.length?wins.length/trades.length*100:0,pf:grossLoss?grossWin/grossLoss:grossWin?Infinity:0,avgR:trades.length?trades.reduce((s,t)=>s+t.r,0)/trades.length:0,balance:starting+pnl,dd,curve,fees:trades.reduce((s,t)=>s+t.fees,0),avgWin:wins.length?grossWin/wins.length:0,avgLoss:losses.length?grossLoss/losses.length:0};
}
export function groupTrades(trades,key){const g={};for(const t of trades){const k=typeof key==='function'?key(t):t[key];(g[k]??=[]).push(t);}return Object.entries(g).map(([name,rows])=>({name,...metrics(rows),trades:rows}));}
export function filterTrades(trades,{account='all',accountIds,range='month',symbol='all',session='all',outcome='all',query=''}={}){
 const start=range==='month'?'2026-10-01':range==='week'?'2026-10-12':range==='quarter'?'2026-08-01':'0000-01-01';
 return trades.filter(t=>(!accountIds||accountIds.includes(t.accountId))&&(account==='all'||t.accountId===account)&&t.date>=start&&(symbol==='all'||t.symbol===symbol)&&(session==='all'||t.session===session)&&(outcome==='all'||(outcome==='win'?t.pnl-t.fees>0:t.pnl-t.fees<=0))&&(!query||`${t.symbol} ${t.setup} ${t.ticket} ${t.date}`.toLowerCase().includes(query.toLowerCase())));
}
export function calendarCells(year,month){const first=new Date(year,month,1),offset=(first.getDay()+6)%7,days=new Date(year,month+1,0).getDate();return Array.from({length:Math.ceil((offset+days)/7)*7},(_,i)=>{const date=new Date(year,month,i-offset+1);return {day:date.getDate(),date:`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`,current:date.getMonth()===month};});}
export function loadState(){try{const s=JSON.parse(localStorage.getItem('structure-v1'));if(s?.version===1)return s;}catch{}return {version:1,users:structuredClone(seedUsers),accounts:structuredClone(seedAccounts),trades:structuredClone(seedTrades),entries:structuredClone(seedEntries),playbooks:structuredClone(seedPlaybooks),profile:{name:'Anas Ayub',email:'anas@example.com',timezone:'Asia/Karachi',currency:'USD'},risk:{perTrade:1,dailyLoss:3,maxTrades:3},preferences:{email:true,sync:true,weekly:true},activity:[{id:'ev1',text:'Trade history synced · Main trading account',time:'Oct 16, 15:42',type:'sync'},{id:'ev2',text:'New license issued · Strategy lab',time:'Oct 01, 12:00',type:'license'}],theme:'light'};}
