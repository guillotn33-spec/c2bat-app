"use client";
import { useState } from "react";
import { COMMUNES_REUNION, villeParCP, cpParVille, VILLES_UNIQUES } from "@/lib/communes";

export default function ChampVille({ ville, codePostal, onChange }) {
  const [suggestionsVille, setSuggestionsVille] = useState([]);
  const [suggestionsCp, setSuggestionsCp] = useState([]);

  function handleCp(val) {
    const ville = villeParCP(val);
    onChange({ codePostal: val, ville: ville || "" });
    if (val.length >= 3) {
      setSuggestionsCp(
        COMMUNES_REUNION.filter(c => c.cp.startsWith(val)).slice(0, 5)
      );
    } else {
      setSuggestionsCp([]);
    }
  }

  function handleVille(val) {
    const cp = cpParVille(val);
    onChange({ ville: val, codePostal: cp || codePostal });
    if (val.length >= 2) {
      setSuggestionsVille(
        VILLES_UNIQUES.filter(v =>
          v.toLowerCase().startsWith(val.toLowerCase())
        ).slice(0, 6)
      );
    } else {
      setSuggestionsVille([]);
    }
  }

  function selectionnerCommune(c) {
    onChange({ ville: c.ville, codePostal: c.cp });
    setSuggestionsCp([]);
    setSuggestionsVille([]);
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Code postal */}
      <div className="relative">
        <label className="text-xs font-bold text-slate-400 uppercase block mb-1">
          Code postal
        </label>
        <input
          value={codePostal}
          onChange={e => handleCp(e.target.value)}
          placeholder="97400"
          maxLength={5}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 min-h-[44px]"
        />
        {suggestionsCp.length > 0 && (
          <div className="absolute left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl mt-1 overflow-hidden z-50">
            {suggestionsCp.map((c, i) => (
              <button key={i} onClick={() => selectionnerCommune(c)}
                className="w-full text-left px-3 py-2.5 text-xs hover:bg-blue-50 border-b border-slate-100 last:border-0">
                <span className="font-bold text-blue-900">{c.cp}</span>
                <span className="text-slate-500 ml-2">{c.ville}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Ville */}
      <div className="relative">
        <label className="text-xs font-bold text-slate-400 uppercase block mb-1">
          Ville
        </label>
        <input
          value={ville}
          onChange={e => handleVille(e.target.value)}
          placeholder="Saint-Denis"
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 min-h-[44px]"
        />
        {suggestionsVille.length > 0 && (
          <div className="absolute left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl mt-1 overflow-hidden z-50">
            {suggestionsVille.map((v, i) => {
              const cp = cpParVille(v);
              return (
                <button key={i} onClick={() => selectionnerCommune({ ville:v, cp })}
                  className="w-full text-left px-3 py-2.5 text-xs hover:bg-blue-50 border-b border-slate-100 last:border-0">
                  <span className="font-bold text-slate-800">{v}</span>
                  {cp && <span className="text-slate-400 ml-2">{cp}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}