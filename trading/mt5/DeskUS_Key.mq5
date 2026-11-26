//+------------------------------------------------------------------+
//|                                                  DeskUS_Key.mq5  |
//|  Desk Key : la règle A du backtest Desk US, en une touche.       |
//|                                                                  |
//|  - Un graphique = un indice. Le profil (US100 ou SP500) fixe     |
//|    toutes les règles ; les deux ne se mélangent jamais (symbole  |
//|    vérifié, numéro magique propre à chaque profil).              |
//|  - Détecte le setup en direct, exactement comme le backtest :    |
//|    tendance -> Judas sur le pré-marché -> cassure M1 -> limite   |
//|    au 50 % (Fibo retracé) -> SL derrière le Judas -> TP en R.    |
//|  - Exécution par vous : une touche (K) ou le bouton. Le lot est  |
//|    calculé d'après votre réglage de risque. Mode auto en option. |
//|  - Tout est dessiné sur le graphique (niveaux + panneau).        |
//+------------------------------------------------------------------+
#property copyright "Desk US"
#property version   "1.00"
#property description "Règle A Desk US (US100 / SP500) : détection, dessin et exécution en une touche."

#include <Trade\Trade.mqh>

#define DK_VERSION "1.00"

enum ENUM_DK_PROFIL
  {
   PROFIL_AUTO  = 0, // Automatique (d'après le nom du symbole)
   PROFIL_US100 = 1, // US100 (Nasdaq)
   PROFIL_SP500 = 2  // SP500
  };

enum ENUM_DK_RISQUE
  {
   RISQUE_MONTANT  = 0, // Montant fixe (devise du compte)
   RISQUE_POURCENT = 1, // Pourcentage du solde
   RISQUE_LOT_FIXE = 2  // Lot fixe
  };

enum ENUM_DK_HEURE
  {
   HEURE_AUTO = 0, // Automatique (compte réel ou démo)
   HEURE_NY7  = 1  // Serveur = New York + 7 h (pour le testeur de stratégie)
  };

input ENUM_DK_PROFIL InpProfil      = PROFIL_AUTO;     // Profil (un graphique = un indice)
input ENUM_DK_RISQUE InpRisqueMode  = RISQUE_MONTANT;  // Calcul du lot
input double         InpRisque      = 1000;            // Risque par trade (montant ou %) ou lot fixe
input double         InpTP          = 3.0;             // Objectif en R (2, 2.5 ou 3)
input string         InpTouche      = "K";             // Touche : placer l'ordre (ou l'armer avant 10:00 NY)
input string         InpToucheAnnul = "X";             // Touche : annuler l'ordre en attente
input bool           InpAuto        = false;           // Mode automatique (place l'ordre sans vous)
input bool           InpSuivreFibo  = true;            // Déplacer l'ordre quand la jambe s'allonge (comme le backtest)
input bool           InpSortie13h   = true;            // Fermer la position à 13:00 NY (19:00 Paris)
input bool           InpFiltreH1    = false;           // US100 : pas de trade si le H1 va contre (filtre optionnel)
input ENUM_DK_HEURE  InpHeure       = HEURE_AUTO;      // Heure du serveur
input int            InpCoin        = 0;               // Coin du panneau (0 = haut gauche, 1 = haut droit)

//--- Profil (règles figées, issues des backtests) -------------------
struct Profil
  {
   string            nom;
   bool              fvg;        // FVG M1 obligatoire pour valider la cassure
   double            marge;      // marge du stop au-delà du Judas (points de l'indice)
   double            cassureMin; // cassure nette : clôture au-delà du sommet d'au moins X R
   int               judasMin;   // le fond du Judas doit se former au moins N min après 9:30 NY
   bool              daily;      // le Daily doit être d'accord avec le H4
   long              magic;
   color             couleur;
  };
Profil P;

//--- Bougies (heure UTC) --------------------------------------------
struct Bar { long t; double o, h, l, c; };

//--- Étapes du setup ------------------------------------------------
enum ENUM_ETAPE
  {
   E_AVANT     = 0,  // avant 9:30 NY
   E_PAS_TRADE = 1,  // tendance absente ou filtre
   E_JUDAS     = 2,  // attente du Judas
   E_CASSURE   = 3,  // Judas fait, attente d'une cassure valide
   E_PRET      = 4,  // cassure validée : ordre au 50 %
   E_TOUCHE    = 5,  // niveau d'entrée touché (rempli) entre 10:00 et 11:00
   E_IGNORE    = 6,  // touché avant 10:00 NY : pas de trade (comme le backtest)
   E_EXPIRE    = 7,  // 11:00 NY sans remplissage
   E_FINI      = 8   // pas de setup aujourd'hui
  };

struct Setup
  {
   int               etape;
   string            info;     // dernier refus ou précision
   double            L, ext, sw, far, entry, sl;
   long              sweepT, extT, swT, mssT, farT, fillT;
   bool              fvg;
   double            cassurePts, cassureMinPts;
  };

//--- État global ------------------------------------------------------
CTrade   trade;
long     g_srvOff   = 0;       // heure serveur - UTC (secondes)
string   g_jour     = "";      // date NY du jour traité (+ P provisoire / F définitif)
int      g_dir      = 0;       // sens autorisé du jour (+1 achat, -1 vente, 0 aucun)
int      g_h4 = 0, g_d1 = 0, g_h1 = 0;
string   g_raison   = "";
double   g_preHi = 0, g_preLo = 0;
long     g_t800, g_t930, g_t950, g_t10, g_t11, g_t13;
Setup    S;
Bar      B[];                  // bougies M1 du jour (fermées)
int      g_n = 0;
datetime g_lastBar  = 0;
bool     g_arme     = false;
bool     g_auto     = false;
double   g_tp       = 3.0;
bool     g_tradeFait = false;
string   g_msg      = "";
datetime g_msgT     = 0;
string   PFX        = "DK_";

//+------------------------------------------------------------------+
//| Heures                                                           |
//+------------------------------------------------------------------+
datetime MkTime(int y, int mo, int d, int h, int mi)
  {
   MqlDateTime t; t.year = y; t.mon = mo; t.day = d; t.hour = h; t.min = mi; t.sec = 0;
   return StructToTime(t);
  }
// n-ième dimanche du mois (n = 1, 2) à hh:00 UTC
long NthSundayUtc(int y, int mo, int n, int hh)
  {
   datetime d1 = MkTime(y, mo, 1, 0, 0);
   MqlDateTime t; TimeToStruct(d1, t);
   int first = (7 - t.day_of_week) % 7;       // jours jusqu'au 1er dimanche
   return (long)d1 + (long)(first + 7 * (n - 1)) * 86400 + hh * 3600;
  }
