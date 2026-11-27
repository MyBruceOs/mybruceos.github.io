//+------------------------------------------------------------------+
//|                                                  DeskUS_Key.mq5  |
//|  Desk Key : la règle A du backtest Desk US, en une touche.       |
//|                                                                  |
//|  - Un graphique = un actif. Le profil (US100, SP500 ou or) fixe  |
//|    toutes les règles ; ils ne se mélangent jamais (symbole       |
//|    vérifié, numéro magique propre à chaque profil).              |
//|  - Feu rouge (US100, SP500) : pas de trade quand les 10 derniers |
//|    setups de l'indice sont négatifs (règle suivie à blanc).      |
//|  - Or : second trade de continuation, stop du trade 1 remonté.   |
//|  - Détecte le setup en direct, exactement comme le backtest :    |
//|    tendance -> Judas sur le pré-marché -> cassure M1 -> limite   |
//|    au 50 % (Fibo retracé) -> SL derrière le Judas -> TP en R.    |
//|  - Exécution par vous : une touche (K) ou le bouton. Le lot est  |
//|    calculé d'après votre réglage de risque. Mode auto en option. |
//|  - Dessine le setup du jour et ceux des 7 derniers jours (avec   |
//|    leur résultat), et envoie les niveaux à l'application.        |
//+------------------------------------------------------------------+
#property copyright "Desk US"
#property version   "1.09"
#property description "Règle A Desk US (US100 / SP500 / or) : détection, dessin, historique, feu rouge et exécution en une touche."

#include <Trade\Trade.mqh>

#define DK_VERSION "1.09"

enum ENUM_DK_PROFIL
  {
   PROFIL_AUTO  = 0, // Automatique (d'après le nom du symbole)
   PROFIL_US100 = 1, // US100 (Nasdaq)
   PROFIL_SP500 = 2, // SP500
   PROFIL_OR    = 3  // Or (XAUUSD)
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

input ENUM_DK_PROFIL InpProfil      = PROFIL_AUTO;     // Profil (un graphique = un actif)
input ENUM_DK_RISQUE InpRisqueMode  = RISQUE_MONTANT;  // Calcul du lot
input double         InpRisque      = 1000;            // Risque par trade (montant ou %) ou lot fixe · modifiable dans le panneau
input double         InpFtmoJour    = 5;               // FTMO : perte max du jour (% du capital de départ), pour l'avertissement du risque
input double         InpFtmoMax     = 10;              // FTMO : perte max totale (% du capital de départ)
input double         InpCapital     = 0;               // Capital de départ (0 = lu dans les dépôts du compte)
input double         InpTP          = 3.0;             // Objectif en R (2, 2.5 ou 3)
input string         InpTouche      = "K";             // Touche : placer l'ordre (ou l'armer avant 10:00 NY)
input string         InpToucheAnnul = "X";             // Touche : annuler l'ordre en attente
input bool           InpAuto        = false;           // Mode automatique (place l'ordre sans vous)
input bool           InpSuivreFibo  = true;            // Déplacer l'ordre quand la jambe s'allonge (comme le backtest)
input bool           InpSortie13h   = true;            // Fermer la position à 13:00 NY (19:00 Paris)
input bool           InpFiltreH1    = false;           // US100 : pas de trade si le H1 va contre (filtre optionnel)
input bool           InpFeuRouge    = true;            // US100, SP500 : feu rouge (pas de trade si les 10 derniers setups < 0 R) · bouton FEU
input bool           InpSecond      = true;            // Or : second trade de continuation (stop du trade 1 remonté) · bouton 2e TRADE
input bool           InpProtection  = false;           // Protection annonces FTMO (aucun ordre autour des annonces US)
input int            InpProtMin     = 2;               // Protection : minutes avant et après chaque annonce
input int            InpHistJours   = 7;               // Historique : nombre de séances au démarrage (0 à 250, bouton PÉRIODE)
input bool           InpEnvoyer     = true;            // Envoyer les setups à l'application Desk US
input string         InpKey         = "";              // Clé Desk US (vide = reprise du robot DeskUS_Bridge)
input ENUM_DK_HEURE  InpHeure       = HEURE_AUTO;      // Heure du serveur
input int            InpCoin        = 0;               // Coin du panneau (0 = haut gauche, 1 = haut droit)
input group          "Notifications"
input bool           InpNotifPush   = true;            // Notification sur le téléphone (application MT5, MetaQuotes ID)
input bool           InpNotifTout   = false;           // Aussi le sens du jour et le Judas (sinon : setup prêt, ordre, entrée, sortie)
input bool           InpAlertePC    = true;            // Fenêtre d'alerte et son sur l'ordinateur
input string         InpTgToken     = "";              // Telegram : jeton du bot (vide = pas de Telegram)
input string         InpTgChat      = "";              // Telegram : identifiant du chat
input string         InpWaPhone     = "";              // WhatsApp (CallMeBot) : numéro au format +33612345678 (vide = pas de WhatsApp)
input string         InpWaApiKey    = "";              // WhatsApp (CallMeBot) : clé reçue de CallMeBot

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
   int               tendance;   // 0 = H4, 1 = H4 + Daily d'accord, 2 = H4 ou H1 sans conflit
   int               finH, finM; // fin des entrées (heure de New York)
   bool              feu;        // feu rouge appliqué à ce profil
   bool              second;     // second trade de continuation
   string            unite;      // unité de prix affichée (pts, $)
   long              magic;
   color             couleur;
  };
Profil P;

struct Bar { long t; double o, h, l, c; };

//--- Contexte d'une journée -------------------------------------------
struct Ctx
  {
   int               y, mo, d;
   long              t800, t925, t930, t950, t10, t11, t12, t13;
   long              tF;         // fin des entrées du profil (11:00 NY indices, 12:00 NY or)
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
   // second trade (or) : 0 rien, 1 attente de l'impulsion, 2 attente du repli, 3 attente de la cassure du repli,
   // 4 prêt (limite au 50 % de la nouvelle jambe), 5 rempli, 6 annulé
   int               s2etat;
   string            s2info;
   double            s2PL, s2SH, s2e, s2sl, s2tp, s2rr, s2r, s2t1;
   long              s2T0, s2fillT, s2exitT;
   bool              s2fini;
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
int      g_deinit   = -1;      // raison du dernier arrêt (changement d'unité de temps : on garde l'état)
bool     g_protect  = false;   // protection annonces active
long     g_evT[];              // annonces du jour (UTC)
string   g_evNom[];
string   g_evJour   = "";
string   g_hLab[];             // résumé des derniers jours (du plus récent au plus ancien)
color    g_hCol[];
long     g_hT[];               // 9:30 NY de chaque jour (UTC)
int      g_hObj     = 0;       // objets dessinés pour l'historique
int      g_histN    = 7;       // séances analysées (7, 30, 90, 250)
string   g_hStat    = "";      // statistiques de la période
int      g_rMode    = 0;       // money management : 0 montant, 1 % du solde, 2 lot fixe (modifiable dans le panneau)
double   g_rVal     = 1000;
double   g_capital  = 0;       // capital de départ (dépôts)
int      g_notif    = 0;       // notifications déjà envoyées aujourd'hui (bits)
string   g_notifJour = "";
ulong    g_posSuivie = 0;      // position Desk Key en cours (pour la notification de sortie)
ulong    g_ordSuivi  = 0;      // ordre en attente (pour la notification d'expiration à la fin des entrées)
bool     g_feuOn    = true;    // feu rouge appliqué (bouton FEU) ; désactivé = prévenir seulement
bool     g_feuRouge = false;   // feu du jour : rouge si les 10 derniers setups (R à 3R) sont négatifs
double   g_feuS     = 0;       // somme des 10 derniers setups (R à 3R)
int      g_feuN     = 0;       // setups pris en compte (10 au plus)
bool     g_feuCalc  = false;   // feu calculé pour la séance
bool     g_second   = true;    // second trade activé (or, bouton 2e TRADE)
bool     g_arme2    = false;   // second trade armé (manuel)
bool     g_t2Fait   = false;   // second trade déjà pris aujourd'hui
ulong    g_pos2Suivie = 0;     // position du second trade (notifications)
CTrade   trade2;               // second trade (numéro magique du profil + 1)
// déclarations (fonctions définies plus bas)
string Sens(int v);
double RisqueVoulu();
string RisqueTexte();
string RisqueAnalyse(color &c);
void   NotifierUneFois(int bit, string texte, bool fort);
void   Notifier(string texte, bool fort);
void   Panneau();
string LireCle();
bool   FeuBloque();
void   SuivreNotifs2(long now, ulong pos1);
string FeuTexte();
double ResRegle(Setup &s);

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
//| Sens du jour selon le profil (copie des filtres du backtest)     |
//+------------------------------------------------------------------+
void Direction(Ctx &c, int nc)
  {
   c.dir = 0; c.raison = "";
   if(P.tendance == 1)
     {
      if(nc < 15) c.raison = "historique Daily insuffisant";
      else if(c.h4 == 0) c.raison = "H4 sans tendance";
      else if(c.d1 != c.h4) c.raison = "H4 et Daily pas d'accord";
      else c.dir = c.h4;
     }
   else if(P.tendance == 2)   // or : H4 ou H1, sans conflit
     {
      if(c.h4 != 0 && c.h1 != 0 && c.h4 != c.h1) c.raison = "H4 et H1 en conflit";
      else if(c.h4 != 0) c.dir = c.h4;
      else if(c.h1 != 0) c.dir = c.h1;
      else c.raison = "H4 et H1 sans tendance";
     }
   else
     {
      if(c.h4 == 0) c.raison = "H4 sans tendance";
      else c.dir = c.h4;
     }
   if(c.dir != 0 && InpFiltreH1 && P.tendance == 0 && c.h1 == -c.dir) { c.raison = "H1 contre le trade (filtre)"; c.dir = 0; }
   c.ok = true;
  }

//+------------------------------------------------------------------+
//| Contexte d'une journée (m = M1 couvrant au moins 40 jours avant) |
//+------------------------------------------------------------------+
void BuildCtx(Bar &m[], int n, int y, int mo, int d, Ctx &c)
  {
   c.y = y; c.mo = mo; c.d = d;
   c.t800 = NyToUtc(y, mo, d, 8, 0);  c.t930 = NyToUtc(y, mo, d, 9, 30); c.t925 = c.t930 - 300; c.t950 = c.t930 + 20 * 60;
   c.t10  = NyToUtc(y, mo, d, 10, 0); c.t11  = NyToUtc(y, mo, d, 11, 0); c.t12 = NyToUtc(y, mo, d, 12, 0); c.t13  = NyToUtc(y, mo, d, 13, 0);
   c.tF   = NyToUtc(y, mo, d, P.finH, P.finM);
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
   Direction(c, nc);
  }

// même calcul que BuildCtx, à partir d'agrégats déjà calculés (historique long)
int DernierFini(Bar &a[], int na, long secs, long fin) { return Lb(a, na, fin - secs + 1) - 1; }
int TrendDe(Bar &a[], int na, long secs, long fin)
  {
   int j = DernierFini(a, na, secs, fin);
   if(j < 0) return 0;
   int first = MathMax(0, j - 59), cnt = j - first + 1;
   Bar tmp[]; ArrayResize(tmp, cnt);
   for(int i = 0; i < cnt; i++) tmp[i] = a[first + i];
   return TrendOf(tmp, cnt);
  }
void BuildCtxFast(Bar &m[], int n, Bar &a4[], int n4, Bar &a1[], int n1, long &dT[], double &dC[], int nd, int y, int mo, int d, Ctx &c)
  {
   c.y = y; c.mo = mo; c.d = d;
   c.t800 = NyToUtc(y, mo, d, 8, 0);  c.t930 = NyToUtc(y, mo, d, 9, 30); c.t925 = c.t930 - 300; c.t950 = c.t930 + 20 * 60;
   c.t10  = NyToUtc(y, mo, d, 10, 0); c.t11  = NyToUtc(y, mo, d, 11, 0); c.t12 = NyToUtc(y, mo, d, 12, 0); c.t13  = NyToUtc(y, mo, d, 13, 0);
   c.tF   = NyToUtc(y, mo, d, P.finH, P.finM);
   c.h4 = TrendDe(a4, n4, 14400, c.t925);
   c.h1 = TrendDe(a1, n1, 3600, c.t925);
   int nc = 0; while(nc < nd && dT[nc] < c.t930) nc++;
   c.d1 = 0;
   int iB = Lb(m, n, c.t925) - 1;
   if(nc >= 15 && iB >= 0)
     {
      double px = m[iB].c, sN = 0, sP = 0;
      for(int i = nc - 10; i < nc; i++) sN += dC[i];
      for(int i = nc - 15; i < nc - 5; i++) sP += dC[i];
      sN /= 10.0; sP /= 10.0;
      c.d1 = (px > sN && sN > sP) ? 1 : ((px < sN && sN < sP) ? -1 : 0);
     }
   Direction(c, nc);
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
//| Second trade de l'or (copie de second() du backtest)              |
//| Pendant que le trade 1 est ouvert : impulsion au-delà de la jambe |
//| du trade 1, repli (pivot 2 bougies) au-dessus du stop 1, clôture  |
//| au-delà du sommet du repli -> limite au 50 % de la nouvelle jambe,|
//| stop sous le repli ± marge, objectif = TP du trade 1, rempli      |
//| avant 12:00 NY. Au remplissage, le stop du trade 1 est remonté au |
//| stop du second trade.                                             |
//+------------------------------------------------------------------+
void Second(Bar &E[], int n, int k, int d, double e1, double sl1, double far1, Ctx &c, long now, Setup &s)
  {
   double risk1 = MathAbs(e1 - sl1), tp1 = e1 + d * g_tp * risk1;
   int phase = 0, extI = k; double ext = far1, PL = 0, SH = 0, legX = 0, e2 = 0, sl2 = 0;
   s.s2etat = 1; s.s2tp = tp1;
   for(int j = k + 1; j < n && E[j].t < c.t13; j++)
     {
      double fav = d > 0 ? E[j].h : E[j].l;
      if(d > 0 ? E[j].l <= sl1 : E[j].h >= sl1) { s.s2etat = 6; s.s2info = "trade 1 au stop avant le second trade"; return; }
      if(d > 0 ? E[j].h >= tp1 : E[j].l <= tp1) { s.s2etat = 6; s.s2info = "trade 1 au TP avant le second trade"; return; }
      if(phase == 0) { if(d > 0 ? fav > far1 : fav < far1) { phase = 1; ext = fav; extI = j; s.s2etat = 2; } continue; }
      if(phase == 1 || phase == 2)
        {
         if(d > 0 ? fav > ext : fav < ext) { ext = fav; extI = j; }
         if(phase == 1)
           {
            int p = j - 2;
            if(p - 2 > extI - 1 && p > k + 2 && p - 2 >= 0)
              {
               bool piv = d > 0
                          ? (E[p].l < E[p - 1].l && E[p].l < E[p - 2].l && E[p].l <= E[p + 1].l && E[p].l <= E[p + 2].l)
                          : (E[p].h > E[p - 1].h && E[p].h > E[p - 2].h && E[p].h >= E[p + 1].h && E[p].h >= E[p + 2].h);
               double adv = d > 0 ? E[p].l : E[p].h;
               if(piv && (d > 0 ? adv > sl1 : adv < sl1))
                 {
                  double sh = adv;
                  for(int z = extI; z <= p; z++) { double fz = d > 0 ? E[z].h : E[z].l; if(d > 0 ? fz > sh : fz < sh) sh = fz; }
                  PL = adv; SH = sh; phase = 2; s.s2etat = 3; s.s2PL = PL; s.s2SH = SH;
                 }
              }
            continue;
           }
         // phase 2 : attendre la clôture au-delà du sommet du repli
         if(d > 0 ? E[j].l < PL : E[j].h > PL) { phase = 1; s.s2etat = 2; continue; }   // repli plus profond : nouveau creux
         if(d > 0 ? E[j].c > SH : E[j].c < SH)
           {
            legX = ext; e2 = PL + (legX - PL) * 0.5; sl2 = PL - d * P.marge; phase = 3;
            s.s2etat = 4; s.s2T0 = E[j].t; s.s2e = e2; s.s2sl = sl2; s.s2PL = PL; s.s2SH = SH;
            s.s2rr = MathAbs(e2 - sl2) > 0 ? (tp1 - e2) * d / MathAbs(e2 - sl2) : 0;
           }
         continue;
        }
      // phase 3 : limite au 50 % de la nouvelle jambe, retracée si la jambe s'allonge, remplie avant 12:00 NY
      if(E[j].t >= c.t12) { s.s2etat = 6; s.s2info = "second trade : pas de remplissage avant 12:00 NY"; return; }
      if(d > 0 ? E[j].l <= e2 : E[j].h >= e2)
        {
         double risk2 = MathAbs(e2 - sl2);
         if(risk2 <= 0) { s.s2etat = 6; return; }
         double tpR = (tp1 - e2) * d / risk2;
         s.s2etat = 5; s.s2fillT = E[j].t; s.s2e = e2; s.s2sl = sl2; s.s2rr = NormalizeDouble(tpR, 2);
         long ex2 = 0; bool f2 = true;
         s.s2r = tpR > 0 ? SimR(E, n, j, d, e2, sl2, tpR, c.t13, ex2, f2) : 0;
         if(tpR <= 0) { f2 = true; ex2 = E[j].t; }
         s.s2exitT = ex2;
         // trade 1 avec son stop remonté au stop du second trade
         double stop1 = d > 0 ? MathMax(sl1, sl2) : MathMin(sl1, sl2), lastC = E[j].c, exP = 0; bool sortie = false;
         if(d > 0 ? E[j].l <= sl2 : E[j].h >= sl2) { exP = stop1; sortie = true; }
         for(int q = j + 1; !sortie && q < n && E[q].t < c.t13; q++)
           {
            if(d > 0 ? E[q].l <= stop1 : E[q].h >= stop1) { exP = stop1; sortie = true; break; }
            if(d > 0 ? E[q].h >= tp1 : E[q].l <= tp1) { exP = tp1; sortie = true; break; }
            lastC = E[q].c;
           }
         bool f1 = sortie || (n > 0 && E[n - 1].t >= c.t13 - 60);
         if(!sortie) exP = lastC;
         s.s2t1 = NormalizeDouble((exP - e1) * d / risk1, 2);
         s.s2fini = f1 && f2;
         return;
        }
      if(d > 0 ? fav > legX : fav < legX) { legX = fav; ext = legX; e2 = PL + (legX - PL) * 0.5; s.s2e = e2; s.s2rr = MathAbs(e2 - sl2) > 0 ? (tp1 - e2) * d / MathAbs(e2 - sl2) : 0; }
     }
   if(s.s2etat == 4 && now >= c.t12) { s.s2etat = 6; s.s2info = "second trade : pas de remplissage avant 12:00 NY"; }
   if(s.s2etat >= 1 && s.s2etat <= 3 && now >= c.t12) { s.s2etat = 6; s.s2info = "pas de second trade (pas de continuation avant 12:00 NY)"; }
  }
// résultat de la règle au TP choisi : trade 1, plus le second trade de l'or s'il a été rempli
double ResRegle(Setup &s)
  {
   double r1 = MathAbs(g_tp - 2.0) < 0.01 ? s.r2 : (MathAbs(g_tp - 2.5) < 0.01 ? s.r25 : s.r3);
   if(s.s2etat == 5) return NormalizeDouble(s.s2t1 + s.s2r, 2);
   return r1;
  }

//+------------------------------------------------------------------+
//| Recherche du setup d'une journée (copie de setup() du backtest)  |
//+------------------------------------------------------------------+
void ScanDay(Bar &b[], int n, Ctx &c, long now, Setup &s)
  {
   s.etape = E_AVANT; s.info = ""; s.ok = false; s.fillT = 0; s.fillI = -1; s.mssT = 0; s.sweepT = 0; s.extT = 0; s.swT = 0;
   s.cassurePts = 0; s.cassureMinPts = 0; s.fvg = false; s.r2 = 0; s.r25 = 0; s.r3 = 0; s.exitT = 0; s.fini = false;
   s.s2etat = 0; s.s2info = ""; s.s2PL = 0; s.s2SH = 0; s.s2e = 0; s.s2sl = 0; s.s2tp = 0; s.s2rr = 0; s.s2r = 0; s.s2t1 = 0;
   s.s2T0 = 0; s.s2fillT = 0; s.s2exitT = 0; s.s2fini = false;
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
      for(int k = last + 1; k < n && b[k].t < c.tF; k++)
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
            bool slNow = d > 0 ? b[k].l <= sl : b[k].h >= sl;
            if(P.second && g_second && !slNow) Second(b, n, k, d, entry, sl, far, c, now, s);
            return;
           }
         if(d < 0 ? b[k].l < far : b[k].h > far) { far = d < 0 ? b[k].l : b[k].h; farT = b[k].t; entry = far + (ext - far) * 0.5; }
        }
      s.far = far; s.farT = farT; s.entry = entry;
      if(now >= c.tF) { s.etape = E_EXPIRE; s.fini = true; }
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
ulong MonOrdreM(long magic)
  {
   for(int i = OrdersTotal() - 1; i >= 0; i--)
     {
      ulong tk = OrderGetTicket(i);
      if(tk == 0) continue;
      if(OrderGetString(ORDER_SYMBOL) == _Symbol && OrderGetInteger(ORDER_MAGIC) == magic) return tk;
     }
   return 0;
  }
ulong MaPositionM(long magic)
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong tk = PositionGetTicket(i);
      if(tk == 0) continue;
      if(PositionGetString(POSITION_SYMBOL) == _Symbol && PositionGetInteger(POSITION_MAGIC) == magic) return tk;
     }
   return 0;
  }
