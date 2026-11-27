# Progress · Desk US

*Mis à jour le 27/11/2026 (nuit). Fichier tenu à jour à chaque étape du projet.*

## Où on en est

| Élément | Version | En ligne | Remarque |
|---|---|---|---|
| Desk Key (MT5, exécution en une touche) | **1.08** | oui | Telegram / WhatsApp : nettoyage des valeurs collées, relais par le serveur si MT5 échoue (erreur 1009), résultat du test dans le panneau. 1.07 : expiration de l'ordre à 11:00 NY chez FTMO. |
| DeskUS_Bridge (MT5, données) | **1.06** | oui | Exporte aussi US30 et XAUUSD pour les backtests. |
| Application web | — | oui | Onglet Mon compte ; lecture incrémentale (quota Supabase). |
| Base Supabase | — | — | Plan gratuit : 133 Mo / 500 Mo (projet partagé avec une autre application). |
| Moteur de backtest `desk-bt-m1` | **v11** | — | Séance paramétrable (Londres / New York) ; structure M5 avec exécution M1 (`tf=5`) ; historique M5 sur 3 ans (`src=M5`). Vérifié : redonne les trades de référence. |

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
- [x] Installer Desk Key 1.07 sur les deux graphiques (vu en ligne le 27/11 à 2:01 Paris).
- [x] DeskUS_Bridge 1.06 remis sur son propre graphique (US30.cash M5) : en ligne depuis le 27/11 à 2:15 Paris, export en cours.
- [x] Notifications sur le téléphone (application MT5) : fonctionnent.
- [x] Desk Key 1.08 installé ; notifications Telegram OK (27/11, 2:36 Paris), par le relais du serveur Desk US car MT5 renvoie l'erreur 1009 / 5203 vers api.telegram.org.

- [ ] Bridge → F7 → Paramètres : « Profondeur de l'export M1 » = **1095** et « Symboles à exporter seulement » = **XAUUSD** (retirer US30.cash), puis laisser MT5 ouvert environ 2 h.
- [ ] Quand l'export est terminé (« export terminé » dans l'onglet Experts) : Bridge → F7 → « Exporter l'historique » = false.

## Décidé, à faire après l'analyse de l'or (27/11)
- **Feu rouge par actif, activé** : pause d'un actif quand la somme de ses 10 derniers setups (résultat de la règle à 3R, pris ou non) est négative ; retour automatique au vert quand elle redevient positive ou nulle. Explication visuelle : https://claude.ai/artifact/CXxoyndBmwbWBnf1v8Lk7z
  - Desk Key : voyant vert / rouge par actif avec la somme des 10 derniers setups ; en rouge, la touche K et le mode AUTO ne placent pas l'ordre (option « prévenir seulement ») ; notification à chaque changement de couleur ; la règle continue d'être suivie à blanc.
  - Application : voyant et courbe du total des 10 derniers setups par actif, historique des périodes rouges.
- Profil or (si la validation 3 ans le confirme) dans la base, Desk Key et l'application ; option second trade sur l'or.
- Bornes d'alarme de l'application recalculées sur 3 ans ; repères de risque mis à jour.

## Plus tard
- Installer MT5, Desk Key et le Bridge sur le **VPS de l'utilisateur** (MT5 allumé 24 h/24 : sortie de 13:00 NY assurée même PC éteint).
- Plusieurs comptes FTMO : voir [backlog.md](backlog.md).
- Supabase Pro (sauvegardes automatiques) quand le compte est financé ; en attendant, export CSV du Journal de temps en temps.
