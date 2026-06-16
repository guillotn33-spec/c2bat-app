"use client";
import { useState } from "react";
import { KITS, GAMMES, calculerPrimeS24 } from "@/lib/kits";

export default function ChoixKit() {
  const [gamme, setGamme] = useState("SOFAR PowerAll");
  const [kitSelectionne, setKitSelectionne] = useState(null);

  const kitsAffiches = KITS.filter(k => k.gamme === gamme);

  const COULEURS_GAMME = {
    "SOFAR PowerAll": "#3b82f6",
    "Alpha ESS SMILE": "#10b981",
    "Micro-onduleurs Hoymiles": "#f59e0b",
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-blue-950 text-white px-4 py-4 sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-3">
          <a href="/" className="text-sm bg-blue-900/50 px-3 py-2 rounded-lg border border-blue-800 min-h-[44px] flex items-center">
            Retour
          </a>
          <h1 className="font-bold text-lg">Choix du kit</h1>
        </div>
      </header>

      <div className="p-4 max-w-2xl mx-auto space-y-5">

        {/* Sélection gamme */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs font-bold text-slate-400 uppercase mb-3">Gamme</p>
          <div className="space-y-2">
            {GAMMES.map(g => (
              <button key={g} onClick={() => { setGamme(g); setKitSelectionne(null); }}
                className="w-full text-left px-4 py-3 rounded-xl border-2 font-semibold text-sm transition-all min-h-[44px]"
                style={gamme === g
                  ? { borderColor: COULEURS_GAMME[g], background: COULEURS_GAMME[g] + "15", color: COULEURS_GAMME[g] }
                  : { borderColor: "#e2e8f0", color: "#64748b" }}>
                {g === "SOFAR PowerAll" && "SOFAR PowerAll — Onduleur hybride tout-en-un"}
                {g === "Alpha ESS SMILE" && "Alpha ESS SMILE — Solution economique extensible"}
                {g === "Micro-onduleurs Hoymiles" && "Micro-onduleurs Hoymiles — Optimisation par module"}
              </button>
            ))}
          </div>
        </div>

        {/* Kits de la gamme */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-slate-400 uppercase px-1">Puissance</p>
          {kitsAffiches.map(kit => {
            const prime = calculerPrimeS24(kit);
            const selected = kitSelectionne?.id === kit.id;
            return (
              <div key={kit.id}
                onClick={() => setKitSelectionne(selected ? null : kit)}
                className="bg-white rounded-2xl border-2 p-4 cursor-pointer transition-all"
                style={{ borderColor: selected ? kit.color : "#e2e8f0" }}>

                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-bold text-slate-800">{kit.nom}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{kit.description}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-black" style={{ color: kit.color }}>
                      {kit.total_ttc.toLocaleString("fr-FR")} €
                    </p>
                    <p className="text-xs text-slate-400">TTC (TVA 8,5%)</p>
                  </div>
                </div>

                {/* Specs */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-slate-50 rounded-xl p-2 text-center">
                    <p className="text-xs text-slate-400">Puissance</p>
                    <p className="font-bold text-slate-800 text-sm">{kit.puissance_kwc} kWc</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2 text-center">
                    <p className="text-xs text-slate-400">Modules</p>
                    <p className="font-bold text-slate-800 text-sm">{kit.nb_modules} pan.</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2 text-center">
                    <p className="text-xs text-slate-400">Stockage</p>
                    <p className="font-bold text-slate-800 text-sm">{kit.batterie_kwh} kWh</p>
                  </div>
                </div>

                {/* Prime S24 */}
                <div className="bg-green-50 rounded-xl p-3 border border-green-100 mb-3">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-bold text-green-700">Prime S24 autoconsommation</p>
                    <p className="text-base font-black text-green-700">
                      {prime.toLocaleString("fr-FR")} €
                    </p>
                  </div>
                  <p className="text-xs text-green-600 mt-0.5">
                    {kit.prime_s24_eur_wc} €/Wc · tranche {kit.tranche_s24}
                  </p>
                </div>

                {/* Avantages (si sélectionné) */}
                {selected && (
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <div className="space-y-1.5">
                      {kit.avantages.map((a, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                          <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs"
                            style={{ background: kit.color }}>✓</span>
                          {a}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50 rounded-xl p-2">
                        <p className="text-slate-400">Onduleur</p>
                        <p className="font-semibold text-slate-700">{kit.onduleur_modele}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-2">
                        <p className="text-slate-400">Batterie</p>
                        <p className="font-semibold text-slate-700">{kit.batterie_modele}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-2">
                        <p className="text-slate-400">Structure</p>
                        <p className="font-semibold text-slate-700">{kit.structure_marque}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-2">
                        <p className="text-slate-400">Strings</p>
                        <p className="font-semibold text-slate-700">{kit.strings}</p>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">Total HT</span>
                        <span className="font-semibold">{kit.total_ht.toLocaleString("fr-FR")} €</span>
                      </div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">TVA 8,5%</span>
                        <span className="font-semibold">{(kit.total_ttc - kit.total_ht).toFixed(2)} €</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-1 mt-1">
                        <span>Total TTC</span>
                        <span style={{ color: kit.color }}>{kit.total_ttc.toLocaleString("fr-FR")} €</span>
                      </div>
                      <div className="flex justify-between text-xs text-green-600 mt-1">
                        <span>Apres prime S24</span>
                        <span className="font-bold">{(kit.total_ttc - prime).toLocaleString("fr-FR")} €</span>
                      </div>
                    </div>

                    <a href={`/kits/${kit.id}`}
                      className="w-full font-bold py-3 rounded-xl min-h-[44px] flex items-center justify-center text-white transition-all"
                      style={{ background: kit.color }}>
                      Selectionner ce kit
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}