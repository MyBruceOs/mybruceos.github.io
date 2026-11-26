# Backtests Desk US — US100 et SP500 (session US, entrées M1)

*Mis à jour le 26 novembre 2026 (avec le test de tendance H1).*

Données : vraies bougies M1 de FTMO (US100.cash et US500.cash), exportées par le robot MT5 `DeskUS_Bridge` 1.04. La période va du **22 décembre 2025 au 25 novembre 2026**, soit 241 jours de bourse.

**Risque fixe de 1 000 $ par trade.** L'objectif (TP) est un multiple du risque : 2R = +2 000 $, 2,5R = +2 500 $, 3R = +3 000 $. Une perte au stop vaut toujours −1 000 $.

Les heures sont données en **heure de New York**, car l'ouverture est toujours à 9:30 NY. À Paris, cela fait 15:30 la plupart de l'année, mais 14:30 pendant les semaines où les États-Unis et l'Europe ne changent pas d'heure le même jour. En 2026, ce sont les semaines du 9 au 27 mars et du 26 au 30 octobre.

---

## 1. La règle d'entrée (commune aux deux indices)

1. **Tendance** : on ne prend que le sens donné par le filtre de tendance de l'indice (voir section 2).
2. **Liquidité** : on note le haut et le bas du **pré-marché** (8:00–9:30 NY).
3. **Judas** : après 9:30, le prix doit passer au-delà de ce niveau : sous le bas pour un achat, au-dessus du haut pour une vente. Le point extrême atteint s'appelle le « fond du Judas » (ou le « sommet » pour une vente).
4. **Cassure (MSS) M1** : une bougie M1 **clôture** au-delà du dernier sommet M1 formé avant le fond du Judas (le dernier creux pour une vente). Ce sommet est un pivot de 2 bougies de chaque côté.
5. **Fibonacci** : on le trace du fond du Judas (0 %) au plus haut de la jambe (100 %). Tant que la jambe fait de nouveaux plus hauts, on le retrace.
6. **Ordre limite au 50 %**. Stop = fond du Judas − marge. TP = 2R, 2,5R ou 3R du risque.
7. L'ordre doit être rempli **entre 10:00 et 11:00 NY** (16:00–17:00 Paris). On sort à 13:00 NY si ni le stop ni le TP n'ont été touchés.
8. Un seul trade par indice et par jour : le premier setup valide.

