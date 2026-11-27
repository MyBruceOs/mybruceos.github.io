# Règles de trading Desk US — référence A

*Version du 27 novembre 2026 (Desk Key 1.08, nouvelle application). Règles validées par le backtest M1 FTMO (décembre 2025 – novembre 2026). Les chiffres détaillés sont dans [backtests.md](backtests.md).*

> **Un indice = un profil = un graphique.** On ne mélange jamais les règles de l'US100 et du SP500.

---

## 1. Ce qui est commun aux deux indices

| Étape | Règle |
|---|---|
| Heures | Toujours en **heure de New York**. Ouverture 9:30 NY (15:30 Paris, ou 14:30 pendant les semaines de décalage horaire de mars et de fin octobre). |
| Liquidité | Haut et bas du **pré-marché** (8:00–9:30 NY). |
| Sens du jour | Fixé à 9:25 NY par le filtre de tendance du profil. **Un seul sens par jour.** |
| Judas | Après 9:30 NY, le prix passe au-delà du niveau du pré-marché : **sous le bas pour un achat**, au-dessus du haut pour une vente. Le point extrême atteint est le « fond du Judas ». |
| Cassure (MSS) M1 | Une bougie M1 **clôture** au-delà du dernier sommet M1 formé avant le fond du Judas (le dernier creux pour une vente). Ce sommet est un pivot de 2 bougies de chaque côté. |
| Entrée | Ordre **limite au 50 %** du Fibonacci tracé du fond du Judas (0 %) au plus haut de la jambe (100 %). Tant que la jambe fait de nouveaux plus hauts, on retrace le Fibonacci et l'ordre suit. |
| Fenêtre | L'ordre doit être rempli **entre 10:00 et 11:00 NY**. Si le 50 % est touché **avant 10:00**, la journée est perdue pour ce sens (pas de trade). Pas de remplissage à 11:00 : on annule. |
| Stop | Fond du Judas ± la marge du profil. |
| Objectif | 2R, 2,5R ou **3R** (référence) du risque. |
| Sortie | TP, SL ou **13:00 NY** (19:00 Paris). |
| Fréquence | **Un trade par indice et par jour** au maximum. |
| Money management | Décidé par le trader. Le risque par trade est un réglage de Desk Key. |

## 2. Profil US100