ulong MonOrdre()    { return MonOrdreM(P.magic); }
ulong MaPosition()  { return MaPositionM(P.magic); }
ulong MonOrdre2()   { return MonOrdreM(P.magic + 1); }      // second trade (or)
ulong MaPosition2() { return MaPositionM(P.magic + 1); }
// trade Desk Key du jour : identifiant de position, volume, prix (0 si aucun)
long TradeDuJourM(long magic, double &vol, double &px)
  {
   vol = 0; px = 0;
   if(!HistorySelect(ToSrv(G.t930 - 3600), TimeTradeServer() + 60)) return 0;
   for(int i = HistoryDealsTotal() - 1; i >= 0; i--)
     {
      ulong tk = HistoryDealGetTicket(i);
      if(tk == 0) continue;
      if(HistoryDealGetString(tk, DEAL_SYMBOL) == _Symbol && HistoryDealGetInteger(tk, DEAL_MAGIC) == magic
         && HistoryDealGetInteger(tk, DEAL_ENTRY) == DEAL_ENTRY_IN)
        {
         vol = HistoryDealGetDouble(tk, DEAL_VOLUME); px = HistoryDealGetDouble(tk, DEAL_PRICE);
         return HistoryDealGetInteger(tk, DEAL_POSITION_ID);
        }
     }
   return 0;
  }
long TradeDuJour(double &vol, double &px) { return TradeDuJourM(P.magic, vol, px); }
bool TradeDejaFait() { double v, p; return TradeDuJour(v, p) != 0 || MaPosition() != 0; }
bool Trade2DejaFait() { double v, p; return TradeDuJourM(P.magic + 1, v, p) != 0 || MaPosition2() != 0; }

double Lot(double entry, double sl)
  {
   double step = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP), vmin = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN), vmax = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   if(step <= 0) step = 0.01;
   if(g_rMode == RISQUE_LOT_FIXE) return MathMax(vmin, MathMin(vmax, MathFloor(g_rVal / step + 1e-9) * step));
   double risk = RisqueVoulu();
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
// le symbole accepte-t-il une date d'expiration précise sur les ordres en attente ?
bool ExpirationPossible() { return (SymbolInfoInteger(_Symbol, SYMBOL_EXPIRATION_MODE) & SYMBOL_EXPIRATION_SPECIFIED) != 0; }

void Msg(string s) { g_msg = s; g_msgT = TimeLocal(); Print("Desk Key ", P.nom, " : ", s); }

//+------------------------------------------------------------------+
//| Money management (panneau, commun aux graphiques du compte)      |
//+------------------------------------------------------------------+
string GvNom(string k) { return "DK_" + I(AccountInfoInteger(ACCOUNT_LOGIN)) + "_" + k; }
double RisqueVoulu() { return g_rMode == RISQUE_MONTANT ? g_rVal : (g_rMode == RISQUE_POURCENT ? AccountInfoDouble(ACCOUNT_BALANCE) * g_rVal / 100.0 : 0); }
double BorneRisque(int mode, double v)
  {
   if(mode == RISQUE_POURCENT) return MathMax(0.05, MathMin(20, NormalizeDouble(v, 2)));
   if(mode == RISQUE_LOT_FIXE) return MathMax(0.01, MathMin(500, NormalizeDouble(v, 2)));
   return MathMax(10, MathMin(1e7, MathRound(v)));
  }
// au démarrage : le réglage du panneau est gardé, sauf si les paramètres du robot ont été modifiés (F7)
void ChargerRisque()
  {
   int im = (int)InpRisqueMode; double iv = BorneRisque(im, InpRisque);
   bool connu = GlobalVariableCheck(GvNom("rm")) && GlobalVariableCheck(GvNom("rv"));
   bool inputsChanges = !GlobalVariableCheck(GvNom("im")) || (int)GlobalVariableGet(GvNom("im")) != im || MathAbs(GlobalVariableGet(GvNom("iv")) - iv) > 1e-9;
   if(connu && !inputsChanges) { g_rMode = (int)GlobalVariableGet(GvNom("rm")); g_rVal = BorneRisque(g_rMode, GlobalVariableGet(GvNom("rv"))); }
   else { g_rMode = im; g_rVal = iv; }
   GlobalVariableSet(GvNom("im"), im); GlobalVariableSet(GvNom("iv"), iv);
   SauverRisque();
  }
void SauverRisque() { GlobalVariableSet(GvNom("rm"), g_rMode); GlobalVariableSet(GvNom("rv"), g_rVal); }
bool ChargerOption(string k, bool inp)
  {
   string gk = GvNom(P.nom + "_" + k), gi = GvNom(P.nom + "_" + k + "_in");
   bool v = inp;
   if(GlobalVariableCheck(gk) && GlobalVariableCheck(gi) && (GlobalVariableGet(gi) != 0) == inp) v = GlobalVariableGet(gk) != 0;
   GlobalVariableSet(gi, inp ? 1 : 0); GlobalVariableSet(gk, v ? 1 : 0);
   return v;
  }
void SauverOption(string k, bool v) { GlobalVariableSet(GvNom(P.nom + "_" + k), v ? 1 : 0); }
// un changement fait sur l'autre graphique (autre indice) est repris ici
bool SuivreRisque()
  {
   if(!GlobalVariableCheck(GvNom("rm"))) return false;
   int m = (int)GlobalVariableGet(GvNom("rm")); double v = GlobalVariableGet(GvNom("rv"));
   if(m == g_rMode && MathAbs(v - g_rVal) < 1e-9) return false;
   g_rMode = m; g_rVal = BorneRisque(m, v);
   return true;
  }
