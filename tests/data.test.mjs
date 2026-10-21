import test from 'node:test';import assert from 'node:assert/strict';
import {metrics,filterTrades as productionFilter,calendarCells,groupTrades} from '../src/data.js';
import {seedTrades,seedAccounts} from './fixtures/legacy-data.mjs';
const filterTrades=(rows,options={})=>productionFilter(rows,{anchorDate:'2026-10-16',...options});
test('metrics include fees and calculate peak-to-trough drawdown',()=>{const t=[{date:'2026-10-01',time:'08:00',pnl:200,fees:10,r:2},{date:'2026-10-02',time:'08:00',pnl:-100,fees:10,r:-1}];const m=metrics(t,1000);assert.equal(m.pnl,80);assert.equal(m.balance,1080);assert.equal(m.winRate,50);assert.equal(m.pf,190/110);assert.equal(m.avgR,.5);assert.ok(Math.abs(m.dd-(110/1190*100))<.0001);});
test('empty metrics are finite and stable',()=>{const m=metrics([],0);assert.equal(m.pnl,0);assert.equal(m.winRate,0);assert.equal(m.dd,0);assert.equal(m.pf,0);assert.equal(m.avgWin,0);});
test('filters cannot escape allowed account scope',()=>{const rows=filterTrades(seedTrades,{accountIds:['a1','a2'],account:'a4',range:'all'});assert.equal(rows.length,0);const own=filterTrades(seedTrades,{accountIds:['a1','a2'],range:'month',symbol:'XAUUSD',session:'London'});assert.ok(own.length);assert.ok(own.every(t=>['a1','a2'].includes(t.accountId)&&t.date>='2026-10-01'&&t.symbol==='XAUUSD'&&t.session==='London'));});
test('calendar uses a Monday-first grid and handles leap years',()=>{const oct=calendarCells(2026,9);assert.equal(oct[0].date,'2026-09-28');assert.equal(oct.filter(c=>c.current).length,31);assert.equal(oct.length%7,0);assert.equal(calendarCells(2024,1).filter(c=>c.current).length,29);});
test('group totals reconcile with the ledger after fees',()=>{const rows=filterTrades(seedTrades,{accountIds:['a1'],range:'month'}),m=metrics(rows);const sessions=groupTrades(rows,'session');assert.equal(sessions.reduce((s,x)=>s+x.total,0),m.total);assert.ok(Math.abs(sessions.reduce((s,x)=>s+x.pnl,0)-m.pnl)<.0001);});
test('each seeded trade belongs to an existing single-account license',()=>{assert.equal(new Set(seedAccounts.map(a=>a.license)).size,seedAccounts.length);assert.equal(new Set(seedTrades.map(t=>t.ticket)).size,seedTrades.length);assert.ok(seedTrades.every(t=>seedAccounts.some(a=>a.id===t.accountId)));});

test('legacy workspace migration preserves existing data and assigns owners once',async()=>{const {migrateUserWorkspaces,seedUsers,seedEntries}=await import('./fixtures/legacy-data.mjs');const legacy={users:structuredClone(seedUsers),entries:structuredClone(seedEntries)};migrateUserWorkspaces(legacy);const count=legacy.entries.length;assert.ok(legacy.entries.filter(e=>e.id.startsWith('j')).every(e=>e.userId));assert.equal(legacy.entries.find(e=>e.id==='j1').userId,'u1');assert.ok(legacy.entries.some(e=>e.userId==='u2'));migrateUserWorkspaces(legacy);assert.equal(legacy.entries.length,count);});

test('EA-only migration archives legacy manual entries and preserves user edits',async()=>{
 const {migrateEAOnly}=await import('./fixtures/legacy-data.mjs');const first=structuredClone(seedTrades[0]);first.source='Manual';first.notes='Keep my review';
 const manual={id:'custom-manual',ticket:999,source:'Manual',pnl:500};const legacy={trades:[first,manual],playbooks:[{id:'old-setup'}]};
 migrateEAOnly(legacy);assert.equal(legacy.trades.length,1);assert.equal(legacy.trades[0].source,'EA sync');assert.equal(legacy.trades[0].notes,'Keep my review');assert.equal(legacy.archivedManualTrades[0].id,'custom-manual');assert.equal(legacy.archivedPlaybooks.length,1);assert.ok(!legacy.playbooks);migrateEAOnly(legacy);assert.equal(legacy.archivedManualTrades.length,1);
});
test('trade filters reject non-EA history and search by advisor and magic number',()=>{
 const manual={...seedTrades[0],id:'manual',source:'Manual'};assert.equal(filterTrades([manual],{range:'all'}).length,0);
 const byName=filterTrades(seedTrades,{range:'all',query:'NOVA Retracement EA'});assert.ok(byName.length);assert.ok(byName.every(t=>t.eaName==='NOVA Retracement EA'));
 const byMagic=filterTrades(seedTrades,{range:'all',query:'202602'});assert.ok(byMagic.length);assert.ok(byMagic.every(t=>t.magic===202602));assert.ok(seedTrades.every(t=>t.source==='EA sync'&&t.eaName&&t.magic));
});
