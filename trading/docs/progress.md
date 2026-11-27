# Progress · Desk US

*Mis à jour le 27/11/2026 (nuit). Fichier tenu à jour à chaque étape du projet.*

## Où on en est

| Élément | Version | En ligne | Remarque |
|---|---|---|---|
| Desk Key (MT5, exécution en une touche) | **1.08** | oui | Telegram / WhatsApp : nettoyage des valeurs collées, relais par le serveur si MT5 échoue (erreur 1009), résultat du test dans le panneau. 1.07 : expiration de l'ordre à 11:00 NY chez FTMO. |
| DeskUS_Bridge (MT5, données) | **1.06** | oui | Exporte aussi US30 et XAUUSD pour les backtests. |
| Application web | — | oui | Onglet Mon compte ; lecture incrémentale (quota Supabase). |
| Base Supabase | — | — | Plan gratuit : 133 Mo / 500 Mo (projet partagé avec une autre application). |
| Moteur de backtest `desk-bt-m1` | **v9** | — | Séance paramétrable (Londres / New York). Vérifié : redonne les 163 trades de référence. |

## Fait
- Règle A validée en backtest M1 (US100 : H4, FVG, cassure nette ; SP500 : H4 + Daily, Judas après 9:50 NY). Détails : [regles.md](regles.md), [backtests.md](backtests.md).
- Desk Key : panneau, touche K, AUTO (désactivé par défaut), suivi du 50 %, annulation 11:00, sortie 13:00, historique jusqu'à 250 séances, protection annonces, money management dans le panneau, notifications (téléphone MT5, Telegram, WhatsApp), expiration de l'ordre côté FTMO.
- Application : Aujourd'hui, Mon compte, Journal, Suivi du test, Règles, Réglages ; profils lus dans la base (un actif validé apparaît tout seul).

## En cours
- ~~Backtest US30~~ : **fait le 27/11, rejeté** (aucune version positive sur les deux moitiés de l'année, win rate 23–32 % ; détails dans backtests.md, section 4 sexies).
- **Backtest XAUUSD** : séance de Londres (range asiatique, Judas après 2:00 NY, entrée 3:00–5:00 NY, sortie 8:00 NY) contre séance de New York.
- Export : US100, US500 et US30 complets (doublons M5 nettoyés) ; XAUUSD en cours (environ 7 jours de M1 par minute). Backtests or lancés automatiquement vers 4:05 Paris.

## À faire par l'utilisateur
- [x] Installer Desk Key 1.07 sur les deux graphiques (vu en ligne le 27/11 à 2:01 Paris).
- [x] DeskUS_Bridge 1.06 remis sur son propre graphique (US30.cash M5) : en ligne depuis le 27/11 à 2:15 Paris, export en cours.
- [x] Notifications sur le téléphone (application MT5) : fonctionnent.
- [x] Desk Key 1.08 installé ; notifications Telegram OK (27/11, 2:36 Paris), par le relais du serveur Desk US car MT5 renvoie l'erreur 1009 / 5203 vers api.telegram.org.

- [ ] Quand l'export est terminé (« export terminé » dans l'onglet Experts) : Bridge → F7 → « Exporter l'historique » = false.

## Plus tard
- Installer MT5, Desk Key et le Bridge sur le **VPS de l'utilisateur** (MT5 allumé 24 h/24 : sortie de 13:00 NY assurée même PC éteint).
- Plusieurs comptes FTMO : voir [backlog.md](backlog.md).
- Supabase Pro (sauvegardes automatiques) quand le compte est financé ; en attendant, export CSV du Journal de temps en temps.
