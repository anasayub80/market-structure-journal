// MT5 history reader. Files remain in the browser; report markup is never rendered.
export const MAX_FILE_BYTES=10*1024*1024;
const MAX_ROWS=50000,MAX_UNPACKED=32*1024*1024;
const clean=s=>String(s??'').replace(/\u00a0|\u202f/g,' ').replace(/\s+/g,' ').trim();
export const normalizeHeader=s=>clean(s).toLowerCase().replace(/[^a-z0-9]/g,'');
export function decodeEntities(s){return String(s).replace(/&#(x[0-9a-f]+|\d+);|&(amp|lt|gt|quot|apos|nbsp);/gi,(_,num,name)=>{if(num){const n=num[0].toLowerCase()==='x'?parseInt(num.slice(1),16):Number(num);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[name.toLowerCase()];});}
const textOnly=s=>clean(decodeEntities(String(s).replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,'').replace(/<[^>]*>/g,' ')));
export function parseNumber(value,{optional=false}={}){
 let s=clean(value).replace(/[−–]/g,'-');if(!s||/^[-—–n/a]+$/i.test(s))return optional?null:NaN;
 const negative=/^\(.*\)$/.test(s);s=s.replace(/[()\s'$€£¥%]/g,'').replace(/(?:USD|EUR|GBP|JPY|AUD|CAD|CHF|NZD)$/i,'');
 if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replaceAll('.','').replace(',','.'):s.replaceAll(',','');
 else if(s.includes(','))s=/^[+-]?\d{1,3}(,\d{3})+$/.test(s)?s.replaceAll(',',''):s.replace(',','.');
 if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s))return NaN;
 return Number(s)*(negative?-1:1);
}
export function parseTimestamp(value,dateOrder='iso'){
 let s=clean(value);if(!s)return null;
 if(/^\d+(?:\.\d+)?$/.test(s)&&Number(s)>20000&&Number(s)<100000){return new Date(Math.round((Number(s)-25569)*86400000)).toISOString().slice(0,19);}
 let m=s.match(/^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?(?:Z)?$/);
 let y,mo,d,h=0,mi=0,sec=0;
 if(m){[,y,mo,d,h=0,mi=0,sec=0]=m;}else{m=s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);if(!m)return null;let a,b;[,a,b,y,h=0,mi=0,sec=0]=m;if(dateOrder==='dmy'||Number(a)>12){d=a;mo=b;}else if(dateOrder==='mdy'||Number(b)>12){mo=a;d=b;}else return null;}
 [y,mo,d,h,mi,sec]=[y,mo,d,h,mi,sec].map(Number);const dt=new Date(Date.UTC(y,mo-1,d,h,mi,sec));
 if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==mo-1||dt.getUTCDate()!==d||h>23||mi>59||sec>59)return null;
 return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}T${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}