void ChangerRisque(int mode, double v)
  {
   double bal = AccountInfoDouble(ACCOUNT_BALANCE);
   if(mode != g_rMode)   // conversion pour garder à peu près le même risque
     {
      double argent = RisqueVoulu();
      if(g_rMode == RISQUE_LOT_FIXE) argent = 0;
      if(mode == RISQUE_POURCENT) v = argent > 0 && bal > 0 ? argent / bal * 100.0 : 1.0;
      else if(mode == RISQUE_MONTANT) v = argent > 0 ? argent : bal * 0.01;
      else v = S.ok ? Lot(NormPx(S.entry), NormPx(S.sl)) : 1.0;
     }
   g_rMode = mode; g_rVal = BorneRisque(mode, v);
   SauverRisque();
   Msg("risque par trade : " + RisqueTexte());
  }
double PasRisque() { return g_rMode == RISQUE_POURCENT ? (g_rVal < 1 ? 0.1 : 0.25) : (g_rMode == RISQUE_LOT_FIXE ? (g_rVal < 1 ? 0.01 : 0.1) : (g_rVal < 1000 ? 50 : 250)); }
string RisqueTexte()
  {
   string cur = AccountInfoString(ACCOUNT_CURRENCY);
   if(g_rMode == RISQUE_POURCENT) return Fr(g_rVal, 2) + " % du solde (" + Fr(RisqueVoulu(), 0) + " " + cur + ")";
   if(g_rMode == RISQUE_LOT_FIXE) return Fr(g_rVal, 2) + " lot fixe";
   return Fr(g_rVal, 0) + " " + cur;
  }
double CapitalDepart()
  {
   if(InpCapital > 0) return InpCapital;
   if(g_capital > 0) return g_capital;
   double sum = 0;
   if(HistorySelect(0, TimeTradeServer() + 86400))
      for(int i = 0; i < HistoryDealsTotal(); i++)
        {
         ulong tk = HistoryDealGetTicket(i);
         if(tk != 0 && (ENUM_DEAL_TYPE)HistoryDealGetInteger(tk, DEAL_TYPE) == DEAL_TYPE_BALANCE) sum += HistoryDealGetDouble(tk, DEAL_PROFIT);
        }
   g_capital = sum > 0 ? sum : AccountInfoDouble(ACCOUNT_BALANCE);
   return g_capital;
  }
// ligne du panneau : risque en argent, pire jour (les 3 actifs perdants), pertes avant la perte max
string RisqueAnalyse(color &c)
  {
   double cap = CapitalDepart(), eq = AccountInfoDouble(ACCOUNT_EQUITY);
   double r = RisqueVoulu();
   if(g_rMode == RISQUE_LOT_FIXE && S.ok) r = RisqueArgent(NormPx(S.entry), NormPx(S.sl), Lot(NormPx(S.entry), NormPx(S.sl)));
   c = clrSilver;
   if(r <= 0 || cap <= 0) return "Risque : " + RisqueTexte();
   double jour = cap * InpFtmoJour / 100.0, plancher = cap * (1 - InpFtmoMax / 100.0);
   int avant = (int)MathFloor((eq - plancher) / r);
   double pire = 3 * r / cap * 100.0;
   if(r >= jour || 3 * r >= jour) c = clrTomato; else if(3 * r >= 0.5 * jour || avant <= 6) c = clrOrange; else c = clrMediumSeaGreen;
   return "Risque " + Fr(r / cap * 100.0, 2) + " % · 3 pertes le même jour : −" + Fr(pire, 1) + " % (limite jour " + Fr(InpFtmoJour, 0) + " %) · "
          + I(MathMax(0, avant)) + " pertes avant la perte max";
  }

