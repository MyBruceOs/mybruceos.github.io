//+------------------------------------------------------------------+
//|                                              DeskUS_Bridge.mq5   |
//|  Envoie prix, compte, positions, bougies M15 et trades clôturés  |
//|  de MT5 vers l'application Desk US (mybruceos.github.io/trading) |
//|  Le robot ne passe AUCUN ordre : il lit et il envoie, c'est tout.|
//+------------------------------------------------------------------+
#property copyright   "Desk US"
#property version     "1.06"
#property description "Pont MT5 -> Desk US. Lecture seule : aucun ordre n'est passé."

//--- paramètres (onglet « Entrées »)
input string InpKey      = "";                       // Clé Desk US (copiée depuis l'application)
input string InpSymbols  = "US100.cash,US500.cash";  // Symboles à suivre, séparés par des virgules
input string InpMacro    = "DXY.cash,XAUUSD,USOIL.cash,US30.cash"; // Intermarché (prix seulement, ignorés s'ils n'existent pas)
input int    InpSeconds  = 3;                        // Envoi toutes les N secondes
input int    InpDays     = 60;                       // Trades clôturés envoyés (jours d'historique)
input string InpUrl      = "https://xakrdapoxthvvqpyjuji.supabase.co/rest/v1/rpc/desk_push"; // Adresse du service
input string InpApiKey   = "sb_publishable_Hzn2bTrae-TflG_HCzLVWg_QYF4l0ec";                 // Clé publique du service
input bool   InpHistExport  = true;   // Exporter l'historique (une seule fois) pour les backtests
input int    InpHistDaysM1  = 365;    // Profondeur de l'export M1 (jours)
input string InpHistExtra   = "US30.cash,XAUUSD"; // Symboles à exporter seulement pour les backtests (pas suivis en direct)
input int    InpHistDaysM5  = 1095;   // Profondeur de l'export M5 (jours)
input bool   InpHistRestart = false;  // Recommencer l'export depuis le début
input string InpHistUrl     = "https://xakrdapoxthvvqpyjuji.supabase.co/rest/v1/rpc/desk_hist_push"; // Adresse de l'export

#define EA_VERSION "1.06"

string   g_syms[];
string   g_hsyms[];   // symboles exportés (suivis + export seul)
string   g_qsyms[];   // symboles suivis + intermarché (cotations seulement)
long     g_srvOff      = 0;     // décalage heure serveur - UTC (secondes)
datetime g_lastBars    = 0;     // dernier envoi des bougies (heure locale PC)
datetime g_lastTrades  = 0;     // dernier envoi des trades clôturés
datetime g_lastInit    = 0;     // dernier calcul du capital initial
datetime g_lastSend    = 0;
bool     g_histDone    = false;
int      g_histSent    = 0;
int      g_histFail    = 0;
string   g_histStatus  = "";
double   g_initBalance = 0;
int      g_okCount     = 0;
string   g_lastError   = "";

//+------------------------------------------------------------------+
//| Outils JSON                                                      |
//+------------------------------------------------------------------+
string Q(string s)
  {
   StringReplace(s, "\\", "\\\\");
   StringReplace(s, "\"", "\\\"");
   return "\"" + s + "\"";
  }
string N(double v, int digits)
  {
   if(!MathIsValidNumber(v)) return "null";
   return DoubleToString(v, digits);
  }
string I(long v) { return IntegerToString(v); }

//+------------------------------------------------------------------+
//| Heures : UTC, heure serveur, minuit à Prague (reset FTMO)        |
//+------------------------------------------------------------------+
void UpdateServerOffset()
  {
   datetime srv = TimeTradeServer();
   datetime gmt = TimeGMT();
   if(srv <= 0 || gmt <= 0) return;
   g_srvOff = (long)MathRound((double)(srv - gmt) / 900.0) * 900;
  }
long ToUtc(datetime serverTime) { return (long)serverTime - g_srvOff; }

