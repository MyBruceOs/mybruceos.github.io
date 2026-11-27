# Progress · Desk US

*Mis à jour le 27/11/2026 (nuit). Fichier tenu à jour à chaque étape du projet.*

## Où on en est

| Élément | Version | En ligne | Remarque |
|---|---|---|---|
| Desk Key (MT5, exécution en une touche) | **1.07** | oui | Expiration de l'ordre à 11:00 NY chez FTMO. 1.06 : risque réglable dans le panneau, notifications. |
| DeskUS_Bridge (MT5, données) | **1.06** | oui | Exporte aussi US30 et XAUUSD pour les backtests. |
| Application web | — | oui | Onglet Mon compte ; lecture incrémentale (quota Supabase). |
| Base Supabase | — | — | Plan gratuit : 133 Mo / 500 Mo (projet partagé avec une autre application). |
| Moteur de backtest `desk-bt-m1` | **v9** | — | Séance paramétrable (Londres / New York). Vérifié : redonne les 163 trades de référence. |

## Fait
- Règle A validée en backtest M1 (US100 : H4, FVG, cassure nette ; SP500 : H4 + Daily, Judas après 9:50 NY). Détails : [regles.md](regles.md), [backtests.md](backtests.md).
- Desk Key : panneau, touche K, AUTO (désactivé par défaut), suivi du 50 %, annulation 11:00, sortie 13:00, historique jusqu'à 250 séances, protection annonces, money management dans le panneau, notifications (téléphone MT5, Telegram, WhatsApp), expiration de l'ordre côté FTMO.
- Application : Aujourd'hui, Mon compte, Journal, Suivi du test, Règles, Réglages ; profils lus dans la base (un actif validé apparaît tout seul).

## En cours
- **Backtest US30** avec les règles US100 puis SP500 (stop mis à l'échelle : 6 et 13 pts).
- **Backtest XAUUSD** : séance de Londres (range asiatique, Judas après 2:00 NY, entrée 3:00–5:00 NY, sortie 8:00 NY) contre séance de New York.
- En attente : l'export M1 de US30 et XAUUSD par le Bridge 1.06 (MT5 ouvert environ 1 h).

## À faire par l'utilisateur
- [x] Installer Desk Key 1.07 sur les deux graphiques (vu en ligne le 27/11 à 2:01 Paris).
- [ ] **Remettre DeskUS_Bridge 1.06 sur un graphique à lui** (un seul robot par graphique dans MT5 : Desk Key l'a remplacé). Il n'envoie plus rien depuis le 27/11 à 0:17 Paris, d'où pas d'export US30 / XAUUSD et un compte figé dans l'application.
- [x] Notifications sur le téléphone (application MT5) : fonctionnent.
- [ ] Notifications Telegram : n'arrivent pas encore. Lire le message de l'onglet Experts après TESTER LES NOTIFS.

## Plus tard
- Installer MT5, Desk Key et le Bridge sur le **VPS de l'utilisateur** (MT5 allumé 24 h/24 : sortie de 13:00 NY assurée même PC éteint).
- Plusieurs comptes FTMO : voir [backlog.md](backlog.md).
- Supabase Pro (sauvegardes automatiques) quand le compte est financé ; en attendant, export CSV du Journal de temps en temps.