//+------------------------------------------------------------------+
//| Notifications (téléphone MT5, Telegram, WhatsApp, ordinateur)    |
//+------------------------------------------------------------------+
#define N_SENS    1
#define N_JUDAS   2
#define N_PRET    4
#define N_ORDRE   8
#define N_REMPLI  16
#define N_SORTIE  32
#define N_ANNULE  64
#define N_AVANT10 128
#define N_FEU     256
#define N_S2PRET  512
#define N_S2ORDRE 1024
#define N_S2REMPLI 2048
#define N_S2SORTIE 4096
#define N_S2ANNULE 8192
string UrlEnc(string s)
  {
   uchar b[]; int n = StringToCharArray(s, b, 0, WHOLE_ARRAY, CP_UTF8);
   string o = "";
   for(int i = 0; i < n; i++)
     {
      uchar c = b[i];
      if(c == 0) break;
      if((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-' || c == '_' || c == '.' || c == '~') o += CharToString(c);
      else o += StringFormat("%%%02X", c);
     }
   return o;
  }
// valeurs collées nettoyées (espaces, retours à la ligne, guillemets)
string Nettoyer(string v) { StringReplace(v, " ", ""); StringReplace(v, "\r", ""); StringReplace(v, "\n", ""); StringReplace(v, "\t", ""); StringReplace(v, "\"", ""); StringReplace(v, "'", ""); return v; }
string g_tgTok = "", g_tgChat = "", g_waTel = "", g_waCle = "";
bool   g_tgRelais = false, g_waRelais = false;   // MT5 n'arrive pas à joindre le service : passage par le serveur Desk US
bool   g_enTest = false;
long   g_testIds[];
string g_testCh[];
datetime g_testT = 0;
void LireNotifs() { g_tgTok = Nettoyer(InpTgToken); g_tgChat = Nettoyer(InpTgChat); g_waTel = Nettoyer(InpWaPhone); g_waCle = Nettoyer(InpWaApiKey); }
// appel d'une fonction du serveur Desk US (même adresse que l'envoi des setups)
int Rpc(string fn, string body, string &resp)
  {
   char data[], result[]; string rh;
   int len = StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
   if(len > 0) ArrayResize(data, len - 1);
   ResetLastError();
   int code = WebRequest("POST", "https://xakrdapoxthvvqpyjuji.supabase.co/rest/v1/rpc/" + fn, "Content-Type: application/json\r\napikey: " + API_KEY + "\r\n", 8000, data, result, rh);
   resp = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   return code;
  }
// relais par le serveur : renvoie l'identifiant de la requête (0 si échec)
long Relais(string canal, string a, string b, string texte)
  {
   if(g_key == "") g_key = LireCle();
   if(g_key == "") { Print("Desk Key : relais impossible, clé Desk US absente"); return 0; }
   string resp;
   int code = Rpc("desk_notify", "{\"p_key\":" + Q(g_key) + ",\"p_channel\":" + Q(canal) + ",\"p_a\":" + Q(a) + ",\"p_b\":" + Q(b) + ",\"p_text\":" + Q(texte) + "}", resp);
   if(code < 200 || code >= 300)
     {
      string why = resp;
      if(StringFind(resp, "bad telegram token") >= 0) why = "jeton Telegram mal copié (format attendu 123456789:AAH…)";
      else if(StringFind(resp, "bad telegram chat id") >= 0) why = "identifiant de chat Telegram invalide (un nombre, pas le @ du bot)";
      else if(StringFind(resp, "bad phone") >= 0) why = "numéro WhatsApp invalide (format +33612345678)";
      else if(StringFind(resp, "bad callmebot key") >= 0) why = "clé CallMeBot invalide";
      Print("Desk Key : relais ", canal, " refusé : ", why);
      if(g_enTest) Msg((canal == "tg" ? "Telegram" : "WhatsApp") + " : " + why);
      return 0;
     }
   return (long)StringToInteger(resp);
  }
void SuivreRelais(long id, string canal)
  {
   if(!g_enTest || id <= 0) return;
   int k = ArraySize(g_testIds);
   ArrayResize(g_testIds, k + 1); ArrayResize(g_testCh, k + 1);
   g_testIds[k] = id; g_testCh[k] = canal; g_testT = TimeLocal();
  }
void Telegram(string texte)
  {
   if(g_tgTok == "" || g_tgChat == "") return;
   if(!g_tgRelais)
     {
      char data[], res[]; string rh;
      string body = "chat_id=" + UrlEnc(g_tgChat) + "&text=" + UrlEnc(texte);
      int len = StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
      if(len > 0) ArrayResize(data, len - 1);
      ResetLastError();
      int code = WebRequest("POST", "https://api.telegram.org/bot" + g_tgTok + "/sendMessage", "Content-Type: application/x-www-form-urlencoded\r\n", 5000, data, res, rh);
      int err = GetLastError();
      if(code == 200) { if(g_enTest) Msg("Telegram : OK (envoi direct)"); return; }
      string rep = CharArrayToString(res, 0, WHOLE_ARRAY, CP_UTF8);
      if(code >= 400 && code < 500)   // Telegram a répondu : le problème vient du jeton ou de l'identifiant
        {
         Print("Desk Key : Telegram refuse (", code, ") ", rep);
         if(g_enTest) Msg("Telegram : refusé " + I(code) + " · " + (StringFind(rep, "chat not found") >= 0 ? "identifiant de chat faux, ou /start pas envoyé au bot" : (code == 401 ? "jeton faux" : (code == 403 ? "envoyez /start à votre bot dans Telegram" : StringSubstr(rep, 0, 80)))));
         return;
        }
      Print("Desk Key : MT5 n'arrive pas à joindre Telegram (code ", code, ", erreur ", err, "), passage par le relais du serveur Desk US");
      g_tgRelais = true;
     }
   SuivreRelais(Relais("tg", g_tgTok, g_tgChat, texte), "tg");
  }
void WhatsApp(string texte)
  {
   if(g_waTel == "" || g_waCle == "") return;
   if(!g_waRelais)
     {
      char data[], res[]; string rh;
      ResetLastError();
      int code = WebRequest("GET", "https://api.callmebot.com/whatsapp.php?phone=" + UrlEnc(g_waTel) + "&text=" + UrlEnc(texte) + "&apikey=" + UrlEnc(g_waCle), "", 5000, data, res, rh);
      int err = GetLastError();
      if(code == 200) { if(g_enTest) Msg("WhatsApp : OK (envoi direct)"); return; }
      if(code >= 400 && code < 500) { Print("Desk Key : CallMeBot refuse (", code, ") ", CharArrayToString(res)); if(g_enTest) Msg("WhatsApp : refusé " + I(code) + " (numéro ou clé CallMeBot)"); return; }
      Print("Desk Key : MT5 n'arrive pas à joindre CallMeBot (code ", code, ", erreur ", err, "), passage par le relais du serveur Desk US");
      g_waRelais = true;
     }
   SuivreRelais(Relais("wa", g_waTel, g_waCle, texte), "wa");
  }
// résultat d'un test passé par le relais (lu quelques secondes après)
string ExtraitNum(string r, string champ)
  {
   int p = StringFind(r, "\"" + champ + "\":"); if(p < 0) return "";
   p += StringLen(champ) + 3;
   while(p < StringLen(r) && StringGetCharacter(r, p) == ' ') p++;
   int q = p; while(q < StringLen(r) && StringGetCharacter(r, q) >= '0' && StringGetCharacter(r, q) <= '9') q++;
   return StringSubstr(r, p, q - p);
  }
void SuivreTest()
  {
   if(g_testT == 0 || ArraySize(g_testIds) == 0 || TimeLocal() - g_testT < 3) return;
   if(g_key == "") g_key = LireCle();
   string bilan = ""; bool attente = false;
   for(int i = 0; i < ArraySize(g_testIds); i++)
     {
      string resp;
      Rpc("desk_notify_result", "{\"p_key\":" + Q(g_key) + ",\"p_id\":" + I(g_testIds[i]) + "}", resp);
      string nom = g_testCh[i] == "tg" ? "Telegram" : "WhatsApp";
      if(StringFind(resp, "\"pending\": true") >= 0 || StringFind(resp, "\"pending\":true") >= 0) { attente = true; continue; }
      string st = ExtraitNum(resp, "status");
      string r = resp; StringReplace(r, "\\", "");
      string why = "";
      if(StringFind(r, "chat not found") >= 0) why = "identifiant de chat faux, ou /start pas envoyé au bot";
      else if(StringFind(r, "Unauthorized") >= 0) why = "jeton faux";
      else if(StringFind(r, "Forbidden") >= 0) why = "envoyez /start à votre bot dans Telegram";
      bilan += (bilan != "" ? " · " : "") + nom + (st == "200" ? " : OK (par le serveur Desk US)" : " : erreur " + (st != "" ? st : "réseau") + (why != "" ? " · " + why : ""));
     }
   if(attente && TimeLocal() - g_testT < 20) return;
   if(bilan == "") bilan = "notifications : pas de réponse du serveur";
   Msg(bilan);
   ArrayResize(g_testIds, 0); ArrayResize(g_testCh, 0); g_testT = 0;
   Panneau();
  }
void Notifier(string texte, bool fort)
  {
   string m = "Desk Key " + P.nom + " · " + texte;
   if(InpNotifPush && !MQLInfoInteger(MQL_TESTER))
     {
      string court = StringLen(m) > 250 ? StringSubstr(m, 0, 250) : m;
      if(!SendNotification(court)) Print("Desk Key : notification téléphone impossible (Outils > Options > Notifications : MetaQuotes ID et case cochée), erreur ", GetLastError());
     }
   if(InpAlertePC && fort && !MQLInfoInteger(MQL_TESTER)) Alert(m);
   if(MQLInfoInteger(MQL_TESTER)) { Print("[notif] ", m); return; }
   Telegram((fort ? "🔔 " : "") + m);
   WhatsApp((fort ? "🔔 " : "") + m);
  }
// une seule fois par jour et par événement, même si MT5 redémarre
bool DejaNotifie(int bit)
  {
   string j = StringSubstr(g_jour, 0, 10);
   if(j != g_notifJour)
     {
      g_notifJour = j;
      string gv = GvNom(P.nom + "_notif_" + StringSubstr(j, 0, 4) + StringSubstr(j, 5, 2) + StringSubstr(j, 8, 2));
      g_notif = GlobalVariableCheck(gv) ? (int)GlobalVariableGet(gv) : 0;
     }
   return (g_notif & bit) != 0;
  }
void Marquer(int bit)
  {
   g_notif |= bit;
   string j = g_notifJour;
   GlobalVariableSet(GvNom(P.nom + "_notif_" + StringSubstr(j, 0, 4) + StringSubstr(j, 5, 2) + StringSubstr(j, 8, 2)), g_notif);
  }
void NotifierUneFois(int bit, string texte, bool fort) { if(DejaNotifie(bit)) return; Marquer(bit); Notifier(texte, fort); }
string ModeTexte() { return g_auto ? "AUTO : l'ordre part tout seul" : "manuel : touche " + InpTouche; }
string HnY(long utc) { return Hm(NyLocal(utc)) + " NY"; }
//--- feu rouge (US100, SP500) ----------------------------------------
bool FeuBloque() { return P.feu && g_feuOn && g_feuCalc && g_feuRouge; }
string FeuTexte()
  {
   if(!P.feu) return "";
   if(!g_feuCalc) return "Feu : pas encore calculé (il faut l'historique M1 des derniers mois)";
   string base = "10 derniers setups " + (g_feuS >= 0 ? "+" : "") + Fr(g_feuS, 1) + " R" + (g_feuN < 10 ? " (" + I(g_feuN) + " seulement)" : "");
   if(g_feuRouge) return (g_feuOn ? "FEU ROUGE · pas de trade aujourd'hui (règle suivie à blanc) · " : "FEU ROUGE désactivé (prévenir seulement) · ") + base;
   return "Feu vert · " + base + (g_feuOn ? "" : " · feu rouge désactivé");
  }
// somme des 10 derniers setups (entrées, résultat à 3R) avant l'instant t ; e* triés du plus récent au plus ancien
void FeuDe(long &eT[], double &eR[], int ne, long t, double &somme, int &cnt)
  {
   somme = 0; cnt = 0;
   for(int i = 0; i < ne && cnt < 10; i++) if(eT[i] < t) { somme += eR[i]; cnt++; }
  }
string FeuJson(double somme, int cnt)
  {
   return "\"feu\":{\"c\":" + Q(cnt >= 10 && somme < 0 ? "rouge" : "vert") + ",\"s\":" + N(somme, 2) + ",\"n\":" + I(cnt) + ",\"on\":" + (g_feuOn ? "true" : "false") + "}";
  }
// une notification quand le feu change de couleur (début de séance)
void SuivreFeu()
  {
   if(!P.feu || !g_feuCalc) return;
   string gv = GvNom(P.nom + "_feu_c");
   int avant = GlobalVariableCheck(gv) ? (int)GlobalVariableGet(gv) : 0;
   int maint = g_feuRouge ? 1 : 0;
   if(maint != avant)
      NotifierUneFois(N_FEU, g_feuRouge ? "FEU ROUGE · les 10 derniers setups font " + Fr(g_feuS, 1) + " R : " + (g_feuOn ? "pas de trade sur " + P.nom + " jusqu'au retour au vert (la règle est suivie à blanc)" : "feu désactivé, Desk Key prévient seulement")
                                        : "FEU VERT · les 10 derniers setups font +" + Fr(g_feuS, 1) + " R : trading repris sur " + P.nom, true);
   GlobalVariableSet(gv, maint);
  }
// suit les étapes du setup et la position du jour
void SuivreNotifs()
  {
   if(!G.ok || g_jour == "") return;
   long now = NowUtc();
   if(InpNotifTout && G.dir != 0 && now >= G.t925 && now < G.t11)
      NotifierUneFois(N_SENS, (G.dir > 0 ? "ACHATS" : "VENTES") + " uniquement aujourd'hui (H4 " + Sens(G.h4) + (P.tendance == 1 ? ", Daily " + Sens(G.d1) : (P.tendance == 2 ? ", H1 " + Sens(G.h1) : "")) + ")"
                      + (FeuBloque() ? " · FEU ROUGE : pas d'ordre aujourd'hui" : ""), false);
   if(InpNotifTout && S.sweepT > 0 && now < G.t11)
      NotifierUneFois(N_JUDAS, "Judas fait à " + Hm(ParisLocal(S.sweepT)) + " Paris · attente de la cassure", false);
   if(S.etape == E_PRET && now < G.tF)
     {
      double e = NormPx(S.entry), sl = NormPx(S.sl), lots = Lot(e, sl);
      if(FeuBloque())
         NotifierUneFois(N_PRET, "setup du jour (" + (G.dir > 0 ? "achat" : "vente") + " limite " + Px(e) + ") · FEU ROUGE : pas d'ordre, la règle est suivie à blanc", false);
      else
         NotifierUneFois(N_PRET, "SETUP PRÊT · " + (G.dir > 0 ? "ACHAT" : "VENTE") + " limite " + Px(e) + " · SL " + Px(sl) + " · TP " + Px(NormPx(TpPrix(S, G.dir, g_tp))) + " (" + Fr(g_tp, 1) + "R) · "
                         + Fr(lots, 2) + " lot · risque " + Fr(RisqueArgent(e, sl, lots), 0) + " " + AccountInfoString(ACCOUNT_CURRENCY) + " · "
                         + (now < G.t10 ? "départ 10:00 NY (" + Hm(ParisLocal(G.t10)) + " Paris) · " : "") + "entrées jusqu'à " + HnY(G.tF) + " · " + ModeTexte()
                         + (g_protect ? " · protection annonces ON" : "") + (P.feu && g_feuRouge && !g_feuOn ? " · feu rouge désactivé" : ""), true);
     }
   if(S.etape == E_IGNORE && DejaNotifie(N_PRET))
      NotifierUneFois(N_AVANT10, "setup annulé : le 50 % a été touché avant 10:00 NY (pas de trade, comme le backtest)", false);
   ulong pos = MaPosition(), ord = MonOrdre();
   if(ord != 0) g_ordSuivi = ord;
   else if(g_ordSuivi != 0 && pos == 0)
     {
      g_ordSuivi = 0;
      if(now >= G.tF - 5) NotifierUneFois(N_ANNULE, "ordre expiré à " + HnY(G.tF) + " sans remplissage (pas de trade aujourd'hui)", false);
     }
   if(pos != 0) g_ordSuivi = 0;
   if(pos != 0 && g_posSuivie == 0)
     {
      g_posSuivie = pos;
      if(PositionSelectByTicket(pos))
         NotifierUneFois(N_REMPLI, "EN POSITION · " + (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY ? "achat " : "vente ") + Fr(PositionGetDouble(POSITION_VOLUME), 2) + " lot à "
                         + Px(PositionGetDouble(POSITION_PRICE_OPEN)) + " · SL " + Px(PositionGetDouble(POSITION_SL)) + " · TP " + Px(PositionGetDouble(POSITION_TP)), true);
     }
   if(pos == 0 && g_posSuivie != 0)
     {
      ulong id = g_posSuivie; g_posSuivie = 0;
      double net = 0; string why = "fermée";
      if(HistorySelectByPosition(id))
         for(int i = 0; i < HistoryDealsTotal(); i++)
           {
            ulong tk = HistoryDealGetTicket(i);
            if(tk == 0) continue;
            net += HistoryDealGetDouble(tk, DEAL_PROFIT) + HistoryDealGetDouble(tk, DEAL_COMMISSION) + HistoryDealGetDouble(tk, DEAL_SWAP) + HistoryDealGetDouble(tk, DEAL_FEE);
            if(HistoryDealGetInteger(tk, DEAL_ENTRY) == DEAL_ENTRY_OUT)
              {
               long rs = HistoryDealGetInteger(tk, DEAL_REASON);
               why = rs == DEAL_REASON_TP ? "TP touché" : (rs == DEAL_REASON_SL ? "stop touché" : (rs == DEAL_REASON_EXPERT ? "fermée par Desk Key (13:00 NY)" : "fermée à la main"));
              }
           }
      NotifierUneFois(N_SORTIE, "SORTIE · " + why + " · résultat " + (net >= 0 ? "+" : "") + Fr(net, 0) + " " + AccountInfoString(ACCOUNT_CURRENCY)
                      + " · équité " + Fr(AccountInfoDouble(ACCOUNT_EQUITY), 0), true);
     }
   SuivreNotifs2(now, pos);
  }
// second trade de l'or : prêt, en position (stop du trade 1 remonté), sortie
void SuivreNotifs2(long now, ulong pos1)
  {
   if(!P.second || !g_second) return;
   if(S.s2etat == 4 && now < G.t12 && pos1 != 0 && MonOrdre2() == 0 && MaPosition2() == 0 && !g_t2Fait)
     {
      double e = NormPx(S.s2e), sl = NormPx(S.s2sl), lots = Lot(e, sl);
      NotifierUneFois(N_S2PRET, "SECOND TRADE PRÊT · " + (G.dir > 0 ? "ACHAT" : "VENTE") + " limite " + Px(e) + " · SL " + Px(sl) + " · TP " + Px(NormPx(S.s2tp)) + " (le TP du trade 1, " + Fr(S.s2rr, 1) + "R) · "
                      + Fr(lots, 2) + " lot · au remplissage, le stop du trade 1 passe à " + Px(sl) + " · "
                      + (g_auto ? "AUTO : l'ordre part tout seul" : "touche " + InpTouche + " pour le placer") + " · jusqu'à 12:00 NY", true);
     }
   ulong p2 = MaPosition2();
   if(p2 != 0 && g_pos2Suivie == 0)
     {
      g_pos2Suivie = p2;
      if(PositionSelectByTicket(p2))
         NotifierUneFois(N_S2REMPLI, "SECOND TRADE EN POSITION · " + Fr(PositionGetDouble(POSITION_VOLUME), 2) + " lot à " + Px(PositionGetDouble(POSITION_PRICE_OPEN)) + " · SL " + Px(PositionGetDouble(POSITION_SL))
                         + " · TP " + Px(PositionGetDouble(POSITION_TP)) + " · stop du trade 1 remonté au même niveau", true);
     }
   if(p2 == 0 && g_pos2Suivie != 0)
     {
      ulong id = g_pos2Suivie; g_pos2Suivie = 0;
      double net = 0;
      if(HistorySelectByPosition(id))
         for(int i = 0; i < HistoryDealsTotal(); i++)
           {
            ulong tk = HistoryDealGetTicket(i);
            if(tk != 0) net += HistoryDealGetDouble(tk, DEAL_PROFIT) + HistoryDealGetDouble(tk, DEAL_COMMISSION) + HistoryDealGetDouble(tk, DEAL_SWAP) + HistoryDealGetDouble(tk, DEAL_FEE);
           }
      NotifierUneFois(N_S2SORTIE, "SORTIE DU SECOND TRADE · résultat " + (net >= 0 ? "+" : "") + Fr(net, 0) + " " + AccountInfoString(ACCOUNT_CURRENCY) + " · équité " + Fr(AccountInfoDouble(ACCOUNT_EQUITY), 0), true);
     }
  }

bool Placer()
  {
   long now = NowUtc();
   if(S.etape != E_PRET) { Msg("pas de setup prêt"); return false; }
   if(FeuBloque()) { g_arme = false; Msg("FEU ROUGE : pas d'ordre aujourd'hui sur " + P.nom + " (bouton FEU pour le désactiver)"); return false; }
   if(now < G.t10) { g_arme = true; Msg("armé : l'ordre partira à 10:00 NY s'il est encore valide"); return false; }
   if(now >= G.tF) { Msg("fenêtre d'entrée terminée (" + HnY(G.tF) + ")"); return false; }
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
   if(lots <= 0)
     {
      Msg("lot impossible : risque trop faible pour le lot minimum");
      static datetime dernierLot = 0;
      if(TimeLocal() - dernierLot > 600) { dernierLot = TimeLocal(); Notifier("ordre NON placé : risque trop faible pour le lot minimum", true); }
      return false;
     }
   string cmt = "DeskKey " + P.nom + " " + Fr(g_tp, 1) + "R";
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK), bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   bool ok;
   // ordre limite : expiration à la fin des entrées chez FTMO, pour qu'il soit annulé même si MT5 est fermé
   bool marche = G.dir > 0 ? ask <= entry : bid >= entry;
   bool expire = !marche && ExpirationPossible() && G.tF - now >= 120;
   ENUM_ORDER_TYPE_TIME tt = expire ? ORDER_TIME_SPECIFIED : ORDER_TIME_GTC;
   datetime ex = expire ? ToSrv(G.tF) : 0;
   if(G.dir > 0) ok = marche ? trade.Buy(lots, _Symbol, 0, sl, tp, cmt) : trade.BuyLimit(lots, entry, _Symbol, sl, tp, tt, ex, cmt);
   else          ok = marche ? trade.Sell(lots, _Symbol, 0, sl, tp, cmt) : trade.SellLimit(lots, entry, _Symbol, sl, tp, tt, ex, cmt);
   if(!ok && expire && trade.ResultRetcode() == TRADE_RETCODE_INVALID_EXPIRATION)
     {
      Print("Desk Key : expiration refusée par le serveur, ordre placé sans expiration (annulation par Desk Key à " + HnY(G.tF) + ")");
      if(G.dir > 0) ok = trade.BuyLimit(lots, entry, _Symbol, sl, tp, ORDER_TIME_GTC, 0, cmt);
      else          ok = trade.SellLimit(lots, entry, _Symbol, sl, tp, ORDER_TIME_GTC, 0, cmt);
      expire = false;
     }
   if(ok && (trade.ResultRetcode() == TRADE_RETCODE_DONE || trade.ResultRetcode() == TRADE_RETCODE_PLACED))
     {
      g_arme = false;
      Msg((G.dir > 0 ? "ACHAT" : "VENTE") + " " + Fr(lots, 2) + " lot à " + Px(entry) + " · SL " + Px(sl) + " · TP " + Px(tp) + (expire ? " · expire à " + HnY(G.tF) + " chez FTMO" : ""));
      NotifierUneFois(N_ORDRE, "ORDRE PLACÉ · " + (G.dir > 0 ? "achat" : "vente") + " limite " + Px(entry) + " · " + Fr(lots, 2) + " lot · SL " + Px(sl) + " · TP " + Px(tp)
                      + (expire ? " · expire chez FTMO à " + HnY(G.tF) + " (même si MT5 est fermé)" : " · annulé par Desk Key à " + HnY(G.tF)), false);
      return true;
     }
   Msg("refusé par le serveur : " + trade.ResultRetcodeDescription());
   static datetime dernierRefus = 0;
   if(TimeLocal() - dernierRefus > 600) { dernierRefus = TimeLocal(); Notifier("ORDRE REFUSÉ par le serveur : " + trade.ResultRetcodeDescription() + " · vérifiez MT5 (Algo Trading activé ?)", true); }
   return false;
  }
// second trade de l'or : limite au 50 % de la nouvelle jambe, stop sous le repli, objectif = TP du trade 1, avant 12:00 NY
bool PlacerT2()
  {
   long now = NowUtc();
   if(!P.second || !g_second) return false;
   if(S.s2etat == 5 || S.s2etat == 6) { Msg("second trade : " + (S.s2info != "" ? S.s2info : "pas de setup possible aujourd'hui")); return false; }
   if(S.s2etat != 4) { g_arme2 = true; Msg("second trade armé : l'ordre partira dès que le setup sera prêt (avant 12:00 NY)"); return false; }
   if(now >= G.t12) { Msg("second trade : fenêtre terminée (12:00 NY)"); return false; }
   if(MaPosition() == 0) { Msg("second trade : seulement pendant que le trade 1 est ouvert"); return false; }
   if(g_t2Fait || MaPosition2() != 0 || MonOrdre2() != 0) { Msg("second trade déjà pris aujourd'hui"); return false; }
   int ev;
   if(Bloque(now, ev)) { g_arme2 = true; Msg("annonce " + g_evNom[ev] + " : second trade différé (protection)"); return false; }
   double entry = NormPx(S.s2e), sl = NormPx(S.s2sl), tp = NormPx(S.s2tp);
   if((tp - entry) * G.dir <= 0 || (entry - sl) * G.dir <= 0) { Msg("second trade : niveaux incohérents, pas d'ordre"); return false; }
   double lots = Lot(entry, sl);
   if(lots <= 0) { Msg("second trade : risque trop faible pour le lot minimum"); return false; }
   string cmt = "DeskKey " + P.nom + " 2e";
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK), bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   bool marche = G.dir > 0 ? ask <= entry : bid >= entry;
   bool expire = !marche && ExpirationPossible() && G.t12 - now >= 120;
   ENUM_ORDER_TYPE_TIME tt = expire ? ORDER_TIME_SPECIFIED : ORDER_TIME_GTC;
   datetime ex = expire ? ToSrv(G.t12) : 0;
   bool ok;
   if(G.dir > 0) ok = marche ? trade2.Buy(lots, _Symbol, 0, sl, tp, cmt) : trade2.BuyLimit(lots, entry, _Symbol, sl, tp, tt, ex, cmt);
   else          ok = marche ? trade2.Sell(lots, _Symbol, 0, sl, tp, cmt) : trade2.SellLimit(lots, entry, _Symbol, sl, tp, tt, ex, cmt);
   if(!ok && expire && trade2.ResultRetcode() == TRADE_RETCODE_INVALID_EXPIRATION)
     {
      if(G.dir > 0) ok = trade2.BuyLimit(lots, entry, _Symbol, sl, tp, ORDER_TIME_GTC, 0, cmt);
      else          ok = trade2.SellLimit(lots, entry, _Symbol, sl, tp, ORDER_TIME_GTC, 0, cmt);
      expire = false;
     }
   if(ok && (trade2.ResultRetcode() == TRADE_RETCODE_DONE || trade2.ResultRetcode() == TRADE_RETCODE_PLACED))
     {
      g_arme2 = false;
      Msg("second trade : " + (G.dir > 0 ? "achat" : "vente") + " " + Fr(lots, 2) + " lot à " + Px(entry) + " · SL " + Px(sl) + " · TP " + Px(tp));
      NotifierUneFois(N_S2ORDRE, "SECOND TRADE PLACÉ · " + (G.dir > 0 ? "achat" : "vente") + " limite " + Px(entry) + " · " + Fr(lots, 2) + " lot · SL " + Px(sl) + " · TP " + Px(tp)
                      + (expire ? " · expire chez FTMO à 12:00 NY" : " · annulé par Desk Key à 12:00 NY"), false);
      return true;
     }
   Msg("second trade refusé par le serveur : " + trade2.ResultRetcodeDescription());
   return false;
  }