// Dernier dimanche du mois à 01:00 UTC (changement d'heure européen)
datetime LastSundayUtc(int year, int month)
  {
   MqlDateTime t;
   t.year = year; t.mon = month + 1; t.day = 1; t.hour = 0; t.min = 0; t.sec = 0;
   if(t.mon > 12) { t.mon = 1; t.year++; }
   datetime lastDay = StructToTime(t) - 86400;
   MqlDateTime ld;
   TimeToStruct(lastDay, ld);
   return lastDay - ld.day_of_week * 86400 + 3600;
  }
bool EuSummer(datetime utc)
  {
   MqlDateTime t;
   TimeToStruct(utc, t);
   return utc >= LastSundayUtc(t.year, 3) && utc < LastSundayUtc(t.year, 10);
  }
// Minuit à Prague (= Paris), exprimé en heure serveur
datetime PragueMidnightServer()
  {
   long utcNow   = (long)TimeGMT();
   long off      = EuSummer((datetime)utcNow) ? 7200 : 3600;
   long localNow = utcNow + off;
   long midLocal = localNow - (localNow % 86400);
   return (datetime)(midLocal - off + g_srvOff);
  }

//+------------------------------------------------------------------+
//| Capital initial : somme des dépôts (opérations de type balance)  |
//+------------------------------------------------------------------+
void ComputeInitialBalance()
  {
   if(!HistorySelect(0, TimeTradeServer() + 86400)) return;
   double sum = 0;
   int total = HistoryDealsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong tk = HistoryDealGetTicket(i);
      if(tk == 0) continue;
      if((ENUM_DEAL_TYPE)HistoryDealGetInteger(tk, DEAL_TYPE) == DEAL_TYPE_BALANCE)
         sum += HistoryDealGetDouble(tk, DEAL_PROFIT);
     }
   if(sum > 0) g_initBalance = sum;
  }

//+------------------------------------------------------------------+
//| Compte                                                           |
//+------------------------------------------------------------------+
string AccountJson()
  {
   double bal = AccountInfoDouble(ACCOUNT_BALANCE);
   double eq  = AccountInfoDouble(ACCOUNT_EQUITY);
   // résultat réalisé depuis minuit Prague (trades clôturés + frais du jour)
   double dayPl = 0, dayBal = 0;
   datetime mid = PragueMidnightServer();
   if(HistorySelect(mid, TimeTradeServer() + 86400))
     {
      int total = HistoryDealsTotal();
      for(int i = 0; i < total; i++)
        {
         ulong tk = HistoryDealGetTicket(i);
         if(tk == 0) continue;
         ENUM_DEAL_TYPE ty = (ENUM_DEAL_TYPE)HistoryDealGetInteger(tk, DEAL_TYPE);
         double v = HistoryDealGetDouble(tk, DEAL_PROFIT) + HistoryDealGetDouble(tk, DEAL_COMMISSION)
                    + HistoryDealGetDouble(tk, DEAL_SWAP) + HistoryDealGetDouble(tk, DEAL_FEE);
         if(ty == DEAL_TYPE_BALANCE) dayBal += v;
         else dayPl += v;
        }
     }
   string s = "{";
   s += "\"cur\":" + Q(AccountInfoString(ACCOUNT_CURRENCY));
   s += ",\"server\":" + Q(AccountInfoString(ACCOUNT_SERVER));
   s += ",\"bal\":" + N(bal, 2);
   s += ",\"eq\":" + N(eq, 2);
   s += ",\"pl\":" + N(AccountInfoDouble(ACCOUNT_PROFIT), 2);
   s += ",\"mfree\":" + N(AccountInfoDouble(ACCOUNT_MARGIN_FREE), 2);
   s += ",\"lev\":" + I(AccountInfoInteger(ACCOUNT_LEVERAGE));
   s += ",\"init\":" + N(g_initBalance, 2);
   s += ",\"day_pl\":" + N(dayPl, 2);
   s += ",\"day_start\":" + N(bal - dayPl, 2);
   s += ",\"mid\":" + I(ToUtc(mid));
   s += ",\"t\":" + I((long)TimeGMT());
   s += ",\"srv_off\":" + I(g_srvOff);
   s += "}";
   return s;
  }

