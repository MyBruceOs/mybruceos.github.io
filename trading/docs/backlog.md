# Backlog Desk US

Idées validées mais mises de côté. À reprendre quand le besoin se présente.

## Plusieurs comptes FTMO (mis en attente le 27/11/2026 : un seul compte pour l'instant)

**Mécanique actuelle** : une clé Desk US = un espace dans la base = un compte MT5. Un terminal MT5 n'est connecté qu'à un compte à la fois : plusieurs comptes ouverts en même temps = plusieurs installations de MT5, chacune avec son DeskUS_Bridge et son Desk Key.

**À corriger avant de passer à plusieurs comptes** : le Bridge écrit la clé dans un fichier commun à tous les MT5 du PC (`DeskUS\cle.txt`). Avec deux terminaux, la clé du second écraserait celle du premier. Il faudra un fichier par numéro de compte (`cle_<compte>.txt`). Le réglage de risque de Desk Key est déjà rangé par numéro de compte.

**Plan prévu** :
1. Bridge et Desk Key : fichier de clé par compte, envoi du numéro de compte et du serveur (alerte si une clé sert à deux comptes).
2. Base : une seule lecture pour tous les comptes.
3. Application : liste « Mes comptes » (nom, clé, règles FTMO propres à chaque compte), sélecteur dans l'en-tête et vue « Tous les comptes » ; la clé actuelle devient le premier compte ; setups affichés une seule fois (mêmes prix FTMO) ; code « Copier mes comptes » pour le téléphone.
4. Vue « Tous » : équité et total cumulés, marge avant la perte du jour et la perte max de chaque compte.

**Idées liées** : alarme par compte à 50 % / 70 % de la perte du jour ; AUTO sur chaque terminal avec un risque en % du solde de chaque compte (vérifier le plafond de capital par trader dans les règles FTMO).

## Bridge : historique pour les backtests (mis en attente le 27/11/2026)
L'export actuel ne va que vers le passé et mémorise sa progression dans les variables globales de MT5 (perdues si MT5 se ferme brutalement : réexport complet d'environ 1 h, sans perte de données). Pas utile tant qu'on ne refait pas de backtest. À faire quand on voudra refaire les backtests avec les mois récents ou ajouter un actif :
- mise à jour incrémentale : n'envoyer que les jours manquants depuis le dernier export ;
- reprise depuis le serveur (`desk_hist_status`) au lieu des variables globales, et enregistrement immédiat de la progression (`GlobalVariablesFlush`) ;
- découpage M5 aligné sur des semaines fixes (sinon un réexport crée des doublons M5).

## Autres
- Backtest US30 (Dow Jones) et XAUUSD dès que l'historique M1 est exporté par le Bridge.