bool UsSummer(long utc)
  {
   MqlDateTime t; TimeToStruct((datetime)utc, t);
   return utc >= NthSundayUtc(t.year, 3, 2, 7) && utc < NthSundayUtc(t.year, 11, 1, 6);
  }
long LastSundayUtc(int y, int mo)
  {
   int y2 = y, m2 = mo + 1; if(m2 > 12) { m2 = 1; y2++; }
   long last = (long)MkTime(y2, m2, 1, 0, 0) - 86400;
   MqlDateTime t; TimeToStruct((datetime)last, t);
   return last - t.day_of_week * 86400 + 3600;
  }
bool EuSummer(long utc)
  {
   MqlDateTime t; TimeToStruct((datetime)utc, t);
   return utc >= LastSundayUtc(t.year, 3) && utc < LastSundayUtc(t.year, 10);
  }
// heure NY -> UTC (décalage pris à 12:00 UTC du jour, comme le backtest)
long NyToUtc(int y, int mo, int d, int h, int mi)
  {
   long noon = (long)MkTime(y, mo, d, 12, 0);
   long off  = UsSummer(noon) ? -4 * 3600 : -5 * 3600;
   return (long)MkTime(y, mo, d, h, mi) - off;
  }
long NyLocal(long utc)    { return utc + (UsSummer(utc) ? -4 * 3600 : -5 * 3600); }
long ParisLocal(long utc) { return utc + (EuSummer(utc) ? 2 * 3600 : 3600); }
string Hm(long localT)    { return TimeToString((datetime)localT, TIME_MINUTES); }

void UpdateServerOffset()
  {
   if(InpHeure == HEURE_NY7)
     {
      long srv = (long)TimeCurrent();
      g_srvOff = (UsSummer(srv - 3 * 3600) ? 3 : 2) * 3600;
      return;
     }
   datetime srv = TimeTradeServer(), gmt = TimeGMT();
   if(srv <= 0 || gmt <= 0) return;
   g_srvOff = (long)MathRound((double)(srv - gmt) / 900.0) * 900;
  }
long     NowUtc()            { return (long)TimeTradeServer() - g_srvOff; }
datetime ToSrv(long utc)     { return (datetime)(utc + g_srvOff); }

//+------------------------------------------------------------------+
//| Outils                                                           |
//+------------------------------------------------------------------+
int Lb(Bar &b[], int n, long t)
  {
   int a = 0, z = n;
   while(a < z) { int m = (a + z) >> 1; if(b[m].t < t) a = m + 1; else z = m; }
   return a;
  }
string Px(double v) { return DoubleToString(v, _Digits); }
string Fr(double v, int d)
  {
   string s = DoubleToString(v, d);
   StringReplace(s, ".", ",");
   return s;
  }
double NormPx(double p)
  {
   double ts = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   if(ts <= 0) ts = _Point;
   return NormalizeDouble(MathRound(p / ts) * ts, _Digits);
  }
int LoadM1(long fromUtc, long toUtc, Bar &out[])
  {
   MqlRates r[];
   ArraySetAsSeries(r, false);
   int got = CopyRates(_Symbol, PERIOD_M1, ToSrv(fromUtc), ToSrv(toUtc), r);
   if(got <= 0) { ArrayResize(out, 0); return 0; }
   ArrayResize(out, got);
   for(int i = 0; i < got; i++)
     {
      out[i].t = (long)r[i].time - g_srvOff;
      out[i].o = r[i].open; out[i].h = r[i].high; out[i].l = r[i].low; out[i].c = r[i].close;
     }
   return got;
  }

//+------------------------------------------------------------------+
//| Tendance (copie exacte de trendOf du backtest)                   |
//+------------------------------------------------------------------+
int TrendOf(Bar &b[], int n)
  {
   if(n < 30) return 0;
   double k20 = 2.0 / 21.0, k50 = 2.0 / 51.0, e20 = b[0].c, e50 = b[0].c;
   for(int i = 1; i < n; i++) { e20 = b[i].c * k20 + e20 * (1 - k20); e50 = b[i].c * k50 + e50 * (1 - k50); }
   double x = b[n - 1].c;
   int s0 = n > 80 ? n - 80 : 0;
   double hLast = 0, hPrev = 0, lLast = 0, lPrev = 0; int nh = 0, nl = 0;
   for(int i = s0 + 2; i < n - 2; i++)
     {
      bool H = true, L = true;
      for(int j = 1; j <= 2; j++)
        {
         if(b[i].h <= b[i - j].h || b[i].h < b[i + j].h) H = false;
         if(b[i].l >= b[i - j].l || b[i].l > b[i + j].l) L = false;
        }
      if(H) { hPrev = hLast; hLast = b[i].h; nh++; }
      if(L) { lPrev = lLast; lLast = b[i].l; nl++; }
     }
   int st = 0;
   if(nh >= 2 && nl >= 2)
     {
      bool hh = hLast > hPrev, hl = lLast > lPrev;
      if(hh && hl) st = 1; else if(!hh && !hl) st = -1;
     }
   if(nh >= 1 && x > hLast) st = MathMax(st, 1);
   if(nl >= 1 && x < lLast) st = MathMin(st, -1);
   double s = st + (x > e50 ? 0.5 : -0.5) + (e20 > e50 ? 0.5 : -0.5);
   return s >= 1 ? 1 : (s <= -1 ? -1 : 0);
  }
// regroupe les M1 en bougies de `secs` secondes (décalage `off`), garde celles finies avant `fin`
int Aggregate(Bar &m[], int n, long secs, long off, long fin, Bar &out[], int keep)
  {
   Bar tmp[]; ArrayResize(tmp, 0);
   int cnt = 0; long curK = -1;
   for(int i = 0; i < n; i++)
     {
      long k = (long)MathFloor((double)(m[i].t + off) / (double)secs);
      if(k != curK)
        {
         cnt++; ArrayResize(tmp, cnt, 4096);
         tmp[cnt - 1].t = k * secs - off; tmp[cnt - 1].o = m[i].o; tmp[cnt - 1].h = m[i].h; tmp[cnt - 1].l = m[i].l; tmp[cnt - 1].c = m[i].c;
         curK = k;
        }
      else
        {
         tmp[cnt - 1].h = MathMax(tmp[cnt - 1].h, m[i].h);
         tmp[cnt - 1].l = MathMin(tmp[cnt - 1].l, m[i].l);
         tmp[cnt - 1].c = m[i].c;
        }
     }
   int last = -1;
   for(int i = cnt - 1; i >= 0; i--) if(tmp[i].t + secs <= fin) { last = i; break; }
   if(last < 0) { ArrayResize(out, 0); return 0; }
   int first = MathMax(0, last - keep + 1), m2 = last - first + 1;
   ArrayResize(out, m2);
   for(int i = 0; i < m2; i++) out[i] = tmp[first + i];
   return m2;
  }