//+------------------------------------------------------------------+
//| Cotations et spécifications des contrats                         |
//+------------------------------------------------------------------+
string QuotesJson()
  {
   string s = "{";
   for(int k = 0; k < ArraySize(g_qsyms); k++)
     {
      string sym = g_qsyms[k];
      int    dg  = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
      double ts  = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_SIZE);
      double tv  = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE_LOSS);
      if(tv <= 0) tv = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE);
      double ppv = (ts > 0) ? tv / ts : 0;   // valeur d'1 point d'indice pour 1 lot, devise du compte
      if(k > 0) s += ",";
      s += Q(sym) + ":{";
      s += "\"bid\":" + N(SymbolInfoDouble(sym, SYMBOL_BID), dg);
      s += ",\"ask\":" + N(SymbolInfoDouble(sym, SYMBOL_ASK), dg);
      s += ",\"dg\":" + I(dg);
      s += ",\"ts\":" + N(ts, 8);
      s += ",\"tv\":" + N(tv, 8);
      s += ",\"ppv\":" + N(ppv, 6);
      s += ",\"cs\":" + N(SymbolInfoDouble(sym, SYMBOL_TRADE_CONTRACT_SIZE), 4);
      s += ",\"vmin\":" + N(SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN), 4);
      s += ",\"vstep\":" + N(SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP), 4);
      s += ",\"vmax\":" + N(SymbolInfoDouble(sym, SYMBOL_VOLUME_MAX), 4);
      s += ",\"hi\":" + N(SymbolInfoDouble(sym, SYMBOL_BIDHIGH), dg);
      s += ",\"lo\":" + N(SymbolInfoDouble(sym, SYMBOL_BIDLOW), dg);
      s += ",\"pdh\":" + N(iHigh(sym, PERIOD_D1, 1), dg);
      s += ",\"pdl\":" + N(iLow(sym, PERIOD_D1, 1), dg);
      s += ",\"pdc\":" + N(iClose(sym, PERIOD_D1, 1), dg);
      s += ",\"dopen\":" + N(iOpen(sym, PERIOD_D1, 0), dg);
      s += ",\"t\":" + I(ToUtc((datetime)SymbolInfoInteger(sym, SYMBOL_TIME)));
      s += "}";
     }
   s += "}";
   return s;
  }

//+------------------------------------------------------------------+
//| Positions ouvertes                                               |
//+------------------------------------------------------------------+
string PositionsJson()
  {
   string s = "[";
   int n = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong tk = PositionGetTicket(i);
      if(tk == 0) continue;
      string sym = PositionGetString(POSITION_SYMBOL);
      int dg = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
      long type = PositionGetInteger(POSITION_TYPE);
      long pid  = PositionGetInteger(POSITION_IDENTIFIER);
      double psl = PositionGetDouble(POSITION_SL), ptp = PositionGetDouble(POSITION_TP);
      if(psl > 0 && !GlobalVariableCheck("DeskUS_SL_" + I(pid))) GlobalVariableSet("DeskUS_SL_" + I(pid), psl);
      if(ptp > 0 && !GlobalVariableCheck("DeskUS_TP_" + I(pid))) GlobalVariableSet("DeskUS_TP_" + I(pid), ptp);
      if(n++ > 0) s += ",";
      s += "{\"id\":" + I(PositionGetInteger(POSITION_IDENTIFIER));
      s += ",\"sym\":" + Q(sym);
      s += ",\"dir\":" + (type == POSITION_TYPE_BUY ? "1" : "-1");
      s += ",\"vol\":" + N(PositionGetDouble(POSITION_VOLUME), 2);
      s += ",\"po\":" + N(PositionGetDouble(POSITION_PRICE_OPEN), dg);
      s += ",\"pc\":" + N(PositionGetDouble(POSITION_PRICE_CURRENT), dg);
      s += ",\"sl\":" + N(PositionGetDouble(POSITION_SL), dg);
      s += ",\"tp\":" + N(PositionGetDouble(POSITION_TP), dg);
      s += ",\"pl\":" + N(PositionGetDouble(POSITION_PROFIT), 2);
      s += ",\"sw\":" + N(PositionGetDouble(POSITION_SWAP), 2);
      s += ",\"to\":" + I(ToUtc((datetime)PositionGetInteger(POSITION_TIME)));
      s += "}";
     }
   s += "]";
   return s;
  }

