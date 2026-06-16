// Catalogue centralisé des kits photovoltaïques et des aides disponibles.
// Source unique de vérité utilisée par le formulaire commercial.

export const KITS = [
  {
    id: 'kit-3kwc',
    label: 'Kit 3 kWc — SOFAR PowerAll',
    puissance_kwc: 2.93,
    modules: 5,
    module_wc: 585,
    batterie_kwh: 9.98,
    onduleur: 'ESI 3K-S1',
    prix_ttc: 12496.70,
  },
  {
    id: 'kit-6kwc',
    label: 'Kit 6 kWc — SOFAR PowerAll',
    puissance_kwc: 5.85,
    modules: 10,
    module_wc: 585,
    batterie_kwh: 9.98,
    onduleur: 'ESI 6K-S1',
    prix_ttc: 18900.00,
  },
  {
    id: 'kit-9kwc',
    label: 'Kit 9 kWc — SOFAR PowerAll',
    puissance_kwc: 8.78,
    modules: 15,
    module_wc: 585,
    batterie_kwh: 19.96,
    onduleur: 'ESI 9K-S1',
    prix_ttc: 26800.00,
  },
  {
    id: 'kit-12kwc',
    label: 'Kit 12 kWc — SOFAR PowerAll',
    puissance_kwc: 11.70,
    modules: 20,
    module_wc: 585,
    batterie_kwh: 19.96,
    onduleur: 'ESI 12K-S1',
    prix_ttc: 34500.00,
  },
  {
    id: 'custom',
    label: 'Configuration personnalisée…',
    puissance_kwc: null,
    modules: null,
    module_wc: 585,
    batterie_kwh: null,
    onduleur: 'ESI 3K-S1',
    prix_ttc: null,
  },
]

export function getKitById(id) {
  return KITS.find((k) => k.id === id) || null
}

// ── Aides financières disponibles ──
// Une seule aide retenue à la fois (non cumulables entre elles, comme indiqué
// dans la proposition). "montant" peut être fixe ou calculé (€/Wc).
export const AIDES = [
  {
    id: 'kap-pv',
    label: 'Kap PV — Région Réunion + FEDER Europe',
    description: "Subvention FEDER cofinancée par l'Europe · Dossier pris en charge à 100% par C2BAT",
    type: 'fixe',
    montant: 6000,
  },
  {
    id: 'prime-s24',
    label: 'Prime S24 — Autoconsommation',
    description: 'Arrêté tarifaire S24 · 1.52 €/Wc · Non cumulable avec Kap PV',
    type: 'par_wc',
    montant_par_wc: 1.52,
  },
  {
    id: 'aucune',
    label: 'Aucune aide',
    description: 'Prix plein, sans subvention déduite',
    type: 'fixe',
    montant: 0,
  },
]

export function getAideById(id) {
  return AIDES.find((a) => a.id === id) || null
}

export function computeAideMontant(aide, puissanceKwc) {
  if (!aide) return 0
  if (aide.type === 'fixe') return aide.montant
  if (aide.type === 'par_wc') return Math.round(aide.montant_par_wc * puissanceKwc * 1000)
  return 0
}
