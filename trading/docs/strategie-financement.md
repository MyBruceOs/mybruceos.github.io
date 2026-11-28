# Stratégie de financement : des challenges FTMO au compte propre

*Écrite le 28/11/2026 à partir des simulations (backtests.md 4 vicies, 4 duovicies, 4 trevicies et ci-dessous). Versements FTMO : le premier 14 jours après le passage en compte financé, puis un par mois. Les chiffres supposent que la règle garde son avantage ; les colonnes « 50 % » montrent ce qui se passe si elle n'en garde que la moitié.*

## Principe
- Les challenges FTMO sont le moteur : pour quelques centaines d'euros, tu trades jusqu'à 400 k$ de capital. C'est de loin ce qui rapporte le plus par euro risqué.
- Le compte propre est la deuxième jambe : il est construit avec les versements FTMO, il lisse tes revenus (moins de mois sans rien) et il continue de tourner si FTMO change ses règles.
- Tous les comptes prennent les mêmes trades : une mauvaise série touche tout en même temps. D'où une **caisse challenges** qu'on ne vide jamais, et un compte propre à risque modéré.

## Phase 1 · Démarrage (budget 1 200 €)
1. Acheter **un seul challenge 50k** (345 €). Garder les 855 € restants : deux autres essais en cas d'échec.
2. Challenge à **1,5 %** par trade (1,8 % pour aller plus vite, réussite plus faible). Compte financé à **2,15 %**, coussin de **5 %** laissé à chaque versement (si FTMO l'autorise).
3. Ne rien acheter d'autre avant le premier versement (vers le 3e mois en médiane).

## Phase 2 · Montée en charge (à partir du premier versement)
1. Chaque versement va dans la **caisse challenges**.
2. Dès que la caisse le permet, acheter un **challenge 100k** à 1,5 %, jusqu'à **400 k$** au total (50k + 3 × 100k + 50k).
3. Compte perdu ou challenge raté : racheter tout de suite, au même risque.
4. **Ne rien sortir de la caisse tant qu'elle n'a pas 10 000 €.** C'est de quoi relancer quatre fois tous les challenges. Avec 2 500 € de caisse, la machine s'arrête faute d'argent dans 65 % des parcours sur 3 ans ; avec 10 000 €, dans 12 %.

## Phase 3 · Construire le compte propre
Chaque fin de mois, ce qui dépasse 10 000 € dans la caisse challenges :
- **70 % sur le compte propre** ;
- **30 % pour toi**.
On s'arrête quand le compte propre atteint **100 000 €**.

## Phase 4 · Croisière
- FTMO : tout ce qui dépasse 10 000 € dans la caisse challenges est **pour toi**.
- Le compte propre continue de travailler seul, avec ses propres retraits (ci-dessous).

## Le compte propre et tes retraits
- **Courtier** : un courtier régulé avec MT5, l'US100, l'US500 et l'or en CFD, et des spreads proches de ceux de FTMO. Desk Key tourne dessus comme sur FTMO (un MT5 à part, idéalement sur le VPS).
- **Risque : 1 % du solde par trade** (Desk Key, risque « % du solde »). C'est ton argent : pas de 2,15 % ici. Pire baisse attendue : environ 16 % en médiane sur 3 ans, environ 21 % une fois sur dix. À 0,5 %, environ 8 % de baisse mais moitié moins de gains ; à 1,5 %, 25 à 30 % de baisse.
- **Retraits, le 1er de chaque mois** :
  - si le solde est **au-dessus de son plus haut** (les dépôts venant de FTMO montent le plus haut d'autant), retirer **50 % de l'écart** ; le plus haut devient le solde après retrait ;
  - si le solde est **sous son plus haut** : **ne rien retirer**, laisser remonter ;
  - ne jamais retirer le capital déposé.
- Les 50 % laissés à chaque fois font grossir le compte : les retraits grossissent avec lui.
- Mettre de côté une part de tout ce que tu retires (FTMO et compte propre) pour les impôts ; le taux dépend de ton statut, à voir avec un comptable.

## Ce que ça donne (simulation sur 36 mois, budget de départ 1 200 €)

| | Avantage du backtest | Avantage réduit de moitié |
|---|---|---|
| Argent touché par toi sur 3 ans | 712 k€ (médiane 741 k€) | 185 k€ (médiane 129 k€) |
| Touché la 3e année | 339 k€, environ 4 mois sur 12 sans rien | 101 k€, environ 7 mois sur 12 sans rien |
| Compte propre au bout de 3 ans | environ 189 k€ (médiane 197 k€) | environ 87 k€ (médiane 111 k€) |
| Patrimoine total (médiane) | 949 k€ | 251 k€ |
| Machine FTMO arrêtée faute de caisse | 12 % | 34 % |

Comparé à « tout pour moi, pas de compte propre » (même caisse de 10 000 €) : autant d'argent touché sur 3 ans (715 k€), mais pas de compte propre et plus de mois sans rien la 3e année (4,7 au lieu de 3,6 sur 12). Avec un avantage réduit de moitié, la stratégie avec compte propre fait mieux sur le patrimoine (251 k€ au lieu de 226 k€) et sur la régularité.

## Points de contrôle
- Après 3 à 6 mois de trades réels, comparer avec le backtest (onglet Suivi du test) : si on est plutôt dans la colonne « moitié », garder la même méthode mais relever la caisse challenges et ne pas dépasser 1 % sur le compte propre.
- Vérifier chez FTMO avant de compter dessus : le plafond de 400 k$, le coussin au versement, le rythme des versements (premier à 14 jours, puis mensuel).
- Le simulateur de l'application permet de refaire ces calculs (avantage 100 / 75 / 50 %, coussin, risques).