//+------------------------------------------------------------------+
//| Bougies M15 (2 à 3 jours) pour calculer Asie, Londres, opens     |
//+------------------------------------------------------------------+
string RatesJson(string sym, ENUM_TIMEFRAMES tf, int count)
  {
   int dg = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
   MqlRates r[];
   ArraySetAsSeries(r, false);
   int got = CopyRates(sym, tf, 0, count, r);
   string s = "[";
   for(int i = 0; i < got; i++)
     {
      if(i > 0) s += ",";
      s += "[" + I(ToUtc(r[i].time)) + "," + N(r[i].open, dg) + "," + N(r[i].high, dg) + "," + N(r[i].low, dg) + "," + N(r[i].close, dg) + "]";
     }
   return s + "]";
  }

// M15 (3 jours) pour les niveaux du jour, M5 (24 h) pour l'ouverture, H1 (10 jours) et D1 (6 mois) pour la tendance
string BarsJson()
  {
   string s = "{";
   for(int k = 0; k < ArraySize(g_syms); k++)
     {
      string sym = g_syms[k];
      if(k > 0) s += ",";
      s += Q(sym) + ":" + RatesJson(sym, PERIOD_M15, 288);
      s += "," + Q(sym + "@M5") + ":" + RatesJson(sym, PERIOD_M5, 288);
      s += "," + Q(sym + "@H1") + ":" + RatesJson(sym, PERIOD_H1, 240);
      s += "," + Q(sym + "@D1") + ":" + RatesJson(sym, PERIOD_D1, 120);
     }
   s += "}";
   return s;
  }

//+------------------------------------------------------------------+
//| Trades clôturés (regroupés par position)                         |
//+------------------------------------------------------------------+
struct PosAgg
  {
   long   id;
   string sym;
   int    dir;
   double volIn;
   double volOut;
   double pxIn;
   double pxOut;
   double sl;
   double tp;
   long   tOpen;
   long   tClose;
   double profit;
   double comm;
   double swap;
   double fee;
  };

bool IsOpenPosition(long posId)
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong tk = PositionGetTicket(i);
      if(tk == 0) continue;
      if(PositionGetInteger(POSITION_IDENTIFIER) == posId) return true;
     }
   return false;
  }

