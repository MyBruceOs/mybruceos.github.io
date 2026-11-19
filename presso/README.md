# Presso Center : réservations et gestion

Application web de Presso Center, l'activité de récupération sportive mobile (pressothérapie) à Tours. Elle reprend les chiffres du business plan Adie de novembre 2026.

- **`/presso/`** : page publique où les clients réservent. Formules et tarifs, créneaux libres selon les bottes disponibles, questionnaire de santé, autorisation parentale, ajout à l'agenda, message WhatsApp à Presso Center. Les clubs y demandent aussi un test pilote.
- **`/presso/gestion.html`** : espace de gestion, réservé au gérant.
  - **Accueil** : chiffre d'affaires comparé au prévisionnel, heures de la semaine sur le plafond de 16 h, liste « À faire » (demandes, séances à clôturer, paiements, stock, contrôle du matériel, mensualité Adie, seuil de TVA).
  - **Agenda** : semaine sur ordinateur, jour par jour sur téléphone ; séances, domicile, créneaux clubs, événements, indisponibilités ; confirmation et rappel par WhatsApp ; clôture d'une séance (passages, paiement, carte 10 séances).
  - **Clients** : fiches des sportifs (crédits, historique, santé) et suivi des clubs et partenaires, de la demande au contrat. Facturation du forfait mensuel et bilan de fréquentation imprimable pour le renouvellement.
  - **Finances** : recettes et dépenses, « il me reste » (cotisations 16 %, charges, prêt), trésorerie et provision URSSAF, graphique comparé au prévisionnel, prêt Adie, seuil de franchise de TVA, export du livre des recettes (CSV).
  - **Matériel** : état des 5 bottes, contrôle hebdomadaire, consommables décomptés à chaque séance, rappel de la 6e botte.
  - **Réglages** : coordonnées, plages ouvertes à la réservation, tarifs, paramètres financiers, QR code pour les flyers, sauvegarde.

Le site est statique (HTML, CSS, JavaScript), sans étape de compilation. GitHub Pages le sert tel quel.

## Deux modes

| Mode | Quand | Données |
|---|---|---|
| Démo | `assets/config.js` vide | Fictives, enregistrées dans le navigateur. Rien n'est partagé. |
| Supabase | `assets/config.js` rempli | Base partagée : les clients réservent, le gérant gère depuis son téléphone. |

## Brancher la base Supabase

1. Créer un projet Supabase (région Paris).
2. Dans l'éditeur SQL, exécuter `supabase/schema.sql` puis `supabase/seed.sql`.
3. Créer un code d'activation (il ne sert qu'une fois, ne pas le versionner) :
   ```sql
   insert into public.admin_codes (code)
   values (upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)))
   returning code;
   ```
4. Dans **Authentication → URL Configuration**, mettre l'adresse de `gestion.html` en Site URL et dans les Redirect URLs, par exemple `https://mybruceos.github.io/presso/gestion.html`. Les liens de confirmation et de mot de passe oublié y renverront.
5. Copier l'URL du projet et la clé *publishable* dans `assets/config.js`. Cette clé est publique par conception : la sécurité repose sur les règles RLS.
6. Le gérant ouvre `gestion.html`, crée son compte, confirme son e-mail, se connecte et saisit le code d'activation.

## Sécurité

- Toutes les tables sont protégées par RLS. Seul un compte inscrit dans `admins` lit et écrit.
- Un visiteur n'accède qu'à quatre fonctions : `public_info`, `public_busy`, `book` et `club_request`. Les créneaux occupés sont renvoyés sans nom ni téléphone.
- `book` revérifie tout côté serveur : formule, horaires (heure de Paris), délai minimum, bottes disponibles, chevauchements, questionnaire de santé, autorisation parentale, longueur des champs et limite de demandes en attente par numéro. Elle calcule aussi le prix.

## Fichiers

```
presso/
  index.html          page de réservation
  gestion.html        espace de gestion
  assets/
    config.js         connexion Supabase (vide = démo)
    core.js           catalogue, règles de créneaux, stockage local ou Supabase
    book.js           page de réservation
    admin.js          espace de gestion
    styles.css        styles (clair et sombre)
    vendor/           supabase-js 2.45.4 et qrcode-generator 1.4.4 (licence MIT)
  supabase/
    schema.sql        tables, RLS, fonctions
    seed.sql          réglages et tarifs du plan, bottes, consommables, partenaires
```

Les tarifs, horaires et paramètres financiers par défaut sont dans `PC.DEFAULT_SETTINGS` (`assets/core.js`). `seed.sql` en est généré. Une fois en ligne, tout se modifie depuis l'écran Réglages.
