# Règles de trading Desk US — référence A

*Version du 27 novembre 2026 (Desk Key 1.09 : or, second trade, feu rouge ; application mise à jour). Règles validées par le backtest M1 FTMO (décembre 2025 – novembre 2026). Les chiffres détaillés sont dans [backtests.md](backtests.md).*

> **Un actif = un profil = un graphique.** On ne mélange jamais les règles de l'US100, du SP500 et de l'or.

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

## 3 bis. Profil XAUUSD (or) — validé sur 3 ans (2024–2026)

Même mécanique que les indices (section 1 : liquidité du pré-marché 8:00–9:30 NY, Judas après 9:30, cassure M1 au-delà du dernier pivot avant le Judas, entrée limite au 50 %, retracée si la jambe s'allonge, stop derrière le Judas, sortie 13:00 NY), avec ces différences :

| Règle | Valeur |
|---|---|
| Séance | **New York** uniquement. La séance de Londres a été testée et ne marche pas avec cette règle. |
| Sens du jour | **H4 ou H1, sans conflit** : à 9:25 NY, si le H4 ou le H1 donne un sens et que l'autre ne le contredit pas (même sens ou neutre), on prend ce sens. Si l'un dit achat et l'autre vente, ou si les deux sont neutres : pas de trade. |
| Fenêtre d'entrée | L'ordre doit être rempli **entre 10:00 et 12:00 NY** (16:00–18:00 Paris), une heure de plus que les indices : l'or reste très volatil jusqu'à 12:00 NY. Touché avant 10:00 : pas de trade. Pas rempli à 12:00 : annulé. |
| FVG M1 | Non exigé (presque toujours présent sur l'or, il ne change rien). |
| Cassure nette / Judas après 9:50 | Non. |
| Marge du stop | **1 $** au-delà du Judas (stop moyen 7 à 18 $ selon la volatilité). |
| Objectif | **3R** (2R donne plus de gagnants mais environ 10 R de moins par an). |
| Sortie | 13:00 NY (19:00 Paris). |
| Résultats du backtest (22/12/2025 – 25/11/2026, 3R) | 53 trades (environ 4 à 5 par mois, de 1 à 8), 55 % de gagnants, +37,7 R, pire baisse −4,5 R, 11 mois positifs et 0 négatif ; 1re moitié +23,2 R, 2de moitié +14,5 R. |

**Second trade de continuation (or seulement, validé sur 3 ans : +11,4 R en 2024, +12,5 R en 2025, +13,5 R en 2026)**

| Règle | Valeur |
|---|---|
| Quand | Seulement pendant que le trade 1 est ouvert (pas après son stop ni son TP), ordre rempli avant 12:00 NY (18:00 Paris). |
| Setup | Le prix dépasse le haut de la jambe du trade 1 (impulsion), fait un repli qui forme un creux plus haut (pivot M1 de 2 bougies) au-dessus du stop du trade 1, puis une bougie M1 clôture au-dessus du sommet d'avant le repli (seconde cassure). Inverse pour une vente. |
| Entrée | Limite au **50 %** de la nouvelle jambe (creux du repli → plus haut), retracée si la jambe s'allonge. |
| Stop | Sous le creux du repli, **1 $** de marge. |
| Objectif | **Le même prix que le TP du trade 1** (3R du trade 1), pas 1R. |
| **Gestion obligatoire** | Dès que le second trade est rempli, **remonter le stop du trade 1 au stop du second trade**. Sans cette règle, le second trade double les pertes des mauvaises journées. |
| Risque | Même risque que le trade 1. |
| Backtest 2026 | 10 seconds trades (environ 1 par mois), 6 gagnants ; or : +51,2 R au lieu de +37,7 R, pire creux −4,0 R au lieu de −4,5 R ; compte 3 actifs : +106,4 R au lieu de +92,9 R, pire creux −8,5 R au lieu de −9 R. |

À ne pas faire sur l'or : entrer entre 9:30 et 10:00 NY (23 % de gagnants), trader la séance de Londres, sortir à 12:00. Second trade sur l'US100 ou le SP500 : non (trop rare ou neutre, et aggrave le creux).

## 4. Ce qu'il faut attendre (simulations)

> **Configuration retenue le 27/11/2026 (3 ans, backtests.md 4 terdecies)** : US100 et SP500 avec **feu rouge** (pas de trade sur un indice quand la somme de ses 10 derniers setups est négative ; la règle continue d'être suivie, retour automatique au vert), or avec second trade et **sans** feu rouge. Résultat 2024 / 2025 / 2026 : +69,7 / +41,9 / +99,7 R, pire creux −13,6 R, 29 mois positifs sur 36. **Risque : 0,5 % par trade** (5 % de risque de toucher −10 % dans l'année ; pire creux réel −7,4 %) ; 0,33 % pour une sécurité maximale.
>
> **Mise à jour du 27/11/2026, validation sur 3 ans** (backtests.md, section 4 undecies) : 2025 a été une année **perdante** pour l'US100 (−19,2 R, 25 % de gagnants) et le SP500 (−2,8 R), avec un creux de **−29 R** pour les deux ensemble et 14 pertes d'affilée. Sur 3 ans, la règle reste gagnante (environ +30 R par an pour les deux indices), mais les creux à attendre sont bien plus profonds que ceux calculés sur 2026 seul : une année sur 10 **−20 R**, une année sur 100 **−31 R**. **Les repères de risque ci-dessous (0,75 % / 1 %) sont à remplacer** : pour rester sous la limite FTMO de 10 %, il faut environ **0,33 % par trade** (1 % de risque de toucher −10 % dans l'année) ; 0,5 % donne 10 % de risque. Les bornes d'alarme de l'application seront recalculées sur 3 ans.


Référence A, les deux indices ensemble, TP 3R, 0,05 R de frais par trade :
- environ **89 trades par an**, un trade sur environ 1 jour de bourse sur 3 ;
- creux normal sur une année : **−7 à −11 R** ; séries de **6 à 9 pertes** possibles sans que la méthode soit cassée ;
- **signal d'alarme** : plus de 13 pertes d'affilée ou un creux de plus de −17 R, il faut alors arrêter et analyser ;
- si l'avantage réel n'est que la moitié du backtest : environ +25 R par an, avec un creux médian de −10 R.

Avec l'or en plus (les 3 actifs sur le même compte, si l'or est validé) :
- environ **142 trades par an** sur 113 jours ; 3 actifs le même jour seulement 2 fois dans l'année, 2 trades le même jour 25 fois (les deux perdants 7 fois) ; pire journée −2 R (−3 R possible) ;
- historique 2026 : +92,9 R, **12 mois positifs sur 12**, pire creux **−9 R** (9 pertes d'affilée du 6 avril au 5 mai, réparties sur les 3 actifs) ;
- simulations : creux d'une année sur 10 **−11,6 R**, une année sur 100 **−16,8 R** ; séries de 6 à 9 pertes normales, 13 au pire ;
- **money management** (limite FTMO de 10 %) : à **1 % par trade**, un challenge démarré début avril 2026 serait descendu à **−9,5 %** (frais compris) avant de réussir, à 0,5 % de l'échec. Au cours de l'année, les 212 challenges démarrés à chaque séance auraient tous réussi à 1 % (32 jours en médiane) ; à 1,5 %, 17 auraient échoué. Repères : **0,75 % par trade en challenge** (pire creux historique environ −7 %), **0,5 % sur un compte financé**. Le même compte peut porter les 3 actifs : les séparer sur plusieurs comptes ne réduit pas le risque.

## 5. Ce qui ne sert pas (testé et rejeté)

- Entrer au 61,8 %, entrer du bon côté du prix d'ouverture, break-even ou sortie partielle à 1R.
- Fondamentaux en filtre, divergence SMT, jour de la semaine.
- Stop élargi sur l'US100, entrées entre 9:30 et 10:00 NY.
- Annonces de 10:00 NY : pas un motif de perte. Les jours d'annonce sont même favorables au SP500.
- Dow Jones (US30) : rejeté, en M1 comme en M5, avec les concepts ICT / SMC testés (OTE, SMT, premium / discount, draw on liquidity).
- Or : séance de Londres, killzone ICT de New York (7:30–9:00), entrées avant 10:00 NY, OTE 70,5 %.

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
  - la ligne au-dessus des boutons donne le risque en % du capital de départ, la perte si les trois actifs perdent le même jour (comparée à la limite FTMO du jour) et le nombre de pertes avant la perte max. Vert : confortable ; orange : agressif ; rouge : trois pertes le même jour peuvent dépasser la limite du jour. Les limites se règlent dans les paramètres (5 % et 10 % par défaut).
- Bouton **AUTO** : mode automatique, désactivé par défaut. À n'activer que si la prop firm l'autorise.
- Gestion faite par Desk Key :
  - l'ordre suit le 50 % quand la jambe s'allonge, avec le lot recalculé ;
  - il est annulé à 11:00 NY s'il n'est pas rempli : l'ordre porte une **date d'expiration à 11:00 NY chez FTMO**, il est donc annulé par le serveur même si MT5 est fermé (si le serveur refuse l'expiration, Desk Key l'annule lui-même) ;
  - la position est fermée à 13:00 NY (réglage modifiable).
- Chaque profil a son **numéro magique** : US100 = 7710100, SP500 = 7710500, or = 7710900 (second trade de l'or : 7710901). Le commentaire de l'ordre indique le profil (« DeskKey US100 3R », « DeskKey XAUUSD 2e »), pour le suivi dans le journal.

### Feu rouge (US100, SP500) — Desk Key 1.09
- Chaque matin, Desk Key additionne le résultat des **10 derniers setups** de l'indice (entrées touchées dans la fenêtre, à 3R, pris ou non), calculé sur l'historique M1 (environ 120 séances de plus que la période affichée).
- Somme **négative** : **feu rouge**. La touche K, le bouton et le mode AUTO ne placent pas d'ordre ; le setup est suivi et dessiné à blanc, et envoyé à l'application. Somme positive ou nulle (ou moins de 10 setups connus) : feu vert. Le retour au vert est automatique.
- Ligne « Feu » du panneau (sous le sens du jour) : couleur et somme des 10 derniers setups. Dans la rangée des 7 jours et l'historique, un **●** marque les jours sous feu rouge ; la ligne de statistiques donne aussi le total « sous feu vert ».
- **Désactivable** : bouton **FEU ROUGE : ON / OFF** du panneau (gardé au redémarrage) ou paramètre « Feu rouge ». Désactivé, Desk Key prévient seulement (panneau, notification) et laisse trader.
- Notification à chaque changement de couleur (début de séance).
- Pas de feu rouge sur l'or (backtests.md 4 terdecies).

### Exécution et spread — Desk Key 1.10
Le graphique MT5 et le backtest utilisent le prix **Bid**. Or un **achat limite se remplit sur l'Ask** (Bid + spread), et le **stop et l'objectif d'une vente se déclenchent sur l'Ask**. Sans correction, des achats « touchés » sur le graphique ne sont pas remplis (27/11/2026 : US100, plus bas Bid 26229,13 pour un ordre à 26230,08, spread 1,45 : ordre manqué de 0,5 pt), et des ventes sont sorties au stop sans que le graphique le touche. Mesure sur 3 ans : backtests.md 4 unvicies.
- **Rattrapage des achats** (paramètre « Achats : … achat au marché », activé par défaut) : si le graphique (Bid) atteint le prix de l'achat limite sans que l'ordre se remplisse, Desk Key l'annule et **achète au marché**, au même stop et au même objectif, avec un lot recalculé pour garder le même risque en argent. Seulement si l'Ask est à moins de **10 % du risque** au-dessus du 50 % (paramètre « prix maximal accepté », en R) ; sinon l'ordre limite reste. Vérifié à chaque tick, pour le trade 1 et le second trade de l'or. Au placement, même règle : si le graphique est déjà au 50 %, l'achat part au marché.
- **Ventes** (paramètre « Ventes : stop et objectif décalés du spread », réglé « selon l'actif ») : sur le **SP500 et l'or**, le stop et l'objectif de l'ordre sont placés **un spread plus haut** que ceux de la règle (spread lu au placement) : ils se déclenchent quand le graphique touche les niveaux de la règle. Le lot est calculé sur ce stop (même risque en argent). Pas sur l'US100 : son spread est petit par rapport au risque et le décalage y coûte plus qu'il ne rapporte. Réglages possibles : selon l'actif, oui, non.
- Rien ne change dans la détection, le dessin, le suivi de la règle et l'application : la règle reste celle du backtest (Bid).
- **Pourquoi garder un ordre limite, même en AUTO** (plutôt qu'un achat au marché quand le prix touche le 50 %) :
  - *coût* : un achat au marché à la touche paie toujours le spread (Ask = 50 % + spread), alors qu'un ordre limite est rempli au 50 % dès que le prix descend un peu plus bas, ce qui est le cas le plus fréquent (US100 : le prix passe en médiane 4 pts sous le 50 %). Sur 3 ans, acheter au marché à chaque touche donnerait 11,0 R au lieu de 15,8 R sur les achats US100, 6,1 au lieu de 9,8 sur le SP500, 34,8 au lieu de 40,5 sur l'or (backtests.md 4 unvicies) ;
  - *fiabilité* : l'ordre limite est chez FTMO. Il est rempli même si MT5, le PC ou le VPS a un temps de retard ou perd la connexion à ce moment-là, et il expire tout seul à la fin de la fenêtre. Un achat au marché dépend de Desk Key à la seconde près et peut glisser dans un mouvement rapide (le 27/11 : 68 pts en une minute) ; un ordre limite n'est jamais rempli plus cher que son prix ;
  - le rattrapage ne paie le spread que quand c'est nécessaire.
- **Pas de limite de trades** : Desk Key n'a aucun réglage de nombre de trades. Chaque actif a son propre numéro magique et ses propres ordres ; un trade sur l'or ne bloque jamais l'US100 ou le SP500. Par actif, la règle ne donne qu'un setup par jour (la première cassure après le Judas, plus le second trade de l'or) : c'est la règle testée en backtest, pas un réglage. Le contrôle « déjà un trade aujourd'hui sur cet actif » sert seulement à ne pas replacer un ordre après un trade (redémarrage de MT5, par exemple).

### Or (XAUUSD) et second trade — Desk Key 1.09
- Mettre Desk Key sur un **graphique M1 XAUUSD** : le profil or se choisit tout seul (symbole contenant XAU ou GOLD).
- Règles du profil : section 3 bis. Fenêtre d'entrée **10:00–12:00 NY** : l'ordre expire chez FTMO à 12:00 NY ; panneau, dessins et notifications suivent cette heure.
- **Second trade** (bouton **2e TRADE : OUI / NON**, paramètre « Second trade », activé par défaut) : pendant que le trade 1 est en position, Desk Key suit la continuation (ligne 4 du panneau : impulsion → repli → cassure du repli). Quand le setup est prêt : notification « SECOND TRADE PRÊT », puis **touche K** (ou AUTO) pour placer la limite au 50 % de la nouvelle jambe, stop sous le repli ± 1 $, objectif = TP du trade 1, expiration à 12:00 NY. K pressée avant que le setup soit prêt : le second trade est armé.
- Au **remplissage du second trade**, Desk Key **remonte le stop du trade 1** au stop du second trade. Le second trade est annulé si le trade 1 se ferme avant, ou à 12:00 NY. Les deux positions sont fermées à 13:00 NY.
- Même risque en argent que le trade 1 (lot recalculé sur son propre stop).

### Notifications
Desk Key prévient à chaque étape importante, une seule fois par jour et par événement (même si MT5 redémarre) :
- **SETUP PRÊT** : sens, prix limite, SL, TP, lot, risque, heure de départ, mode AUTO ou manuel, protection annonces ;
- **ORDRE PLACÉ**, **EN POSITION** (rempli), **SORTIE** (TP, stop, 13:00 NY ou à la main, avec le résultat et l'équité) ;
- ordre annulé à 11:00 NY ou setup annulé (50 % touché avant 10:00 NY) ;
- **problème** : ordre refusé par le serveur, lot impossible ;
- en option (réglage « Aussi le sens du jour et le Judas ») : le sens du jour à 9:25 NY et le Judas.

**Alertes pour trader depuis le téléphone (Desk Key 1.11)** · réglage « Alertes pour trader depuis le téléphone », activé par défaut. Elles ne partent que si Desk Key n'a ni ordre ni position ce jour-là et n'en placera pas (pas d'AUTO, rien d'armé) : quand on n'est pas devant MT5, on passe l'ordre soi-même depuis l'application MT5 du téléphone. Le PC doit rester allumé, MT5 ouvert, Desk Key sur ses graphiques.
- **Chaque matin (9:25 NY, 15:25 Paris)** : « Desk Key en marche · ACHATS / VENTES uniquement aujourd'hui ». Pas de message : le PC ou MT5 s'est arrêté.
- **SETUP PRÊT · À PLACER DEPUIS TON TÉLÉPHONE** : sens, prix limite, SL, TP, lots et risque, expiration (11:00 NY / 17:00 Paris, 12:00 NY pour l'or). Ventes du SP500 et de l'or : stop et objectif déjà décalés du spread (comme Desk Key les placerait). Setup prêt avant 10:00 NY : « PAS AVANT 10:00 NY », puis à 10:00 NY « C'EST L'HEURE · place ton ordre » avec les niveaux du moment.
- **NOUVEAU 50 %** : la jambe s'allonge, déplacer l'ordre aux nouveaux niveaux (au plus une alerte par minute, à partir de 10:00 NY, si le 50 % bouge d'au moins 2 % du risque).
- **ENTRÉE TOUCHÉE** (heure de Paris) : achat non rempli à cause du spread : acheter au marché tant que le prix reste sous le 50 % + 10 % du risque, même SL et même TP ; vente : vérifier qu'elle est remplie.
- **FIN DE LA FENÊTRE** sans entrée : annuler l'ordre. Setup annulé (50 % touché avant 10:00 NY) : annuler l'ordre s'il est placé.
- **13:00 NY (19:00 Paris)** : fermer la position si elle est encore ouverte (sortie de la règle).
- **Or, SECOND TRADE PRÊT** : l'ordre à placer et le niveau où remonter le stop du trade 1 au remplissage.
- Sous feu rouge, seul le message « setup du jour · FEU ROUGE : pas d'ordre » est envoyé.

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
- **Ajouter un actif** : quand un nouvel actif est validé en backtest, son profil est ajouté dans la base (`desk_profiles`) et un profil correspondant est ajouté à Desk Key ; l'application l'affiche toute seule dans tous les onglets (c'est ce qui a été fait pour l'or).
- **Feu rouge dans l'application** (1.09) : colonne « Feu » du journal (● Vert / ● Rouge, somme des 10 setups précédents au survol, détail en cliquant la ligne), filtres « Sous feu vert » / « Sous feu rouge », total « Règle telle que tradée (sans le feu rouge) » ; ligne « Feu » sur la carte de chaque indice dans Aujourd'hui, et alerte en haut quand un indice est sous feu rouge ; Mon compte : la courbe de la règle ne compte pas les entrées sous feu rouge ; Suivi : la règle complète reste suivie (bornes du backtest sur 3 ans), avec le total « tradé » à côté.
- **Historique sur 3 ans** : le journal remonte jusqu'au 22/12/2023 (périodes 1 an, 2 ans, 3 ans). Les jours avant l'installation de Desk Key viennent du moteur de backtest (mêmes règles ; mention « backtest » ; pas de niveaux du pré-marché) ; ensuite, ce sont ceux envoyés par Desk Key.
- **Délai dans le journal** : colonne « Délai » = minutes entre la cassure et la touche du 50 % (en couleur au-delà de 20 min), et deux totaux « touché dans les 20 min » / « touché plus de 20 min après la cassure » (entrées, R, R par entrée, % de gagnants) sur la période et l'actif choisis. Piste suivie, pas une règle (backtests.md 4 quindecies) : sur 3 ans, les touches lentes ont été meilleures sur les indices, pas sur l'or.
- **Simulateur** : simulations sur les 35 mois de résultats (janvier 2024 – novembre 2026, compte tel qu'il se trade, frais compris), tirés par blocs de mois.
  - *Challenge FTMO* : budget, taille et nombre de comptes au départ (en même temps ou l'un après l'autre), rachat après un échec, réinvestissement des versements jusqu'au plafond FTMO, risque en challenge (et pour le 2e compte), risque en financé, coussin, versements tous les 14 jours ou tous les mois, part versée, taux €/$, pertes plus grosses qu'en backtest, attentes FTMO. Résultat : gain encaissé net (moyenne, médiane, 1 parcours sur 10), part des parcours sans aucun versement, premier versement, mois sans versement, comptes financés perdus et temps pour revenir au financé, réussite du challenge ; courbes mois par mois ; comparaison de 11 stratégies en un clic ; tableau de réussite du challenge selon le risque. Tous les comptes d'un parcours prennent les mêmes trades le même jour.
  - *Compte propre* : capital, risque par trade (sur le solde ou sur le capital de départ), retrait mensuel des gains : gain, pire baisse, part des parcours perdants.
- **Or dans l'application** : carte du jour avec l'étape du second trade ; journal : résultat de la règle = trade 1 avec stop remonté + second trade (mention « 2 trades »), détail des deux trades réels.

### Différences possibles avec le backtest
- Le backtest utilise les prix Bid. En réel, un achat limite se remplit quand l'Ask touche le prix, et le stop et l'objectif d'une vente se déclenchent sur l'Ask : sans correction, environ 0,09 R par trade perdu sur 3 ans. Desk Key 1.10 rattrape les achats et décale les ventes du SP500 et de l'or (section 6, « Exécution et spread ») : environ 0,04 R par trade, dans les 0,05 R de frais déjà comptés.
- Pour tester dans le **testeur de stratégie**, choisir « Serveur = New York + 7 h » dans le réglage Heure du serveur.