string TradesJson()
  {
   datetime from = (datetime)((long)TimeTradeServer() - (long)InpDays * 86400);
   if(!HistorySelect(from, TimeTradeServer() + 86400)) return "[]";
   PosAgg a[];
   int total = HistoryDealsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong tk = HistoryDealGetTicket(i);
      if(tk == 0) continue;
      ENUM_DEAL_TYPE ty = (ENUM_DEAL_TYPE)HistoryDealGetInteger(tk, DEAL_TYPE);
      if(ty != DEAL_TYPE_BUY && ty != DEAL_TYPE_SELL) continue;
      long pid = HistoryDealGetInteger(tk, DEAL_POSITION_ID);
      if(pid == 0) continue;
      int idx = -1;
      for(int j = ArraySize(a) - 1; j >= 0; j--) if(a[j].id == pid) { idx = j; break; }
      if(idx < 0)
        {
         idx = ArraySize(a);
         ArrayResize(a, idx + 1);
         a[idx].id = pid; a[idx].sym = HistoryDealGetString(tk, DEAL_SYMBOL); a[idx].dir = 0;
         a[idx].volIn = 0; a[idx].volOut = 0; a[idx].pxIn = 0; a[idx].pxOut = 0; a[idx].sl = 0; a[idx].tp = 0;
         a[idx].tOpen = 0; a[idx].tClose = 0; a[idx].profit = 0; a[idx].comm = 0; a[idx].swap = 0; a[idx].fee = 0;
        }
      ENUM_DEAL_ENTRY en = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(tk, DEAL_ENTRY);
      double vol = HistoryDealGetDouble(tk, DEAL_VOLUME);
      double px  = HistoryDealGetDouble(tk, DEAL_PRICE);
      long   t   = ToUtc((datetime)HistoryDealGetInteger(tk, DEAL_TIME));
      if(en == DEAL_ENTRY_IN)
        {
         if(a[idx].volIn == 0)
           {
            a[idx].dir = (ty == DEAL_TYPE_BUY) ? 1 : -1;
            a[idx].tOpen = t;
            a[idx].sl = HistoryDealGetDouble(tk, DEAL_SL);
            a[idx].tp = HistoryDealGetDouble(tk, DEAL_TP);
            if(a[idx].sl == 0)
              {
               ulong ord = (ulong)HistoryDealGetInteger(tk, DEAL_ORDER);
               if(ord > 0 && HistoryOrderSelect(ord))
                 {
                  a[idx].sl = HistoryOrderGetDouble(ord, ORDER_SL);
                  if(a[idx].tp == 0) a[idx].tp = HistoryOrderGetDouble(ord, ORDER_TP);
                 }
              }
           }
         a[idx].pxIn  += px * vol;
         a[idx].volIn += vol;
        }
      else
        {
         a[idx].pxOut  += px * vol;
         a[idx].volOut += vol;
         a[idx].tClose  = t;
        }
      a[idx].profit += HistoryDealGetDouble(tk, DEAL_PROFIT);
      a[idx].comm   += HistoryDealGetDouble(tk, DEAL_COMMISSION);
      a[idx].swap   += HistoryDealGetDouble(tk, DEAL_SWAP);
      a[idx].fee    += HistoryDealGetDouble(tk, DEAL_FEE);
     }
   string s = "[";
   int n = 0;
   for(int j = 0; j < ArraySize(a); j++)
     {
      if(a[j].volIn <= 0 || a[j].volOut <= 0) continue;          // ouverte avant la période, ou pas encore fermée
      if(a[j].volOut + 1e-9 < a[j].volIn) continue;              // partiellement fermée
      if(IsOpenPosition(a[j].id)) continue;
      int dg = (int)SymbolInfoInteger(a[j].sym, SYMBOL_DIGITS);
      if(dg <= 0) dg = 2;
      if(a[j].sl == 0 && GlobalVariableCheck("DeskUS_SL_" + I(a[j].id))) a[j].sl = GlobalVariableGet("DeskUS_SL_" + I(a[j].id));
      if(a[j].tp == 0 && GlobalVariableCheck("DeskUS_TP_" + I(a[j].id))) a[j].tp = GlobalVariableGet("DeskUS_TP_" + I(a[j].id));
      if(n++ > 0) s += ",";
      s += "{\"id\":" + I(a[j].id);
      s += ",\"sym\":" + Q(a[j].sym);
      s += ",\"dir\":" + I(a[j].dir);
      s += ",\"vol\":" + N(a[j].volIn, 2);
      s += ",\"pi\":" + N(a[j].pxIn / a[j].volIn, dg);
      s += ",\"px\":" + N(a[j].pxOut / a[j].volOut, dg);
      s += ",\"sl\":" + N(a[j].sl, dg);
      s += ",\"tp\":" + N(a[j].tp, dg);
      s += ",\"to\":" + I(a[j].tOpen);
      s += ",\"tc\":" + I(a[j].tClose);
      s += ",\"pl\":" + N(a[j].profit, 2);
      s += ",\"cm\":" + N(a[j].comm, 2);
      s += ",\"sw\":" + N(a[j].swap, 2);
      s += ",\"fee\":" + N(a[j].fee, 2);
      s += ",\"net\":" + N(a[j].profit + a[j].comm + a[j].swap + a[j].fee, 2);
      s += "}";
     }
   s += "]";
   return s;
  }