//+------------------------------------------------------------------+
//| Contexte du jour : tendances, pré-marché (calculés une fois)     |
//+------------------------------------------------------------------+
void ContexteDuJour(int y, int mo, int d)
  {
   g_t800 = NyToUtc(y, mo, d, 8, 0);  g_t930 = NyToUtc(y, mo, d, 9, 30); g_t950 = g_t930 + 20 * 60;
   g_t10  = NyToUtc(y, mo, d, 10, 0); g_t11  = NyToUtc(y, mo, d, 11, 0); g_t13  = NyToUtc(y, mo, d, 13, 0);
   long t925 = g_t930 - 5 * 60;
   Bar m[];
   int n = LoadM1(t925 - 40 * 86400, t925 - 1, m);
   // tendance H4 (bougies de 4 h alignées comme le backtest) et H1
   Bar h4[], h1[];
   int n4 = Aggregate(m, n, 14400, 7200, t925, h4, 60);
   int n1 = Aggregate(m, n, 3600, 0, t925, h1, 60);
   g_h4 = TrendOf(h4, n4);
   g_h1 = TrendOf(h1, n1);
   // Daily : prix avant 9:25 contre la moyenne des 10 dernières clôtures (16:00 NY)
   double closes[]; int nc = 0;
   int lastDay = -1;
   for(int i = 0; i < n; i++)
     {
      MqlDateTime t; TimeToStruct((datetime)m[i].t, t);
      int key = t.year * 10000 + t.mon * 100 + t.day;
      if(key == lastDay) continue;
      lastDay = key;
      if(t.day_of_week == 0 || t.day_of_week == 6) continue;
      long o930 = NyToUtc(t.year, t.mon, t.day, 9, 30), o16 = NyToUtc(t.year, t.mon, t.day, 16, 0);
      if(o930 >= g_t930) continue;
      int a = Lb(m, n, o930);
      if(a >= n || m[a].t != o930) continue;   // pas de séance ce jour-là
      int z = Lb(m, n, o16) - 1;
      if(z < 0) continue;
      nc++; ArrayResize(closes, nc); closes[nc - 1] = m[z].c;
     }
   g_d1 = 0;
   if(nc >= 15 && n > 0)
     {
      double px = m[n - 1].c, sN = 0, sP = 0;
      for(int i = nc - 10; i < nc; i++) sN += closes[i];
      for(int i = nc - 15; i < nc - 5; i++) sP += closes[i];
      sN /= 10.0; sP /= 10.0;
      g_d1 = (px > sN && sN > sP) ? 1 : ((px < sN && sN < sP) ? -1 : 0);
     }
   // sens autorisé
   g_dir = 0; g_raison = "";
   if(P.daily)
     {
      if(nc < 15) g_raison = "historique Daily insuffisant";
      else if(g_h4 == 0) g_raison = "H4 sans tendance";
      else if(g_d1 != g_h4) g_raison = "H4 et Daily pas d'accord";
      else g_dir = g_h4;
     }
   else
     {
      if(g_h4 == 0) g_raison = "H4 sans tendance";
      else g_dir = g_h4;
     }
   if(g_dir != 0 && InpFiltreH1 && !P.daily && g_h1 == -g_dir) { g_raison = "H1 contre le trade (filtre)"; g_dir = 0; }
   g_tradeFait = TradeDejaFait();
   g_arme = false;
  }

//+------------------------------------------------------------------+
//| Recherche du setup (copie exacte de setup() du backtest)         |
//+------------------------------------------------------------------+
void Scan()
  {
   S.etape = E_AVANT; S.info = ""; S.fillT = 0; S.mssT = 0; S.sweepT = 0; S.extT = 0; S.swT = 0;
   S.cassurePts = 0; S.cassureMinPts = 0; S.fvg = false;
   // pré-marché
   g_preHi = -DBL_MAX; g_preLo = DBL_MAX;
   for(int i = 0; i < g_n && B[i].t < g_t930; i++)
      if(B[i].t >= g_t800) { g_preHi = MathMax(g_preHi, B[i].h); g_preLo = MathMin(g_preLo, B[i].l); }
   long now = NowUtc();
   if(now < g_t930 || g_preHi < g_preLo) { S.etape = E_AVANT; return; }
   if(g_dir == 0) { S.etape = E_PAS_TRADE; S.info = g_raison; return; }
   int d = g_dir;
   S.L = d < 0 ? g_preHi : g_preLo;
   int n = g_n;
   int i0 = Lb(B, n, g_t930);
   S.etape = E_JUDAS;
   if(i0 >= n) return;
   double ext = d < 0 ? -DBL_MAX : DBL_MAX; int extI = -1; bool swept = false;
   for(int i = i0; i < n && B[i].t < g_t11; i++)
     {
      if(d < 0 ? B[i].h > ext : B[i].l < ext) { ext = d < 0 ? B[i].h : B[i].l; extI = i; }
      if(d < 0 ? ext > S.L : ext < S.L) { if(!swept) S.sweepT = B[i].t; swept = true; }
      if(!swept) continue;
      S.etape = E_CASSURE; S.ext = ext; S.extT = B[extI].t;
      if(i <= extI) continue;
      // dernier sommet (creux) pivot 2 bougies avant l'extrême du Judas
      double sw = 0; bool found = false; int swI = -1;
      for(int k = extI - 2; k >= MathMax(2, i0 - 60); k--)
        {
         bool piv = d < 0
                    ? (B[k].l < B[k - 1].l && B[k].l < B[k - 2].l && B[k].l <= B[k + 1].l && B[k].l <= B[k + 2].l)
                    : (B[k].h > B[k - 1].h && B[k].h > B[k - 2].h && B[k].h >= B[k + 1].h && B[k].h >= B[k + 2].h);
         if(piv) { sw = d < 0 ? B[k].l : B[k].h; swI = k; found = true; break; }
        }
      if(!found)
        {
         sw = d < 0 ? DBL_MAX : -DBL_MAX;
         for(int k = i0; k <= extI; k++) sw = d < 0 ? MathMin(sw, B[k].l) : MathMax(sw, B[k].h);
         swI = i0;
        }
      S.sw = sw; S.swT = B[swI].t;
      if(!(d < 0 ? B[i].c < sw : B[i].c > sw)) continue;
      // règle SP500 : le fond du Judas doit se former après 9:30 + N min
      if(P.judasMin > 0 && B[extI].t < g_t930 + P.judasMin * 60)
        { S.info = "cassure refusée : fond du Judas à " + Hm(ParisLocal(B[extI].t)) + " Paris, trop tôt"; continue; }
      int fvgEnd = -1;
      for(int k = extI + 1; k <= i && k + 1 < n; k++)
        {
         if((d < 0 && B[k - 1].l > B[k + 1].h) || (d > 0 && B[k - 1].h < B[k + 1].l)) { fvgEnd = k + 1; break; }
        }
      if(P.fvg && fvgEnd < 0) { S.info = "cassure sans FVG M1 (en attente)"; continue; }
      int last = P.fvg ? MathMax(i, fvgEnd) : i;
      double far = d < 0 ? DBL_MAX : -DBL_MAX; long farT = 0;
      for(int k = extI; k <= last; k++)
        {
         double v = d < 0 ? B[k].l : B[k].h;
         if(d < 0 ? v < far : v > far) { far = v; farT = B[k].t; }
        }
      double entry = far + (ext - far) * 0.5;
      double sl = d < 0 ? ext + P.marge : ext - P.marge;
      double brk = (B[i].c - sw) * d;
      // règle US100 : cassure nette
      if(P.cassureMin > 0 && brk < P.cassureMin * MathAbs(entry - sl))
        { S.info = "cassure refusée : +" + Fr(brk, 1) + " pts, il faut " + Fr(P.cassureMin * MathAbs(entry - sl), 1) + " pts"; continue; }
      // setup validé
      S.etape = E_PRET; S.info = ""; S.mssT = B[i].t; S.fvg = fvgEnd >= 0;
      S.cassurePts = brk; S.cassureMinPts = P.cassureMin * MathAbs(entry - sl);
      S.sl = sl;
      for(int k = last + 1; k < n && B[k].t < g_t11; k++)
        {
         if(d < 0 ? B[k].h >= entry : B[k].l <= entry)
           {
            S.far = far; S.farT = farT; S.entry = entry; S.fillT = B[k].t;
            S.etape = B[k].t < g_t10 ? E_IGNORE : E_TOUCHE;
            return;
           }
         if(d < 0 ? B[k].l < far : B[k].h > far) { far = d < 0 ? B[k].l : B[k].h; farT = B[k].t; entry = far + (ext - far) * 0.5; }
        }
      S.far = far; S.farT = farT; S.entry = entry;
      if(now >= g_t11) S.etape = E_EXPIRE;
      return;
     }
   if(now >= g_t11 && S.etape < E_PRET) S.etape = E_FINI;
  }