| Règle | Valeur |
|---|---|
| Tendance | **H4** seul. H4 neutre = pas de trade. |
| FVG M1 | **Obligatoire** pour valider la cassure (validation seulement, on n'entre pas dessus). |
| Cassure nette | La clôture de cassure dépasse le sommet d'**au moins 5 % du risque** (≈ 3 à 5 pts). Sinon, on attend une cassure plus nette. |
| Marge du stop | **3 pts** au-delà du Judas. |
| Option | Filtre « H1 contre le trade » : pas de trade si le H1 va contre le sens du jour. Testé sur 7 trades (6 perdants), il tient sur les deux moitiés de l'année. Désactivé par défaut. |
| Résultats du backtest (3R) | 58 trades, 24 % des jours, 47 % de gagnants, +30 790 $ pour 1 000 $ de risque par trade, pire baisse −4 000 $. |

## 3. Profil SP500

| Règle | Valeur |
|---|---|
| Tendance | **H4 et Daily d'accord** (Daily : prix au-dessus de la moyenne des 10 dernières clôtures, et cette moyenne monte). Sinon, pas de trade. |
| FVG M1 | Non exigé. |
| Judas pas trop tôt | Le fond du Judas doit se former **au moins 20 min après 9:30 NY** (après 9:50 NY, soit 15:50 Paris). Si le fond est plus tôt, on attend un nouveau fond après 9:50. |
| Marge du stop | **2 pts** au-delà du Judas. |
| Résultats du backtest (3R) | 31 trades, 13 % des jours, 55 % de gagnants, +24 440 $, pire baisse −3 000 $. |

## 4. Ce qu'il faut attendre (simulations)

Référence A, les deux indices ensemble, TP 3R, 0,05 R de frais par trade :
- environ **89 trades par an**, un trade sur environ 1 jour de bourse sur 3 ;
- creux normal sur une année : **−7 à −11 R** ; séries de **6 à 9 pertes** possibles sans que la méthode soit cassée ;
- **signal d'alarme** : plus de 13 pertes d'affilée ou un creux de plus de −17 R, il faut alors arrêter et analyser ;
- si l'avantage réel n'est que la moitié du backtest : environ +25 R par an, avec un creux médian de −10 R.

## 5. Ce qui ne sert pas (testé et rejeté)

- Entrer au 61,8 %, entrer du bon côté du prix d'ouverture, break-even ou sortie partielle à 1R.
- Fondamentaux en filtre, divergence SMT, jour de la semaine.
- Stop élargi sur l'US100, entrées entre 9:30 et 10:00 NY.
- Annonces de 10:00 NY : pas un motif de perte. Les jours d'annonce sont même favorables au SP500.

---

## 6. Desk Key : l'outil MT5 en une touche

Fichier : `trading/mt5/DeskUS_Key.mq5`.

### Installation
1. MT5 → **Fichier → Ouvrir le dossier des données** → `MQL5/Experts`. Copier `DeskUS_Key.mq5`, puis l'ouvrir avec MetaEditor et cliquer sur **Compiler**.
2. Ouvrir **un graphique M1 de US100.cash** et **un graphique M1 de US500.cash** (deux graphiques séparés).
3. Glisser Desk Key sur chaque graphique. Le profil se choisit tout seul d'après le symbole. Il refuse de démarrer si le profil ne correspond pas au symbole.
4. Cocher **« Autoriser le trading algorithmique »** dans les réglages de Desk Key, et activer le bouton **Algo Trading** de MT5. C'est nécessaire même pour l'exécution manuelle en une touche.
5. Régler le **risque par trade** directement dans le panneau (voir « Money management » ci-dessous).

### Utilisation
- Le panneau affiche chaque condition dans l'ordre : tendance du jour → Judas → cassure (avec la règle propre à l'indice) → ordre (prix, SL, TP, lot, risque en devise du compte) → état.
- Les niveaux sont dessinés sur le graphique : pré-marché, liquidité visée, Judas, niveau de cassure, Fibonacci 0/100 %, entrée 50 %, SL, TP 2R / 2,5R / 3R, heures clés (10:00, 11:00, 13:00 NY ; 9:50 NY pour le SP500).
- **Touche K** (ou le bouton) :
  - avant 10:00 NY, si le setup est prêt : l'ordre est **armé** et partira à 10:00 s'il est encore valide ;
  - entre 10:00 et 11:00 NY : l'ordre limite part **tout de suite**, avec le lot calculé.