//+------------------------------------------------------------------+
//| Envoi HTTP                                                       |
//+------------------------------------------------------------------+
int Post(string body, string &resp) { return PostTo(InpUrl, body, resp, 5000); }

int PostTo(string url, string body, string &resp, int timeout)
  {
   char data[];
   char result[];
   string rh;
   int len = StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
   if(len > 0) ArrayResize(data, len - 1);   // retire le zéro final
   string headers = "Content-Type: application/json\r\napikey: " + InpApiKey + "\r\n";
   ResetLastError();
   int code = WebRequest("POST", url, headers, timeout, data, result, rh);
   if(code == -1)
     {
      int err = GetLastError();
      if(err == 4014)
         resp = "MT5 bloque l'adresse : Outils > Options > Expert Advisors > cocher « Autoriser WebRequest » et ajouter https://xakrdapoxthvvqpyjuji.supabase.co";
      else
         resp = "Erreur réseau " + IntegerToString(err);
      return -1;
     }
   resp = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   return code;
  }

void Send(bool force)
  {
   UpdateServerOffset();
   datetime now = TimeLocal();
   // marché fermé (aucun tick depuis 10 min et aucune position) : un envoi par minute suffit
   bool quiet = (TimeTradeServer() - TimeCurrent() > 600) && PositionsTotal() == 0;
   if(!force && quiet && now - g_lastSend < 60) return;

   if(force || g_initBalance <= 0 || now - g_lastInit >= 600) { ComputeInitialBalance(); g_lastInit = now; }
   bool withBars   = force || now - g_lastBars >= 60;
   bool withTrades = force || now - g_lastTrades >= 60;

   string payload = "{\"v\":" + Q(EA_VERSION);
   payload += ",\"account\":" + AccountJson();
   payload += ",\"quotes\":" + QuotesJson();
   payload += ",\"positions\":" + PositionsJson();
   if(withBars)   payload += ",\"bars\":" + BarsJson();
   if(withTrades) payload += ",\"trades\":" + TradesJson();
   payload += "}";

   string body = "{\"p_key\":" + Q(InpKey) + ",\"p_payload\":" + payload + "}";
   string resp;
   int code = Post(body, resp);
   g_lastSend = now;
   if(code >= 200 && code < 300)
     {
      g_okCount++;
      g_lastError = "";
      if(withBars) g_lastBars = now;
      if(withTrades) g_lastTrades = now;
     }
   else
     {
      if(code == -1) g_lastError = resp;
      else if(StringFind(resp, "unknown key") >= 0) g_lastError = "Clé inconnue : recopie la clé depuis l'application (Réglages > Connexion MT5).";
      else g_lastError = "Réponse " + IntegerToString(code) + " : " + StringSubstr(resp, 0, 200);
      Print("Desk US : ", g_lastError);
     }
   ShowStatus();
  }

void ShowStatus()
  {
   string st = (g_lastError == "")
               ? "Desk US · connecté · " + IntegerToString(g_okCount) + " envois · dernier à " + TimeToString(g_lastSend, TIME_SECONDS)
               : "Desk US · ERREUR : " + g_lastError;
   if(g_histStatus != "") st += "\n" + g_histStatus;
   Comment(st);
  }

//+------------------------------------------------------------------+
//| Export d'historique : un paquet par cycle, reprend où il s'était |
//| arrêté (variables globales du terminal), du plus récent au plus  |
//| ancien. M1 par jour, M5 par semaine.                             |
//+------------------------------------------------------------------+
string HistGV(string sym, string tfn) { return "DeskUS_H_" + sym + "_" + tfn; }