void Annuler(string pourquoi)
  {
   ulong tk = MonOrdre();
   if(tk != 0 && trade.OrderDelete(tk))
     {
      Msg("ordre annulé (" + pourquoi + ")");
      if(pourquoi != "à votre demande") NotifierUneFois(N_ANNULE, "ordre annulé : " + pourquoi, false);
     }
   g_arme = false;
  }
void Annuler2(string pourquoi)
  {
   ulong tk = MonOrdre2();
   if(tk != 0 && trade2.OrderDelete(tk))
     {
      Msg("second trade annulé (" + pourquoi + ")");
      if(pourquoi != "à votre demande") NotifierUneFois(N_S2ANNULE, "second trade annulé : " + pourquoi, false);
     }
   g_arme2 = false;
  }
// second trade : placement, suivi du 50 %, stop du trade 1 remonté, annulation, sortie de 13:00 NY
void GererT2()
  {
   if(!P.second) return;
   static datetime essaiSl = 0, essai2 = 0;
   long now = NowUtc();
   ulong pos1 = MaPosition(), ord2 = MonOrdre2(), pos2 = MaPosition2();
   if(pos2 != 0) g_t2Fait = true;
   if(pos2 != 0 && InpSortie13h && now >= G.t13 && now < G.t13 + 6 * 3600) { if(trade2.PositionClose(pos2)) Msg("second trade fermé à 13:00 NY"); return; }
   // au remplissage du second trade : stop du trade 1 remonté au stop du second trade
   if(pos2 != 0 && pos1 != 0 && PositionSelectByTicket(pos2))
     {
      double sl2 = PositionGetDouble(POSITION_SL);
      if(sl2 > 0 && PositionSelectByTicket(pos1))
        {
         double sl1 = PositionGetDouble(POSITION_SL), tp1 = PositionGetDouble(POSITION_TP);
         bool mieux = G.dir > 0 ? (sl1 <= 0 || sl2 > sl1 + _Point / 2) : (sl1 <= 0 || sl2 < sl1 - _Point / 2);
         if(mieux && TimeLocal() - essaiSl >= 10)
           {
            essaiSl = TimeLocal();
            if(trade.PositionModify(pos1, sl2, tp1)) { Msg("stop du trade 1 remonté à " + Px(sl2) + " (second trade rempli)"); }
            else Msg("stop du trade 1 : modification refusée (" + trade.ResultRetcodeDescription() + ")");
           }
        }
     }
   if(ord2 != 0)
     {
      if(now >= G.t12) { Annuler2("12:00 NY sans remplissage"); return; }
      if(pos1 == 0) { Annuler2("trade 1 fermé"); return; }
      if(!g_second || S.s2etat == 6) { Annuler2("setup du second trade plus valide"); return; }
      if(InpSuivreFibo && S.s2etat == 4 && OrderSelect(ord2))
        {
         double px = OrderGetDouble(ORDER_PRICE_OPEN), ts = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
         if(MathAbs(px - NormPx(S.s2e)) >= ts && trade2.OrderDelete(ord2)) { Msg("second trade : la jambe s'allonge, ordre déplacé au nouveau 50 %"); PlacerT2(); }
        }
      return;
     }
   if(!g_second || pos2 != 0 || g_t2Fait || pos1 == 0) return;
   int ev;
   if(S.s2etat == 4 && now < G.t12 && (g_arme2 || g_auto) && !Bloque(now, ev) && TimeLocal() - essai2 >= 30) { essai2 = TimeLocal(); PlacerT2(); }
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
      if(now >= G.tF) { Annuler(HnY(G.tF) + " sans remplissage"); return; }
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
           { if(trade.OrderDelete(ord)) { Msg("la jambe s'allonge : ordre déplacé au nouveau 50 %"); Placer(); } }
         else
           {
            double lv = Lot(NormPx(S.entry), NormPx(S.sl));
            if(lv > 0 && MathAbs(OrderGetDouble(ORDER_VOLUME_CURRENT) - lv) > 1e-6 && trade.OrderDelete(ord)) { Msg("risque modifié : ordre remis avec " + Fr(lv, 2) + " lot"); Placer(); }
           }
        }
      return;
     }
   if(pos != 0 || g_tradeFait) return;
   static datetime essai = 0;
   int evb;
   if(S.etape == E_PRET && now >= G.t10 && now < G.tF && (g_arme || g_auto) && !FeuBloque() && !Bloque(now, evb) && TimeLocal() - essai >= 30)
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
   j += ",\"etat\":" + Q(EtapeCode(s.etape)) + ",\"info\":" + Q(s.info) + ",\"fini\":" + (s.fini ? "true" : "false") + ",\"fin\":" + I(c.tF);
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
   // second trade (or) : étape, niveaux, résultat du second trade et du trade 1 avec le stop remonté
   if(s.s2etat > 0)
     {
      string e2 = s.s2etat == 1 ? "impulsion" : (s.s2etat == 2 ? "repli" : (s.s2etat == 3 ? "cassure" : (s.s2etat == 4 ? "pret" : (s.s2etat == 5 ? "rempli" : "annule"))));
      j += ",\"s2\":{\"etat\":" + Q(e2) + ",\"info\":" + Q(s.s2info) + ",\"tpR\":" + N(g_tp, 1);
      if(s.s2etat >= 3) j += ",\"pl\":" + N(s.s2PL, dg) + ",\"sh\":" + N(s.s2SH, dg);
      if(s.s2etat >= 4 && s.s2T0 > 0) j += ",\"t0\":" + I(s.s2T0) + ",\"e\":" + N(s.s2e, dg) + ",\"sl\":" + N(s.s2sl, dg) + ",\"tp\":" + N(s.s2tp, dg) + ",\"rr\":" + N(s.s2rr, 2);
      if(s.s2etat == 5) j += ",\"fill\":" + I(s.s2fillT) + ",\"r\":" + N(s.s2r, 2) + ",\"t1\":" + N(s.s2t1, 2) + ",\"fini\":" + (s.s2fini ? "true" : "false");
      j += "}";
     }
   if(aujourdhui)
     {
      if(s.ok) j += ",\"lot\":" + N(Lot(NormPx(s.entry), NormPx(s.sl)), 2) + ",\"tpR\":" + N(g_tp, 1);
      double vol, px; long pid = TradeDuJour(vol, px);
      if(pid != 0) j += ",\"pris\":{\"id\":" + I(pid) + ",\"vol\":" + N(vol, 2) + ",\"px\":" + N(px, dg) + ",\"tpR\":" + N(g_tp, 1) + "}";
      else if(MonOrdre() != 0) j += ",\"ordre\":true";
      if(P.second)
        {
         double v2, p2; long pid2 = TradeDuJourM(P.magic + 1, v2, p2);
         if(pid2 != 0) j += ",\"pris2\":{\"id\":" + I(pid2) + ",\"vol\":" + N(v2, 2) + ",\"px\":" + N(p2, dg) + "}";
         else if(MonOrdre2() != 0) j += ",\"ordre2\":true";
         j += ",\"second\":" + (g_second ? "true" : "false");
        }
      if(P.feu && g_feuCalc) j += "," + FeuJson(g_feuS, g_feuN);
      j += ",\"auto\":" + (g_auto ? "true" : "false") + ",\"protection\":" + (g_protect ? "true" : "false");
      j += ",\"rMode\":" + I(g_rMode) + ",\"rVal\":" + N(g_rVal, 2) + ",\"rUsd\":" + N(RisqueVoulu(), 0);
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
      Efface(p + "e2"); Efface(p + "sl2"); Efface(p + "res2");
      if(!complet)
        {
         string why = s.etape == E_PAS_TRADE ? "pas de trade : " + c.raison : (s.sweepT > 0 ? "Judas sans cassure valide" : "pas de Judas");
         if(s.preHi >= s.preLo) Txt(p + "why", c.t930, c.dir < 0 ? s.preHi : s.preLo, why, clrGray, 8, c.dir < 0 ? ANCHOR_LEFT_LOWER : ANCHOR_LEFT_UPPER);
        }
      return;
     }
   Efface(p + "why");
   double r = MathAbs(s.entry - s.sl);
   long tEnd = complet ? c.t13 : (s.exitT > 0 ? s.exitT : c.tF);
   Mark(p + "mss", s.mssT, s.sw, 159, cSw, "Cassure validée");
   if(complet)
     {
      Seg(p + "sw", s.swT, s.mssT + 300, s.sw, cSw, STYLE_SOLID, 1, "");
      Seg(p + "f0", s.extT, c.t13, s.ext, cFib, STYLE_DOT, 1, "Fibo 0 % (Judas)");
      Seg(p + "f100", s.extT, c.t13, s.far, cFib, STYLE_DOT, 1, "Fibo 100 %");
     }
   Seg(p + "entry", s.mssT, tEnd, s.entry, cEnt, STYLE_SOLID, 2, complet ? "Entrée 50 % " + Px(s.entry) : "");
   Seg(p + "sl", s.mssT, tEnd, s.sl, clrRed, STYLE_SOLID, 2, complet ? "SL " + Px(s.sl) : "");
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
      Rect(p + "bw", s.fillT, tx, s.entry, TpPrix(s, c.dir, g_tp), clair ? (color)0xB8E6B8 : (color)0x1E4A1E);
      Rect(p + "bl", s.fillT, tx, s.entry, s.sl, clair ? (color)0xB8B8EE : (color)0x1E1E4A);
      double rr = ResRegle(s);
      string lab = (rr > 0 ? "+" : "") + Fr(rr, 1) + "R" + (s.s2etat == 5 ? " (2 trades)" : "") + (s.fini && (s.s2etat != 5 || s.s2fini) ? "" : " (en cours)");
      Txt(p + "res", tx, c.dir > 0 ? TpPrix(s, c.dir, g_tp) : s.sl, lab, rr > 0 ? cTp : clrRed, 11, ANCHOR_LEFT_LOWER);
     }
   else
     {
      Efface(p + "bw"); Efface(p + "bl");
      if(!complet)
        {
         string lab = s.etape == E_IGNORE ? "touché avant 10:00 NY : pas de trade" : "pas de remplissage avant " + HnY(c.tF);
         Txt(p + "res", tEnd, s.entry, lab, clrGray, 8, ANCHOR_LEFT);
        }
      else Efface(p + "res");
     }
   // second trade (or) : 50 % de la nouvelle jambe, stop (et stop du trade 1 remonté), résultat
   if(s.s2etat >= 4 && s.s2T0 > 0)
     {
      long t2e = s.s2etat == 5 ? (complet ? c.t13 : (s.s2exitT > 0 ? s.s2exitT : c.t13)) : (complet ? c.t12 : c.t12);
      Seg(p + "e2", s.s2T0, t2e, s.s2e, cEnt, STYLE_DASH, 1, complet ? "2e trade 50 % " + Px(s.s2e) : "");
      Seg(p + "sl2", s.s2T0, t2e, s.s2sl, clrRed, STYLE_DASH, 1, complet ? "Stop 2e trade = stop du trade 1 remonté " + Px(s.s2sl) : "");
      if(s.s2etat == 5) Txt(p + "res2", t2e, s.s2e, " 2e : " + (s.s2r > 0 ? "+" : "") + Fr(s.s2r, 1) + "R · trade 1 " + (s.s2t1 > 0 ? "+" : "") + Fr(s.s2t1, 1) + "R", s.s2r > 0 ? cTp : clrRed, 8, ANCHOR_LEFT);
      else Efface(p + "res2");
     }
   else { Efface(p + "e2"); Efface(p + "sl2"); Efface(p + "res2"); }
  }