![Exemple d'entrée SP500, 8 mai 2026](img/entree-sp500-2026-05-08.png)

## 2. Règles retenues par indice

| | US100 | SP500 |
|---|---|---|
| Filtre de tendance | H4 | H4 **et** Daily d'accord |
| FVG M1 | obligatoire, comme validation de la cassure (on n'entre pas dessus) | non exigé |
| Marge du stop sous le Judas | 3 pts | 2 pts |
| **Nouveau filtre (proposé)** | **cassure nette** : la clôture dépasse le sommet d'au moins 5 % du risque (≈ 3–5 pts). Sinon, on attend une vraie cassure plus tard | **Judas pas trop tôt** : le fond du Judas doit se former au moins **20 min après 9:30** (après 9:50 NY = 15:50 Paris). Sinon, on attend un nouveau Judas |

Définitions des tendances :
- **H4** : sommets et creux H4 montants (ou descendants), plus position du prix par rapport aux EMA20 et EMA50.
- **Daily** : le prix est au-dessus de la moyenne des 10 dernières clôtures, et cette moyenne monte (l'inverse pour une baisse).

## 3. Résultats avec les règles de base (sans le nouveau filtre)

### US100 : H4, FVG, stop + 3 pts, entrées 10:00–11:00 NY

| Mois | Jours | Trades | % jours | Gagnants / perdants (3R) | 2R | 2,5R | 3R |
|---|---|---|---|---|---|---|---|
| déc. 2025 | 7 | 3 | 43 % | 2 / 1 | +1 080 $ | +1 580 $ | +1 190 $ |
| janv. | 21 | 5 | 24 % | 3 / 2 | +2 550 $ | +3 550 $ | +4 320 $ |
| févr. | 20 | 3 | 15 % | 1 / 2 | −990 $ | −990 $ | −990 $ |
| mars | 22 | 6 | 27 % | 2 / 4 | 0 $ | +170 $ | +670 $ |
| avr. | 22 | 4 | 18 % | 1 / 3 | −1 000 $ | −500 $ | 0 $ |
| mai | 21 | 7 | 33 % | 4 / 3 | +4 570 $ | +6 070 $ | +5 650 $ |
| juin | 22 | 6 | 27 % | 3 / 3 | +5 360 $ | +6 860 $ | +4 360 $ |
| juil. | 23 | 6 | 26 % | 2 / 4 | +3 000 $ | +1 000 $ | +2 000 $ |
| août | 21 | 7 | 33 % | 3 / 4 | +980 $ | +1 980 $ | +2 980 $ |
| sept. | 22 | 5 | 23 % | 3 / 2 | +4 000 $ | +5 500 $ | +7 000 $ |
| oct. | 22 | 6 | 27 % | 1 / 5 | 0 $ | −2 500 $ | −2 000 $ |
| nov. | 18 | 3 | 17 % | 2 / 1 | +1 610 $ | +2 110 $ | +2 610 $ |
| **Total** | **241** | **61** | **25 %** | **27 / 34** | **+21 160 $** | **+24 830 $** | **+27 790 $** |

Win rate (trade fini positif) : 49 % à 2R, 46 % à 2,5R, 44 % à 3R. Le TP est touché dans 38 %, 33 % et 25 % des trades. Pire baisse : −4 000 $.

### SP500 : H4 + Daily, sans FVG, stop + 2 pts, entrées 10:00–11:00 NY

| Mois | Jours | Trades | % jours | Gagnants / perdants (3R) | 2R | 2,5R | 3R |
|---|---|---|---|---|---|---|---|
| déc. 2025 | 7 | 1 | 14 % | 0 / 1 | −1 000 $ | −1 000 $ | −1 000 $ |
| janv. | 21 | 4 | 19 % | 4 / 0 | +6 060 $ | +3 370 $ | +3 370 $ |
| févr. | 20 | 3 | 15 % | 0 / 3 | −3 000 $ | −3 000 $ | −3 000 $ |
| mars | 22 | 5 | 23 % | 1 / 4 | −2 000 $ | −1 500 $ | −1 000 $ |
| avr. | 22 | 2 | 9 % | 0 / 2 | −1 570 $ | −1 570 $ | −1 570 $ |
| mai | 21 | 8 | 38 % | 4 / 4 | +4 000 $ | +6 000 $ | +8 000 $ |
| juin | 22 | 4 | 18 % | 1 / 3 | −1 000 $ | −500 $ | 0 $ |
| juil. | 23 | 1 | 4 % | 0 / 1 | −1 000 $ | −1 000 $ | −1 000 $ |
| août | 21 | 2 | 10 % | 1 / 1 | +1 000 $ | +1 500 $ | +2 000 $ |
| sept. | 22 | 2 | 9 % | 2 / 0 | +4 000 $ | +5 000 $ | +6 000 $ |
| oct. | 22 | 3 | 14 % | 0 / 3 | −3 000 $ | −3 000 $ | −3 000 $ |
| nov. | 18 | 2 | 11 % | 2 / 0 | +4 000 $ | +3 990 $ | +4 490 $ |
| **Total** | **241** | **37** | **15 %** | **15 / 22** | **+6 490 $** | **+8 290 $** | **+13 290 $** |

Win rate : 41 %. Le TP est touché dans 35 % des trades à 2R et 27 % à 3R. Pire baisse : −6 000 $.

### Les deux indices ensemble (règles de base)

- 80 jours avec au moins un trade sur 241, soit **33 %** des jours. US100 seul : 43 jours ; SP500 seul : 19 jours ; les deux le même jour : 18 jours.
- Quand les deux indices donnent un trade le même jour, c'est **toujours dans le même sens**. Ils ont perdu ensemble 9 fois (−2 000 $ ce jour-là) et gagné ensemble 5 fois.
- Résultat combiné : +27 650 $ à 2R, +33 120 $ à 2,5R, +41 080 $ à 3R.

## 4. Augmenter le win rate : le nouveau filtre par indice

| | Trades | % jours | Win rate 2R | Win rate 3R | 2R | 3R | Pire baisse |
|---|---|---|---|---|---|---|---|
| US100 de base | 61 | 25 % | 49 % | 44 % | +21 160 $ | +27 790 $ | −4 000 $ |
| **US100 + cassure nette** | **58** | **24 %** | **52 %** | **47 %** | **+24 160 $** | **+30 790 $** | −4 000 $ |
| SP500 de base | 37 | 15 % | 41 % | 41 % | +6 490 $ | +13 290 $ | −6 000 $ |
| **SP500 + Judas après 9:50** | **31** | **13 %** | **55 %** | **55 %** | **+17 640 $** | **+24 440 $** | **−3 000 $** |

Robustesse :
- **US100** : un seuil de cassure de 5 %, 7,5 % ou 10 % du risque donne le même résultat.
- **SP500** : avec un fond du Judas exigé après 15, 20 ou 25 min, le win rate passe de 41 % à 49 %, puis 55 % et 55 %. Les deux moitiés de l'année s'améliorent.

### Détail par mois avec les nouveaux filtres (3R)

| Mois | US100 trades | US100 win rate | US100 | SP500 trades | SP500 win rate | SP500 | Jours avec un trade |
|---|---|---|---|---|---|---|---|
| déc. | 3 | 67 % | +1 190 $ | 1 | 100 % | +1 000 $ | 3 |
| janv. | 5 | 60 % | +4 320 $ | 3 | 100 % | +2 440 $ | 8 |
| févr. | 3 | 33 % | −990 $ | 2 | 0 % | −2 000 $ | 5 |
| mars | 6 | 33 % | +670 $ | 3 | 33 % | +1 000 $ | 8 |
| avr. | 4 | 25 % | 0 $ | 2 | 0 % | −2 000 $ | 5 |
| mai | 7 | 57 % | +5 650 $ | 6 | 67 % | +7 510 $ | 10 |
| juin | 6 | 50 % | +4 360 $ | 2 | 50 % | +2 000 $ | 6 |
| juil. | 6 | 33 % | +2 000 $ | 2 | 50 % | +2 000 $ | 8 |
| août | 5 | 60 % | +4 980 $ | 2 | 50 % | +2 000 $ | 6 |
| sept. | 5 | 60 % | +7 000 $ | 3 | 67 % | +5 000 $ | 6 |
| oct. | 5 | 20 % | −1 000 $ | 3 | 33 % | +1 000 $ | 7 |
| nov. | 3 | 67 % | +2 610 $ | 2 | 100 % | +4 490 $ | 4 |
| **Total** | **58** | **47 %** | **+30 790 $** | **31** | **55 %** | **+24 440 $** | **76 (32 %)** |

Résultat combiné : **+55 230 $ à 3R** (contre +41 080 $) et **+41 800 $ à 2R** (contre +27 650 $). Le SP500 passe de 5 à 10 mois positifs sur 12.

## 4 bis. Tendance H1 au lieu du H4, ou les deux ensemble

La tendance H1 est calculée de la même façon que la H4 (sommets/creux, EMA20/50), sur les bougies H1 terminées avant 9:25 NY. Les résultats ci-dessous incluent les nouveaux filtres (cassure nette pour US100, Judas après 9:50 pour SP500), avec un risque de 1 000 $.

### US100

| Filtre de tendance | Trades | % jours | Win rate 2R | Win rate 3R | 2R | 3R | Pire baisse |
|---|---|---|---|---|---|---|---|
| **H4 (actuel)** | **58** | **24 %** | **52 %** | **47 %** | **+24 160 $** | **+30 790 $** | −4 000 $ |
| H1 seul | 65 | 27 % | 46 % | 45 % | +16 820 $ | +29 720 $ | −6 000 $ |
| H1 et H4 d'accord | 40 | 17 % | 55 % | 53 % | +20 510 $ | +29 140 $ | −3 000 $ |
| Daily + H1 + H4 | 21 | 9 % | 43 % | 38 % | +3 200 $ | +4 790 $ | −3 000 $ |

### SP500

| Filtre de tendance | Trades | % jours | Win rate 2R | Win rate 3R | 2R | 3R | Pire baisse |
|---|---|---|---|---|---|---|---|
| **H4 + Daily (actuel)** | **31** | **13 %** | **55 %** | **55 %** | **+17 640 $** | **+24 440 $** | **−3 000 $** |
| H4 seul | 60 | 25 % | 45 % | 43 % | +18 060 $ | +27 740 $ | −7 000 $ |
| H1 seul | 61 | 25 % | 39 % | 36 % | +10 140 $ | +13 130 $ | −15 770 $ |
| H1 et H4 d'accord | 40 | 17 % | 40 % | 38 % | +7 130 $ | +12 300 $ | −10 000 $ |
| Daily + H1 | 23 | 10 % | 48 % | 48 % | +9 130 $ | +13 490 $ | −4 000 $ |
| Daily + H1 + H4 | 21 | 9 % | 48 % | 48 % | +8 130 $ | +12 440 $ | −3 000 $ |

Conclusions :
- **Le H1 seul ne remplace pas le H4.** Sur US100, il donne un peu plus de trades, mais moins de gains à 2R et une pire baisse plus grande. Sur SP500, il est nettement moins bon et perd sur la seconde moitié de l'année.
- **US100 avec H1 et H4 d'accord** : c'est la variante au meilleur win rate (53 % à 3R, 55 % à 2R) et à la plus petite baisse (−3 000 $), pour le même résultat à 3R. En revanche, elle donne 31 % de trades en moins. C'est la même chose sans le filtre de cassure (42 trades, 50 %).
- **SP500 avec H4 seul**, une fois le filtre « Judas après 9:50 » appliqué, devient rentable sur les deux moitiés de l'année : 2 fois plus de trades et un peu plus de gains, mais un win rate de 43 % et une pire baisse de −7 000 $. Sans ce filtre, le H4 seul restait faible sur SP500.

### Combinaisons des deux indices (3R)

| Combinaison | Trades | Jours avec un trade | Win rate 3R | 2R | 3R | Pire baisse |
|---|---|---|---|---|---|---|
| **A. US100 H4 + SP500 H4+Daily (actuel)** | 89 | 76 (32 %) | 49 % | +41 800 $ | +55 230 $ | −5 320 $ |
| B. US100 H4 + SP500 H4 | 118 | 87 (36 %) | 45 % | +42 220 $ | +58 530 $ | −7 320 $ |
| C. US100 H1+H4 + SP500 H4+Daily | 71 | 61 (25 %) | 54 % | +38 150 $ | +53 580 $ | −5 000 $ |
| D. US100 H1+H4 + SP500 H4 | 100 | 78 (32 %) | 47 % | +38 570 $ | +56 880 $ | −7 000 $ |

## 4 ter. Analyse des trades perdants de B

Objectif : trouver un motif commun aux trades perdants de B, qu'on pourrait retirer sans toucher aux gagnants.

Méthode : B compte 118 trades (65 perdants, 53 gagnants). Pour chaque mesure du setup, j'ai comparé les perdants et les gagnants. Les mesures testées :
- profondeur et heure du Judas, heure de la cassure, netteté et corps de la bougie de cassure ;
- taille de la jambe, risque comparé à la volatilité, range du pré-marché, gap ;
- premium/discount par rapport à la veille, liquidité visée, distance à l'ouverture ;
- délai entre la cassure et l'entrée ;
- tendance Daily et H1 par rapport au trade ;
- les 10 facteurs fondamentaux.

Contrôle anti-hasard : le motif est choisi sur la première moitié de l'année (déc.–juin), puis vérifié sur la seconde (juin–nov.).

Résultats :
- **La plupart des motifs sont du hasard.** Les 8 meilleurs motifs trouvés sur la première moitié font perdre de l'argent ou n'apportent rien sur la seconde moitié, sauf un. Par exemple, « Judas très profond » sur SP500 : 8 perdants pour 1 gagnant sur l'année, mais tout l'effet vient de la première moitié. Sur US100, le même motif retire 7 gagnants.
- **Le vrai motif des pertes de B, c'est le Daily sur SP500.** Les 29 trades SP500 de B où le Daily n'est pas d'accord ont un win rate de 31 %. Ils ne rapportent que +3 300 $ à 3R et font passer la pire baisse de −5 320 à −7 320 $. C'est exactement ce que le filtre de A retire.
- **Un seul motif tient sur les deux moitiés : US100 quand le H1 va contre le trade.** Il concerne 7 trades : 6 perdants et 1 gagnant, avec +2 920 $ puis +3 000 $ selon la moitié. C'est logique : on ne prend pas un trade contre la tendance horaire à l'ouverture. Sur SP500, ce motif ne marche pas (3 perdants, 4 gagnants).
- Fondamentaux : aucun des 10 facteurs (VIX, dollar, taux, Fed, emploi, inflation, crédit…) ne trie les perdants sans retirer autant ou plus de gagnants.

| Combinaison | Trades | Jours | Win rate 3R | Win rate 2R | 2R | 3R | Pire baisse |
|---|---|---|---|---|---|---|---|
| A actuel | 89 | 76 (32 %) | 49 % | 53 % | +41 800 $ | +55 230 $ | −5 320 $ |
| **A + US100 sans H1 contre** | **82** | **70 (29 %)** | **52 %** | **54 %** | **+41 720 $** | **+61 150 $** | **−5 000 $** |
| B | 118 | 87 (36 %) | 45 % | 48 % | +42 220 $ | +58 530 $ | −7 320 $ |
| B + US100 sans H1 contre | 111 | 83 (34 %) | 47 % | 49 % | +42 140 $ | +64 450 $ | −7 000 $ |

Le filtre « H1 contre » ajoute environ +6 000 $ à 3R, mais rien à 2R : à 2R, le gagnant retiré compense les pertes évitées.

## 5. Idées testées et rejetées

| Idée | Effet |
|---|---|
| Entrer au 61,8 % au lieu du 50 % | Le win rate baisse (44 % → 39 % sur US100) |
| N'entrer que du bon côté du prix d'ouverture | +2 points de win rate, mais 25 % de trades en moins |
| Stop au point d'entrée (break-even) à +1R | Moins de pertes, mais moins de TP et environ −5 000 $ |
| Sortir la moitié de la position à +1R | Win rate de 61 % (US100), mais environ −40 % de gains |
| Divergence SMT US100 / SP500 | Aucun effet mesurable |
| Fondamental (macro), Daily sur US100, jour de la semaine | Incohérent d'un indice à l'autre : du bruit |
| Stop élargi sur US100 (5, 7, 10 pts) | Pas de gain fiable : l'écart vient de 2 trades |
| Entrer dès 9:30–10:00 NY | Perdant (US100 −4 000 $ sur 12 trades) |
| Viser 70 % des jours avec un trade | Impossible avec une règle rentable : environ 1,5 jour par semaine au maximum |

## 6. Le stop élargi sur le SP500 (0,8 → 2 pts)

Exemple réel : le 10 août 2026, avec une entrée à 7 751,13. Avec le stop à 0,8 pt, une mèche descend à 7 747,10 et touche le stop : −1R. Avec le stop à 2 pts, il manque 0,2 pt pour le toucher, et le TP 3R est atteint à 17:10 : +3R. Sur l'année, seuls 4 trades sur 44 changent avec le stop à 2 pts. L'avantage existe mais reste fragile.

![Même trade avec deux stops, 10 août 2026](img/stop-elargi-sp500-2026-08-10.png)

## 7. Précautions

- Les filtres de la section 4 ont été choisis sur les mêmes données que celles qui servent à les juger. Les tests de robustesse sont rassurants, mais avec 31 trades SP500 sur l'année, le win rate de 55 % reste fragile. Il faut les **valider sur les semaines à venir**, en démo ou en notant chaque setup dans le journal.
- Les CFD FTMO ont un spread et un slippage qui ne sont pas simulés ici. L'ordre de remplissage est prudent : si le stop et le TP sont touchés dans la même bougie M1, on compte le stop.

## Annexe technique

- Fonction de backtest : edge function Supabase `desk-bt-m1` (v8), avec les paramètres `sym`, `fvg`, `buf`, `fib`, `minbrk`, `minext`, `openside`, `rr`, `fillend`, `from` et `to`.
- Résultats : table `desk_bt` (une ligne par jour, filtre et niveau ; `rv` contient les variantes de gestion, `x` les mesures du setup).
- Runs de référence :
  - `ux` / `spx` : règles de base ;
  - `ux_b05` : US100 + cassure nette ;
  - `spx_e20` : SP500 + Judas après 9:50 ;
  - `uh1`, `sh1`, `uh1b`, `sh1b` : tests de tendance H1.