string RatesArray(MqlRates &r[], int got, int dg)
  {
   string a = "[";
   for(int i = 0; i < got; i++)
     {
      if(i > 0) a += ",";
      a += "[" + I(ToUtc(r[i].time)) + "," + N(r[i].open, dg) + "," + N(r[i].high, dg) + "," + N(r[i].low, dg) + "," + N(r[i].close, dg) + "]";
     }
   return a + "]";
  }

void HistStep()
  {
   if(!InpHistExport || g_histDone) return;
   for(int k = 0; k < ArraySize(g_hsyms); k++)
     {
      for(int j = 0; j < 2; j++)
        {
         ENUM_TIMEFRAMES tf = (j == 0) ? PERIOD_M1 : PERIOD_M5;
         string tfn = (j == 0) ? "M1" : "M5";
         int days = (j == 0) ? InpHistDaysM1 : InpHistDaysM5;
         long span = (j == 0) ? 86400 : 7 * 86400;
         string gv = HistGV(g_hsyms[k], tfn);
         long limit = (long)TimeTradeServer() - (long)days * 86400;
         long cursor;
         if(GlobalVariableCheck(gv)) cursor = (long)GlobalVariableGet(gv);
         else
           {
            MqlDateTime t;
            TimeToStruct(TimeTradeServer(), t);
            t.hour = 0; t.min = 0; t.sec = 0;
            cursor = (long)StructToTime(t) + 86400;   // début de demain, heure serveur
           }
         if(cursor <= limit) continue;                 // cette série est terminée
         // saute les périodes vides (week-ends, jours fériés) sans attendre
         for(int tries = 0; tries < 10 && cursor > limit; tries++)
           {
            long from = cursor - span;
            MqlRates r[];
            ArraySetAsSeries(r, false);
            ResetLastError();
            int got = CopyRates(g_hsyms[k], tf, (datetime)from, (datetime)(cursor - 1), r);
            if(got < 0)
              {
               // historique pas encore chargé par le terminal : on réessaie au prochain cycle
               g_histFail++;
               if(g_histFail > 40)
                 {
                  Print("Desk US : historique ", g_hsyms[k], " ", tfn, " indisponible avant ", TimeToString((datetime)cursor), ", export arrêté pour cette série.");
                  GlobalVariableSet(gv, (double)limit);
                  g_histFail = 0;
                 }
               g_histStatus = "Historique : chargement " + g_hsyms[k] + " " + tfn + " par MT5…";
               return;
              }
            if(got == 0)
              {
               cursor = from;
               GlobalVariableSet(gv, (double)cursor);
               continue;
              }
            g_histFail = 0;
            int dg = (int)SymbolInfoInteger(g_hsyms[k], SYMBOL_DIGITS);
            string body = "{\"p_key\":" + Q(InpKey) + ",\"p_sym\":" + Q(g_hsyms[k]) + ",\"p_tf\":" + Q(tfn) + ",\"p_bars\":" + RatesArray(r, got, dg) + "}";
            string resp;
            int code = PostTo(InpHistUrl, body, resp, 20000);
            if(code >= 200 && code < 300)
              {
               GlobalVariableSet(gv, (double)from);
               g_histSent++;
               g_histStatus = "Historique : " + IntegerToString(g_histSent) + " paquets envoyés · " + g_hsyms[k] + " " + tfn + " jusqu'au " + TimeToString((datetime)from, TIME_DATE);
              }
            else
              {
               g_histStatus = "Historique : erreur " + IntegerToString(code) + " (" + StringSubstr(resp, 0, 120) + "), nouvel essai au prochain cycle";
               Print("Desk US : ", g_histStatus);
              }
            return;   // un seul paquet par cycle pour ne pas ralentir le direct
           }
         return;
        }
     }
   g_histDone = true;
   g_histStatus = "Historique : export terminé (" + IntegerToString(g_histSent) + " paquets cette session)";
   Print("Desk US : ", g_histStatus);
  }