//+------------------------------------------------------------------+
//| Ordres                                                           |
//+------------------------------------------------------------------+
ulong MonOrdre()
  {
   for(int i = OrdersTotal() - 1; i >= 0; i--)
     {
      ulong tk = OrderGetTicket(i);
      if(tk == 0) continue;
      if(OrderGetString(ORDER_SYMBOL) == _Symbol && OrderGetInteger(ORDER_MAGIC) == P.magic) return tk;
     }
   return 0;
  }
ulong MaPosition()
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong tk = PositionGetTicket(i);
      if(tk == 0) continue;
      if(PositionGetString(POSITION_SYMBOL) == _Symbol && PositionGetInteger(POSITION_MAGIC) == P.magic) return tk;
     }
   return 0;
  }
bool TradeDejaFait()
  {
   if(!HistorySelect(ToSrv(g_t930 - 3600), TimeTradeServer() + 60)) return false;
   for(int i = HistoryDealsTotal() - 1; i >= 0; i--)
     {
      ulong tk = HistoryDealGetTicket(i);
      if(tk == 0) continue;
      if(HistoryDealGetString(tk, DEAL_SYMBOL) == _Symbol && HistoryDealGetInteger(tk, DEAL_MAGIC) == P.magic
         && HistoryDealGetInteger(tk, DEAL_ENTRY) == DEAL_ENTRY_IN) return true;
     }
   return MaPosition() != 0;
  }
double Lot(double entry, double sl)
  {
   double step = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP), vmin = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN), vmax = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   if(step <= 0) step = 0.01;
   if(InpRisqueMode == RISQUE_LOT_FIXE) return MathMax(vmin, MathMin(vmax, MathFloor(InpRisque / step) * step));
   double risk = InpRisqueMode == RISQUE_MONTANT ? InpRisque : AccountInfoDouble(ACCOUNT_BALANCE) * InpRisque / 100.0;
   double p = 0;
   if(!OrderCalcProfit(entry > sl ? ORDER_TYPE_BUY : ORDER_TYPE_SELL, _Symbol, 1.0, entry, sl, p) || p >= 0) return 0;
   double lots = MathFloor(risk / (-p) / step) * step;
   if(lots < vmin) return 0;
   return MathMin(vmax, NormalizeDouble(lots, 2));
  }
double RisqueArgent(double entry, double sl, double lots)
  {
   double p = 0;
   if(!OrderCalcProfit(entry > sl ? ORDER_TYPE_BUY : ORDER_TYPE_SELL, _Symbol, lots, entry, sl, p)) return 0;
   return -p;
  }
double TpPrix() { return S.entry + g_dir * g_tp * MathAbs(S.entry - S.sl); }

void Msg(string s) { g_msg = s; g_msgT = TimeLocal(); Print("Desk Key ", P.nom, " : ", s); }

bool Placer()
  {
   long now = NowUtc();
   if(S.etape != E_PRET) { Msg("pas de setup prêt"); return false; }
   if(now < g_t10) { g_arme = true; Msg("armé : l'ordre partira à 10:00 NY s'il est encore valide"); return false; }
   if(now >= g_t11) { Msg("fenêtre d'entrée terminée (11:00 NY)"); return false; }
   if(g_tradeFait || MaPosition() != 0) { Msg("déjà un trade aujourd'hui sur " + P.nom); return false; }
   double entry = NormPx(S.entry), sl = NormPx(S.sl), tp = NormPx(TpPrix());
   double lots = Lot(entry, sl);
   if(lots <= 0) { Msg("lot impossible : risque trop faible pour le lot minimum"); return false; }
   string cmt = "DeskKey " + P.nom + " " + Fr(g_tp, 1) + "R";
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK), bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   bool ok;
   if(g_dir > 0) ok = (ask <= entry) ? trade.Buy(lots, _Symbol, 0, sl, tp, cmt) : trade.BuyLimit(lots, entry, _Symbol, sl, tp, ORDER_TIME_GTC, 0, cmt);
   else          ok = (bid >= entry) ? trade.Sell(lots, _Symbol, 0, sl, tp, cmt) : trade.SellLimit(lots, entry, _Symbol, sl, tp, ORDER_TIME_GTC, 0, cmt);
   if(ok && (trade.ResultRetcode() == TRADE_RETCODE_DONE || trade.ResultRetcode() == TRADE_RETCODE_PLACED))
     {
      g_arme = false;
      Msg((g_dir > 0 ? "ACHAT" : "VENTE") + " " + Fr(lots, 2) + " lot à " + Px(entry) + " · SL " + Px(sl) + " · TP " + Px(tp));
      return true;
     }
   Msg("refusé par le serveur : " + trade.ResultRetcodeDescription());
   return false;
  }
