//+------------------------------------------------------------------+
//|                                              DeskUS_Bridge.mq5   |
//|  Envoie prix, compte, positions, bougies M15 et trades clôturés  |
//|  de MT5 vers l'application Desk US (mybruceos.github.io/trading) |
//|  Le robot ne passe AUCUN ordre : il lit et il envoie, c'est tout.|
//+------------------------------------------------------------------+
#property copyright   "Desk US"
#property version     "1.01"
#property description "Pont MT5 -> Desk US. Lecture seule : aucun ordre n'est passé."

//--- paramètres (onglet « Entrées »)
input string InpKey      = "";                       // Clé Desk US (copiée depuis l'application)
input string InpSymbols  = "US100.cash,US500.cash";  // Symboles à suivre, séparés par des virgules
input int    InpSeconds  = 3;                        // Envoi toutes les N secondes
input int    InpDays     = 60;                       // Trades clôturés envoyés (jours d'historique)
input string InpUrl      = "https://xakrdapoxthvvqpyjuji.supabase.co/rest/v1/rpc/desk_push"; // Adresse du service
input string InpApiKey   = "sb_publishable_Hzn2bTrae-TflG_HCzLVWg_QYF4l0ec";                 // Clé publique du service

#define EA_VERSION "1.01"

string   g_syms[];
long     g_srvOff      = 0;     // décalage heure serveur - UTC (secondes)
datetime g_lastBars    = 0;     // dernier envoi des bougies (heure locale PC)
datetime g_lastTrades  = 0;     // dernier envoi des trades clôturés
datetime g_lastInit    = 0;     // dernier calcul du capital initial
datetime g_lastSend    = 0;
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
   for(int k = 0; k < ArraySize(g_syms); k++)
     {
      string sym = g_syms[k];
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

// M15 (3 jours) pour les niveaux du jour, H1 (10 jours) et D1 (6 mois) pour la tendance
string BarsJson()
  {
   string s = "{";
   for(int k = 0; k < ArraySize(g_syms); k++)
     {
      string sym = g_syms[k];
      if(k > 0) s += ",";
      s += Q(sym) + ":" + RatesJson(sym, PERIOD_M15, 288);
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
int Post(string body, string &resp)
  {
   char data[];
   char result[];
   string rh;
   int len = StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
   if(len > 0) ArrayResize(data, len - 1);   // retire le zéro final
   string headers = "Content-Type: application/json\r\napikey: " + InpApiKey + "\r\n";
   ResetLastError();
   int code = WebRequest("POST", InpUrl, headers, 5000, data, result, rh);
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
   string st = (g_lastError == "")
               ? "Desk US · connecté · " + IntegerToString(g_okCount) + " envois · dernier à " + TimeToString(now, TIME_SECONDS)
               : "Desk US · ERREUR : " + g_lastError;
   Comment(st);
  }

//+------------------------------------------------------------------+
//| Cycle de vie                                                     |
//+------------------------------------------------------------------+
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
  }

void OnTick()
  {
  }
//+------------------------------------------------------------------+