//+------------------------------------------------------------------+
//| Cycle de vie                                                     |
//+------------------------------------------------------------------+
// partage la clé avec Desk Key (fichier commun à tous les terminaux de ce PC)
void PartagerCle()
  {
   if(StringLen(InpKey) < 32) return;
   FolderCreate("DeskUS", FILE_COMMON);
   int h = FileOpen("DeskUS\\cle.txt", FILE_WRITE | FILE_TXT | FILE_COMMON | FILE_ANSI);
   if(h == INVALID_HANDLE) return;
   FileWriteString(h, InpKey);
   FileClose(h);
  }

int OnInit()
  {
   if(StringLen(InpKey) < 32)
     {
      Alert("Desk US : colle ta clé (elle commence par dk_) dans l'onglet « Données d'entrée » du robot. Elle se copie dans l'application : Réglages > Connexion MT5.");
      return INIT_PARAMETERS_INCORRECT;
     }
   string parts[];
   int n = StringSplit(InpSymbols, ',', parts);
   ArrayResize(g_syms, 0);
   for(int i = 0; i < n; i++)
     {
      string s = parts[i];
      StringTrimLeft(s);
      StringTrimRight(s);
      if(s == "") continue;
      if(!SymbolSelect(s, true)) { Print("Desk US : symbole introuvable ", s); continue; }
      int k = ArraySize(g_syms);
      ArrayResize(g_syms, k + 1);
      g_syms[k] = s;
     }
   if(ArraySize(g_syms) == 0)
     {
      Alert("Desk US : aucun symbole valide. Vérifie les noms (ex. US100.cash,US500.cash).");
      return INIT_PARAMETERS_INCORRECT;
     }
   ArrayCopy(g_qsyms, g_syms);
   // nouvel export à chaque démarrage : un symbole ajouté à la liste est exporté
   // (les séries déjà finies sont sautées tout de suite grâce aux variables globales du terminal)
   g_histDone = false; g_histFail = 0; g_histSent = 0;
   ArrayCopy(g_hsyms, g_syms);
   string xparts[];
   int xn = StringSplit(InpHistExtra, ',', xparts);
   for(int i = 0; i < xn; i++)
     {
      string s = xparts[i];
      StringTrimLeft(s);
      StringTrimRight(s);
      if(s == "") continue;
      bool deja = false;
      for(int j = 0; j < ArraySize(g_hsyms); j++) if(g_hsyms[j] == s) deja = true;
      if(deja) continue;
      if(!SymbolSelect(s, true)) { Print("Desk US : export, symbole absent chez ce broker : ", s); continue; }
      int k = ArraySize(g_hsyms);
      ArrayResize(g_hsyms, k + 1);
      g_hsyms[k] = s;
     }
   string mparts[];
   int mn = StringSplit(InpMacro, ',', mparts);
   for(int i = 0; i < mn; i++)
     {
      string s = mparts[i];
      StringTrimLeft(s);
      StringTrimRight(s);
      if(s == "") continue;
      if(!SymbolSelect(s, true)) { Print("Desk US : intermarché, symbole absent chez ce broker : ", s); continue; }
      int k = ArraySize(g_qsyms);
      ArrayResize(g_qsyms, k + 1);
      g_qsyms[k] = s;
     }
   if(InpHistRestart)
     {
      for(int k = 0; k < ArraySize(g_hsyms); k++)
        {
         GlobalVariableDel(HistGV(g_hsyms[k], "M1"));
         GlobalVariableDel(HistGV(g_hsyms[k], "M5"));
        }
     }
   PartagerCle();
   EventSetTimer(MathMax(1, InpSeconds));
   Send(true);
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   EventKillTimer();
   Comment("");
  }

void OnTimer()
  {
   Send(false);
   HistStep();
   ShowStatus();
  }

void OnTick()
  {
  }
//+------------------------------------------------------------------+
