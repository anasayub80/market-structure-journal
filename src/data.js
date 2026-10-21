export const money=(v,sign=false)=>`${v<0?'−':sign&&v>0?'+':''}$${Math.abs(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
export const shortMoney=v=>`${v<0?'−':''}$${(Math.abs(v)/1000).toFixed(1)}k`;
export const dateLabel=d=>new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
export const uid=()=>globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2);
export function metrics(trades,starting=0){
 const rValues=trades.filter(t=>Number.isFinite(t.r)).map(t=>t.r);
 const pnl=trades.reduce((s,t)=>s+t.pnl-t.fees,0),wins=trades.filter(t=>t.pnl-t.fees>0),losses=trades.filter(t=>t.pnl-t.fees<=0),grossWin=wins.reduce((s,t)=>s+t.pnl-t.fees,0),grossLoss=Math.abs(losses.reduce((s,t)=>s+t.pnl-t.fees,0));
 let equity=starting,peak=starting,dd=0;const curve=[{date:'Start',value:starting}];
 for(const t of [...trades].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))){equity+=t.pnl-t.fees;peak=Math.max(peak,equity);dd=Math.max(dd,peak?((peak-equity)/peak)*100:0);curve.push({date:t.date,value:equity});}
 return {pnl,wins:wins.length,losses:losses.length,total:trades.length,winRate:trades.length?wins.length/trades.length*100:0,pf:grossLoss?grossWin/grossLoss:grossWin?Infinity:0,avgR:rValues.length?rValues.reduce((s,r)=>s+r,0)/rValues.length:0,rKnown:rValues.length>0,rCount:rValues.length,ddKnown:starting>0,balance:starting+pnl,dd,curve,fees:trades.reduce((s,t)=>s+t.fees,0),avgWin:wins.length?grossWin/wins.length:0,avgLoss:losses.length?grossLoss/losses.length:0};
}
export function groupTrades(trades,key){const g={};for(const t of trades){const k=typeof key==='function'?key(t):t[key];(g[k]??=[]).push(t);}return Object.entries(g).map(([name,rows])=>({name,...metrics(rows),trades:rows}));}
export function filterTrades(trades,{account='all',accountIds,range='month',anchorDate=new Date().toISOString().slice(0,10),symbol='all',session='all',outcome='all',query=''}={}){
 const anchor=new Date(anchorDate+'T12:00:00Z');let from=new Date(anchor);if(range==='month')from.setUTCDate(1);else if(range==='week')from.setUTCDate(from.getUTCDate()-(from.getUTCDay()+6)%7);else if(range==='quarter'){from.setUTCDate(1);from.setUTCMonth(from.getUTCMonth()-2);}const start=range==='all'?'0000-01-01':from.toISOString().slice(0,10);
 return trades.filter(t=>['EA sync','MT5 import','Manual entry'].includes(t.source)&&(!accountIds||accountIds.includes(t.accountId))&&(account==='all'||t.accountId===account)&&t.date>=start&&(symbol==='all'||t.symbol===symbol)&&(session==='all'||t.session===session)&&(outcome==='all'||(outcome==='win'?t.pnl-t.fees>0:t.pnl-t.fees<=0))&&(!query||`${t.symbol} ${t.eaName||''} ${t.magic||''} ${t.ticket} ${t.date}`.toLowerCase().includes(query.toLowerCase())));
}
export function calendarCells(year,month){const first=new Date(year,month,1),offset=(first.getDay()+6)%7,days=new Date(year,month+1,0).getDate();return Array.from({length:Math.ceil((offset+days)/7)*7},(_,i)=>{const date=new Date(year,month,i-offset+1);return {day:date.getDate(),date:`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`,current:date.getMonth()===month};});}