void DessinerJour()
  {
   if(!G.ok) return;
   g_clair = FondClair();
   VLine("v930", G.t930, clrGray, "9:30 NY");
   VLine("v10", G.t10, clrGoldenrod, "10:00 NY : début des entrées");
   VLine("v11", G.tF, clrGoldenrod, HnY(G.tF) + " : fin des entrées" + (P.second ? " (et du second trade)" : ""));
   VLine("v13", G.t13, clrIndianRed, "13:00 NY : sortie");
   if(P.judasMin > 0) VLine("v950", G.t950, clrOrange, "9:50 NY : Judas valable après"); else Efface("v950");
   DessinerSetup("J_", G, S, true);
   ChartRedraw();
  }

//--- historique : setups des N derniers jours ----------------------
void Historique(bool envoyer)
  {
   ObjectsDeleteAll(0, PFX + "H");
   ArrayResize(g_hLab, 0); ArrayResize(g_hCol, 0); ArrayResize(g_hT, 0); g_hObj = 0;
   g_hStat = "";
   int extra = P.feu ? 120 : 0;   // séances de plus pour le feu rouge : il faut les 10 derniers setups avant chaque jour
   if(g_histN <= 0 && extra == 0) { ChartRedraw(); return; }
   g_clair = FondClair();
   ulong t0 = GetTickCount64();
   Bar m[];
   long now = NowUtc();
   int n = LoadM1(now - (long)((g_histN + extra) * 7 / 5 + 60) * 86400, G.t800 - 60, m);
   if(n < 1000) { Print("Desk Key ", P.nom, " : historique M1 insuffisant (", n, " bougies) — Outils > Options > Graphiques > Barres max = Illimité"); return; }
   // agrégats H4 / H1 et clôtures journalières, calculés une seule fois
   Bar a4[], a1[];
   int n4 = Aggregate(m, n, 14400, 7200, (long)9e15, a4, 10000000);
   int n1 = Aggregate(m, n, 3600, 0, (long)9e15, a1, 10000000);
   long dT[]; double dC[]; int nd = 0, lastDay = -1;
   for(int i = 0; i < n; i++)
     {
      MqlDateTime t; TimeToStruct((datetime)m[i].t, t);
      int key = t.year * 10000 + t.mon * 100 + t.day;
      if(key == lastDay) continue;
      lastDay = key;
      if(t.day_of_week == 0 || t.day_of_week == 6) continue;
      long o930 = NyToUtc(t.year, t.mon, t.day, 9, 30), o16 = NyToUtc(t.year, t.mon, t.day, 16, 0);
      int a = Lb(m, n, o930);
      if(a >= n || m[a].t != o930) continue;
      int z = Lb(m, n, o16) - 1;
      if(z < 0) continue;
      nd++; ArrayResize(dT, nd, 512); ArrayResize(dC, nd, 512); dT[nd - 1] = o930; dC[nd - 1] = m[z].c;
     }
   string rows[]; long rowT[]; double rowR[]; bool rowE[]; int nr = 0;
   long eT[]; double eR[]; int ne = 0, neOld = 0;   // entrées (du plus récent au plus ancien) : 9:30 NY et résultat à 3R
   int found = 0, scanned = 0, nMiss = 0;
   long ny0 = NyLocal(G.t930);
   for(int back = 1; back <= (g_histN + extra) * 2 + 10; back++)
     {
      if(scanned >= g_histN && (extra == 0 || neOld >= 10 || scanned >= g_histN + extra)) break;
      MqlDateTime t; TimeToStruct((datetime)(ny0 - (long)back * 86400), t);
      if(t.day_of_week == 0 || t.day_of_week == 6) continue;
      long o930 = NyToUtc(t.year, t.mon, t.day, 9, 30);
      int a = Lb(m, n, o930);
      if(a >= n || m[a].t != o930) continue;   // jour sans séance
      Ctx c; BuildCtxFast(m, n, a4, n4, a1, n1, dT, dC, nd, t.year, t.mon, t.day, c);
      Setup s; ScanDay(m, n, c, c.t13 + 60, s);
      bool montre = scanned < g_histN;
      scanned++;
      if(s.etape == E_TOUCHE)
        {
         ne++; ArrayResize(eT, ne, 256); ArrayResize(eR, ne, 256); eT[ne - 1] = c.t930; eR[ne - 1] = s.r3;
         if(!montre) neOld++;
        }
      if(!montre) continue;
      string p = "H" + StringFormat("%02d%02d%02d", t.year % 100, t.mon, t.day) + "_";
      if(g_histo)
        {
         DessinerSetup(p, c, s, false);
         VLine(p + "v", c.t930, g_clair ? clrSilver : (color)0x505050, StringFormat("%02d/%02d · 9:30 NY", t.day, t.mon));
        }
      // résumé pour le panneau
      string lab = StringFormat("%02d/%02d ", t.day, t.mon); color col = clrDimGray;
      double rr = 0;
      if(s.etape == E_TOUCHE)
        {
         rr = ResRegle(s);
         lab += (rr > 0 ? "+" : "") + Fr(rr, 1) + "R"; col = rr > 0 ? clrForestGreen : clrFireBrick;
        }
      else if(s.etape == E_EXPIRE) { lab += "manqué"; nMiss++; } // setup valide, 50 % pas touché
      else if(s.etape == E_IGNORE) lab += "< 10h";        // 50 % touché avant 10:00 NY
      else if(s.etape == E_PAS_TRADE) lab += "tendance";  // pas de sens du jour
      else lab += "rien";                                  // pas de Judas ou pas de cassure valide
      int k = ArraySize(g_hLab);
      ArrayResize(g_hLab, k + 1); ArrayResize(g_hCol, k + 1); ArrayResize(g_hT, k + 1);
      g_hLab[k] = lab; g_hCol[k] = col; g_hT[k] = c.t930;
      nr++; ArrayResize(rows, nr, 256); ArrayResize(rowT, nr, 256); ArrayResize(rowR, nr, 256); ArrayResize(rowE, nr, 256);
      rows[nr - 1] = SetupJson(c, s, false); rowT[nr - 1] = c.t930; rowR[nr - 1] = rr; rowE[nr - 1] = s.etape == E_TOUCHE;
      found++;
     }
   // feu rouge : état d'aujourd'hui et de chaque jour de l'historique (10 setups précédents)
   int nTr = 0, nWin = 0, nVert = 0; double sumR = 0, sumVert = 0;
   if(P.feu)
     {
      FeuDe(eT, eR, ne, G.t930, g_feuS, g_feuN);
      g_feuRouge = g_feuN >= 10 && g_feuS < 0;
      g_feuCalc = true;
     }
   for(int i = 0; i < nr; i++)
     {
      bool rouge = false;
      if(P.feu)
        {
         double sf; int cf; FeuDe(eT, eR, ne, rowT[i], sf, cf);
         rouge = cf >= 10 && sf < 0;
         rows[i] = StringSubstr(rows[i], 0, StringLen(rows[i]) - 1) + "," + FeuJson(sf, cf) + "}";
         if(rouge && i < ArraySize(g_hLab)) g_hLab[i] = StringSubstr(g_hLab[i], 0, 6) + "●" + StringSubstr(g_hLab[i], 6);   // ● = jour sous feu rouge
        }
      if(rowE[i])
        {
         nTr++; sumR += rowR[i]; if(rowR[i] > 0) nWin++;
         if(!rouge) { nVert++; sumVert += rowR[i]; }
        }
     }
   // envoi à l'application par paquets de 25 jours
   if(envoyer)
      for(int i = 0; i < nr; i += 25)
        {
         string pk = "[";
         for(int j = i; j < MathMin(nr, i + 25); j++) pk += (j > i ? "," : "") + rows[j];
         Envoyer(pk + "]");
        }
   g_hStat = "Histo " + I(found) + " séances : " + I(nTr) + " entrées · " + (nTr > 0 ? I((int)MathRound(100.0 * nWin / nTr)) + " % gagnants · " : "")
             + (sumR >= 0 ? "+" : "") + Fr(sumR, 1) + "R à " + Fr(g_tp, 1) + "R · " + I(nMiss) + " manqués";
   if(P.feu && nTr > nVert) g_hStat += " · sous feu vert " + I(nVert) + " entrées " + (sumVert >= 0 ? "+" : "") + Fr(sumVert, 1) + "R (● = feu rouge)";
   for(int i = ObjectsTotal(0) - 1; i >= 0; i--) if(StringFind(ObjectName(0, i), PFX + "H") == 0) g_hObj++;
   string res = "";
   for(int i = 0; i < MathMin(7, ArraySize(g_hLab)); i++) res += (i > 0 ? " | " : "") + g_hLab[i];
   if(found < g_histN) g_hStat += " (M1 disponible : " + I(found) + " séances)";
   Print("Desk Key ", P.nom, " : ", g_hStat, P.feu ? " · " + FeuTexte() : "", " · ", g_hObj, " objets dessinés", g_histo ? "" : " (historique masqué)", " · ", (GetTickCount64() - t0), " ms · 7 derniers : ", res);
   ChartRedraw();
  }