void Annuler(string pourquoi)
  {
   ulong tk = MonOrdre();
   if(tk != 0 && trade.OrderDelete(tk)) Msg("ordre annulé (" + pourquoi + ")");
   g_arme = false;
  }

void Gerer()
  {
   long now = NowUtc();
   ulong ord = MonOrdre(), pos = MaPosition();
   if(pos != 0) g_tradeFait = true;
   // sortie à 13:00 NY
   if(pos != 0 && InpSortie13h && now >= g_t13 && now < g_t13 + 6 * 3600)
     { if(trade.PositionClose(pos)) Msg("position fermée à 13:00 NY"); return; }
   // ordre en attente
   if(ord != 0)
     {
      if(now >= g_t11) { Annuler("11:00 NY sans remplissage"); return; }
      if(S.etape == E_IGNORE || S.etape == E_EXPIRE || S.etape == E_FINI || S.etape == E_PAS_TRADE) { Annuler("setup plus valide"); return; }
      if(InpSuivreFibo && S.etape == E_PRET && OrderSelect(ord))
        {
         double px = OrderGetDouble(ORDER_PRICE_OPEN);
         double ts = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
         if(MathAbs(px - NormPx(S.entry)) >= ts)
           {
            // nouveau 50 % : on replace l'ordre avec le lot recalculé
            if(trade.OrderDelete(ord)) { Msg("la jambe s'allonge : ordre déplacé au nouveau 50 %"); Placer(); }
           }
        }
      return;
     }
   if(pos != 0 || g_tradeFait) return;
   // armé ou automatique : on place dès que la fenêtre est ouverte
   static datetime essai = 0;
   if(S.etape == E_PRET && now >= g_t10 && now < g_t11 && (g_arme || g_auto) && TimeLocal() - essai >= 30)
     {
      essai = TimeLocal();
      Placer();
     }
  }

//+------------------------------------------------------------------+
//| Dessin                                                           |
//+------------------------------------------------------------------+
void Seg(string name, long t1, long t2, double price, color c, int style, int width, string label)
  {
   string n = PFX + name;
   if(ObjectFind(0, n) < 0) ObjectCreate(0, n, OBJ_TREND, 0, ToSrv(t1), price, ToSrv(t2), price);
   ObjectSetInteger(0, n, OBJPROP_TIME, 0, ToSrv(t1)); ObjectSetDouble(0, n, OBJPROP_PRICE, 0, price);
   ObjectSetInteger(0, n, OBJPROP_TIME, 1, ToSrv(t2)); ObjectSetDouble(0, n, OBJPROP_PRICE, 1, price);
   ObjectSetInteger(0, n, OBJPROP_COLOR, c); ObjectSetInteger(0, n, OBJPROP_STYLE, style); ObjectSetInteger(0, n, OBJPROP_WIDTH, width);
   ObjectSetInteger(0, n, OBJPROP_RAY_RIGHT, false); ObjectSetInteger(0, n, OBJPROP_SELECTABLE, false); ObjectSetInteger(0, n, OBJPROP_BACK, true);
   string tn = n + "_t";
   if(label == "") { ObjectDelete(0, tn); return; }
   if(ObjectFind(0, tn) < 0) ObjectCreate(0, tn, OBJ_TEXT, 0, ToSrv(t2), price);
   ObjectSetInteger(0, tn, OBJPROP_TIME, 0, ToSrv(t2)); ObjectSetDouble(0, tn, OBJPROP_PRICE, 0, price);
   ObjectSetString(0, tn, OBJPROP_TEXT, " " + label); ObjectSetInteger(0, tn, OBJPROP_COLOR, c);
   ObjectSetInteger(0, tn, OBJPROP_FONTSIZE, 8); ObjectSetInteger(0, tn, OBJPROP_ANCHOR, ANCHOR_LEFT); ObjectSetInteger(0, tn, OBJPROP_SELECTABLE, false);
  }
void VLine(string name, long t, color c, string label)
  {
   string n = PFX + name;
   if(ObjectFind(0, n) < 0) ObjectCreate(0, n, OBJ_VLINE, 0, ToSrv(t), 0);
   ObjectSetInteger(0, n, OBJPROP_TIME, 0, ToSrv(t)); ObjectSetInteger(0, n, OBJPROP_COLOR, c);
   ObjectSetInteger(0, n, OBJPROP_STYLE, STYLE_DOT); ObjectSetInteger(0, n, OBJPROP_BACK, true); ObjectSetInteger(0, n, OBJPROP_SELECTABLE, false);
   ObjectSetString(0, n, OBJPROP_TEXT, label);
  }
void Rect(string name, long t1, long t2, double p1, double p2, color c)
  {
   string n = PFX + name;
   if(ObjectFind(0, n) < 0) ObjectCreate(0, n, OBJ_RECTANGLE, 0, ToSrv(t1), p1, ToSrv(t2), p2);
   ObjectSetInteger(0, n, OBJPROP_TIME, 0, ToSrv(t1)); ObjectSetDouble(0, n, OBJPROP_PRICE, 0, p1);
   ObjectSetInteger(0, n, OBJPROP_TIME, 1, ToSrv(t2)); ObjectSetDouble(0, n, OBJPROP_PRICE, 1, p2);
   ObjectSetInteger(0, n, OBJPROP_COLOR, c); ObjectSetInteger(0, n, OBJPROP_FILL, true); ObjectSetInteger(0, n, OBJPROP_BACK, true); ObjectSetInteger(0, n, OBJPROP_SELECTABLE, false);
  }
void Mark(string name, long t, double price, int code, color c, string label)
  {
   string n = PFX + name;
   if(ObjectFind(0, n) < 0) ObjectCreate(0, n, OBJ_ARROW, 0, ToSrv(t), price);
   ObjectSetInteger(0, n, OBJPROP_TIME, 0, ToSrv(t)); ObjectSetDouble(0, n, OBJPROP_PRICE, 0, price);
   ObjectSetInteger(0, n, OBJPROP_ARROWCODE, code); ObjectSetInteger(0, n, OBJPROP_COLOR, c); ObjectSetInteger(0, n, OBJPROP_WIDTH, 2); ObjectSetInteger(0, n, OBJPROP_SELECTABLE, false);
   ObjectSetString(0, n, OBJPROP_TOOLTIP, label);
  }
