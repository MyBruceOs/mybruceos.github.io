# Progress · Desk US

*Mis à jour le 27/11/2026. Fichier tenu à jour à chaque étape du projet.*

## Où on en est

| Élément | Version | En ligne | Remarque |
|---|---|---|---|
| Desk Key (MT5, exécution en une touche) | **1.09** | oui (27/11) | 1.09 : profil or (XAUUSD) avec second trade et stop du trade 1 remonté, feu rouge US100 / SP500 désactivable (bouton FEU ROUGE). 1.08 : Telegram / WhatsApp par le relais du serveur si MT5 échoue. |
| DeskUS_Bridge (MT5, données) | **1.06** | oui | Exporte aussi US30 et XAUUSD pour les backtests. |
| Application web | — | oui (or et feu rouge en ligne le 27/11) | Prête : or, second trade, colonne « Feu » et filtres du journal, statistiques et bornes d'alarme sur 3 ans. |
| Base Supabase | — | — | Plan gratuit : 133 Mo / 500 Mo (projet partagé avec une autre application). |
| Moteur de backtest `desk-bt-m1` | **v14** | — | v14 : chemin du prix et 34 gestions de sortie (backtests.md 4 quaterdecies). v13 : second trade. |
| (ancien) moteur | v11 | — | Séance paramétrable (Londres / New York) ; structure M5 avec exécution M1 (`tf=5`) ; historique M5 sur 3 ans (`src=M5`). Vérifié : redonne les trades de référence. |

## Fait
- Règle A validée en backtest M1 (US100 : H4, FVG, cassure nette ; SP500 : H4 + Daily, Judas après 9:50 NY). Détails : [regles.md](regles.md), [backtests.md](backtests.md).
- Desk Key : panneau, touche K, AUTO (désactivé par défaut), suivi du 50 %, annulation 11:00, sortie 13:00, historique jusqu'à 250 séances, protection annonces, money management dans le panneau, notifications (téléphone MT5, Telegram, WhatsApp), expiration de l'ordre côté FTMO.
- Application : Aujourd'hui, Mon compte, Journal, Suivi du test, Règles, Réglages ; profils lus dans la base (un actif validé apparaît tout seul).