// amène le graphique sur la séance d'un jour de l'historique (toutes unités de temps)
void AllerAuJour(int i)
  {
   if(i < 0 || i >= ArraySize(g_hT)) return;
   if(!g_histo) { g_histo = true; Historique(false); }
   int shift = iBarShift(_Symbol, _Period, ToSrv(g_hT[i]), false);
   if(shift < 0) return;
   ChartSetInteger(0, CHART_AUTOSCROLL, false);
   int vis = (int)ChartGetInteger(0, CHART_VISIBLE_BARS);
   ChartNavigate(0, CHART_END, -(shift - vis / 3));
   Msg("graphique placé sur le " + StringSubstr(g_hLab[i], 0, 5) + " (" + g_hLab[i] + ")");
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
void Btn(string id, int x, int y, int w, string text, color bg, color fg, int size = 9)
  {
   string n = PFX + "B" + id;
   if(ObjectFind(0, n) < 0) ObjectCreate(0, n, OBJ_BUTTON, 0, 0, 0);
   ObjectSetInteger(0, n, OBJPROP_CORNER, InpCoin == 1 ? CORNER_RIGHT_UPPER : CORNER_LEFT_UPPER);
   ObjectSetInteger(0, n, OBJPROP_XDISTANCE, InpCoin == 1 ? PX0 + PW - 10 - x : PX0 + 10 + x); ObjectSetInteger(0, n, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, n, OBJPROP_XSIZE, w); ObjectSetInteger(0, n, OBJPROP_YSIZE, 24);
   ObjectSetString(0, n, OBJPROP_TEXT, text); ObjectSetString(0, n, OBJPROP_FONT, "Arial Bold"); ObjectSetInteger(0, n, OBJPROP_FONTSIZE, size);
   ObjectSetInteger(0, n, OBJPROP_BGCOLOR, bg); ObjectSetInteger(0, n, OBJPROP_COLOR, fg); ObjectSetInteger(0, n, OBJPROP_BORDER_COLOR, clrDimGray);
   ObjectSetInteger(0, n, OBJPROP_STATE, false); ObjectSetInteger(0, n, OBJPROP_SELECTABLE, false);
  }
// champ de saisie (valeur du risque) : le texte n'est réécrit que si la valeur change, pour ne pas gêner la frappe
string g_rvAff = "";
void Edit(string id, int x, int y, int w, string text)
  {
   string n = PFX + "E" + id;
   bool neuf = ObjectFind(0, n) < 0;
   if(neuf) ObjectCreate(0, n, OBJ_EDIT, 0, 0, 0);
   ObjectSetInteger(0, n, OBJPROP_CORNER, InpCoin == 1 ? CORNER_RIGHT_UPPER : CORNER_LEFT_UPPER);
   ObjectSetInteger(0, n, OBJPROP_XDISTANCE, InpCoin == 1 ? PX0 + PW - 10 - x : PX0 + 10 + x); ObjectSetInteger(0, n, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, n, OBJPROP_XSIZE, w); ObjectSetInteger(0, n, OBJPROP_YSIZE, 24);
   ObjectSetString(0, n, OBJPROP_FONT, "Arial Bold"); ObjectSetInteger(0, n, OBJPROP_FONTSIZE, 10);
   ObjectSetInteger(0, n, OBJPROP_ALIGN, ALIGN_CENTER);
   ObjectSetInteger(0, n, OBJPROP_BGCOLOR, clrWhite); ObjectSetInteger(0, n, OBJPROP_COLOR, clrBlack); ObjectSetInteger(0, n, OBJPROP_BORDER_COLOR, clrDimGray);
   ObjectSetInteger(0, n, OBJPROP_SELECTABLE, false);
   if(neuf || text != g_rvAff) { ObjectSetString(0, n, OBJPROP_TEXT, text); g_rvAff = text; }
  }
string Sens(int v) { return v > 0 ? "haussière" : (v < 0 ? "baissière" : "neutre"); }
color  CSens(int v) { return v > 0 ? clrMediumSeaGreen : (v < 0 ? clrTomato : clrSilver); }

string EtatTexte(color &ce)
  {
   long now = NowUtc();
   ulong ord = MonOrdre(), pos = MaPosition();
   ce = clrSilver;
   if(pos != 0)
     {
      ce = clrDeepSkyBlue;
      if(P.second && g_second)
        {
         if(MaPosition2() != 0) return "EN POSITION · 2 trades (stop du trade 1 remonté) · sortie TP, SL ou 13:00 NY";
         if(MonOrdre2() != 0) return "EN POSITION · second trade placé (jusqu'à 12:00 NY)";
         if(S.s2etat == 4 && now < G.t12) { ce = clrLimeGreen; return g_auto ? "EN POSITION · second trade : placement en cours" : "SECOND TRADE PRÊT · appuyez sur " + InpTouche; }
         if(S.s2etat >= 1 && S.s2etat <= 3 && now < G.t12) return "EN POSITION · attente d'une continuation pour le second trade";
        }
      return "EN POSITION · sortie TP, SL ou 13:00 NY";
     }
   if(ord != 0) { ce = clrDeepSkyBlue; return "ORDRE PLACÉ · annulé à " + HnY(G.tF) + " s'il n'est pas rempli"; }
   if(g_tradeFait) return "TERMINÉ · trade du jour déjà pris";
   if(FeuBloque() && (S.etape == E_CASSURE || S.etape == E_PRET || S.etape == E_JUDAS)) { ce = clrTomato; return "FEU ROUGE · setup suivi à blanc, pas d'ordre"; }
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
      case E_EXPIRE:    return "EXPIRÉ · pas de remplissage avant " + HnY(G.tF);
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
   int rows = g_reduit ? 3 : 18;
   int nh = MathMin(ArraySize(g_hLab), 7);
   if(ObjectFind(0, bg) < 0) ObjectCreate(0, bg, OBJ_RECTANGLE_LABEL, 0, 0, 0);
   ObjectSetInteger(0, bg, OBJPROP_CORNER, InpCoin == 1 ? CORNER_RIGHT_UPPER : CORNER_LEFT_UPPER);
   ObjectSetInteger(0, bg, OBJPROP_XDISTANCE, InpCoin == 1 ? PX0 + PW : PX0); ObjectSetInteger(0, bg, OBJPROP_YDISTANCE, PY0);
   ObjectSetInteger(0, bg, OBJPROP_XSIZE, PW); ObjectSetInteger(0, bg, OBJPROP_YSIZE, RowY(rows) - PY0 + (g_reduit ? 34 : (nh > 0 ? 130 : 100)));
   ObjectSetInteger(0, bg, OBJPROP_BGCOLOR, (color)0x1C1712); ObjectSetInteger(0, bg, OBJPROP_BORDER_TYPE, BORDER_FLAT);
   ObjectSetInteger(0, bg, OBJPROP_COLOR, P.couleur); ObjectSetInteger(0, bg, OBJPROP_SELECTABLE, false);
   bool pret = S.etape == E_PRET && ord == 0 && pos == 0 && !g_tradeFait && now < G.tF && !FeuBloque();
   string go = now < G.t10 ? (g_arme ? "ARMÉ OK" : "ARMER (" + InpTouche + ")") : "PLACER L'ORDRE (" + InpTouche + ")";
   bool pret2 = P.second && g_second && pos != 0 && S.s2etat == 4 && MonOrdre2() == 0 && MaPosition2() == 0 && !g_t2Fait && now < G.t12;
   if(P.second && g_second && pos != 0) { go = pret2 ? "PLACER LE 2e TRADE (" + InpTouche + ")" : (g_arme2 ? "2e TRADE ARMÉ" : "ARMER LE 2e TRADE (" + InpTouche + ")"); pret = pret2; }
   if(FeuBloque() && pos == 0) go = "FEU ROUGE : PAS D'ORDRE";
   Btn("MIN", PW - 46, PY0 + 4, 26, g_reduit ? "+" : "–", clrDimGray, clrWhite);
   if(g_reduit)
     {
      for(int r = 3; r <= 18; r++) ObjectDelete(0, PFX + "L" + IntegerToString(r));
      ObjectDelete(0, PFX + "BOPT");
      ObjectDelete(0, PFX + "BPER");
      ObjectDelete(0, PFX + "BRM"); ObjectDelete(0, PFX + "BRMOINS"); ObjectDelete(0, PFX + "BRPLUS"); ObjectDelete(0, PFX + "BRINF"); ObjectDelete(0, PFX + "BNT"); ObjectDelete(0, PFX + "ERV"); g_rvAff = "";
      for(int i = 0; i < 7; i++) ObjectDelete(0, PFX + "BD" + I(i));
      ObjectDelete(0, PFX + "BX"); ObjectDelete(0, PFX + "BAUTO"); ObjectDelete(0, PFX + "BT2"); ObjectDelete(0, PFX + "BT25"); ObjectDelete(0, PFX + "BT3"); ObjectDelete(0, PFX + "BHIS"); ObjectDelete(0, PFX + "BANN");
      Lbl(0, "DESK KEY · " + P.nom + (d > 0 ? " · ACHATS" : (d < 0 ? " · VENTES" : " · pas de trade")), P.couleur, 11, "Arial Black");
      Lbl(1, etat + (P.feu && g_feuCalc && g_feuRouge ? (g_feuOn ? " · FEU ROUGE" : " · feu rouge désactivé") : "") + " · risque " + RisqueTexte(), ce, 9, "Arial Bold");
      string rs = ""; for(int i = 0; i < nh; i++) rs += (i > 0 ? " · " : "") + g_hLab[i];
      Lbl(2, nh > 0 ? "7 j : " + rs : " ", clrSilver, 8);
      Btn("GO", 0, RowY(rows) + 4, 220, go, pret ? clrForestGreen : clrDimGray, clrWhite);
      ChartRedraw();
      return;
     }
   Lbl(0, "DESK KEY · " + P.nom + " · règle A", P.couleur, 11, "Arial Black");
   Lbl(1, "NY " + Hm(NyLocal(now)) + " · Paris " + Hm(ParisLocal(now)) + " · entrées " + Hm(ParisLocal(G.t10)) + "–" + Hm(ParisLocal(G.tF)) + " Paris · sortie " + Hm(ParisLocal(G.t13)), clrSilver);
   string tend = "Tendance : H4 " + Sens(G.h4);
   if(P.tendance == 1) tend += " · Daily " + Sens(G.d1);
   else if(P.tendance == 2) tend += " · H1 " + Sens(G.h1) + " (H4 ou H1, sans conflit)";
   else tend += " · H1 " + Sens(G.h1) + (InpFiltreH1 ? " (filtre H1 actif)" : "");
   Lbl(2, tend, CSens(d));
   Lbl(3, d > 0 ? "→ ACHATS uniquement" : (d < 0 ? "→ VENTES uniquement" : "→ PAS DE TRADE aujourd'hui : " + G.raison), CSens(d), 10, "Arial Bold");
   // ligne 4 : feu rouge (indices) ou second trade (or)
   if(P.feu) Lbl(4, FeuTexte(), !g_feuCalc ? clrSilver : (g_feuRouge ? clrTomato : clrMediumSeaGreen), 9, "Arial Bold");
   else if(P.second)
     {
      string t2 = !g_second ? "Second trade : désactivé (bouton 2e TRADE)" : "Second trade : " ;
      if(g_second)
        {
         if(S.s2etat == 0) t2 += "après l'entrée du trade 1, si le prix continue (avant 12:00 NY)";
         else if(S.s2etat == 1) t2 += "attente d'une impulsion au-delà de la jambe du trade 1";
         else if(S.s2etat == 2) t2 += "impulsion faite · attente d'un repli (au-dessus du stop 1)";
         else if(S.s2etat == 3) t2 += "repli à " + Px(S.s2PL) + " · attente d'une clôture au-delà de " + Px(S.s2SH);
         else if(S.s2etat == 4) t2 += (d > 0 ? "ACHAT" : "VENTE") + " limite " + Px(S.s2e) + " · SL " + Px(S.s2sl) + " · TP " + Px(S.s2tp) + " (" + Fr(S.s2rr, 1) + "R)";
         else if(S.s2etat == 5) t2 += "rempli à " + Hm(ParisLocal(S.s2fillT)) + " Paris · " + (S.s2r > 0 ? "+" : "") + Fr(S.s2r, 1) + "R · trade 1 avec stop remonté " + (S.s2t1 > 0 ? "+" : "") + Fr(S.s2t1, 1) + "R";
         else t2 += S.s2info != "" ? S.s2info : "pas de second trade";
        }
      Lbl(4, t2, S.s2etat == 4 ? clrOrange : (S.s2etat == 5 ? clrMediumSeaGreen : clrSilver), 9);
     }
   else Lbl(4, " ", clrSilver);
   if(S.preHi >= S.preLo)
      Lbl(5, "Pré-marché : haut " + Px(S.preHi) + " · bas " + Px(S.preLo) + (d != 0 ? " · cible : le " + (d > 0 ? "bas" : "haut") : ""), clrSilver);
   else Lbl(5, "Pré-marché : en attente des données", clrSilver);
   if(S.sweepT > 0)
      Lbl(6, "1. Judas OK à " + Hm(ParisLocal(S.sweepT)) + " Paris · extrême " + Px(S.ext) + " à " + Hm(ParisLocal(S.extT)), clrMediumSeaGreen);
   else Lbl(6, "1. Judas : attendre un passage " + (d > 0 ? "sous le bas" : (d < 0 ? "au-dessus du haut" : "au-delà")) + " du pré-marché", clrSilver);
   string rule = P.judasMin > 0 ? "Judas après " + Hm(ParisLocal(G.t950)) + " Paris" : (P.fvg ? "nette ≥ 5 % du risque + FVG" : "clôture M1 au-delà du sommet");
   if(S.ok)
     {
      string c = "2. Cassure OK à " + Hm(ParisLocal(S.mssT)) + " Paris · niveau " + Px(S.sw);
      if(P.cassureMin > 0) c += " · +" + Fr(S.cassurePts, 1) + " " + P.unite + " (min " + Fr(S.cassureMinPts, 1) + ")";
      Lbl(7, c, clrMediumSeaGreen);
     }
   else if(S.etape == E_CASSURE && S.swT > 0) Lbl(7, "2. Cassure : clôture M1 au-delà de " + Px(S.sw) + " · " + rule, clrGold);
   else Lbl(7, "2. Cassure M1 · " + rule, clrSilver);
   Lbl(8, S.info != "" ? "   " + S.info : " ", clrOrange);
   if(S.ok && S.etape != E_IGNORE)
     {
      double r = MathAbs(S.entry - S.sl), lots = Lot(NormPx(S.entry), NormPx(S.sl));
      Lbl(9, "3. " + (d > 0 ? "ACHAT" : "VENTE") + " LIMITE " + Px(S.entry) + " · SL " + Px(S.sl) + " · TP " + Px(TpPrix(S, d, g_tp)) + " (" + Fr(g_tp, 1) + "R)", FeuBloque() ? clrGray : clrOrange, 10, "Arial Bold");
      Lbl(10, "   Lot " + Fr(lots, 2) + " · risque " + Fr(RisqueArgent(NormPx(S.entry), NormPx(S.sl), lots), 0) + " " + AccountInfoString(ACCOUNT_CURRENCY) + " · " + Fr(r, 1) + " " + P.unite, clrWhite);
     }
   else { Lbl(9, "3. Ordre : en attente du setup", clrSilver); Lbl(10, " ", clrSilver); }
   Lbl(11, "État : " + etat, ce, 10, "Arial Bold");
   Lbl(12, g_msg != "" && TimeLocal() - g_msgT < 120 ? "› " + g_msg : " ", clrLightSkyBlue);
   Lbl(13, "Profil " + P.nom + " : stop Judas ± " + Fr(P.marge, 1) + " " + P.unite + " · " + (P.fvg ? "FVG obligatoire" : "sans FVG") + " · " + (P.tendance == 1 ? "H4 + Daily" : (P.tendance == 2 ? "H4 ou H1" : "H4"))
       + " · entrées jusqu'à " + HnY(G.tF) + (P.feu ? " · feu rouge " + (g_feuOn ? "ON" : "OFF") : "") + (P.second ? " · 2e trade " + (g_second ? "ON" : "OFF") : ""), clrDimGray, 8);
   string ann = AnnoncesTexte();
   if(ann != "") Lbl(14, "Annonces : " + ann + " · protection " + (g_protect ? "OUI (pas d'ordre ±" + I(InpProtMin) + " min)" : "NON"), g_protect ? clrLightSkyBlue : clrOrange, 8);
   else Lbl(14, "Touches : " + InpTouche + " = placer / armer · " + InpToucheAnnul + " = annuler · pas d'annonce US aujourd'hui", clrDimGray, 8);
   string app = !InpEnvoyer ? "Application : envoi désactivé"
                : (g_pushErr != "" ? "Application : " + g_pushErr
                   : (g_lastPushT > 0 ? "Application : setups envoyés (" + TimeToString(g_lastPushT, TIME_MINUTES) + ")" : "Application : en attente"));
   Lbl(15, app, g_pushErr != "" ? clrOrange : clrDimGray, 8);
   Lbl(16, g_hStat != "" ? g_hStat : " ", clrSilver, 8);
   color cr; string ra = RisqueAnalyse(cr);
   Lbl(17, ra, cr, 8);
   int by = RowY(rows) + 6;
   Btn("GO", 0, by, 190, go, pret ? clrForestGreen : clrDimGray, clrWhite);
   Btn("X", 196, by, 90, "ANNULER (" + InpToucheAnnul + ")", ord != 0 || g_arme ? clrFireBrick : clrDimGray, clrWhite);
   Btn("AUTO", 292, by, 108, g_auto ? "AUTO : OUI" : "AUTO : NON", g_auto ? clrDarkOrange : clrDimGray, clrWhite);
   if(P.feu) Btn("OPT", 406, by, 134, g_feuOn ? "FEU ROUGE : ON" : "FEU ROUGE : OFF", g_feuOn ? (g_feuRouge ? clrFireBrick : clrSeaGreen) : clrDimGray, clrWhite);
   else if(P.second) Btn("OPT", 406, by, 134, g_second ? "2e TRADE : OUI" : "2e TRADE : NON", g_second ? clrSteelBlue : clrDimGray, clrWhite);
   else ObjectDelete(0, PFX + "BOPT");
   Btn("T2", 0, by + 30, 60, "2R", MathAbs(g_tp - 2.0) < 0.01 ? P.couleur : clrDimGray, clrWhite);
   Btn("T25", 66, by + 30, 60, "2,5R", MathAbs(g_tp - 2.5) < 0.01 ? P.couleur : clrDimGray, clrWhite);
   Btn("T3", 132, by + 30, 60, "3R", MathAbs(g_tp - 3.0) < 0.01 ? P.couleur : clrDimGray, clrWhite);
   Btn("ANN", 196, by + 30, 90, g_protect ? "ANNONCES : OUI" : "ANNONCES : NON", g_protect ? clrSteelBlue : clrDimGray, clrWhite);
   Btn("HIS", 292, by + 30, 108, (g_histo ? "MASQUER " : "AFFICHER ") + "HISTO", g_histo ? clrSteelBlue : clrDimGray, clrWhite);
   Btn("PER", 406, by + 30, 134, "PÉRIODE : " + I(g_histN) + " J", clrSlateGray, clrWhite);
   // money management : mode, valeur (saisie ou − / +), équivalent en argent, test des notifications
   string nm = g_rMode == RISQUE_POURCENT ? "RISQUE : % SOLDE" : (g_rMode == RISQUE_LOT_FIXE ? "RISQUE : LOT FIXE" : "RISQUE : MONTANT");
   Btn("RM", 0, by + 60, 130, nm, clrSlateGray, clrWhite);
   Btn("RMOINS", 136, by + 60, 26, "–", clrDimGray, clrWhite, 11);
   Edit("RV", 166, by + 60, 80, Fr(g_rVal, g_rMode == RISQUE_MONTANT ? 0 : 2));
   Btn("RPLUS", 250, by + 60, 26, "+", clrDimGray, clrWhite, 11);
   double rv = RisqueVoulu();
   if(g_rMode == RISQUE_LOT_FIXE && S.ok) rv = RisqueArgent(NormPx(S.entry), NormPx(S.sl), Lot(NormPx(S.entry), NormPx(S.sl)));
   Btn("RINF", 282, by + 60, 118, rv > 0 ? "= " + Fr(rv, 0) + " " + AccountInfoString(ACCOUNT_CURRENCY) : "= selon le stop", (color)0x303030, clrSilver, 8);
   Btn("NT", 406, by + 60, 134, "TESTER LES NOTIFS", clrDimGray, clrWhite, 8);
   for(int i = 0; i < 7; i++)
     {
      if(i < nh) Btn("D" + I(i), i * 76, by + 90, 72, g_hLab[i], g_hCol[i], clrWhite, 8);
      else ObjectDelete(0, PFX + "BD" + I(i));
     }
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
   bool isAu = StringFind(s, "XAU") >= 0 || StringFind(s, "GOLD") >= 0;
   if(pf == PROFIL_AUTO) pf = isNq ? PROFIL_US100 : (isSp ? PROFIL_SP500 : (isAu ? PROFIL_OR : 0));
   if(pf == PROFIL_US100 && !isNq) { Alert("Desk Key : le profil US100 ne peut pas tourner sur ", _Symbol); return false; }
   if(pf == PROFIL_SP500 && !isSp) { Alert("Desk Key : le profil SP500 ne peut pas tourner sur ", _Symbol); return false; }
   if(pf == PROFIL_OR && !isAu)    { Alert("Desk Key : le profil or ne peut pas tourner sur ", _Symbol); return false; }
   P.finH = 11; P.finM = 0; P.feu = false; P.second = false; P.unite = "pts"; P.tendance = 0;
   if(pf == PROFIL_US100)
     { P.nom = "US100"; P.fvg = true;  P.marge = 3.0; P.cassureMin = 0.05; P.judasMin = 0;  P.daily = false; P.magic = 7710100; P.couleur = clrDodgerBlue; P.feu = true; }
   else if(pf == PROFIL_SP500)
     { P.nom = "SP500"; P.fvg = false; P.marge = 2.0; P.cassureMin = 0;    P.judasMin = 20; P.daily = true;  P.tendance = 1; P.magic = 7710500; P.couleur = clrDarkOrange; P.feu = true; }
   else if(pf == PROFIL_OR)   // validé sur 3 ans (backtests.md 4 terdecies) : séance de New York, H4 ou H1 sans conflit, entrées 10:00–12:00 NY
     { P.nom = "XAUUSD"; P.fvg = false; P.marge = 1.0; P.cassureMin = 0; P.judasMin = 0; P.daily = false; P.tendance = 2; P.finH = 12; P.magic = 7710900; P.couleur = clrGoldenrod; P.second = true; P.unite = "$"; }
   else { Alert("Desk Key : symbole ", _Symbol, " non reconnu. Choisissez le profil US100, SP500 ou or."); return false; }
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
      g_t2Fait = P.second && Trade2DejaFait();
      g_arme = false; g_arme2 = false;
      g_lastBar = 0;
      if(g_histJour != jour) { g_histJour = jour; g_feuCalc = false; Historique(true); SuivreFeu(); }
     }
   datetime cur = iTime(_Symbol, PERIOD_M1, 0);
   if(cur != g_lastBar)
     {
      g_lastBar = cur;
      g_n = LoadM1(G.t800 - 90 * 60, (long)cur - g_srvOff - 1, B);
      ScanDay(B, g_n, G, now, S);
      DessinerJour();
     }
   SuivreRisque();
   SuivreTest();
   SuivreNotifs();   // avant Gerer : « setup prêt » arrive avant « ordre placé »
   Gerer();
   GererT2();
   EnvoyerJour();
   Panneau();
  }