void Efface(string name) { ObjectDelete(0, PFX + name); ObjectDelete(0, PFX + name + "_t"); }

void Dessiner()
  {
   if(g_t930 == 0) return;
   VLine("v930", g_t930, clrGray, "9:30 NY");
   VLine("v10", g_t10, clrGoldenrod, "10:00 NY : début des entrées");
   VLine("v11", g_t11, clrGoldenrod, "11:00 NY : fin des entrées");
   VLine("v13", g_t13, clrIndianRed, "13:00 NY : sortie");
   if(P.judasMin > 0) VLine("v950", g_t950, clrOrange, "9:50 NY : Judas valable après"); else Efface("v950");
   if(g_preHi > g_preLo)
     {
      Rect("pre", g_t800, g_t930, g_preHi, g_preLo, (color)0x2A2238);
      Seg("preHi", g_t800, g_t13, g_preHi, clrSlateGray, STYLE_DASH, 1, "Haut du pré-marché" + (g_dir < 0 ? " = liquidité visée" : ""));
      Seg("preLo", g_t800, g_t13, g_preLo, clrSlateGray, STYLE_DASH, 1, "Bas du pré-marché" + (g_dir > 0 ? " = liquidité visée" : ""));
     }
   bool judas = S.etape >= E_CASSURE && S.extT > 0;
   if(judas) Mark("ext", S.extT, S.ext, g_dir > 0 ? 233 : 234, clrTomato, "Judas"); else Efface("ext");
   if(judas && S.swT > 0) Seg("sw", S.swT, (long)MathMax((double)S.mssT, (double)NowUtc()) + 300, S.sw, clrGold, STYLE_SOLID, 1, "Niveau de cassure (MSS)"); else Efface("sw");
   bool niveaux = S.etape >= E_PRET;
   if(niveaux)
     {
      Mark("mss", S.mssT, S.sw, 159, clrGold, "Cassure validée");
      double r = MathAbs(S.entry - S.sl);
      Seg("f0", S.extT, g_t13, S.ext, clrMediumPurple, STYLE_DOT, 1, "Fibo 0 % (Judas)");
      Seg("f100", S.extT, g_t13, S.far, clrMediumPurple, STYLE_DOT, 1, "Fibo 100 %");
      Seg("entry", S.mssT, g_t13, S.entry, clrOrange, STYLE_SOLID, 2, "Entrée 50 % " + Px(S.entry));
      Seg("sl", S.mssT, g_t13, S.sl, clrRed, STYLE_SOLID, 2, "SL " + Px(S.sl));
      double tps[3] = {2.0, 2.5, 3.0};
      for(int k = 0; k < 3; k++)
        {
         double tp = S.entry + g_dir * tps[k] * r;
         bool sel = MathAbs(tps[k] - g_tp) < 0.01;
         Seg("tp" + IntegerToString(k), S.mssT, g_t13, tp, sel ? clrLimeGreen : clrDarkGreen, sel ? STYLE_SOLID : STYLE_DOT, sel ? 2 : 1, "TP " + Fr(tps[k], 1) + "R " + Px(tp));
        }
     }
   else { Efface("mss"); Efface("f0"); Efface("f100"); Efface("entry"); Efface("sl"); Efface("tp0"); Efface("tp1"); Efface("tp2"); }
   ChartRedraw();
  }

//+------------------------------------------------------------------+
//| Panneau                                                          |
//+------------------------------------------------------------------+
int PX0 = 10, PY0 = 22, PW = 420;
void Lbl(int row, string text, color c, int size = 9, string font = "Arial")
  {
   string n = PFX + "L" + IntegerToString(row);
   if(ObjectFind(0, n) < 0) ObjectCreate(0, n, OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, n, OBJPROP_CORNER, InpCoin == 1 ? CORNER_RIGHT_UPPER : CORNER_LEFT_UPPER);
   ObjectSetInteger(0, n, OBJPROP_ANCHOR, InpCoin == 1 ? ANCHOR_RIGHT_UPPER : ANCHOR_LEFT_UPPER);
   ObjectSetInteger(0, n, OBJPROP_XDISTANCE, PX0 + 10); ObjectSetInteger(0, n, OBJPROP_YDISTANCE, PY0 + 8 + row * 17);
   ObjectSetString(0, n, OBJPROP_TEXT, text); ObjectSetString(0, n, OBJPROP_FONT, font);
   ObjectSetInteger(0, n, OBJPROP_FONTSIZE, size); ObjectSetInteger(0, n, OBJPROP_COLOR, c); ObjectSetInteger(0, n, OBJPROP_SELECTABLE, false);
  }
void Btn(string id, int x, int y, int w, string text, color bg, color fg)
  {
   string n = PFX + "B" + id;
   if(ObjectFind(0, n) < 0) ObjectCreate(0, n, OBJ_BUTTON, 0, 0, 0);
   ObjectSetInteger(0, n, OBJPROP_CORNER, InpCoin == 1 ? CORNER_RIGHT_UPPER : CORNER_LEFT_UPPER);
   ObjectSetInteger(0, n, OBJPROP_XDISTANCE, InpCoin == 1 ? PX0 + PW - 10 - x : PX0 + 10 + x); ObjectSetInteger(0, n, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, n, OBJPROP_XSIZE, w); ObjectSetInteger(0, n, OBJPROP_YSIZE, 24);
   ObjectSetString(0, n, OBJPROP_TEXT, text); ObjectSetString(0, n, OBJPROP_FONT, "Arial Bold"); ObjectSetInteger(0, n, OBJPROP_FONTSIZE, 9);
   ObjectSetInteger(0, n, OBJPROP_BGCOLOR, bg); ObjectSetInteger(0, n, OBJPROP_COLOR, fg); ObjectSetInteger(0, n, OBJPROP_BORDER_COLOR, clrDimGray);
   ObjectSetInteger(0, n, OBJPROP_STATE, false); ObjectSetInteger(0, n, OBJPROP_SELECTABLE, false);
  }
string Sens(int v) { return v > 0 ? "haussière" : (v < 0 ? "baissière" : "neutre"); }
color  CSens(int v) { return v > 0 ? clrMediumSeaGreen : (v < 0 ? clrTomato : clrSilver); }