## En cours
- ~~Backtest US30~~ : **fait le 27/11, rejeté** en M1 (win rate 23–32 %) **et en M5** (moteur v10 : structure M5, exécution M1 ; win rate 43–54 % mais toutes les versions perdent sur la première moitié de l'année). Recherche ICT / SMC (27/11) : **candidat trouvé**, règle A en **M5** avec biais H4, entrées 10:00–12:00 NY : positive chacune des 3 années (2024, 2025, 2026 ; +25,9 R en 3 ans, 41 trades par an), variante lissée avec draw on liquidity (10 trades par an, pire baisse −2R). Avantage plus faible que l'US100 / SP500 : à mettre en observation avant de l'ajouter. Entrées dès 9:30 NY testées aussi : ne changent rien au verdict et dégradent l'US100 (12 trades ajoutés, 17 % de gagnants). À retester dans quelques mois. Détails : backtests.md, section 4 sexies.
- ~~Backtest XAUUSD~~ : **fait le 27/11. New York gagne, Londres perd.** Même mécanique que les indices, biais H4, sans FVG obligatoire : 43 trades, 49 % de gagnants, +23,5 R, pire baisse −3 R, positif sur les deux moitiés de l'année (backtests.md 4 octies). Variantes (27/11) : entrées 10:00–12:00 NY meilleures (53 trades, 53 %, +30,4 R, pire baisse −3 R) ; biais H1 seul aussi solide (46 trades, 52 %, +30,9 R) ; TP 3R mieux que 2R ; sortie 13:00 NY ; pic de volatilité de l'or à 10:00 NY comme l'US100. Mélange retenu : **« H4 ou H1, sans conflit »**, entrées 10:00–12:00 NY, TP 3R : 53 trades, 55 % de gagnants, +37,7 R (+23,2 / +14,5), 0 mois négatif. Portefeuille 3 actifs : +92,9 R, 12 mois positifs sur 12, pire baisse −9 R ; Monte Carlo : creux 1 année sur 100 −16,8 R ; un seul compte à 0,5–0,75 % par trade (backtests.md 4 nonies). À confirmer sur 2024–2025 (export M1 sur 3 ans en cours) avant d'ajouter un profil XAUUSD.
- Export M1 sur 3 ans (US100, SP500, puis XAUUSD) en cours depuis le 27/11 à 4:20 Paris ; ensuite, test des règles exactes sur 2024 et 2025.

- **US30 abandonné** (décision de l'utilisateur le 27/11, après la recherche ICT / SMC).
- **Validation de l'US100 et du SP500 sur 2024 et 2025** : l'approximation M5 ne permet pas de juger la règle A (calibrée sur 2026, voir backtests.md 4 septies). En attente de l'export M1 sur 3 ans.

- **Règles de l'or écrites** dans regles.md (section 3 bis, candidat) : séance New York, sens « H4 ou H1, sans conflit », entrées 10:00–12:00 NY, stop Judas ± 1 $, TP 3R, sortie 13:00 NY.
- Vérification sur l'historique réel 2026 (un compte, 3 actifs, 1 % par trade) : pire creux −9,5 % début avril–début mai (9 pertes d'affilée) ; repère 0,75 % en challenge, 0,5 % en financé.
- Export M1 sur 3 ans (27/11, 5:00 Paris) : US100 complet (depuis le 27/11/2023), SP500 en cours (depuis le 13/08/2024), or ensuite.

- **Second trade sur l'or seulement, avec le stop du trade 1 remonté au stop du second trade** (moteur v13) : or +51,2 R au lieu de +37,7 R, pire creux −4,0 R ; compte 3 actifs +106,4 R, pire creux −8,5 R. Ajouté comme option dans regles.md (or), à confirmer sur 2024–2025.
- Second trade de continuation testé (moteur v12, backtests.md 4 decies) : +21 trades par an, +15,8 R avec l'objectif du trade 1, mais creux −10 R et le second trade perd à chaque fois que le trade 1 perd ; pas mis en place, à retester sur 2024–2025 (or seul).

- **Validation 3 ans US100 / SP500 (27/11)** : 2024 gagnant (+41,8 R / +17,1 R), **2025 perdant** (−19,2 R / −2,8 R, creux combiné −29 R, 14 pertes d'affilée), 2026 gagnant. Sur 3 ans : +92 R, pire creux réel −32,7 R. Risque à revoir : environ 0,33 % par trade pour rester sous −10 % (backtests.md 4 undecies). À faire : chercher ce qui distingue 2025 (filtre de régime ?) ; recalculer les bornes de l'application sur 3 ans ; valider l'or sur 3 ans (export en cours, depuis le 06/08/2025).

- **2025 analysé** (backtests.md 4 duodecies) : ni le sens, ni la volatilité, ni le biais H4 ne l'expliquent ; seul le résultat récent de la règle le détecte. **Feu rouge par actif** (pause si les 10 derniers setups < 0 R, la règle continue d'être suivie) : 3 ans +98 R au lieu de +92 R, creux −11,7 R au lieu de −29 R, 2025 −6 R au lieu de −22 R. À valider sur l'or, puis à ajouter dans Desk Key et l'application.

## À faire par l'utilisateur
- [ ] Compiler Desk Key 1.09 dans MetaEditor (télécharger le fichier depuis l'onglet Réglages de l'application) et me transmettre les erreurs s'il y en a.
- [ ] Mettre Desk Key 1.09 sur 3 graphiques M1 : US100, SP500 et XAUUSD (le profil or se choisit tout seul).
- [x] Installer Desk Key 1.07 sur les deux graphiques (vu en ligne le 27/11 à 2:01 Paris).
- [x] DeskUS_Bridge 1.06 remis sur son propre graphique (US30.cash M5) : en ligne depuis le 27/11 à 2:15 Paris, export en cours.
- [x] Notifications sur le téléphone (application MT5) : fonctionnent.
- [x] Desk Key 1.08 installé ; notifications Telegram OK (27/11, 2:36 Paris), par le relais du serveur Desk US car MT5 renvoie l'erreur 1009 / 5203 vers api.telegram.org.

- [ ] Bridge → F7 → Paramètres : « Profondeur de l'export M1 » = **1095** et « Symboles à exporter seulement » = **XAUUSD** (retirer US30.cash), puis laisser MT5 ouvert environ 2 h.
- [ ] Quand l'export est terminé (« export terminé » dans l'onglet Experts) : Bridge → F7 → « Exporter l'historique » = false.