- **Touche X** : annule l'ordre en attente ou l'armement.
- **Bouton –** : réduit le panneau à deux lignes (état du jour + bouton de placement) ; **+** le rouvre.
- **Bouton ANNONCES** (réglage « Protection annonces FTMO », désactivé par défaut) : aucun ordre de 2 min avant à 2 min après une annonce US du calendrier (ISM, JOLTS, CPI, NFP…). Un ordre armé part après l'annonce, un ordre en attente est retiré puis remis s'il est encore valide. Utile sur un compte FTMO financé standard ; inutile en Challenge, en Vérification et sur un compte Swing. Dans le backtest, seuls 2 trades sur 89 ont été remplis entre 10:00 et 10:02 un jour d'annonce.
- **Bouton AFFICHER / MASQUER HISTO** : affiche sur le graphique les setups de la période choisie (séparateur « jj/mm · 9:30 NY », Judas, entrée, SL, TP, zone gain/perte, résultat « +3R » / « −1R », ou la raison de l'absence de trade). Les dessins restent visibles en M5, M15, H1 ou H4 : le calcul utilise toujours les bougies M1. Quand on change d'unité de temps, Desk Key garde ses réglages du moment (objectif, période, AUTO, ANNONCES, ordre armé) et redessine tout.
- **Bouton PÉRIODE** : 7 → 30 → 90 → 250 séances (environ un an de bourse), puis retour à 7. Le réglage « Historique » fixe la période au démarrage. Sous les boutons, une ligne résume la période : séances analysées, entrées, % de gagnants, total en R à l'objectif choisi, setups manqués. Le calcul de 250 séances prend quelques secondes.
  - La limite vient des bougies M1 que MT5 garde : il faut environ 60 jours de plus que la période (tendance H4 et Daily). Si la ligne indique « M1 disponible : N séances », mettre **Outils → Options → Graphiques → Barres max dans le graphique = Illimité**, redémarrer MT5, puis faire défiler le graphique M1 vers la gauche pour charger l'historique.
- **Rangée des 7 jours** (sous les boutons) : un bouton par jour, du plus récent au plus ancien ; un clic amène le graphique sur la séance de ce jour, quelle que soit l'unité de temps. Vert = gagnant, rouge = perdant, gris = pas de trade : « manqué » (setup valide, 50 % pas touché avant 11:00 NY), « < 10h » (50 % touché avant 10:00 NY), « tendance » (pas de sens du jour), « rien » (pas de Judas ou pas de cassure valide). En mode réduit, le résumé tient sur une ligne.
- Boutons **2R / 2,5R / 3R** : choix de l'objectif.
- **Money management** (rangée RISQUE du panneau) :
  - bouton **RISQUE** : montant fixe → % du solde → lot fixe (le risque est converti pour rester à peu près le même) ;
  - **–** / **+** ou saisie directe de la valeur dans la case blanche (Entrée pour valider) ;
  - le réglage est **commun au compte** : changé sur le graphique US100, il s'applique aussi au SP500 dans la seconde. Il est gardé quand MT5 redémarre. Si on modifie le risque dans les paramètres du robot (F7), c'est cette valeur qui reprend la main ;
  - un ordre en attente est remis tout de suite avec le nouveau lot ; une position ouverte n'est pas touchée ;
  - la ligne au-dessus des boutons donne le risque en % du capital de départ, la perte si les deux indices perdent le même jour (comparée à la limite FTMO du jour) et le nombre de pertes avant la perte max. Vert : confortable ; orange : agressif ; rouge : deux pertes le même jour peuvent dépasser la limite du jour. Les limites se règlent dans les paramètres (5 % et 10 % par défaut).
- Bouton **AUTO** : mode automatique, désactivé par défaut. À n'activer que si la prop firm l'autorise.
- Gestion faite par Desk Key :
  - l'ordre suit le 50 % quand la jambe s'allonge, avec le lot recalculé ;
  - il est annulé à 11:00 NY s'il n'est pas rempli : l'ordre porte une **date d'expiration à 11:00 NY chez FTMO**, il est donc annulé par le serveur même si MT5 est fermé (si le serveur refuse l'expiration, Desk Key l'annule lui-même) ;
  - la position est fermée à 13:00 NY (réglage modifiable).
- Chaque profil a son **numéro magique** : US100 = 7710100, SP500 = 7710500. Le commentaire de l'ordre indique le profil (« DeskKey US100 3R »), pour le suivi dans le journal.

### Notifications
Desk Key prévient à chaque étape importante, une seule fois par jour et par événement (même si MT5 redémarre) :
- **SETUP PRÊT** : sens, prix limite, SL, TP, lot, risque, heure de départ, mode AUTO ou manuel, protection annonces ;
- **ORDRE PLACÉ**, **EN POSITION** (rempli), **SORTIE** (TP, stop, 13:00 NY ou à la main, avec le résultat et l'équité) ;
- ordre annulé à 11:00 NY ou setup annulé (50 % touché avant 10:00 NY) ;
- **problème** : ordre refusé par le serveur, lot impossible ;
- en option (réglage « Aussi le sens du jour et le Judas ») : le sens du jour à 9:25 NY et le Judas.

Canaux, à choisir dans les paramètres de Desk Key (onglet Paramètres, groupe « Notifications ») :
1. **Téléphone, application MT5** (activé par défaut, gratuit, rien à installer de plus) :
   - sur le téléphone, application MetaTrader 5 → Paramètres → **Messages** : noter le **MetaQuotes ID** ;
   - sur l'ordinateur, MT5 → **Outils → Options → Notifications** : cocher « Activer les notifications Push », coller l'ID, cliquer **Test**.
2. **Telegram** (son personnalisable, idéal pour attirer l'attention) :
   - dans Telegram, écrire à **@BotFather**, commande `/newbot`, récupérer le **jeton** du bot ; envoyer un premier message à ce bot ;
   - récupérer son **identifiant de chat** (par exemple avec @userinfobot) ;
   - coller le jeton et l'identifiant dans Desk Key ; ajouter `https://api.telegram.org` dans **Outils → Options → Expert Advisors → Autoriser WebRequest** ;
   - dans Telegram, choisir une sonnerie forte pour la conversation du bot.
3. **WhatsApp** par le service gratuit **CallMeBot** (service tiers : les messages passent par lui) :
   - suivre la page WhatsApp de callmebot.com : ajouter leur numéro à ses contacts, leur envoyer le message d'autorisation, recevoir la **clé** ;
   - remplir le numéro (format +33612345678) et la clé dans Desk Key ; ajouter `https://api.callmebot.com` dans la liste WebRequest ;
   - dans WhatsApp, donner une sonnerie personnalisée à ce contact.
4. **Ordinateur** : fenêtre d'alerte et son de MT5 pour les messages importants.

Le bouton **TESTER LES NOTIFS** du panneau envoie un message de test sur tous les canaux activés et affiche le résultat dans le panneau quelques secondes après (« Telegram : OK », ou la raison du refus : jeton faux, identifiant faux, /start pas envoyé au bot).

**Relais** : si MT5 n'arrive pas à joindre Telegram ou CallMeBot (erreur 1009 ou 5203 de certaines versions de MT5, adresse non autorisée…), Desk Key passe automatiquement par le serveur Desk US (Supabase), qu'il joint déjà pour les setups. Le jeton et le message transitent alors par ce serveur. Les jetons et identifiants collés sont nettoyés (espaces, retours à la ligne).

### Envoi vers l'application
- Desk Key envoie chaque setup (pré-marché, Judas, cassure, entrée, SL, TP 2R / 2,5R / 3R, lot, état, résultat simulé) à l'application Desk US : le jour même en direct, les jours de la période au démarrage, et toute la période à chaque changement avec le bouton PÉRIODE (envoi par paquets de 25 jours). Le Journal de l'application peut ainsi remonter jusqu'à un an.
- La clé est reprise automatiquement du robot **DeskUS_Bridge 1.05** (fichier commun `DeskUS\cle.txt`) ; sinon, la coller dans le réglage « Clé Desk US » de Desk Key.
- Les trades pris avec Desk Key sont reliés à leur setup dans le journal (résultat réel à côté du résultat de la règle).

## 7. L'application Desk US

- **Aujourd'hui** : déroulé de la séance en heure de Paris, setup du jour de chaque actif (tendance, Judas, cassure, ordre, lot, état), annonces économiques, compte FTMO.
- **Mon compte** :
  - total réel = équité − capital de départ (en $ et en %), avec son détail : trades Desk Key, trades hors Desk Key, flottant, trades plus anciens que le suivi ;
  - au risque réglé dans Desk Key : ce qui reste pour l'objectif, le nombre de gagnants nécessaires, les pertes possibles avant la perte max et sur la journée ;
  - deux courbes : mon equity réelle et la règle (entrées vues en direct × risque actuel), puis l'explication de l'écart : entrées non prises, exécution, risque différent, trades hors Desk Key, flottant.
- **Journal** : un jour = une ligne par actif, avec les niveaux, le résultat de la règle et le trade réel ; filtres (pris, ratés…) et export CSV.
- **Suivi du test** : win rate, R, séries de pertes et creux de chaque actif comparés aux bornes du backtest (« dans la norme », « à surveiller », « alarme »).
- **Règles** : règles et résultats de backtest de chaque actif.
- **Ajouter un actif** : quand un nouvel actif (Dow Jones, XAUUSD…) est validé en backtest, son profil est ajouté dans la base (`desk_profiles`) et un profil correspondant est ajouté à Desk Key ; l'application l'affiche toute seule dans tous les onglets.

### Différences possibles avec le backtest
- Le backtest utilise les prix Bid. En réel, un achat limite se remplit quand l'Ask touche le prix : avec le spread, quelques remplissages « de justesse » n'auront pas lieu.
- Pour tester dans le **testeur de stratégie**, choisir « Serveur = New York + 7 h » dans le réglage Heure du serveur.
