/**
 * Tarifs officiels S24 CRE – La Réunion
 * Source : Arrêté tarifaire S24 (Commission de Régulation de l'Énergie)
 * Mise à jour : 2024
 *
 * Deux filières :
 *  - AUTOCONSOMMATION avec vente du surplus (prime à l'investissement en €/Wc)
 *  - VENTE TOTALE (tarif d'achat en c€/kWh)
 */

// ---------------------------------------------------------------------------
// Tranches de puissance (Wc)
// ---------------------------------------------------------------------------
export const TRANCHES = [
  { label: "≤ 3 kWc",      min: 0,      max: 3000  },
  { label: "3 – 9 kWc",    min: 3000,   max: 9000  },
  { label: "9 – 36 kWc",   min: 9000,   max: 36000 },
  { label: "36 – 100 kWc", min: 36000,  max: 100000 },
];

// ---------------------------------------------------------------------------
// Filière 1 : Autoconsommation avec vente du surplus
// Prime à l'investissement en €/Wc (hors taxes)
// ---------------------------------------------------------------------------
export const TARIFS_AUTOCONSO = [
  { label: "≤ 3 kWc",      min: 0,      max: 3000,   prime_eur_wc: 1.52 },
  { label: "3 – 9 kWc",    min: 3000,   max: 9000,   prime_eur_wc: 1.05 },
  { label: "9 – 36 kWc",   min: 9000,   max: 36000,  prime_eur_wc: 0.80 },
  { label: "36 – 100 kWc", min: 36000,  max: 100000, prime_eur_wc: 0.55 },
];

// ---------------------------------------------------------------------------
// Filière 2 : Vente totale
// Tarif d'achat en c€/kWh (centimes d'euro par kWh)
// ---------------------------------------------------------------------------
export const TARIFS_VENTE_TOTALE = [
  { label: "≤ 3 kWc",      min: 0,      max: 3000,   tarif_cent_kwh: 26.79 },
  { label: "3 – 9 kWc",    min: 3000,   max: 9000,   tarif_cent_kwh: 22.82 },
  { label: "9 – 36 kWc",   min: 9000,   max: 36000,  tarif_cent_kwh: 16.32 },
  { label: "36 – 100 kWc", min: 36000,  max: 100000, tarif_cent_kwh: 14.19 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Retourne la tranche tarifaire pour une puissance donnée (en Wc).
 * @param {number} puissance_wc  – puissance crête en Wc
 * @param {"autoconso"|"vente_totale"} filiere
 * @returns {object|null}
 */
export function getTranche(puissance_wc, filiere = "autoconso") {
  const table =
    filiere === "vente_totale" ? TARIFS_VENTE_TOTALE : TARIFS_AUTOCONSO;

  return (
    table.find(
      (t) => puissance_wc > t.min && puissance_wc <= t.max
    ) ?? null
  );
}

/**
 * Calcule la prime S24 autoconsommation (€).
 * @param {number} puissance_wc  – puissance crête installée en Wc
 * @returns {{ tranche: object, prime_totale_eur: number }|null}
 */
export function calculerPrimeAutoconso(puissance_wc) {
  const tranche = getTranche(puissance_wc, "autoconso");
  if (!tranche) return null;

  return {
    tranche,
    prime_totale_eur: +(puissance_wc * tranche.prime_eur_wc).toFixed(2),
  };
}

/**
 * Calcule le revenu annuel estimé en vente totale (€/an).
 * @param {number} puissance_wc        – puissance crête en Wc
 * @param {number} production_kwh_an   – production annuelle estimée en kWh
 * @returns {{ tranche: object, revenu_annuel_eur: number }|null}
 */
export function calculerRevenuVenteTotale(puissance_wc, production_kwh_an) {
  const tranche = getTranche(puissance_wc, "vente_totale");
  if (!tranche) return null;

  // tarif en c€/kWh → conversion en €/kWh
  const tarif_eur_kwh = tranche.tarif_cent_kwh / 100;

  return {
    tranche,
    revenu_annuel_eur: +(production_kwh_an * tarif_eur_kwh).toFixed(2),
  };
}

/**
 * Retourne un résumé complet des deux filières pour une installation donnée.
 * @param {number} puissance_wc
 * @param {number} production_kwh_an
 * @returns {object}
 */
export function resumeTarifaire(puissance_wc, production_kwh_an) {
  return {
    puissance_kWc: +(puissance_wc / 1000).toFixed(3),
    autoconso: calculerPrimeAutoconso(puissance_wc),
    vente_totale: calculerRevenuVenteTotale(puissance_wc, production_kwh_an),
  };
}
