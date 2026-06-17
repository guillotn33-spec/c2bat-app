# C2BAT ELEC — Mémoire projet

## Stack
- Next.js (App Router), JavaScript pur — **jamais de TypeScript**, jamais de fichiers `.tsx`.
- Pas de dossier `src/` — les routes sont directement dans `app/`.
- Génération PDF : Python (Playwright) via `Scripts/generate_proposition_html.py`,
  appelé par `app/api/generate-pdf/route.js`. C'est la seule chaîne de génération PDF
  active. N'en crée jamais une seconde (pas de WeasyPrint, pas de jspdf/html2canvas
  côté client) sans confirmation explicite.
- Pas de Supabase. Toute trace de `lib/supabase.js`, `app/clients/` liée à Supabase est
  un résidu d'essai antérieur — à supprimer si tu la croises, pas à réparer.
- Déploiement : GitHub (`guillotn33-spec/c2bat-app`) → Railway (auto-deploy au push).
  URL prod : `c2bat-app-production.up.railway.app`.

## Règles non négociables

1. **Ne jamais déclarer un fix "terminé" sans test réel.** "Le build a réussi" ou
   "le code compile" ne veut pas dire que le résultat est correct. Pour tout calcul
   métier (production solaire, économie annuelle, ROI, prix), génère un PDF de test
   avec au moins deux configurations différentes et montre-moi que les chiffres
   varient de façon cohérente avant d'annoncer que c'est réglé.

2. **Cherche les doublons avant de créer un fichier.** Si tu vas créer ou modifier
   une fonction qui existe déjà sous un autre nom de dossier ou de variante
   (ex: `buildProposalData`, `generate-pdf`), fais une recherche du projet entier
   d'abord et dis-moi ce que tu trouves avant de choisir lequel modifier.

3. **Aucun chiffre métier ne doit être une valeur recopiée sans recalcul.**
   `production_annuelle`, `economie_annuelle`, `roi_ans` doivent toujours être
   dérivés des paramètres réels (puissance, irradiation, prix, kit) — jamais une
   valeur par défaut codée en dur qui passe inaperçue.

4. **Wording légal verrouillé** dans toute proposition commerciale générée :
   - jamais le mot "autonome" seul → toujours "stockage intelligent en
     autoconsommation" ou équivalent.
   - toute aide (KAP PV, S24...) doit être qualifiée "provisionnelle / sous
     réserve de validation", jamais présentée comme acquise.

5. **Affiche les diffs avant d'appliquer** (garde "Ask before edits" actif). Ne
   committe et ne push jamais sur Git sans me montrer le résumé des changements.

6. **Après une correction de code, rappelle-moi explicitement** que rien n'est en
   ligne tant que `git add / commit / push` n'a pas été fait et que le déploiement
   Railway n'est pas confirmé "Success" dans l'onglet Deployments — pas seulement
   "build terminé rapidement" (un build qui échoue silencieusement en moins d'une
   seconde n'est pas un succès, c'est un signe de mauvaise détection de provider).

## Contexte métier
- Tarifs S24 et aides KAP PV : La Réunion uniquement, zone cyclonique (pas de
  tuiles, structures Novotegra, normes anti-cycloniques).
- Catalogue de kits dans `lib/catalogue.js` (`KITS`, `AIDES`).