int OnInit()
  {
   if(!ChoisirProfil()) return INIT_PARAMETERS_INCORRECT;
   trade.SetExpertMagicNumber(P.magic);
   trade.SetTypeFillingBySymbol(_Symbol);
   trade.SetDeviationInPoints(50);
   trade2.SetExpertMagicNumber(P.magic + 1);
   trade2.SetTypeFillingBySymbol(_Symbol);
   trade2.SetDeviationInPoints(50);
   // changement d'unité de temps : MT5 relance Desk Key sans effacer ses variables.
   // On garde alors l'objectif, la période, AUTO, ANNONCES, l'armement, et on redessine.
   bool garder = g_deinit == REASON_CHARTCHANGE;
   g_deinit = -1;
   if(!garder)
     {
      g_auto = InpAuto;
      g_tp = (InpTP == 2.0 || InpTP == 2.5 || InpTP == 3.0) ? InpTP : 3.0;
      g_histN = MathMax(0, MathMin(250, InpHistJours));
      g_histo = g_histN > 0;
      g_protect = InpProtection;
      g_feuOn = ChargerOption("feu", InpFeuRouge);
      g_second = ChargerOption("second", InpSecond);
     }
   ChargerRisque();
   LireNotifs();
   UpdateServerOffset();
   EventSetTimer(1);
   if(garder) g_lastBar = 0;
   if(MaPosition() != 0) g_posSuivie = MaPosition();                       // redessine la séance du jour
   if(P.second && MaPosition2() != 0) g_pos2Suivie = MaPosition2();
   Tick();
   if(garder && g_histJour != "") Historique(false); // redessine l'historique, sans renvoi à l'application
   return INIT_SUCCEEDED;
  }
void OnDeinit(const int reason)
  {
   g_deinit = reason;
   EventKillTimer();
   ObjectsDeleteAll(0, PFX);
   ChartRedraw();
  }
void OnTimer() { Tick(); }
void OnTick()  { if(MQLInfoInteger(MQL_TESTER)) Tick(); }

// touche K / bouton : trade 1, ou second trade de l'or quand le trade 1 est pris
void Touche()
  {
   if(P.second && g_second && (g_tradeFait || MaPosition() != 0)) { PlacerT2(); return; }
   Placer();
  }
void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam)
  {
   if(id == CHARTEVENT_KEYDOWN)
     {
      string k1 = InpTouche, k2 = InpToucheAnnul; StringToUpper(k1); StringToUpper(k2);
      if(StringLen(k1) > 0 && lparam == StringGetCharacter(k1, 0)) { Touche(); Panneau(); }
      if(StringLen(k2) > 0 && lparam == StringGetCharacter(k2, 0)) { Annuler("à votre demande"); Annuler2("à votre demande"); Panneau(); }
     }
   if(id == CHARTEVENT_OBJECT_ENDEDIT && sparam == PFX + "ERV")
     {
      string t = ObjectGetString(0, sparam, OBJPROP_TEXT);
      StringReplace(t, ",", "."); StringReplace(t, " ", ""); StringReplace(t, "%", "");
      double v = StringToDouble(t);
      if(v > 0) ChangerRisque(g_rMode, v); else { g_rvAff = ""; Msg("valeur de risque non comprise"); }
      Panneau();
      return;
     }
   if(id == CHARTEVENT_OBJECT_CLICK && StringFind(sparam, PFX + "B") == 0)
     {
      string b = StringSubstr(sparam, StringLen(PFX) + 1);
      bool redessiner = false;
      if(b == "GO") Touche();
      else if(b == "X") { Annuler("à votre demande"); Annuler2("à votre demande"); }
      else if(b == "OPT" && P.feu)
        {
         g_feuOn = !g_feuOn; SauverOption("feu", g_feuOn);
         Msg(g_feuOn ? "feu rouge ACTIVÉ : pas d'ordre quand les 10 derniers setups sont négatifs" : "feu rouge DÉSACTIVÉ : Desk Key prévient seulement");
        }
      else if(b == "OPT" && P.second)
        {
         g_second = !g_second; SauverOption("second", g_second);
         if(!g_second) Annuler2("second trade désactivé");
         Msg(g_second ? "second trade ACTIVÉ" : "second trade désactivé");
         redessiner = true;
        }
      else if(b == "MIN") { g_reduit = !g_reduit; }
      else if(b == "HIS") { g_histo = !g_histo; Historique(false); }
      else if(b == "RM") ChangerRisque((g_rMode + 1) % 3, g_rVal);
      else if(b == "RMOINS") ChangerRisque(g_rMode, g_rVal - PasRisque());
      else if(b == "RPLUS") ChangerRisque(g_rMode, g_rVal + PasRisque());
      else if(b == "NT")
        {
         ArrayResize(g_testIds, 0); ArrayResize(g_testCh, 0); g_testT = 0;
         g_tgRelais = false; g_waRelais = false;   // on réessaie l'envoi direct à chaque test
         Msg("notification de test envoyée (téléphone" + (g_tgTok != "" ? ", Telegram" : "") + (g_waTel != "" ? ", WhatsApp" : "") + ")…");
         g_enTest = true;
         Notifier("TEST · les notifications fonctionnent. Risque " + RisqueTexte() + " · " + ModeTexte(), true);
         g_enTest = false;
        }
      else if(b == "PER")
        {
         g_histN = g_histN < 30 ? 30 : (g_histN < 90 ? 90 : (g_histN < 250 ? 250 : 7));
         Msg("historique : calcul de " + I(g_histN) + " séances…"); Panneau();
         Historique(true);
         Msg(g_hStat);
        }
      else if(StringLen(b) == 2 && StringSubstr(b, 0, 1) == "D") AllerAuJour((int)StringToInteger(StringSubstr(b, 1, 1)));
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