void Panneau()
  {
   string bg = PFX + "BG";
   int rows = 14;
   if(ObjectFind(0, bg) < 0) ObjectCreate(0, bg, OBJ_RECTANGLE_LABEL, 0, 0, 0);
   ObjectSetInteger(0, bg, OBJPROP_CORNER, InpCoin == 1 ? CORNER_RIGHT_UPPER : CORNER_LEFT_UPPER);
   ObjectSetInteger(0, bg, OBJPROP_XDISTANCE, InpCoin == 1 ? PX0 + PW : PX0); ObjectSetInteger(0, bg, OBJPROP_YDISTANCE, PY0);
   ObjectSetInteger(0, bg, OBJPROP_XSIZE, PW); ObjectSetInteger(0, bg, OBJPROP_YSIZE, 8 + rows * 17 + 70);
   ObjectSetInteger(0, bg, OBJPROP_BGCOLOR, (color)0x1C1712); ObjectSetInteger(0, bg, OBJPROP_BORDER_TYPE, BORDER_FLAT);
   ObjectSetInteger(0, bg, OBJPROP_COLOR, P.couleur); ObjectSetInteger(0, bg, OBJPROP_SELECTABLE, false);

   long now = NowUtc();
   int d = g_dir;
   Lbl(0, "DESK KEY · " + P.nom + " · règle A", P.couleur, 11, "Arial Black");
   Lbl(1, "NY " + Hm(NyLocal(now)) + "  ·  Paris " + Hm(ParisLocal(now)) + "  ·  entrées 10:00–11:00 NY (" + Hm(ParisLocal(g_t10)) + "–" + Hm(ParisLocal(g_t11)) + " Paris)", clrSilver);
   string tend = "Tendance : H4 " + Sens(g_h4);
   if(P.daily) tend += " · Daily " + Sens(g_d1);
   else tend += " · H1 " + Sens(g_h1) + (InpFiltreH1 ? " (filtre H1 actif)" : "");
   Lbl(2, tend, CSens(d));
   Lbl(3, d > 0 ? "→ ACHATS uniquement" : (d < 0 ? "→ VENTES uniquement" : "→ PAS DE TRADE aujourd'hui : " + g_raison), CSens(d), 10, "Arial Bold");
   if(g_preHi > g_preLo)
      Lbl(4, "Pré-marché (8:00–9:30 NY) : haut " + Px(g_preHi) + " · bas " + Px(g_preLo) + (d != 0 ? " · cible : le " + (d > 0 ? "bas" : "haut") : ""), clrSilver);
   else Lbl(4, "Pré-marché : en attente des données", clrSilver);
   // Judas
   if(S.etape >= E_CASSURE && S.sweepT > 0)
      Lbl(5, "1. Judas OK à " + Hm(ParisLocal(S.sweepT)) + " Paris · extrême " + Px(S.ext) + " à " + Hm(ParisLocal(S.extT)), clrMediumSeaGreen);
   else Lbl(5, "1. Judas : le prix doit passer " + (d > 0 ? "sous le bas" : (d < 0 ? "au-dessus du haut" : "au-delà")) + " du pré-marché", clrSilver);
   // cassure + règle propre au profil
   string rule = P.judasMin > 0 ? "fond du Judas après 9:50 NY (" + Hm(ParisLocal(g_t950)) + " Paris)" : "cassure nette ≥ 5 % du risque + FVG M1";
   if(S.etape >= E_PRET)
     {
      string c = "2. Cassure OK à " + Hm(ParisLocal(S.mssT)) + " Paris · niveau " + Px(S.sw);
      if(P.cassureMin > 0) c += " · +" + Fr(S.cassurePts, 1) + " pts (min " + Fr(S.cassureMinPts, 1) + ")";
      Lbl(6, c, clrMediumSeaGreen);
     }
   else if(S.etape == E_CASSURE) Lbl(6, "2. Cassure : clôture M1 au-delà de " + Px(S.sw) + " · " + rule, clrGold);
   else Lbl(6, "2. Cassure M1 · " + rule, clrSilver);
   Lbl(7, S.info != "" ? "   " + S.info : " ", clrOrange);
   // ordre
   if(S.etape >= E_PRET && S.etape != E_IGNORE)
     {
      double r = MathAbs(S.entry - S.sl), lots = Lot(NormPx(S.entry), NormPx(S.sl));
      Lbl(8, "3. " + (d > 0 ? "ACHAT" : "VENTE") + " LIMITE " + Px(S.entry) + " · SL " + Px(S.sl) + " · TP " + Px(TpPrix()) + " (" + Fr(g_tp, 1) + "R)", clrOrange, 10, "Arial Bold");
      Lbl(9, "   Lot " + Fr(lots, 2) + " · risque " + Fr(RisqueArgent(NormPx(S.entry), NormPx(S.sl), lots), 0) + " " + AccountInfoString(ACCOUNT_CURRENCY) + " · " + Fr(r, 1) + " pts", clrWhite);
     }
   else { Lbl(8, "3. Ordre : en attente du setup", clrSilver); Lbl(9, " ", clrSilver); }
   // état
   string etat; color ce = clrSilver;
   ulong ord = MonOrdre(), pos = MaPosition();
   if(pos != 0) { etat = "EN POSITION · sortie TP, SL ou 13:00 NY"; ce = clrDeepSkyBlue; }
   else if(ord != 0) { etat = "ORDRE PLACÉ · annulé à 11:00 NY s'il n'est pas rempli"; ce = clrDeepSkyBlue; }
   else if(g_tradeFait) { etat = "TERMINÉ · trade du jour déjà pris"; }
   else switch(S.etape)
     {
      case E_AVANT:     etat = "AVANT L'OUVERTURE"; break;
      case E_PAS_TRADE: etat = "PAS DE TRADE AUJOURD'HUI"; break;
      case E_JUDAS:     etat = "ATTENTE DU JUDAS"; break;
      case E_CASSURE:   etat = "ATTENTE DE LA CASSURE"; ce = clrGold; break;
      case E_PRET:      if(now < g_t10) { etat = g_arme || g_auto ? "ARMÉ · l'ordre partira à 10:00 NY" : "SETUP PRÊT · appuyez sur " + InpTouche + " pour l'armer (départ 10:00 NY)"; ce = clrGold; }
                        else { etat = g_auto ? "AUTO · placement en cours" : "PRÊT · appuyez sur " + InpTouche + " pour placer l'ordre"; ce = clrLimeGreen; }
                        break;
      case E_TOUCHE:    etat = "NIVEAU TOUCHÉ à " + Hm(ParisLocal(S.fillT)) + " Paris (sans ordre de votre part)"; break;
      case E_IGNORE:    etat = "IGNORÉ · le 50 % a été touché avant 10:00 NY"; break;
      case E_EXPIRE:    etat = "EXPIRÉ · pas de remplissage avant 11:00 NY"; break;
      default:          etat = "PAS DE SETUP AUJOURD'HUI"; break;
     }
   Lbl(10, "État : " + etat, ce, 10, "Arial Bold");
   Lbl(11, g_msg != "" && TimeLocal() - g_msgT < 120 ? "› " + g_msg : " ", clrLightSkyBlue);
   Lbl(12, "Profil " + P.nom + " : stop Judas ± " + Fr(P.marge, 1) + " pts · " + (P.fvg ? "FVG obligatoire" : "sans FVG") + " · " + (P.daily ? "H4 + Daily" : "H4"), clrDimGray, 8);
   Lbl(13, "Touches : " + InpTouche + " = placer / armer · " + InpToucheAnnul + " = annuler · un seul trade par jour", clrDimGray, 8);
   int by = PY0 + 8 + rows * 17 + 6;
   bool pret = S.etape == E_PRET && ord == 0 && pos == 0 && !g_tradeFait && now < g_t11;
   Btn("GO", 0, by, 190, now < g_t10 ? (g_arme ? "ARMÉ OK" : "ARMER (" + InpTouche + ")") : "PLACER L'ORDRE (" + InpTouche + ")", pret ? clrForestGreen : clrDimGray, clrWhite);
   Btn("X", 196, by, 90, "ANNULER (" + InpToucheAnnul + ")", ord != 0 || g_arme ? clrFireBrick : clrDimGray, clrWhite);
   Btn("AUTO", 292, by, 108, g_auto ? "AUTO : OUI" : "AUTO : NON", g_auto ? clrDarkOrange : clrDimGray, clrWhite);
   Btn("T2", 0, by + 30, 60, "2R", MathAbs(g_tp - 2.0) < 0.01 ? P.couleur : clrDimGray, clrWhite);
   Btn("T25", 66, by + 30, 60, "2,5R", MathAbs(g_tp - 2.5) < 0.01 ? P.couleur : clrDimGray, clrWhite);
   Btn("T3", 132, by + 30, 60, "3R", MathAbs(g_tp - 3.0) < 0.01 ? P.couleur : clrDimGray, clrWhite);
   ChartRedraw();
  }

