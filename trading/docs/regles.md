# Règles de trading Desk US — référence A

*Version du 27 novembre 2026 (Desk Key 1.03, nouvelle application). Règles validées par le backtest M1 FTMO (décembre 2025 – novembre 2026). Les chiffres détaillés sont dans [backtests.md](backtests.md).*

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
5. Régler le **risque par trade** : montant, pourcentage du solde ou lot fixe.

### Utilisation
- Le panneau affiche chaque condition dans l'ordre : tendance du jour → Judas → cassure (avec la règle propre à l'indice) → ordre (prix, SL, TP, lot, risque en devise du compte) → état.
- Les niveaux sont dessinés sur le graphique : pré-marché, liquidité visée, Judas, niveau de cassure, Fibonacci 0/100 %, entrée 50 %, SL, TP 2R / 2,5R / 3R, heures clés (10:00, 11:00, 13:00 NY ; 9:50 NY pour le SP500).
- **Touche K** (ou le bouton) :
  - avant 10:00 NY, si le setup est prêt : l'ordre est **armé** et partira à 10:00 s'il est encore valide ;
  - entre 10:00 et 11:00 NY : l'ordre limite part **tout de suite**, avec le lot calculé.
- **Touche X** : annule l'ordre en attente ou l'armement.
- **Bouton –** : réduit le panneau à deux lignes (état du jour + bouton de placement) ; **+** le rouvre.
- **Bouton ANNONCES** (réglage « Protection annonces FTMO », désactivé par défaut) : aucun ordre de 2 min avant à 2 min après une annonce US du calendrier (ISM, JOLTS, CPI, NFP…). Un ordre armé part après l'annonce, un ordre en attente est retiré puis remis s'il est encore valide. Utile sur un compte FTMO financé standard ; inutile en Challenge, en Vérification et sur un compte Swing. Dans le backtest, seuls 2 trades sur 89 ont été remplis entre 10:00 et 10:02 un jour d'annonce.
- **Bouton HISTO 7 J** : affiche sur le graphique les setups des 7 derniers jours (niveaux, zone gain/perte, résultat « +3R », « −1R », ou la raison de l'absence de trade).
- Boutons **2R / 2,5R / 3R** : choix de l'objectif.
- Bouton **AUTO** : mode automatique, désactivé par défaut. À n'activer que si la prop firm l'autorise.
- Gestion faite par Desk Key :
  - l'ordre suit le 50 % quand la jambe s'allonge, avec le lot recalculé ;
  - il est annulé à 11:00 NY s'il n'est pas rempli ;
  - la position est fermée à 13:00 NY (réglage modifiable).
- Chaque profil a son **numéro magique** : US100 = 7710100, SP500 = 7710500. Le commentaire de l'ordre indique le profil (« DeskKey US100 3R »), pour le suivi dans le journal.

### Envoi vers l'application
- Desk Key envoie chaque setup (pré-marché, Judas, cassure, entrée, SL, TP 2R / 2,5R / 3R, lot, état, résultat simulé) à l'application Desk US : le jour même en direct, et les 7 derniers jours à l'installation.
- La clé est reprise automatiquement du robot **DeskUS_Bridge 1.05** (fichier commun `DeskUS\cle.txt`) ; sinon, la coller dans le réglage « Clé Desk US » de Desk Key.
- Les trades pris avec Desk Key sont reliés à leur setup dans le journal (résultat réel à côté du résultat de la règle).

## 7. L'application Desk US

- **Aujourd'hui** : déroulé de la séance en heure de Paris, setup du jour de chaque actif (tendance, Judas, cassure, ordre, lot, état), annonces économiques, compte FTMO.
- **Journal** : un jour = une ligne par actif, avec les niveaux, le résultat de la règle et le trade réel ; filtres (pris, ratés…) et export CSV.
- **Suivi du test** : win rate, R, séries de pertes et creux de chaque actif comparés aux bornes du backtest (« dans la norme », « à surveiller », « alarme »).
- **Règles** : règles et résultats de backtest de chaque actif.
- **Ajouter un actif** : quand un nouvel actif (Dow Jones, XAUUSD…) est validé en backtest, son profil est ajouté dans la base (`desk_profiles`) et un profil correspondant est ajouté à Desk Key ; l'application l'affiche toute seule dans tous les onglets.

### Différences possibles avec le backtest
- Le backtest utilise les prix Bid. En réel, un achat limite se remplit quand l'Ask touche le prix : avec le spread, quelques remplissages « de justesse » n'auront pas lieu.
- Pour tester dans le **testeur de stratégie**, choisir « Serveur = New York + 7 h » dans le réglage Heure du serveur.
