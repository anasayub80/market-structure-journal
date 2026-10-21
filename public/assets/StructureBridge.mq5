#property copyright "Structure Trading Journal"
#property version "1.00"
#property strict
#property description "Read-only journal bridge. Sends completed EA position history over HTTPS. Never places or modifies trades."
input string JournalURL = ""; // Full HTTPS URL ending /api/ea/ingest
input string ConnectorToken = ""; // Account credential shown once in Structure
input int SyncSeconds = 60;
input int HistoryDays = 90;
input int MaxPositions = 200; // Latest closed positions; 1 to 500. Import older history as a report.

string J(string value) {
 StringReplace(value,"\\","\\\\"); StringReplace(value,"\"","\\\"");
 StringReplace(value,"\r","\\r"); StringReplace(value,"\n","\\n"); StringReplace(value,"\t","\\t");
 return "\""+value+"\"";
}
string Stamp(datetime value) { return TimeToString(value,TIME_DATE|TIME_SECONDS); }
bool StillOpen(ulong identifier) {
 for(int i=0;i<PositionsTotal();i++) {
  if(PositionGetTicket(i)>0 && (ulong)PositionGetInteger(POSITION_IDENTIFIER)==identifier) return true;
 }
 return false;
}
bool PositionJSON(ulong identifier,string &value) {
 if(StillOpen(identifier) || !HistorySelectByPosition(identifier)) return false;
 double inVolume=0,outVolume=0,inValue=0,outValue=0,profit=0,commission=0,swap=0,fee=0;
 datetime opened=0,closed=0; long magic=0; string symbol="",side=""; bool invalid=false;
 for(uint i=0;i<HistoryDealsTotal();i++) {
  ulong ticket=HistoryDealGetTicket(i); if(ticket==0) continue;
  long type=HistoryDealGetInteger(ticket,DEAL_TYPE);
  if(type!=DEAL_TYPE_BUY && type!=DEAL_TYPE_SELL) continue;
  long entry=HistoryDealGetInteger(ticket,DEAL_ENTRY);
  if(entry==DEAL_ENTRY_INOUT) { invalid=true; break; } // Netting reversals need a report, not guessed allocation.
  double volume=HistoryDealGetDouble(ticket,DEAL_VOLUME),price=HistoryDealGetDouble(ticket,DEAL_PRICE);
  datetime when=(datetime)HistoryDealGetInteger(ticket,DEAL_TIME);
  profit+=HistoryDealGetDouble(ticket,DEAL_PROFIT);commission+=HistoryDealGetDouble(ticket,DEAL_COMMISSION);
  swap+=HistoryDealGetDouble(ticket,DEAL_SWAP);fee+=HistoryDealGetDouble(ticket,DEAL_FEE);
  if(entry==DEAL_ENTRY_IN) {
   long dealMagic=HistoryDealGetInteger(ticket,DEAL_MAGIC);
   if(inVolume>0 && (magic!=dealMagic || side!=(type==DEAL_TYPE_BUY?"Buy":"Sell"))) {invalid=true;break;}
   if(opened==0 || when<opened) opened=when;
   inVolume+=volume;inValue+=volume*price;magic=dealMagic;symbol=HistoryDealGetString(ticket,DEAL_SYMBOL);side=type==DEAL_TYPE_BUY?"Buy":"Sell";
  } else if(entry==DEAL_ENTRY_OUT || entry==DEAL_ENTRY_OUT_BY) {
   outVolume+=volume;outValue+=volume*price;if(when>closed) closed=when;
  }
 }
 if(invalid || magic<=0 || inVolume<=0 || MathAbs(inVolume-outVolume)>0.0000001 || opened==0 || closed<opened) return false;
 value="{\"ticket\":"+J((string)identifier)+",\"symbol\":"+J(symbol)+",\"side\":"+J(side)+
 ",\"lots\":"+DoubleToString(inVolume,8)+",\"openTime\":"+J(Stamp(opened))+",\"closeTime\":"+J(Stamp(closed))+
 ",\"entry\":"+DoubleToString(inValue/inVolume,10)+",\"exit\":"+DoubleToString(outValue/outVolume,10)+
 ",\"pnl\":"+DoubleToString(profit,8)+",\"commission\":"+DoubleToString(commission,8)+",\"swap\":"+DoubleToString(swap,8)+
 ",\"fee\":"+DoubleToString(fee,8)+",\"magic\":"+J((string)magic)+"}";
 return true;
}
void Sync() {
 if(!TerminalInfoInteger(TERMINAL_CONNECTED)) return;
 if(AccountInfoString(ACCOUNT_CURRENCY)!="USD") {Print("Structure requires a USD account.");return;}
 if(!HistorySelect(TimeCurrent()-(datetime)((long)HistoryDays*86400),TimeCurrent())) return;
 ulong candidates[]; int limit=MaxPositions; if(limit<1) limit=1;if(limit>500) limit=500;
 // Copy identifiers before HistorySelectByPosition changes the selected history list.
 for(int i=(int)HistoryDealsTotal()-1;i>=0 && ArraySize(candidates)<limit;i--) {
  ulong ticket=HistoryDealGetTicket(i);long entry=HistoryDealGetInteger(ticket,DEAL_ENTRY);
  if(entry!=DEAL_ENTRY_OUT && entry!=DEAL_ENTRY_OUT_BY) continue;
  ulong identifier=(ulong)HistoryDealGetInteger(ticket,DEAL_POSITION_ID);if(identifier==0)continue;
  bool seen=false;for(int j=0;j<ArraySize(candidates);j++)if(candidates[j]==identifier){seen=true;break;}
  if(!seen){int n=ArraySize(candidates);ArrayResize(candidates,n+1);candidates[n]=identifier;}
 }
 string positions="";for(int i=0;i<ArraySize(candidates);i++){string value="";if(PositionJSON(candidates[i],value)){if(positions!="")positions+=",";positions+=value;}}
 string payload="{\"account\":"+J((string)AccountInfoInteger(ACCOUNT_LOGIN))+",\"server\":"+J(AccountInfoString(ACCOUNT_SERVER))+",\"currency\":\"USD\",\"positions\":["+positions+"]}";
 char data[],result[];int count=StringToCharArray(payload,data,0,WHOLE_ARRAY,CP_UTF8);if(count>0)ArrayResize(data,count-1);
 string responseHeaders="";ResetLastError();
 int code=WebRequest("POST",JournalURL,"Content-Type: application/json\r\nAuthorization: Bearer "+ConnectorToken+"\r\n",15000,data,result,responseHeaders);
 if(code<0)Print("Structure request failed. Check the WebRequest allowlist and network. Error: ",GetLastError());
 else if(code!=200)Print("Structure sync returned HTTP ",code,". Check account binding, license, and connector credential.");
 else Print("Structure history sync acknowledged.");
}
int OnInit() {
 if(StringFind(JournalURL,"https://")!=0 || StringLen(ConnectorToken)!=64 || HistoryDays<1 || SyncSeconds<30) {Print("Set an HTTPS journal endpoint, a connector credential, history days, and an interval of at least 30 seconds.");return INIT_PARAMETERS_INCORRECT;}
 EventSetTimer(SyncSeconds);return INIT_SUCCEEDED;
}
void OnTimer(){Sync();}
void OnDeinit(const int reason){EventKillTimer();}
