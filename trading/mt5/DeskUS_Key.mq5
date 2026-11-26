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
//|  - Dessine le setup du jour et ceux des 7 derniers jours (avec   |
//|    leur résultat), et envoie les niveaux à l'application.        |
//+------------------------------------------------------------------+
#property copyright "Desk US"
#property version   "1.03"
#property description "Règle A Desk US (US100 / SP500) : détection, dessin, historique et exécution en une touche."

#include <Trade\Trade.mqh>

#define DK_VERSION "1.03"

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
input bool           InpProtection  = false;           // Protection annonces FTMO (aucun ordre autour des annonces US)
input int            InpProtMin     = 2;               // Protection : minutes avant et après chaque annonce
input int            InpHistJours   = 7;               // Setups des N derniers jours affichés (0 = aucun)
input bool           InpEnvoyer     = true;            // Envoyer les setups à l'application Desk US
input string         InpKey         = "";              // Clé Desk US (vide = reprise du robot DeskUS_Bridge)
input ENUM_DK_HEURE  InpHeure       = HEURE_AUTO;      // Heure du serveur
input int            InpCoin        = 0;               // Coin du panneau (0 = haut gauche, 1 = haut droit)

const string URL_SETUP = "https://xakrdapoxthvvqpyjuji.supabase.co/rest/v1/rpc/desk_setup_push";
const string API_KEY   = "sb_publishable_Hzn2bTrae-TflG_HCzLVWg_QYF4l0ec";
const string URL_EVENTS = "https://xakrdapoxthvvqpyjuji.supabase.co/rest/v1/rpc/desk_events_read";

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

struct Bar { long t; double o, h, l, c; };

//--- Contexte d'une journée -------------------------------------------
struct Ctx
  {
   int               y, mo, d;
   long              t800, t925, t930, t950, t10, t11, t13;
   int               h4, d1, h1, dir;
   string            raison;
   bool              ok;
  };

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
   string            info;
   bool              ok;        // cassure validée : niveaux d'ordre connus
   double            preHi, preLo, L, ext, sw, far, entry, sl;
   long              sweepT, extT, swT, mssT, farT, fillT;
   int               fillI;
   bool              fvg;
   double            cassurePts, cassureMinPts;
   double            r2, r25, r3;  // résultat simulé (R) à 2R, 2,5R, 3R
   long              exitT;        // sortie (objectif choisi)
   bool              fini;         // résultat définitif
  };

//--- État global ------------------------------------------------------
CTrade   trade;
long     g_srvOff   = 0;
string   g_jour     = "";      // date NY du jour traité (+ P provisoire / F définitif)
Ctx      G;                    // contexte du jour
Setup    S;                    // setup du jour
Bar      B[];                  // bougies M1 du jour (fermées)
int      g_n = 0;
datetime g_lastBar  = 0;
bool     g_arme     = false;
bool     g_auto     = false;
double   g_tp       = 3.0;
bool     g_tradeFait = false;
bool     g_reduit   = false;
bool     g_histo    = true;
string   g_msg      = "";
datetime g_msgT     = 0;
string   PFX        = "DK_";
string   g_key      = "";
string   g_lastPush = "";
datetime g_lastPushT = 0;
string   g_pushErr  = "";
string   g_histJour = "";
bool     g_protect  = false;   // protection annonces active
long     g_evT[];              // annonces du jour (UTC)
string   g_evNom[];
string   g_evJour   = "";

//+------------------------------------------------------------------+
//| Heures                                                           |
//+------------------------------------------------------------------+
datetime MkTime(int y, int mo, int d, int h, int mi)
  {
   MqlDateTime t; t.year = y; t.mon = mo; t.day = d; t.hour = h; t.min = mi; t.sec = 0;
   return StructToTime(t);
  }