- **Or validé sur 3 ans (27/11)** : +2,4 / +35,4 / +37,7 R (trade 1 seul), +13,8 / +47,9 / +51,2 R avec le second trade (confirmé hors échantillon). Le feu rouge n'aide pas l'or.
- **Compte 3 actifs, configuration retenue** : feu rouge sur l'US100 et le SP500, or avec second trade sans feu rouge : 3 ans +211 R (2024 +69,7 ; 2025 +41,9 ; 2026 +99,7), pire creux −13,6 R, 29 mois positifs sur 36 ; risque **0,5 % par trade** (5 % de risque de toucher −10 % dans l'année, pire creux réel −7,4 %), 0,33 % pour une sécurité maximale (backtests.md 4 terdecies).
- **Or : séries de pertes et retournements analysés (27/11, moteur v14, backtests.md 4 quaterdecies)** : seuls 7 perdants sur 107 avaient atteint +2R ; aucune gestion de sortie (stop à l'entrée, verrouillage, stop suiveur, sortie partielle, sortie au temps) ne bat le TP 3R de façon fiable ; aucun filtre d'entrée ne tient d'une année sur l'autre ; les pertes de l'or ne s'enchaînent pas plus que le hasard. Règles de l'or inchangées.
- **Proposé, à décider par l'utilisateur** : mi-risque automatique quand le compte est à 4 R sous son plus haut (retour au risque normal à 2 R du plus haut) : pire creux 3 ans −8,8 R au lieu de −13,6 R pour +176 R au lieu de +211 R ; à sécurité égale (5 % de chances de toucher −10 %), 0,87 % par trade au lieu de 0,54 %, gain médian simulé +45 % au lieu de +35 %.

- **Pas de mi-risque automatique** quand le compte est en creux : proposé le 27/11, refusé par l'utilisateur.
- **Mise en ligne de Desk Key 1.09 et de l'application (27/11)** : demande de fusion n° 14 fusionnée ; base à jour (profil XAUUSD, statistiques 3 ans, second trade réel conservé).
- **Journal sur 3 ans (27/11)** : les jours avant l'installation de Desk Key (indices jusqu'au 08/12/2025, or jusqu'au 23/07/2026, depuis le 22/12/2023) sont complétés dans la base par le moteur de backtest (mêmes règles, mention « backtest », feu rouge recalculé, second trade de l'or). Périodes 1 an, 2 ans, 3 ans dans le journal, chargées à la demande : en ligne (27/11). Desk Key 1.09 vérifié en réel sur l'or : le 02/11/2026 donne −1,23 R avec les 2 trades, comme le backtest.
- **Colonne « Délai » dans le journal (27/11, en ligne)** : délai entre la cassure et la touche, totaux « dans les 20 min » / « après 20 min », colonne dans l'export CSV ; pour juger en réel si un lot plus gros sur les touches lentes vaudrait le coup (pas de changement de règle pour l'instant).
- **Stratégie de comptes (27/11, backtests.md 4 octodecies, même page interactive)** : challenge 2 % puis financé 1,5 % → 128 k$ net en moyenne sur 24 mois (82 k$ pour 1 % / 1 %) ; au-delà de 1,5 % en challenge, plus de gain ; 2,25 % en financé = meilleure moyenne mais au bord de la falaise. Coussin de 5 % laissé sur le compte : même gain, comptes financés perdus 44 % au lieu de 66 % sur 24 mois ; la perte du jour reste à 5 %. À vérifier : FTMO autorise-t-il à laisser une partie des gains au versement ?
- **Monte-Carlo FTMO (27/11, backtests.md 4 septdecies, page interactive https://claude.ai/artifact/7fiv2m6ytSdhsvFKCzFe5Q)** : à 0,5 % par trade, 99 % de réussite des 2 phases en 5,5 mois (médiane) ; à 1 %, 91 % en 2,7 mois ; à 1,5 %, 82 % en 1,8 mois ; à 2 %, 71 % en 1,4 mois.
- **Mois négatifs, disettes, fréquence (27/11, backtests.md 4 sexdecies)** : 7 mois négatifs sur 36 (aucun en 2026) ; 9 journées perdantes d'affilée du 6 avril au 5 mai 2026 (record, à égalité avec juin 2024) ; au plus 12 séances sans trade ; jusqu'à 150 séances sans nouveau plus haut (2025) ; un jour de trade toutes les 2,2 séances, environ 3 trades par semaine.
- **Jour de la semaine et délai cassure → touche (27/11, backtests.md 4 quindecies)** : le vendredi faible n'existe qu'en 2026 (sur 3 ans : +25,9 R, deuxième meilleur jour) ; aucune règle par jour ne tient d'une année sur l'autre (indices et or). Annuler l'ordre s'il n'est pas touché vite fait toujours perdre. Piste à surveiller sur les indices : touche plus de 20 min après la cassure meilleure (+0,59 R contre +0,23 R par entrée, chaque année ; test du hasard 7 %) ; l'or fait l'inverse.

## Mise à jour or + feu rouge (27/11) — en ligne
- **Desk Key 1.09** : profil or (H4 ou H1 sans conflit, stop Judas ± 1 $, entrées 10:00–12:00 NY, TP 3R, sortie 13:00 NY) ; second trade (détection copiée du moteur de backtest : identique sur 20 000 séries de test) avec stop du trade 1 remonté au remplissage ; feu rouge US100 / SP500 calculé chaque matin sur les 10 derniers setups, bouton FEU ROUGE ON / OFF ; envoi du feu et du second trade à l'application. À compiler dans MetaEditor (pas de compilateur MQL5 ici).
- **Application** : or et second trade (Aujourd'hui, Journal, Mon compte, Suivi), colonne « Feu » et filtres « Sous feu vert / rouge » dans le journal, alerte du jour, règles et statistiques sur 3 ans (bornes d'alarme recalculées).
- **Base** (appliquée à la mise en ligne) : profil XAUUSD, règles et statistiques 3 ans des trois profils et de l'ensemble, second trade réel conservé par `desk_setup_push`.

## Décidé, à faire après l'analyse de l'or (27/11) — fait dans la mise à jour ci-dessus
- **Feu rouge sur l'US100 et le SP500 (pas sur l'or), activé** : pause d'un actif quand la somme de ses 10 derniers setups (résultat de la règle à 3R, pris ou non) est négative ; retour automatique au vert quand elle redevient positive ou nulle. Explication visuelle : https://claude.ai/artifact/CXxoyndBmwbWBnf1v8Lk7z
  - Desk Key : voyant vert / rouge par actif avec la somme des 10 derniers setups ; en rouge, la touche K et le mode AUTO ne placent pas l'ordre (option « prévenir seulement ») ; notification à chaque changement de couleur ; la règle continue d'être suivie à blanc.
  - Application : voyant et courbe du total des 10 derniers setups par actif, historique des périodes rouges.
- Profil or (validé sur 3 ans) dans la base, Desk Key et l'application, avec le second trade et le stop du trade 1 remonté.
- Bornes d'alarme de l'application recalculées sur 3 ans ; repères de risque mis à jour.

## Plus tard
- Installer MT5, Desk Key et le Bridge sur le **VPS de l'utilisateur** (MT5 allumé 24 h/24 : sortie de 13:00 NY assurée même PC éteint).
- Plusieurs comptes FTMO : voir [backlog.md](backlog.md).
- Supabase Pro (sauvegardes automatiques) quand le compte est financé ; en attendant, export CSV du Journal de temps en temps.
