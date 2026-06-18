# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commandes de développement

```bash
npm run dev          # Dev server → http://localhost:3000
npm run build        # Build de production (vérifie les erreurs Next.js)
npm run lint         # ESLint
```

Tester le script Python V2 directement (Windows dev) :
```bash
.venv/Scripts/python.exe Scripts/generate_proposition_v2.py Scripts/test_data.json output.pdf
.venv/Scripts/python.exe Scripts/verify_v2_html.py   # vérifie les 2 configs de test + règle 4 CLAUDE.md
```

Sur Linux/Mac :
```bash
.venv/bin/python Scripts/generate_proposition_v2.py Scripts/test_data.json output.pdf
```

## Stack
- Next.js (App Router), JavaScript pur — **jamais de TypeScript**, jamais de fichiers `.tsx`.
- Pas de dossier `src/` — les routes sont directement dans `app/`.
- Tailwind CSS v4 (PostCSS), Geist font via `next/font/google`.
- Déploiement : GitHub (`guillotn33-spec/c2bat-app`) → Railway (auto-deploy au push).
  URL prod : `c2bat-app-production.up.railway.app`. Python venv prod : `/opt/venv/bin/python` (défini dans `nixpacks.toml`).
- Pas de Supabase. Toute trace de `lib/supabase.js` ou `app/clients/` est un résidu — supprimer si croisé, pas réparer.

## Architecture PDF — Deux chaînes (V1 gelée, V2 active)

### Chemin des données
`buildProposalData()` (form JS) → POST `/api/generate-pdf-v2` → JSON temp file → Python `generate_proposition_v2.py` → Playwright/Chromium → PDF blob renvoyé au navigateur.

### V1 — GELÉE, NE JAMAIS MODIFIER
Ces trois fichiers sont en production et ne seront plus touchés, même pour des bugs connus :
- `app/nouvelle-proposition/page.js`
- `Scripts/generate_proposition_html.py` (thème sombre, 2 pages)
- `app/api/generate-pdf/route.js`

### V2 — Développement actif
- `app/nouvelle-proposition-v2/page.js` — formulaire commercial
- `Scripts/generate_proposition_v2.py` — thème clair 4 pages (ou sombre selon `data["theme"]`)
- `app/api/generate-pdf-v2/route.js` — route API (identique à V1 structurellement)

### Python : règles d'implémentation
- `compute_derived()` recalcule **toujours** `production_annuelle = round(puissance_kwc × irradiation × performance / 100)` — ne jamais utiliser `d["production_annuelle"]` reçu.
- `score_solaire()` et `orientation_label()` parsent l'azimut avec `re.search(r'(\d+(?:\.\d+)?)', str(azimut_str))` — jamais `.replace("°", "")` (bug d'encodage connu).
- Toutes les couleurs HTML/CSS passent par le dict `COL` — aucun code hex en dur hors de ce dict.
- `masque_ombrage` est forcé à `False` dans `score_solaire()` tant que visite technique et proposition ne partagent pas de base de données.

### Données de test
- `Scripts/test_data.json` — Kit 2.93 kWc, sans conso EDF (Nicolas GUILLOT)
- `Scripts/test_data_grand_kit.json` — Kit 5.86 kWc, conso EDF 8200 kWh (Marie PAYET)
- `Scripts/verify_v2_html.py` — vérifie les deux configs : 4 pages présentes, score cohérent, wording légal, et absence du mot "autonome" seul

## Composants clés

### `app/page.js` — Wizard visite technique (5 étapes)
Étapes : Client & Kap PV → Toiture → Électricité → Annexes → Signature & PDF. Chaque étape est un bloc d'état local avec photos (base64). Appelle `/api/generate-visite-pdf` (route non encore créée).

### `app/components/RoofMap.jsx` — Carte toiture interactive
Leaflet + html2canvas chargés **dynamiquement depuis CDN** (`window.L`, `window.html2canvas`). Points importants :
- `maxNativeZoom: 19` / `maxZoom: 21` sur la tile layer pour éviter les tuiles grises au zoom max.
- Shoelace formula pour l'aire du polygone, azimut depuis l'arête la plus longue.
- `onResult()` retourne `{ azimut, inclinaison, surface, roof_map_base64 }`.
- `photo_fond_base64` dans les données = photo de la maison capturée dans le formulaire (fond page 1 du PDF).

### `app/api/analyser-edf/route.js` — Analyse relevé EDF
Utilise `claude-sonnet-4-6` (vision) pour extraire PDL, conso annuelle, montant, tarif depuis une facture EDF en image ou PDF.

### `lib/catalogue.js` — Source unique de vérité
Contient `KITS` (4 kits SOFAR PowerAll + custom) et `AIDES` (Kap PV fixe 6000€, Prime S24 1.52€/Wc, Aucune). Ne jamais dupliquer ces valeurs ailleurs.

## Règles non négociables

1. **Ne jamais déclarer un fix "terminé" sans test réel.** "Le build a réussi" ou "le code compile" ne veut pas dire que le résultat est correct. Pour tout calcul métier (production solaire, économie annuelle, ROI, prix), génère un PDF de test avec au moins deux configurations différentes et montre que les chiffres varient de façon cohérente avant d'annoncer que c'est réglé.

2. **Cherche les doublons avant de créer un fichier.** Si tu vas créer ou modifier une fonction qui existe déjà sous un autre nom de dossier ou de variante (ex: `buildProposalData`, `generate-pdf`), fais une recherche du projet entier d'abord et dis ce que tu trouves avant de choisir lequel modifier.

3. **Aucun chiffre métier ne doit être une valeur recopiée sans recalcul.** `production_annuelle`, `economie_annuelle`, `roi_ans` doivent toujours être dérivés des paramètres réels (puissance, irradiation, prix, kit) — jamais une valeur par défaut codée en dur qui passe inaperçue.

4. **Wording légal verrouillé** dans toute proposition commerciale générée :
   - jamais le mot "autonome" seul → toujours "stockage intelligent en autoconsommation" ou équivalent.
   - toute aide (KAP PV, S24...) doit être qualifiée "provisionnelle / sous réserve de validation", jamais présentée comme acquise.

5. **Affiche les diffs avant d'appliquer.** Ne committe et ne push jamais sur Git sans montrer le résumé des changements.

6. **Après une correction de code, rappelle explicitement** que rien n'est en ligne tant que `git add / commit / push` n'a pas été fait et que le déploiement Railway n'est pas confirmé "Success" dans l'onglet Deployments.

## Contexte métier
- Tarifs S24 et aides KAP PV : La Réunion uniquement, zone cyclonique (pas de tuiles, structures Novotegra, normes anti-cycloniques).
- Les champs d'inspection physique (type de fixation, nombre de pannes, entraxe, conformité TGBT) appartiennent exclusivement au wizard visite technique (`app/page.js`) — jamais dans le formulaire proposition.