long NthSundayUtc(int y, int mo, int n, int hh)
  {
   datetime d1 = MkTime(y, mo, 1, 0, 0);
   MqlDateTime t; TimeToStruct(d1, t);
   int first = (7 - t.day_of_week) % 7;
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
long     NowUtc()        { return (long)TimeTradeServer() - g_srvOff; }
datetime ToSrv(long utc) { return (datetime)(utc + g_srvOff); }

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
string Q(string s) { StringReplace(s, "\\", "\\\\"); StringReplace(s, "\"", "\\\""); return "\"" + s + "\""; }
string N(double v, int dg) { if(!MathIsValidNumber(v) || v == DBL_MAX || v == -DBL_MAX) return "null"; return DoubleToString(v, dg); }
string I(long v) { return IntegerToString(v); }
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
// bougies de `secs` secondes (décalage `off`) finies avant `fin`, les `keep` dernières
int Aggregate(Bar &m[], int n, long secs, long off, long fin, Bar &out[], int keep)
  {
   Bar tmp[]; ArrayResize(tmp, 0, 4096);
   int cnt = 0; long curK = -1;
   for(int i = 0; i < n && m[i].t < fin; i++)
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
//| Contexte d'une journée (m = M1 couvrant au moins 40 jours avant) |
//+------------------------------------------------------------------+
void BuildCtx(Bar &m[], int n, int y, int mo, int d, Ctx &c)
  {
   c.y = y; c.mo = mo; c.d = d;
   c.t800 = NyToUtc(y, mo, d, 8, 0);  c.t930 = NyToUtc(y, mo, d, 9, 30); c.t925 = c.t930 - 300; c.t950 = c.t930 + 20 * 60;
   c.t10  = NyToUtc(y, mo, d, 10, 0); c.t11  = NyToUtc(y, mo, d, 11, 0); c.t13  = NyToUtc(y, mo, d, 13, 0);
   Bar h4[], h1[];
   int n4 = Aggregate(m, n, 14400, 7200, c.t925, h4, 60);
   int n1 = Aggregate(m, n, 3600, 0, c.t925, h1, 60);
   c.h4 = TrendOf(h4, n4);
   c.h1 = TrendOf(h1, n1);
   // Daily : prix avant 9:25 contre la moyenne des 10 dernières clôtures (16:00 NY)
   double closes[]; int nc = 0; int lastDay = -1;
   for(int i = 0; i < n && m[i].t < c.t930; i++)
     {
      MqlDateTime t; TimeToStruct((datetime)m[i].t, t);
      int key = t.year * 10000 + t.mon * 100 + t.day;
      if(key == lastDay) continue;
      lastDay = key;
      if(t.day_of_week == 0 || t.day_of_week == 6) continue;
      long o930 = NyToUtc(t.year, t.mon, t.day, 9, 30), o16 = NyToUtc(t.year, t.mon, t.day, 16, 0);
      if(o930 >= c.t930) continue;
      int a = Lb(m, n, o930);
      if(a >= n || m[a].t != o930) continue;
      int z = Lb(m, n, o16) - 1;
      if(z < 0) continue;
      nc++; ArrayResize(closes, nc, 64); closes[nc - 1] = m[z].c;
     }
   c.d1 = 0;
   int iB = Lb(m, n, c.t925) - 1;
   if(nc >= 15 && iB >= 0)
     {
      double px = m[iB].c, sN = 0, sP = 0;
      for(int i = nc - 10; i < nc; i++) sN += closes[i];
      for(int i = nc - 15; i < nc - 5; i++) sP += closes[i];
      sN /= 10.0; sP /= 10.0;
      c.d1 = (px > sN && sN > sP) ? 1 : ((px < sN && sN < sP) ? -1 : 0);
     }
   c.dir = 0; c.raison = "";
   if(P.daily)
     {
      if(nc < 15) c.raison = "historique Daily insuffisant";
      else if(c.h4 == 0) c.raison = "H4 sans tendance";
      else if(c.d1 != c.h4) c.raison = "H4 et Daily pas d'accord";
      else c.dir = c.h4;
     }
   else
     {
      if(c.h4 == 0) c.raison = "H4 sans tendance";
      else c.dir = c.h4;
     }
   if(c.dir != 0 && InpFiltreH1 && !P.daily && c.h1 == -c.dir) { c.raison = "H1 contre le trade (filtre)"; c.dir = 0; }
   c.ok = true;
  }

//+------------------------------------------------------------------+
//| Résultat simulé (copie de sim() du backtest)                     |
//+------------------------------------------------------------------+
double SimR(Bar &b[], int n, int k, int d, double entry, double sl, double tpR, long tEnd, long &exitT, bool &fini)
  {
   double risk = MathAbs(entry - sl), tp = entry + d * tpR * risk, last = entry;
   fini = true; exitT = b[k].t;
   if(d > 0 ? b[k].l <= sl : b[k].h >= sl) return -1;
   for(int j = k + 1; j < n && b[j].t < tEnd; j++)
     {
      exitT = b[j].t;
      if(d > 0 ? b[j].l <= sl : b[j].h >= sl) return -1;
      if(d > 0 ? b[j].h >= tp : b[j].l <= tp) return tpR;
      last = b[j].c;
     }
   if(n == 0 || b[n - 1].t < tEnd - 60) fini = false;   // séance pas finie : résultat provisoire
   exitT = tEnd;
   return NormalizeDouble((last - entry) * d / risk, 2);
  }

//+------------------------------------------------------------------+
//| Recherche du setup d'une journée (copie de setup() du backtest)  |
//+------------------------------------------------------------------+
void ScanDay(Bar &b[], int n, Ctx &c, long now, Setup &s)
  {
   s.etape = E_AVANT; s.info = ""; s.ok = false; s.fillT = 0; s.fillI = -1; s.mssT = 0; s.sweepT = 0; s.extT = 0; s.swT = 0;
   s.cassurePts = 0; s.cassureMinPts = 0; s.fvg = false; s.r2 = 0; s.r25 = 0; s.r3 = 0; s.exitT = 0; s.fini = false;
   s.preHi = -DBL_MAX; s.preLo = DBL_MAX;
   for(int i = Lb(b, n, c.t800); i < n && b[i].t < c.t930; i++) { s.preHi = MathMax(s.preHi, b[i].h); s.preLo = MathMin(s.preLo, b[i].l); }
   if(now < c.t930 || s.preHi < s.preLo) { s.etape = E_AVANT; return; }
   if(c.dir == 0) { s.etape = E_PAS_TRADE; s.info = c.raison; s.fini = true; return; }
   int d = c.dir;
   s.L = d < 0 ? s.preHi : s.preLo;
   int i0 = Lb(b, n, c.t930);
   s.etape = E_JUDAS;
   if(i0 >= n) return;
   double ext = d < 0 ? -DBL_MAX : DBL_MAX; int extI = -1; bool swept = false;
   for(int i = i0; i < n && b[i].t < c.t11; i++)
     {
      if(d < 0 ? b[i].h > ext : b[i].l < ext) { ext = d < 0 ? b[i].h : b[i].l; extI = i; }
      if(d < 0 ? ext > s.L : ext < s.L) { if(!swept) s.sweepT = b[i].t; swept = true; }
      if(!swept) continue;
      s.etape = E_CASSURE; s.ext = ext; s.extT = b[extI].t;
      if(i <= extI) continue;
      double sw = 0; bool found = false; int swI = -1;
      for(int k = extI - 2; k >= MathMax(2, i0 - 60); k--)
        {
         bool piv = d < 0
                    ? (b[k].l < b[k - 1].l && b[k].l < b[k - 2].l && b[k].l <= b[k + 1].l && b[k].l <= b[k + 2].l)
                    : (b[k].h > b[k - 1].h && b[k].h > b[k - 2].h && b[k].h >= b[k + 1].h && b[k].h >= b[k + 2].h);
         if(piv) { sw = d < 0 ? b[k].l : b[k].h; swI = k; found = true; break; }
        }
      if(!found)
        {
         sw = d < 0 ? DBL_MAX : -DBL_MAX;
         for(int k = i0; k <= extI; k++) sw = d < 0 ? MathMin(sw, b[k].l) : MathMax(sw, b[k].h);
         swI = i0;
        }
      s.sw = sw; s.swT = b[swI].t;
      if(!(d < 0 ? b[i].c < sw : b[i].c > sw)) continue;
      if(P.judasMin > 0 && b[extI].t < c.t930 + P.judasMin * 60)
        { s.info = "cassure refusée : extrême du Judas à " + Hm(ParisLocal(b[extI].t)) + " Paris, trop tôt"; continue; }
      int fvgEnd = -1;
      for(int k = extI + 1; k <= i && k + 1 < n; k++)
         if((d < 0 && b[k - 1].l > b[k + 1].h) || (d > 0 && b[k - 1].h < b[k + 1].l)) { fvgEnd = k + 1; break; }
      if(P.fvg && fvgEnd < 0) { s.info = "cassure sans FVG M1 (en attente)"; continue; }
      int last = P.fvg ? MathMax(i, fvgEnd) : i;
      double far = d < 0 ? DBL_MAX : -DBL_MAX; long farT = 0;
      for(int k = extI; k <= last; k++)
        {
         double v = d < 0 ? b[k].l : b[k].h;
         if(d < 0 ? v < far : v > far) { far = v; farT = b[k].t; }
        }
      double entry = far + (ext - far) * 0.5;
      double sl = d < 0 ? ext + P.marge : ext - P.marge;
      double brk = (b[i].c - sw) * d;
      if(P.cassureMin > 0 && brk < P.cassureMin * MathAbs(entry - sl))
        { s.info = "cassure refusée : +" + Fr(brk, 1) + " pts, il faut " + Fr(P.cassureMin * MathAbs(entry - sl), 1) + " pts"; continue; }
      s.etape = E_PRET; s.ok = true; s.info = ""; s.mssT = b[i].t; s.fvg = fvgEnd >= 0;
      s.cassurePts = brk; s.cassureMinPts = P.cassureMin * MathAbs(entry - sl);
      s.sl = sl;
      for(int k = last + 1; k < n && b[k].t < c.t11; k++)
        {
         if(d < 0 ? b[k].h >= entry : b[k].l <= entry)
           {
            s.far = far; s.farT = farT; s.entry = entry; s.fillT = b[k].t; s.fillI = k;
            s.etape = b[k].t < c.t10 ? E_IGNORE : E_TOUCHE;
            if(s.etape == E_IGNORE) { s.fini = true; return; }
            long ex; bool f2, f25, f3;
            s.r2  = SimR(b, n, k, d, entry, sl, 2.0, c.t13, ex, f2);
            s.r25 = SimR(b, n, k, d, entry, sl, 2.5, c.t13, ex, f25);
            s.r3  = SimR(b, n, k, d, entry, sl, 3.0, c.t13, ex, f3);
            long exSel; bool fs; SimR(b, n, k, d, entry, sl, g_tp, c.t13, exSel, fs);
            s.exitT = exSel; s.fini = f2 && f25 && f3;
            return;
           }
         if(d < 0 ? b[k].l < far : b[k].h > far) { far = d < 0 ? b[k].l : b[k].h; farT = b[k].t; entry = far + (ext - far) * 0.5; }
        }
      s.far = far; s.farT = farT; s.entry = entry;
      if(now >= c.t11) { s.etape = E_EXPIRE; s.fini = true; }
      return;
     }
   if(now >= c.t11 && !s.ok) { s.etape = E_FINI; s.fini = true; }
  }

string EtapeCode(int e)
  {
   switch(e)
     {
      case E_AVANT: return "avant";
      case E_PAS_TRADE: return "pas_de_trade";
      case E_JUDAS: return "judas";
      case E_CASSURE: return "cassure";
      case E_PRET: return "pret";
      case E_TOUCHE: return "rempli";
      case E_IGNORE: return "ignore";
      case E_EXPIRE: return "expire";
     }
   return "pas_de_setup";
  }

//+------------------------------------------------------------------+
//| Annonces économiques US du jour (calendrier de l'application)    |
//+------------------------------------------------------------------+
string JsonStr(string obj, string key)
  {
   int a = StringFind(obj, "\"" + key + "\":\"");
   if(a < 0) return "";
   a += StringLen(key) + 4;
   int z = StringFind(obj, "\"", a);
   return z > a ? StringSubstr(obj, a, z - a) : "";
  }
void ChargerAnnonces(Ctx &c)
  {
   string jour = StringFormat("%04d-%02d-%02d", c.y, c.mo, c.d);
   if(jour == g_evJour || MQLInfoInteger(MQL_TESTER)) return;
   string body = "{\"p_from\":\"" + jour + "\",\"p_to\":\"" + jour + "\"}";
   char data[], result[]; string rh;
   int len = StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
   if(len > 0) ArrayResize(data, len - 1);
   int code = WebRequest("POST", URL_EVENTS, "Content-Type: application/json\r\napikey: " + API_KEY + "\r\n", 5000, data, result, rh);
   if(code < 200 || code >= 300) return;   // nouvel essai au prochain contexte
   g_evJour = jour;
   ArrayResize(g_evT, 0); ArrayResize(g_evNom, 0);
   string txt = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   string objs[];
   int n = StringSplit(txt, '}', objs);
   for(int i = 0; i < n; i++)
     {
      string tm = JsonStr(objs[i], "time"), nom = JsonStr(objs[i], "name");
      if(StringLen(tm) != 5) continue;
      int h = (int)StringToInteger(StringSubstr(tm, 0, 2)), mi = (int)StringToInteger(StringSubstr(tm, 3, 2));
      int k = ArraySize(g_evT);
      ArrayResize(g_evT, k + 1); ArrayResize(g_evNom, k + 1);
      g_evT[k] = NyToUtc(c.y, c.mo, c.d, h, mi); g_evNom[k] = nom;
     }
  }
// vrai si un ordre ne doit pas exister à l'instant t (protection active) ; renvoie l'annonce concernée
bool Bloque(long t, int &idx)
  {
   idx = -1;
   if(!g_protect) return false;
   for(int i = 0; i < ArraySize(g_evT); i++)
      if(t >= g_evT[i] - InpProtMin * 60 - 15 && t <= g_evT[i] + InpProtMin * 60) { idx = i; return true; }
   return false;
  }
string AnnoncesTexte()
  {
   string s = "";
   for(int i = 0; i < ArraySize(g_evT); i++)
     {
      if(s != "") s += " · ";
      s += Hm(NyLocal(g_evT[i])) + " NY " + g_evNom[i];
     }
   return s;
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
// trade Desk Key du jour : identifiant de position, volume, prix (0 si aucun)
long TradeDuJour(double &vol, double &px)
  {
   vol = 0; px = 0;
   if(!HistorySelect(ToSrv(G.t930 - 3600), TimeTradeServer() + 60)) return 0;
   for(int i = HistoryDealsTotal() - 1; i >= 0; i--)
     {
      ulong tk = HistoryDealGetTicket(i);
      if(tk == 0) continue;
      if(HistoryDealGetString(tk, DEAL_SYMBOL) == _Symbol && HistoryDealGetInteger(tk, DEAL_MAGIC) == P.magic
         && HistoryDealGetInteger(tk, DEAL_ENTRY) == DEAL_ENTRY_IN)
        {
         vol = HistoryDealGetDouble(tk, DEAL_VOLUME); px = HistoryDealGetDouble(tk, DEAL_PRICE);
         return HistoryDealGetInteger(tk, DEAL_POSITION_ID);
        }
     }
   return 0;
  }
bool TradeDejaFait() { double v, p; return TradeDuJour(v, p) != 0 || MaPosition() != 0; }

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
double TpPrix(Setup &s, int dir, double r) { return s.entry + dir * r * MathAbs(s.entry - s.sl); }

void Msg(string s) { g_msg = s; g_msgT = TimeLocal(); Print("Desk Key ", P.nom, " : ", s); }

bool Placer()
  {
   long now = NowUtc();
   if(S.etape != E_PRET) { Msg("pas de setup prêt"); return false; }
   if(now < G.t10) { g_arme = true; Msg("armé : l'ordre partira à 10:00 NY s'il est encore valide"); return false; }
   if(now >= G.t11) { Msg("fenêtre d'entrée terminée (11:00 NY)"); return false; }
   if(g_tradeFait || MaPosition() != 0) { Msg("déjà un trade aujourd'hui sur " + P.nom); return false; }
   int ev;
   if(Bloque(now, ev))
     {
      g_arme = true;
      Msg("annonce " + g_evNom[ev] + " à " + Hm(NyLocal(g_evT[ev])) + " NY : ordre différé à " + Hm(NyLocal(g_evT[ev] + InpProtMin * 60 + 1)) + " NY (protection)");
      return false;
     }
   double entry = NormPx(S.entry), sl = NormPx(S.sl), tp = NormPx(TpPrix(S, G.dir, g_tp));
   double lots = Lot(entry, sl);
   if(lots <= 0) { Msg("lot impossible : risque trop faible pour le lot minimum"); return false; }
   string cmt = "DeskKey " + P.nom + " " + Fr(g_tp, 1) + "R";
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK), bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   bool ok;
   if(G.dir > 0) ok = (ask <= entry) ? trade.Buy(lots, _Symbol, 0, sl, tp, cmt) : trade.BuyLimit(lots, entry, _Symbol, sl, tp, ORDER_TIME_GTC, 0, cmt);
   else          ok = (bid >= entry) ? trade.Sell(lots, _Symbol, 0, sl, tp, cmt) : trade.SellLimit(lots, entry, _Symbol, sl, tp, ORDER_TIME_GTC, 0, cmt);
   if(ok && (trade.ResultRetcode() == TRADE_RETCODE_DONE || trade.ResultRetcode() == TRADE_RETCODE_PLACED))
     {
      g_arme = false;
      Msg((G.dir > 0 ? "ACHAT" : "VENTE") + " " + Fr(lots, 2) + " lot à " + Px(entry) + " · SL " + Px(sl) + " · TP " + Px(tp));
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
   if(pos != 0 && InpSortie13h && now >= G.t13 && now < G.t13 + 6 * 3600)
     { if(trade.PositionClose(pos)) Msg("position fermée à 13:00 NY"); return; }
   if(ord != 0)
     {
      if(now >= G.t11) { Annuler("11:00 NY sans remplissage"); return; }
      int ev;
      if(Bloque(now, ev) && trade.OrderDelete(ord))
        {
         g_arme = true;   // remis automatiquement après l'annonce s'il est encore valide
         Msg("annonce " + g_evNom[ev] + " : ordre retiré, remis après " + Hm(NyLocal(g_evT[ev] + InpProtMin * 60)) + " NY");
         return;
        }
      if(S.etape == E_IGNORE || S.etape == E_EXPIRE || S.etape == E_FINI || S.etape == E_PAS_TRADE) { Annuler("setup plus valide"); return; }
      if(InpSuivreFibo && S.etape == E_PRET && OrderSelect(ord))
        {
         double px = OrderGetDouble(ORDER_PRICE_OPEN);
         double ts = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
         if(MathAbs(px - NormPx(S.entry)) >= ts)
            if(trade.OrderDelete(ord)) { Msg("la jambe s'allonge : ordre déplacé au nouveau 50 %"); Placer(); }
        }
      return;
     }
   if(pos != 0 || g_tradeFait) return;
   static datetime essai = 0;
   int evb;
   if(S.etape == E_PRET && now >= G.t10 && now < G.t11 && (g_arme || g_auto) && !Bloque(now, evb) && TimeLocal() - essai >= 30)
     {
      essai = TimeLocal();
      Placer();
     }
  }

//+------------------------------------------------------------------+
//| Envoi des setups à l'application                                 |
//+------------------------------------------------------------------+
string LireCle()
  {
   if(StringLen(InpKey) >= 32) return InpKey;
   int h = FileOpen("DeskUS\\cle.txt", FILE_READ | FILE_TXT | FILE_COMMON | FILE_ANSI);
   if(h == INVALID_HANDLE) return "";
   string k = FileReadString(h);
   FileClose(h);
   StringTrimLeft(k); StringTrimRight(k);
   return k;
  }
string SetupJson(Ctx &c, Setup &s, bool aujourdhui)
  {
   int dg = _Digits;
   string j = "{\"profile\":" + Q(P.nom) + ",\"date\":" + Q(StringFormat("%04d-%02d-%02d", c.y, c.mo, c.d)) + ",\"v\":" + Q(DK_VERSION) + ",\"sym\":" + Q(_Symbol);
   j += ",\"dir\":" + I(c.dir) + ",\"h4\":" + I(c.h4) + ",\"d1\":" + I(c.d1) + ",\"h1\":" + I(c.h1) + ",\"raison\":" + Q(c.raison);
   j += ",\"etat\":" + Q(EtapeCode(s.etape)) + ",\"info\":" + Q(s.info) + ",\"fini\":" + (s.fini ? "true" : "false");
   if(s.preHi >= s.preLo) j += ",\"pre\":{\"hi\":" + N(s.preHi, dg) + ",\"lo\":" + N(s.preLo, dg) + "}";
   if(s.sweepT > 0) j += ",\"judas\":{\"t\":" + I(s.sweepT) + ",\"ext\":" + N(s.ext, dg) + ",\"text\":" + I(s.extT) + "}";
   if(s.ok)
     {
      double r = MathAbs(s.entry - s.sl);
      j += ",\"mss\":{\"t\":" + I(s.mssT) + ",\"niveau\":" + N(s.sw, dg) + ",\"pts\":" + N(s.cassurePts, 2) + ",\"fvg\":" + (s.fvg ? "true" : "false") + "}";
      j += ",\"entry\":" + N(s.entry, dg) + ",\"sl\":" + N(s.sl, dg) + ",\"risk\":" + N(r, 2);
      j += ",\"tp\":{\"2\":" + N(TpPrix(s, c.dir, 2.0), dg) + ",\"2.5\":" + N(TpPrix(s, c.dir, 2.5), dg) + ",\"3\":" + N(TpPrix(s, c.dir, 3.0), dg) + "}";
     }
   if(s.fillT > 0) j += ",\"fill\":" + I(s.fillT);
   if(s.etape == E_TOUCHE) j += ",\"res\":{\"2\":" + N(s.r2, 2) + ",\"2.5\":" + N(s.r25, 2) + ",\"3\":" + N(s.r3, 2) + "}";
   if(aujourdhui)
     {
      if(s.ok) j += ",\"lot\":" + N(Lot(NormPx(s.entry), NormPx(s.sl)), 2) + ",\"tpR\":" + N(g_tp, 1);
      double vol, px; long pid = TradeDuJour(vol, px);
      if(pid != 0) j += ",\"pris\":{\"id\":" + I(pid) + ",\"vol\":" + N(vol, 2) + ",\"px\":" + N(px, dg) + ",\"tpR\":" + N(g_tp, 1) + "}";
      else if(MonOrdre() != 0) j += ",\"ordre\":true";
      j += ",\"auto\":" + (g_auto ? "true" : "false") + ",\"protection\":" + (g_protect ? "true" : "false");
     }
   return j + "}";
  }
bool Envoyer(string rows)
  {
   if(!InpEnvoyer || MQLInfoInteger(MQL_TESTER)) return false;
   if(g_key == "") g_key = LireCle();
   if(g_key == "") { g_pushErr = "clé Desk US absente (DeskUS_Bridge 1.05 ou réglage « Clé »)"; return false; }
   string body = "{\"p_key\":" + Q(g_key) + ",\"p_rows\":" + rows + "}";
   char data[], result[]; string rh;
   int len = StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
   if(len > 0) ArrayResize(data, len - 1);
   string headers = "Content-Type: application/json\r\napikey: " + API_KEY + "\r\n";
   ResetLastError();
   int code = WebRequest("POST", URL_SETUP, headers, 5000, data, result, rh);
   if(code == -1)
     {
      int err = GetLastError();
      g_pushErr = err == 4014 ? "autorisez https://xakrdapoxthvvqpyjuji.supabase.co (Outils > Options > Expert Advisors)" : "erreur réseau " + I(err);
      return false;
     }
   if(code < 200 || code >= 300) { g_pushErr = "erreur " + I(code) + " " + StringSubstr(CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8), 0, 80); return false; }
   g_pushErr = "";
   return true;
  }
void EnvoyerJour()
  {
   if(!G.ok) return;
   if(TimeLocal() - g_lastPushT < (g_pushErr != "" ? 60 : 5)) return;
   string row = SetupJson(G, S, true);
   if(row == g_lastPush && TimeLocal() - g_lastPushT < 120) return;
   g_lastPushT = TimeLocal();
   if(Envoyer("[" + row + "]")) g_lastPush = row;
  }

//+------------------------------------------------------------------+
//| Dessin                                                           |
//+------------------------------------------------------------------+
bool g_clair = false;
bool FondClair()
  {
   long v = ChartGetInteger(0, CHART_COLOR_BACKGROUND);
   int r = (int)(v & 0xFF), g = (int)((v >> 8) & 0xFF), b = (int)((v >> 16) & 0xFF);
   return (r * 299 + g * 587 + b * 114) / 1000 > 128;
  }
void Txt(string name, long t, double price, string text, color c, int size, ENUM_ANCHOR_POINT anchor)
  {
   string n = PFX + name;
   if(ObjectFind(0, n) < 0) ObjectCreate(0, n, OBJ_TEXT, 0, ToSrv(t), price);
   ObjectSetInteger(0, n, OBJPROP_TIME, 0, ToSrv(t)); ObjectSetDouble(0, n, OBJPROP_PRICE, 0, price);
   ObjectSetString(0, n, OBJPROP_TEXT, text); ObjectSetInteger(0, n, OBJPROP_COLOR, c);
   ObjectSetInteger(0, n, OBJPROP_FONTSIZE, size); ObjectSetInteger(0, n, OBJPROP_ANCHOR, anchor); ObjectSetInteger(0, n, OBJPROP_SELECTABLE, false);
  }
void Seg(string name, long t1, long t2, double price, color c, int style, int width, string label)
  {
   string n = PFX + name;
   if(ObjectFind(0, n) < 0) ObjectCreate(0, n, OBJ_TREND, 0, ToSrv(t1), price, ToSrv(t2), price);
   ObjectSetInteger(0, n, OBJPROP_TIME, 0, ToSrv(t1)); ObjectSetDouble(0, n, OBJPROP_PRICE, 0, price);
   ObjectSetInteger(0, n, OBJPROP_TIME, 1, ToSrv(t2)); ObjectSetDouble(0, n, OBJPROP_PRICE, 1, price);
   ObjectSetInteger(0, n, OBJPROP_COLOR, c); ObjectSetInteger(0, n, OBJPROP_STYLE, style); ObjectSetInteger(0, n, OBJPROP_WIDTH, width);
   ObjectSetInteger(0, n, OBJPROP_RAY_RIGHT, false); ObjectSetInteger(0, n, OBJPROP_SELECTABLE, false); ObjectSetInteger(0, n, OBJPROP_BACK, true);
   if(label == "") { ObjectDelete(0, n + "_t"); return; }
   Txt(name + "_t", t2, price, " " + label, c, 8, ANCHOR_LEFT);
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

// dessine un setup (préfixe p) ; complet = setup du jour (niveaux jusqu'à 13:00), sinon résumé historique
void DessinerSetup(string p, Ctx &c, Setup &s, bool complet)
  {
   bool clair = g_clair;
   color cPre = clair ? (color)0xF3E8F0 : (color)0x2A2238, cLvl = clair ? clrDimGray : clrSlateGray;
   color cSw = clair ? clrDarkGoldenrod : clrGold, cFib = clair ? clrSlateBlue : clrMediumPurple;
   color cTp = clair ? clrGreen : clrLimeGreen, cTp2 = clair ? clrDarkSeaGreen : clrDarkGreen, cEnt = clair ? clrDarkOrange : clrOrange;
   if(s.preHi >= s.preLo)
     {
      Rect(p + "pre", c.t800, c.t930, s.preHi, s.preLo, cPre);
      if(complet)
        {
         Seg(p + "preHi", c.t800, c.t13, s.preHi, cLvl, STYLE_DASH, 1, "Haut du pré-marché" + (c.dir < 0 ? " = liquidité visée" : ""));
         Seg(p + "preLo", c.t800, c.t13, s.preLo, cLvl, STYLE_DASH, 1, "Bas du pré-marché" + (c.dir > 0 ? " = liquidité visée" : ""));
        }
     }
   if(s.sweepT > 0 && s.extT > 0) Mark(p + "ext", s.extT, s.ext, c.dir > 0 ? 233 : 234, clrTomato, "Judas"); else Efface(p + "ext");
   if(complet && s.sweepT > 0 && s.swT > 0 && !s.ok)
      Seg(p + "sw", s.swT, (long)MathMax((double)c.t930 + 600, (double)NowUtc()) + 300, s.sw, cSw, STYLE_SOLID, 1, "Niveau de cassure (MSS)");
   else if(!s.ok) Efface(p + "sw");
   if(!s.ok)
     {
      Efface(p + "mss"); Efface(p + "f0"); Efface(p + "f100"); Efface(p + "entry"); Efface(p + "sl"); Efface(p + "tp0"); Efface(p + "tp1"); Efface(p + "tp2"); Efface(p + "bw"); Efface(p + "bl"); Efface(p + "res");
      if(!complet)
        {
         string why = s.etape == E_PAS_TRADE ? "pas de trade : " + c.raison : (s.sweepT > 0 ? "Judas sans cassure valide" : "pas de Judas");
         if(s.preHi >= s.preLo) Txt(p + "why", c.t930, c.dir < 0 ? s.preHi : s.preLo, why, clrGray, 8, c.dir < 0 ? ANCHOR_LEFT_LOWER : ANCHOR_LEFT_UPPER);
        }
      return;
     }
   Efface(p + "why");
   double r = MathAbs(s.entry - s.sl);
   long tEnd = complet ? c.t13 : (s.exitT > 0 ? s.exitT : c.t11);
   Mark(p + "mss", s.mssT, s.sw, 159, cSw, "Cassure validée");
   if(complet)
     {
      Seg(p + "sw", s.swT, s.mssT + 300, s.sw, cSw, STYLE_SOLID, 1, "");
      Seg(p + "f0", s.extT, c.t13, s.ext, cFib, STYLE_DOT, 1, "Fibo 0 % (Judas)");
      Seg(p + "f100", s.extT, c.t13, s.far, cFib, STYLE_DOT, 1, "Fibo 100 %");
     }
   Seg(p + "entry", s.mssT, tEnd, s.entry, cEnt, STYLE_SOLID, complet ? 2 : 1, complet ? "Entrée 50 % " + Px(s.entry) : "");
   Seg(p + "sl", s.mssT, tEnd, s.sl, clrRed, STYLE_SOLID, complet ? 2 : 1, complet ? "SL " + Px(s.sl) : "");
   double tps[3] = {2.0, 2.5, 3.0};
   for(int k = 0; k < 3; k++)
     {
      bool sel = MathAbs(tps[k] - g_tp) < 0.01;
      if(!complet && !sel) { Efface(p + "tp" + I(k)); continue; }
      double tp = s.entry + c.dir * tps[k] * r;
      Seg(p + "tp" + I(k), s.mssT, tEnd, tp, sel ? cTp : cTp2, sel ? STYLE_SOLID : STYLE_DOT, sel ? 2 : 1, complet ? "TP " + Fr(tps[k], 1) + "R " + Px(tp) : "");
     }
   if(s.fillT > 0 && s.etape == E_TOUCHE)
     {
      long tx = s.exitT > 0 ? s.exitT : c.t13;
      Rect(p + "bw", s.fillT, tx, s.entry, TpPrix(s, c.dir, g_tp), clair ? (color)0xD8F0D8 : (color)0x183818);
      Rect(p + "bl", s.fillT, tx, s.entry, s.sl, clair ? (color)0xD8D8F5 : (color)0x181838);
      double rr = MathAbs(g_tp - 2.0) < 0.01 ? s.r2 : (MathAbs(g_tp - 2.5) < 0.01 ? s.r25 : s.r3);
      string lab = (rr > 0 ? "+" : "") + Fr(rr, 1) + "R" + (s.fini ? "" : " (en cours)");
      Txt(p + "res", tx, c.dir > 0 ? TpPrix(s, c.dir, g_tp) : s.sl, lab, rr > 0 ? cTp : clrRed, 9, ANCHOR_LEFT_LOWER);
     }
   else
     {
      Efface(p + "bw"); Efface(p + "bl");
      if(!complet)
        {
         string lab = s.etape == E_IGNORE ? "touché avant 10:00 NY : pas de trade" : "pas de remplissage avant 11:00 NY";
         Txt(p + "res", tEnd, s.entry, lab, clrGray, 8, ANCHOR_LEFT);
        }
      else Efface(p + "res");
     }
  }

void DessinerJour()
  {
   if(!G.ok) return;
   g_clair = FondClair();
   VLine("v930", G.t930, clrGray, "9:30 NY");
   VLine("v10", G.t10, clrGoldenrod, "10:00 NY : début des entrées");
   VLine("v11", G.t11, clrGoldenrod, "11:00 NY : fin des entrées");
   VLine("v13", G.t13, clrIndianRed, "13:00 NY : sortie");
   if(P.judasMin > 0) VLine("v950", G.t950, clrOrange, "9:50 NY : Judas valable après"); else Efface("v950");
   DessinerSetup("J_", G, S, true);
   ChartRedraw();
  }

//--- historique : setups des N derniers jours ----------------------
void Historique(bool envoyer)
  {
   ObjectsDeleteAll(0, PFX + "H");
   if(InpHistJours <= 0 || (!g_histo && !envoyer)) { ChartRedraw(); return; }
   g_clair = FondClair();
   Bar m[];
   long now = NowUtc();
   int n = LoadM1(now - (long)(InpHistJours + 50) * 86400, G.t800 - 60, m);
   if(n < 1000) return;
   string rows = "[";
   int found = 0;
   long ny0 = NyLocal(G.t930);
   for(int back = 1; back <= InpHistJours * 2 + 10 && found < InpHistJours; back++)
     {
      MqlDateTime t; TimeToStruct((datetime)(ny0 - (long)back * 86400), t);
      if(t.day_of_week == 0 || t.day_of_week == 6) continue;
      long o930 = NyToUtc(t.year, t.mon, t.day, 9, 30);
      int a = Lb(m, n, o930);
      if(a >= n || m[a].t != o930) continue;   // jour sans séance
      Ctx c; BuildCtx(m, n, t.year, t.mon, t.day, c);
      Setup s; ScanDay(m, n, c, c.t13 + 60, s);
      string p = "H" + StringFormat("%02d%02d", t.mon, t.day) + "_";
      if(g_histo)
        {
         DessinerSetup(p, c, s, false);
         VLine(p + "v", c.t930, (color)(g_clair ? 0xE0E0E0 : 0x303030), StringFormat("%02d/%02d", t.day, t.mon));
        }
      if(found > 0) rows += ",";
      rows += SetupJson(c, s, false);
      found++;
     }
   rows += "]";
   if(envoyer && found > 0) Envoyer(rows);
   ChartRedraw();
  }

//+------------------------------------------------------------------+
//| Panneau                                                          |
//+------------------------------------------------------------------+
int PX0 = 10, PY0 = 22, PW = 560;
int RowY(int row) { return row == 0 ? PY0 + 6 : PY0 + 14 + row * 17; }
void Lbl(int row, string text, color c, int size = 9, string font = "Arial")
  {
   string n = PFX + "L" + IntegerToString(row);
   if(ObjectFind(0, n) < 0) ObjectCreate(0, n, OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, n, OBJPROP_CORNER, InpCoin == 1 ? CORNER_RIGHT_UPPER : CORNER_LEFT_UPPER);
   ObjectSetInteger(0, n, OBJPROP_ANCHOR, InpCoin == 1 ? ANCHOR_RIGHT_UPPER : ANCHOR_LEFT_UPPER);
   ObjectSetInteger(0, n, OBJPROP_XDISTANCE, PX0 + 10); ObjectSetInteger(0, n, OBJPROP_YDISTANCE, RowY(row));
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

string EtatTexte(color &ce)
  {
   long now = NowUtc();
   ulong ord = MonOrdre(), pos = MaPosition();
   ce = clrSilver;
   if(pos != 0) { ce = clrDeepSkyBlue; return "EN POSITION · sortie TP, SL ou 13:00 NY"; }
   if(ord != 0) { ce = clrDeepSkyBlue; return "ORDRE PLACÉ · annulé à 11:00 NY s'il n'est pas rempli"; }
   if(g_tradeFait) return "TERMINÉ · trade du jour déjà pris";
   switch(S.etape)
     {
      case E_AVANT:     return "AVANT L'OUVERTURE";
      case E_PAS_TRADE: return "PAS DE TRADE AUJOURD'HUI";
      case E_JUDAS:     return "ATTENTE DU JUDAS";
      case E_CASSURE:   ce = clrGold; return "ATTENTE DE LA CASSURE";
      case E_PRET:
         if(now < G.t10) { ce = clrGold; return g_arme || g_auto ? "ARMÉ · l'ordre partira à 10:00 NY" : "SETUP PRÊT · " + InpTouche + " pour l'armer (départ 10:00 NY)"; }
         ce = clrLimeGreen; return g_auto ? "AUTO · placement en cours" : "PRÊT · appuyez sur " + InpTouche + " pour placer l'ordre";
      case E_TOUCHE:    return "NIVEAU TOUCHÉ à " + Hm(ParisLocal(S.fillT)) + " Paris (sans ordre de votre part)";
      case E_IGNORE:    return "IGNORÉ · le 50 % a été touché avant 10:00 NY";
      case E_EXPIRE:    return "EXPIRÉ · pas de remplissage avant 11:00 NY";
     }
   return "PAS DE SETUP AUJOURD'HUI";
  }

void Panneau()
  {
   string bg = PFX + "PANEL";
   long now = NowUtc();
   int d = G.dir;
   ulong ord = MonOrdre(), pos = MaPosition();
   color ce; string etat = EtatTexte(ce);
   int rows = g_reduit ? 2 : 15;
   if(ObjectFind(0, bg) < 0) ObjectCreate(0, bg, OBJ_RECTANGLE_LABEL, 0, 0, 0);
   ObjectSetInteger(0, bg, OBJPROP_CORNER, InpCoin == 1 ? CORNER_RIGHT_UPPER : CORNER_LEFT_UPPER);
   ObjectSetInteger(0, bg, OBJPROP_XDISTANCE, InpCoin == 1 ? PX0 + PW : PX0); ObjectSetInteger(0, bg, OBJPROP_YDISTANCE, PY0);
   ObjectSetInteger(0, bg, OBJPROP_XSIZE, PW); ObjectSetInteger(0, bg, OBJPROP_YSIZE, RowY(rows) - PY0 + (g_reduit ? 34 : 70));
   ObjectSetInteger(0, bg, OBJPROP_BGCOLOR, (color)0x1C1712); ObjectSetInteger(0, bg, OBJPROP_BORDER_TYPE, BORDER_FLAT);
   ObjectSetInteger(0, bg, OBJPROP_COLOR, P.couleur); ObjectSetInteger(0, bg, OBJPROP_SELECTABLE, false);
   bool pret = S.etape == E_PRET && ord == 0 && pos == 0 && !g_tradeFait && now < G.t11;
   string go = now < G.t10 ? (g_arme ? "ARMÉ OK" : "ARMER (" + InpTouche + ")") : "PLACER L'ORDRE (" + InpTouche + ")";
   Btn("MIN", PW - 46, PY0 + 4, 26, g_reduit ? "+" : "–", clrDimGray, clrWhite);
   if(g_reduit)
     {
      for(int r = 2; r <= 15; r++) ObjectDelete(0, PFX + "L" + IntegerToString(r));
      ObjectDelete(0, PFX + "BX"); ObjectDelete(0, PFX + "BAUTO"); ObjectDelete(0, PFX + "BT2"); ObjectDelete(0, PFX + "BT25"); ObjectDelete(0, PFX + "BT3"); ObjectDelete(0, PFX + "BHIS"); ObjectDelete(0, PFX + "BANN");
      Lbl(0, "DESK KEY · " + P.nom + (d > 0 ? " · ACHATS" : (d < 0 ? " · VENTES" : " · pas de trade")), P.couleur, 11, "Arial Black");
      Lbl(1, etat, ce, 9, "Arial Bold");
      Btn("GO", 0, RowY(rows) + 4, 220, go, pret ? clrForestGreen : clrDimGray, clrWhite);
      ChartRedraw();
      return;
     }
   Lbl(0, "DESK KEY · " + P.nom + " · règle A", P.couleur, 11, "Arial Black");
   Lbl(1, "NY " + Hm(NyLocal(now)) + " · Paris " + Hm(ParisLocal(now)) + " · entrées " + Hm(ParisLocal(G.t10)) + "–" + Hm(ParisLocal(G.t11)) + " Paris · sortie " + Hm(ParisLocal(G.t13)), clrSilver);
   string tend = "Tendance : H4 " + Sens(G.h4);
   if(P.daily) tend += " · Daily " + Sens(G.d1);
   else tend += " · H1 " + Sens(G.h1) + (InpFiltreH1 ? " (filtre H1 actif)" : "");
   Lbl(2, tend, CSens(d));
   Lbl(3, d > 0 ? "→ ACHATS uniquement" : (d < 0 ? "→ VENTES uniquement" : "→ PAS DE TRADE aujourd'hui : " + G.raison), CSens(d), 10, "Arial Bold");
   if(S.preHi >= S.preLo)
      Lbl(4, "Pré-marché : haut " + Px(S.preHi) + " · bas " + Px(S.preLo) + (d != 0 ? " · cible : le " + (d > 0 ? "bas" : "haut") : ""), clrSilver);
   else Lbl(4, "Pré-marché : en attente des données", clrSilver);
   if(S.sweepT > 0)
      Lbl(5, "1. Judas OK à " + Hm(ParisLocal(S.sweepT)) + " Paris · extrême " + Px(S.ext) + " à " + Hm(ParisLocal(S.extT)), clrMediumSeaGreen);
   else Lbl(5, "1. Judas : attendre un passage " + (d > 0 ? "sous le bas" : (d < 0 ? "au-dessus du haut" : "au-delà")) + " du pré-marché", clrSilver);
   string rule = P.judasMin > 0 ? "Judas après " + Hm(ParisLocal(G.t950)) + " Paris" : "nette ≥ 5 % du risque + FVG";
   if(S.ok)
     {
      string c = "2. Cassure OK à " + Hm(ParisLocal(S.mssT)) + " Paris · niveau " + Px(S.sw);
      if(P.cassureMin > 0) c += " · +" + Fr(S.cassurePts, 1) + " pts (min " + Fr(S.cassureMinPts, 1) + ")";
      Lbl(6, c, clrMediumSeaGreen);
     }
   else if(S.etape == E_CASSURE && S.swT > 0) Lbl(6, "2. Cassure : clôture M1 au-delà de " + Px(S.sw) + " · " + rule, clrGold);
   else Lbl(6, "2. Cassure M1 · " + rule, clrSilver);
   Lbl(7, S.info != "" ? "   " + S.info : " ", clrOrange);
   if(S.ok && S.etape != E_IGNORE)
     {
      double r = MathAbs(S.entry - S.sl), lots = Lot(NormPx(S.entry), NormPx(S.sl));
      Lbl(8, "3. " + (d > 0 ? "ACHAT" : "VENTE") + " LIMITE " + Px(S.entry) + " · SL " + Px(S.sl) + " · TP " + Px(TpPrix(S, d, g_tp)) + " (" + Fr(g_tp, 1) + "R)", clrOrange, 10, "Arial Bold");
      Lbl(9, "   Lot " + Fr(lots, 2) + " · risque " + Fr(RisqueArgent(NormPx(S.entry), NormPx(S.sl), lots), 0) + " " + AccountInfoString(ACCOUNT_CURRENCY) + " · " + Fr(r, 1) + " pts", clrWhite);
     }
   else { Lbl(8, "3. Ordre : en attente du setup", clrSilver); Lbl(9, " ", clrSilver); }
   Lbl(10, "État : " + etat, ce, 10, "Arial Bold");
   Lbl(11, g_msg != "" && TimeLocal() - g_msgT < 120 ? "› " + g_msg : " ", clrLightSkyBlue);
   Lbl(12, "Profil " + P.nom + " : stop Judas ± " + Fr(P.marge, 1) + " pts · " + (P.fvg ? "FVG obligatoire" : "sans FVG") + " · " + (P.daily ? "H4 + Daily" : "H4"), clrDimGray, 8);
   string ann = AnnoncesTexte();
   if(ann != "") Lbl(13, "Annonces : " + ann + " · protection " + (g_protect ? "OUI (pas d'ordre ±" + I(InpProtMin) + " min)" : "NON"), g_protect ? clrLightSkyBlue : clrOrange, 8);
   else Lbl(13, "Touches : " + InpTouche + " = placer / armer · " + InpToucheAnnul + " = annuler · pas d'annonce US aujourd'hui", clrDimGray, 8);
   string app = !InpEnvoyer ? "Application : envoi désactivé"
                : (g_pushErr != "" ? "Application : " + g_pushErr
                   : (g_lastPushT > 0 ? "Application : setups envoyés (" + TimeToString(g_lastPushT, TIME_MINUTES) + ")" : "Application : en attente"));
   Lbl(14, app, g_pushErr != "" ? clrOrange : clrDimGray, 8);
   int by = RowY(rows) + 6;
   Btn("GO", 0, by, 190, go, pret ? clrForestGreen : clrDimGray, clrWhite);
   Btn("X", 196, by, 90, "ANNULER (" + InpToucheAnnul + ")", ord != 0 || g_arme ? clrFireBrick : clrDimGray, clrWhite);
   Btn("AUTO", 292, by, 108, g_auto ? "AUTO : OUI" : "AUTO : NON", g_auto ? clrDarkOrange : clrDimGray, clrWhite);
   Btn("T2", 0, by + 30, 60, "2R", MathAbs(g_tp - 2.0) < 0.01 ? P.couleur : clrDimGray, clrWhite);
   Btn("T25", 66, by + 30, 60, "2,5R", MathAbs(g_tp - 2.5) < 0.01 ? P.couleur : clrDimGray, clrWhite);
   Btn("T3", 132, by + 30, 60, "3R", MathAbs(g_tp - 3.0) < 0.01 ? P.couleur : clrDimGray, clrWhite);
   Btn("ANN", 196, by + 30, 90, g_protect ? "ANNONCES : OUI" : "ANNONCES : NON", g_protect ? clrSteelBlue : clrDimGray, clrWhite);
   if(InpHistJours > 0) Btn("HIS", 292, by + 30, 108, "HISTO " + I(InpHistJours) + " J : " + (g_histo ? "OUI" : "NON"), g_histo ? clrSteelBlue : clrDimGray, clrWhite);
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
   string cle = jour + (ny >= (long)MkTime(t.year, t.mon, t.day, 9, 26) ? "F" : "P");
   if(cle != g_jour)
     {
      g_jour = cle;
      long t930 = NyToUtc(t.year, t.mon, t.day, 9, 30);
      Bar m[];
      int n = LoadM1(t930 - 300 - 40 * 86400, t930 - 301, m);
      BuildCtx(m, n, t.year, t.mon, t.day, G);
      ChargerAnnonces(G);
      g_tradeFait = TradeDejaFait();
      g_arme = false;
      g_lastBar = 0;
      if(g_histJour != jour) { g_histJour = jour; Historique(true); }
     }
   datetime cur = iTime(_Symbol, PERIOD_M1, 0);
   if(cur != g_lastBar)
     {
      g_lastBar = cur;
      g_n = LoadM1(G.t800 - 90 * 60, (long)cur - g_srvOff - 1, B);
      ScanDay(B, g_n, G, now, S);
      DessinerJour();
     }
   Gerer();
   EnvoyerJour();
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
   g_histo = InpHistJours > 0;
   g_protect = InpProtection;
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
      bool redessiner = false;
      if(b == "GO") Placer();
      else if(b == "X") Annuler("à votre demande");
      else if(b == "MIN") { g_reduit = !g_reduit; }
      else if(b == "HIS") { g_histo = !g_histo; Historique(false); }
      else if(b == "ANN") { g_protect = !g_protect; Msg(g_protect ? "protection annonces ACTIVÉE" : "protection annonces désactivée"); }
      else if(b == "AUTO")
        {
         if(!g_auto)
           {
            bool oui = MQLInfoInteger(MQL_TESTER) ||
                       MessageBox("Activer le mode automatique sur " + P.nom + " ?\n\nDesk Key placera l'ordre sans vous dès qu'un setup est valide.\nVérifiez que votre prop firm autorise les robots.",
                                  "Desk Key · mode automatique", MB_YESNO | MB_ICONWARNING) == IDYES;
            if(oui) { g_auto = true; Msg("mode automatique ACTIVÉ"); }
           }
         else { g_auto = false; Msg("mode automatique désactivé"); }
        }
      else if(b == "T2")  { g_tp = 2.0; redessiner = true; }
      else if(b == "T25") { g_tp = 2.5; redessiner = true; }
      else if(b == "T3")  { g_tp = 3.0; redessiner = true; }
      ObjectSetInteger(0, sparam, OBJPROP_STATE, false);
      if(redessiner) { ScanDay(B, g_n, G, NowUtc(), S); DessinerJour(); Historique(false); }
      Panneau();
     }
  }
//+------------------------------------------------------------------+