export function parseDelimited(text){
 text=text.replace(/^\ufeff/,'');const first=text.split(/\r?\n/).find(l=>/symbol|instrument/i.test(l))||text.split(/\r?\n/)[0];
 const delimiter=['\t',';',','].sort((a,b)=>first.split(b).length-first.split(a).length)[0];
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(!cell||quoted)quoted=!quoted;else cell+=c;}else if(c===delimiter&&!quoted){row.push(cell);cell='';}else if((c==='\r'||c==='\n')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>clean(x)))rows.push(row);row=[];cell='';}else cell+=c;if(rows.length>MAX_ROWS)throw Error('This file has more than 50,000 rows. Export a smaller date range.');}
 if(quoted)throw Error('A quoted CSV field is not closed. Export the file again.');row.push(cell);if(row.some(x=>clean(x)))rows.push(row);return rows;
}
export function parseMarkupRows(text){
 const xml=/<(?:\w+:)?Workbook\b/i.test(text),rows=[];
 if(xml){for(const match of text.matchAll(/<(?:\w+:)?Row\b[^>]*>([\s\S]*?)<\/(?:\w+:)?Row\s*>/gi)){const row=[];let index=0;for(const cell of match[1].matchAll(/<(?:\w+:)?Cell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?Cell\s*>)/gi)){const n=cell[1].match(/(?:\w+:)?Index=["'](\d+)["']/i);if(n)index=Number(n[1])-1;if(index>1000)throw Error('This spreadsheet contains an unsupported column index.');row[index++]=textOnly(cell[2]?.match(/<(?:\w+:)?Data\b[^>]*>([\s\S]*?)<\/(?:\w+:)?Data\s*>/i)?.[1]||'');}if(row.length)rows.push(row);}}
 else {for(const match of text.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)){const row=[];for(const cell of match[1].matchAll(/<(?:td|th)\b([^>]*)>([\s\S]*?)<\/(?:td|th)\s*>/gi)){row.push(textOnly(cell[2]));const span=Math.min(100,Number(cell[1].match(/colspan\s*=\s*["']?(\d+)/i)?.[1]||1));for(let i=1;i<span;i++)row.push('');}if(row.length)rows.push(row);}}
 if(rows.length>MAX_ROWS)throw Error('This report has more than 50,000 rows. Export a smaller date range.');return rows;
}
function decodeText(bytes){let encoding='utf-8';if(bytes[0]===255&&bytes[1]===254||bytes[1]===0)encoding='utf-16le';else if(bytes[0]===254&&bytes[1]===255||bytes[0]===0)encoding='utf-16be';return new TextDecoder(encoding).decode(bytes).replace(/^\ufeff/,'');}
async function unzip(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}if(end<0)throw Error('This XLSX archive is incomplete. Export the report again.');
 const count=view.getUint16(end+10,true);let at=view.getUint32(end+16,true),total=0;const files={};if(count>512)throw Error('This workbook has too many internal files.');
 for(let i=0;i<count;i++){
  if(at+46>bytes.length||view.getUint32(at,true)!==0x02014b50)throw Error('Invalid XLSX directory.');const flags=view.getUint16(at+8,true),method=view.getUint16(at+10,true),packed=view.getUint32(at+20,true),size=view.getUint32(at+24,true),nameLength=view.getUint16(at+28,true),extra=view.getUint16(at+30,true),comment=view.getUint16(at+32,true),offset=view.getUint32(at+42,true),name=new TextDecoder().decode(bytes.slice(at+46,at+46+nameLength));at+=46+nameLength+extra+comment;
  if(!/^xl\/(worksheets\/sheet\d+\.xml|sharedStrings\.xml)$/.test(name))continue;
  total+=size;if(total>MAX_UNPACKED)throw Error('Unpacked workbook exceeds the 32 MB limit.');if(flags&1)throw Error('Password-protected workbooks are not supported.');
  if(offset+30>bytes.length||view.getUint32(offset,true)!==0x04034b50)throw Error('Invalid XLSX content.');const start=offset+30+view.getUint16(offset+26,true)+view.getUint16(offset+28,true);if(start+packed>bytes.length)throw Error('Incomplete XLSX data.');let data=bytes.slice(start,start+packed);
  if(method===8){let stream;try{stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));}catch{throw Error('Your browser cannot open this XLSX file. Export HTML from MT5 instead.');}const reader=stream.getReader(),parts=[];let length=0;for(;;){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>MAX_UNPACKED||length>size+100){await reader.cancel();throw Error('Unpacked workbook exceeds its declared size.');}parts.push(value);}data=new Uint8Array(length);let pos=0;for(const part of parts){data.set(part,pos);pos+=part.length;}}
  else if(method!==0)throw Error('Unsupported workbook compression. Export HTML from MT5 instead.');if(data.length!==size)throw Error('XLSX content size does not match its directory.');files[name]=decodeText(data);
 }
 return files;
}
async function xlsxRows(bytes){
 const files=await unzip(bytes),shared=[...(files['xl/sharedStrings.xml']||'').matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi)].map(m=>[...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)].map(t=>decodeEntities(t[1])).join('')),rows=[];
 for(const name of Object.keys(files).filter(n=>n.startsWith('xl/worksheets/')).sort())for(const rowMatch of files[name].matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi)){
  const row=[];for(const cell of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gi)){const ref=cell[1].match(/\br=["']([A-Z]+)\d+["']/)?.[1];if(!ref)continue;let index=0;for(const c of ref)index=index*26+c.charCodeAt(0)-64;index--;if(index>1000)throw Error('Workbook has too many columns.');const type=cell[1].match(/\bt=["']([^"']+)/)?.[1],body=cell[2]||'',value=body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1]||'';row[index]=type==='s'?shared[Number(value)]||'':type==='inlineStr'?[...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(m=>decodeEntities(m[1])).join(''):decodeEntities(value);}
  if(row.some(x=>clean(x)))rows.push(row);if(rows.length>MAX_ROWS)throw Error('Workbook exceeds 50,000 rows.');
 }
 return rows;
}
const aliases={ticket:['ticket','position','positionid','tradeticket','positionticket'],deal:['deal','dealid','dealticket'],symbol:['symbol','instrument'],side:['type','side','tradetype','direction'],direction:['entry','entrytype','direction'],volume:['volume','lots','size','quantity'],openTime:['opentime','opendate','entrytime','entrydate','time'],closeTime:['closetime','closedate','exittime','exitdate'],entry:['openprice','entryprice','entry'],exit:['closeprice','exitprice','exit'],profit:['profit','grossprofit','grosspnl','pnl'],net:['netprofit','netpnl'],commission:['commission','commissions'],fee:['fee'],fees:['fees','tradingfees'],swap:['swap','swaps'],magic:['magic','magicnumber','expertid'],ea:['ea','eaname','expertadvisor','expert'],comment:['comment','comments','notes'],stop:['sl','stoploss'],r:['r','returnr'],date:['date'],time:['time'],account:['account','accountnumber','login'],currency:['currency','depositcurrency']};
function headerMap(row){const cells=row.map(normalizeHeader),map={};for(const [key,list]of Object.entries(aliases))map[key]=cells.findIndex(x=>list.includes(x));const times=cells.flatMap((x,i)=>x==='time'?[i]:[]),prices=cells.flatMap((x,i)=>x==='price'?[i]:[]);if(times.length>=2){map.openTime=times[0];map.closeTime=times[1];}if(prices.length>=2){map.entry=prices[0];map.exit=prices[1];}return {cells,map};}
const value=(row,map,key)=>map[key]>=0?clean(row[map[key]]):'';
function metadataFrom(rows){const result={account:'',currency:'USD',currencyDetected:false,server:'',broker:'',name:''};for(const row of rows.slice(0,40)){for(let i=0;i<row.length;i++){const cell=clean(row[i]),m=cell.match(/^(Account|Login|Currency|Deposit Currency|Server|Company|Broker|Name)\s*:\s*(.*)$/i);if(!m)continue;const v=clean(m[2]||row[i+1]);switch(m[1].toLowerCase()){case'account':case'login':result.account=v.match(/^\d+/)?.[0]||'';const c=v.match(/\b([A-Z]{3})\b/);if(c){result.currency=c[1];result.currencyDetected=true;}const server=v.match(/\(([^,)]+)[,)]+/);if(server)result.server=server[1];break;case'currency':case'deposit currency':result.currency=v.match(/[A-Z]{3}/i)?.[0].toUpperCase()||'USD';result.currencyDetected=true;break;case'server':result.server=v;break;case'broker':case'company':result.broker=v;break;case'name':result.name=v;}}}return result;}
const sideFrom=v=>/^buy(?:\b|$)|^long$/i.test(v)?'Buy':/^sell(?:\b|$)|^short$/i.test(v)?'Sell':null;
function sessionAt(stamp,offset){if(offset===null||offset===undefined||offset==='')return 'Unclassified';const hour=(new Date(stamp+'Z').getUTCHours()-Number(offset)+24)%24;return hour<7?'Asia':hour<12?'London':hour<21?'New York':'Unclassified';}
function cost(row,map){let direct=0;if(map.fees>=0){direct=parseNumber(value(row,map,'fees'));if(!Number.isFinite(direct))return NaN;}let total=0;for(const key of ['commission','fee','swap'])if(map[key]>=0){const n=parseNumber(value(row,map,key),{optional:true});if(n!==null&&!Number.isFinite(n))return NaN;total+=n||0;}return direct-total;}
function normalizedTrade({ticket,positionId,kind,side,symbol,volume,entry,exit,openTime,closeTime,profit,fees,magic,eaName,r,comment,offset}){return {ticket:String(ticket),positionId:String(positionId||ticket),brokerKey:`${kind}:${ticket}`,importKind:kind,symbol,side,entry,exit,lots:volume,pnl:profit,fees,openTime,closeTime,date:closeTime.slice(0,10),time:closeTime.slice(11,16),duration:openTime?Math.max(0,(new Date(closeTime+'Z')-new Date(openTime+'Z'))/60000):null,r:Number.isFinite(r)?r:null,magic:magic||null,eaName:eaName||(magic&&magic!=='0'?`EA · ${magic}`:'Not provided by report'),source:'MT5 import',session:sessionAt(openTime||closeTime,offset),notes:'',brokerComment:comment||'',reviewed:false,demo:false};}
export function rowsToReport(rows,{dateOrder='iso',utcOffset=null,filename='Report'}={}){
 const metadata=metadataFrom(rows),blocks=[];let block=null;
 for(let i=0;i<rows.length;i++){
  const row=rows[i],h=headerMap(row),m=h.map;
  if(m.symbol>=0&&m.side>=0&&(m.profit>=0||m.net>=0)&&(m.ticket>=0||m.deal>=0)){
   const isDeal=m.deal>=0&&m.direction>=0&&h.cells[m.direction]!=='entryprice';
   const direct=m.closeTime>=0||m.date>=0&&m.entry>=0&&m.exit>=0;
   block={...h,kind:direct?'position':isDeal?'deal':'unsupported',rows:[]};blocks.push(block);continue;
  }
  if(block)block.rows.push({row,number:i+1});
 }
 const positions=blocks.filter(b=>b.kind==='position'),deals=blocks.filter(b=>b.kind==='deal'),selected=positions.length?positions:deals;
 if(!selected.length)throw Error('No completed-trade table was found. In MT5 use History → Positions → Report → HTML, or upload a CSV with Ticket, Symbol, Type, Volume, Open Time, Open Price, Close Time, Close Price and Profit.');
 const accountNumbers=new Set();for(const b of selected)for(const {row}of b.rows){const v=value(row,b.map,'account');if(/^\d{4,20}$/.test(v))accountNumbers.add(v);}if(accountNumbers.size>1)throw Error('This file includes more than one MT5 account. Export each account separately.');if(!metadata.account&&accountNumbers.size)metadata.account=[...accountNumbers][0];
 const currencies=new Set();for(const b of selected)for(const {row}of b.rows){const c=value(row,b.map,'currency');if(/^[A-Z]{3}$/i.test(c))currencies.add(c.toUpperCase());}if(currencies.size>1)throw Error('This report mixes currencies. Export one account currency per file.');if(currencies.size){metadata.currency=[...currencies][0];metadata.currencyDetected=true;}
 const trades=[],issues=[],warnings=[],deposits=[];let skipped=0,ignored=0,unmatched=0;
 const issue=(number,reason)=>{skipped++;if(issues.length<100)issues.push({row:number,reason});};
 for(const b of selected){const m=b.map;const pool=new Map();for(const {row,number}of b.rows){
  const rawSide=value(row,m,'side'),side=sideFrom(rawSide);if(!side){if(/balance|credit|deposit|withdrawal/i.test(rawSide)){const amount=parseNumber(value(row,m,'profit'));if(Number.isFinite(amount))deposits.push({amount});}ignored++;continue;}
  const symbol=value(row,m,'symbol'),ticket=value(row,m,b.kind==='deal'?'deal':'ticket'),volume=parseNumber(value(row,m,'volume')),fees=cost(row,m),rawProfit=value(row,m,'profit'),profit=m.profit>=0?parseNumber(rawProfit):parseNumber(value(row,m,'net'))+fees,magic=value(row,m,'magic'),eaName=value(row,m,'ea'),comment=value(row,m,'comment');
  if(!/^\d{1,30}$/.test(ticket)||!symbol||symbol.length>100||!Number.isFinite(volume)||volume<=0||!Number.isFinite(profit)||!Number.isFinite(fees)){issue(number,'Missing or invalid ticket, symbol, volume, profit, or costs.');continue;}
  if(b.kind==='position'){
   const openTime=parseTimestamp(value(row,m,'openTime'),dateOrder),closeTime=parseTimestamp(value(row,m,'closeTime')||`${value(row,m,'date')} ${value(row,m,'time')}`,dateOrder),entry=parseNumber(value(row,m,'entry')),exit=parseNumber(value(row,m,'exit'));
   if(!openTime||!closeTime||closeTime<openTime||!Number.isFinite(entry)||!Number.isFinite(exit)||entry<=0||exit<=0){issue(number,'Invalid open/close time or price. For day-first dates, change Date format before reading the file. Open positions are excluded.');continue;}
   trades.push(normalizedTrade({ticket,positionId:ticket,kind:'position',side,symbol,volume,entry,exit,openTime,closeTime,profit,fees,magic,eaName,r:parseNumber(value(row,m,'r'),{optional:true}),comment,offset:utcOffset}));
  }else{
   const positionId=value(row,m,'ticket'),direction=value(row,m,'direction').toLowerCase(),stamp=parseTimestamp(value(row,m,'openTime'),dateOrder),priceIndex=b.cells.indexOf('price'),price=parseNumber(priceIndex>=0?row[priceIndex]:value(row,m,'entry'));
   if(!positionId||!stamp||!Number.isFinite(price)||price<=0){issue(number,'This deals report has no position ID or valid execution time/price. Export the Positions view to import completed trades reliably.');continue;}
   if(direction==='in'){const list=pool.get(positionId)||[];list.push({volume,price,stamp,fees,side,magic,eaName,symbol});pool.set(positionId,list);continue;}
   if(!['out','out by','outby'].includes(direction)){issue(number,'Reversal or unknown deal direction. Export completed Positions instead.');continue;}
   const list=pool.get(positionId)||[],available=list.reduce((s,l)=>s+l.volume,0);if(available+1e-8<volume||list.some(l=>l.symbol!==symbol||l.side===side||l.stamp>stamp)){unmatched++;issue(number,'Closing deal is missing its matching opening position. Export All History / Positions, including the opening date.');continue;}
   let left=volume,weighted=0,openingFees=0,first=list[0];while(left>1e-8){const leg=list[0],take=Math.min(left,leg.volume);weighted+=leg.price*take;openingFees+=leg.fees*take/leg.volume;leg.fees-=leg.fees*take/leg.volume;leg.volume-=take;left-=take;if(leg.volume<1e-8)list.shift();}
   trades.push(normalizedTrade({ticket,positionId,kind:'deal',side:first.side,symbol,volume,entry:weighted/volume,exit:price,openTime:first.stamp,closeTime:stamp,profit,fees:fees+openingFees,magic:magic||first.magic,eaName:eaName||first.eaName,comment,offset:utcOffset}));
  }
 }}
 trades.sort((a,b)=>(a.closeTime+a.ticket).localeCompare(b.closeTime+b.ticket));
 if(!metadata.currencyDetected)warnings.push('Currency is not included in this file. This journal imports USD only; confirm that USD is your MT5 deposit currency before continuing.');
 if(selected.every(b=>['commission','fee','fees','swap'].every(k=>b.map[k]<0)))warnings.push('Commission, fee and swap columns are absent. Results use profit as reported; check whether this already includes trading costs.');
 if(trades.some(t=>t.magic===null))warnings.push('This export does not identify every EA. Missing advisor names and magic numbers stay unknown.');
 if(trades.some(t=>t.r===null))warnings.push('Original risk is not available in this report. R-based statistics are shown as unavailable.');
 if(utcOffset===null||utcOffset==='')warnings.push('Broker UTC offset is unset. Calendar dates use broker time and sessions remain unclassified.');
 if(skipped)warnings.push(`${skipped} trade rows could not be imported. Review the row issues before continuing.`);
 if(deposits.length)warnings.push('Deposits, withdrawals and credits are excluded from trade P&L. Set the starting balance for a meaningful balance curve.');
 if(!trades.length)throw Error(issues[0]?.reason||'No completed trades were found in this report. Export the MT5 Positions history for the required date range.');
 return {filename,metadata,trades,issues,warnings,skipped,ignored,unmatched,format:selected[0].kind==='position'?'Completed positions':'Position-linked deals',dateStart:trades[0].date,dateEnd:trades.at(-1).date,net:trades.reduce((s,t)=>s+t.pnl-t.fees,0)};
}
export async function parseMT5File(file,options={}){
 if(!file||!file.size)throw Error('Choose a non-empty MT5 report.');if(file.size>MAX_FILE_BYTES)throw Error('The file is larger than 10 MB. Export a shorter date range.');
 const bytes=new Uint8Array(await file.arrayBuffer());let rows,format;
 if(bytes[0]===0x50&&bytes[1]===0x4b){rows=await xlsxRows(bytes);format='XLSX';}
 else {const text=decodeText(bytes);if(/<html|<table|<tr\b|<(?:\w+:)?Workbook\b/i.test(text)){rows=parseMarkupRows(text);format=/<(?:\w+:)?Workbook\b/i.test(text)?'MT5 XML':'HTML';}else {if(/\.pdf$|\.xls$/i.test(file.name)||bytes.slice(0,4).join(',')==='208,207,17,224')throw Error('Upload HTML, MT5 XML, XLSX or CSV. PDF and binary XLS files are not supported.');rows=parseDelimited(text);format='CSV / TSV';}}
 const result=rowsToReport(rows,{...options,filename:file.name});result.fileType=format;return result;
}
const keyFor=t=>t.brokerKey||`position:${t.positionId||t.ticket}`;
export function planImport(report,db,accountId,{onlyEA=false}={}){
 const existing=db.trades.filter(t=>t.accountId===accountId),keys=new Set(existing.map(keyFor)),seen=new Set(),fresh=[],duplicates=[],conflicts=[],excluded=[];
 for(const t of report.trades){if(onlyEA&&(!t.magic||t.magic==='0')){excluded.push(t);continue;}const k=keyFor(t);if(keys.has(k)||seen.has(k)||existing.some(e=>e.source==='Manual entry'&&e.brokerTicket&&String(e.brokerTicket)===String(t.ticket))){duplicates.push(t);continue;}const overlap=existing.find(e=>String(e.positionId||e.ticket)===t.positionId&&e.importKind&&e.importKind!==t.importKind);if(overlap){conflicts.push(t);continue;}seen.add(k);fresh.push(t);}
 return {fresh,duplicates,conflicts,excluded,net:fresh.reduce((s,t)=>s+t.pnl-t.fees,0)};
}
export function commitReport(db,report,{userId,accountId='new',name,number='',server='',currency='USD',balance=0,onlyEA=false,utcOffset=null},makeId=()=>globalThis.crypto?.randomUUID?.()||`local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`){
 if(!db.users.some(u=>u.id===userId))throw Error('Choose an existing account owner.');
 const next=structuredClone(db);let account=next.accounts.find(a=>a.id===accountId);
 if(accountId!=='new'&&(!account||account.userId!==userId||account.demo===true))throw Error('Choose a real journal account owned by this user.');
 const reportNumber=report.metadata.account;if(!reportNumber&&!/^\d{4,20}$/.test(number))throw Error('Enter the MT5 account number for this report.');if(reportNumber&&number&&reportNumber!==number)throw Error('The entered MT5 account number does not match this report.');
 if(account&&reportNumber&&account.number&&account.number!==reportNumber)throw Error('This report belongs to a different MT5 account. Choose its account or create a new one.');
 if(account&&account.currency!==currency)throw Error('Report currency does not match the selected account.');
 if(report.metadata.currency!==currency)throw Error('The import currency does not match this report.');
 if(currency!=='USD')throw Error('This version supports USD reports only; currency conversion is not available.');
 if(!Number.isFinite(Number(balance))||Number(balance)<0)throw Error('Enter a valid non-negative starting balance.');
 if(!account){const bound=next.accounts.find(a=>a.demo!==true&&a.userId===userId&&reportNumber&&a.number===reportNumber&&clean(a.server).toLowerCase()===clean(server).toLowerCase());if(bound)throw Error('This MT5 account already exists. Select it to add more history.');account={id:makeId(),userId,name:clean(name)||`MT5 · ${reportNumber||'Imported history'}`,number:reportNumber||number,broker:report.metadata.broker||'MT5 report',server:server||report.metadata.server,currency,balance:Number(balance),type:'Live',mode:'import',demo:false,license:'File import',status:'Active',connection:'File import',created:new Date().toISOString().slice(0,10),expiry:'',lastSync:null};next.accounts.push(account);}
 const plan=planImport(report,next,account.id,{onlyEA});if(plan.conflicts.length)throw Error('This account already contains overlapping position/deal imports. Use the same report view as the earlier import, or a separate account.');if(!plan.fresh.length)throw Error(plan.duplicates.length?'All these trades already exist. Nothing was imported.':'No trades match the EA filter. Import the full report or export a Magic column.');
 const batchId=makeId(),timestamp=new Date().toISOString();for(const t of plan.fresh)next.trades.push({...t,id:makeId(),accountId:account.id,importBatchId:batchId,importedAt:timestamp});
 account.lastImportedAt=timestamp;account.importOffset=utcOffset;next.dataMode='real';next.importBatches??=[];next.importBatches.unshift({id:batchId,userId,accountId:account.id,filename:report.filename,createdAt:timestamp,count:plan.fresh.length,duplicates:plan.duplicates.length,excluded:plan.excluded.length,skipped:report.skipped,net:plan.net,dateStart:report.dateStart,dateEnd:report.dateEnd,format:report.fileType||report.format,warnings:report.warnings});
 next.activity.unshift({id:makeId(),text:`Imported ${plan.fresh.length} MT5 trades · ${account.name}`,time:timestamp,type:'import',userId});return {db:next,batch:next.importBatches[0],accountId:account.id};
}
export function undoReport(db,batchId,userId){const batch=db.importBatches?.find(b=>b.id===batchId&&b.userId===userId);if(!batch)throw Error('Import not found for this user.');const next=structuredClone(db);next.trades=next.trades.filter(t=>t.importBatchId!==batchId);next.importBatches=next.importBatches.filter(b=>b.id!==batchId);next.activity.unshift({id:'undo-'+batchId,text:`Undid import · ${batch.filename}`,time:new Date().toISOString(),type:'import',userId});return next;}