//+------------------------------------------------------------------+
//| Boucle                                                           |
//+------------------------------------------------------------------+
bool ChoisirProfil()
  {
   string s = _Symbol; StringToUpper(s);
   int pf = InpProfil;
   bool isNq = StringFind(s, "US100") >= 0 || StringFind(s, "NAS100") >= 0 || StringFind(s, "USTEC") >= 0 || StringFind(s, "NDX") >= 0;
   bool isSp = StringFind(s, "US500") >= 0 || StringFind(s, "SPX") >= 0 || StringFind(s, "SP500") >= 0 || StringFind(s, "US.500") >= 0;
   if(pf == PROFIL_AUTO) pf = isNq ? PROFIL_US100 : (isSp ? PROFIL_SP500 : 0);
   if(pf == PROFIL_US100 && !isNq) { Alert("Desk Key : le profil US100 ne peut pas tourner sur ", _Symbol); return false; }
   if(pf == PROFIL_SP500 && !isSp) { Alert("Desk Key : le profil SP500 ne peut pas tourner sur ", _Symbol); return false; }
   if(pf == PROFIL_US100)
     { P.nom = "US100"; P.fvg = true;  P.marge = 3.0; P.cassureMin = 0.05; P.judasMin = 0;  P.daily = false; P.magic = 7710100; P.couleur = clrDodgerBlue; }
   else if(pf == PROFIL_SP500)
     { P.nom = "SP500"; P.fvg = false; P.marge = 2.0; P.cassureMin = 0;    P.judasMin = 20; P.daily = true;  P.magic = 7710500; P.couleur = clrDarkOrange; }
   else { Alert("Desk Key : symbole ", _Symbol, " non reconnu. Choisissez le profil US100 ou SP500."); return false; }
   PFX = "DK_" + P.nom + "_";
   return true;
  }

void Tick()
  {
   UpdateServerOffset();
   long now = NowUtc();
   long ny = NyLocal(now);
   MqlDateTime t; TimeToStruct((datetime)ny, t);
   string jour = StringFormat("%04d-%02d-%02d", t.year, t.mon, t.day);
   // contexte provisoire avant 9:26 NY (horaires, tendance partielle), définitif après
   string cle = jour + (ny >= (long)MkTime(t.year, t.mon, t.day, 9, 26) ? "F" : "P");
   if(cle != g_jour)
     {
      g_jour = cle;
      ContexteDuJour(t.year, t.mon, t.day);
      g_lastBar = 0;
     }
   datetime cur = iTime(_Symbol, PERIOD_M1, 0);
   if(cur != g_lastBar)
     {
      g_lastBar = cur;
      g_n = LoadM1(g_t800 - 90 * 60, (long)cur - g_srvOff - 1, B);
      Scan();
      Dessiner();
     }
   Gerer();
   Panneau();
  }

int OnInit()
  {
   if(!ChoisirProfil()) return INIT_PARAMETERS_INCORRECT;
   trade.SetExpertMagicNumber(P.magic);
   trade.SetTypeFillingBySymbol(_Symbol);
   trade.SetDeviationInPoints(50);
   g_auto = InpAuto;
   g_tp = (InpTP == 2.0 || InpTP == 2.5 || InpTP == 3.0) ? InpTP : 3.0;
   UpdateServerOffset();
   EventSetTimer(1);
   Tick();
   return INIT_SUCCEEDED;
  }
void OnDeinit(const int reason)
  {
   EventKillTimer();
   ObjectsDeleteAll(0, PFX);
   ChartRedraw();
  }
void OnTimer() { Tick(); }
void OnTick()  { if(MQLInfoInteger(MQL_TESTER)) Tick(); }

void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam)
  {
   if(id == CHARTEVENT_KEYDOWN)
     {
      string k1 = InpTouche, k2 = InpToucheAnnul; StringToUpper(k1); StringToUpper(k2);
      if(StringLen(k1) > 0 && lparam == StringGetCharacter(k1, 0)) { Placer(); Panneau(); }
      if(StringLen(k2) > 0 && lparam == StringGetCharacter(k2, 0)) { Annuler("à votre demande"); Panneau(); }
     }
   if(id == CHARTEVENT_OBJECT_CLICK && StringFind(sparam, PFX + "B") == 0)
     {
      string b = StringSubstr(sparam, StringLen(PFX) + 1);
      if(b == "GO") Placer();
      else if(b == "X") Annuler("à votre demande");
      else if(b == "AUTO")
        {
         g_auto = !g_auto;
         Msg(g_auto ? "mode automatique ACTIVÉ" : "mode automatique désactivé");
        }
      else if(b == "T2") g_tp = 2.0;
      else if(b == "T25") g_tp = 2.5;
      else if(b == "T3") g_tp = 3.0;
      ObjectSetInteger(0, sparam, OBJPROP_STATE, false);
      Dessiner();
      Panneau();
     }
  }
//+------------------------------------------------------------------+
