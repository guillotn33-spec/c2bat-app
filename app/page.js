"use client";
import { useState } from "react";

export default function NouvelleVisite() {
  const [step, setStep] = useState(1);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-emerald-600 p-6 text-white">
          <h1 className="text-2xl font-black">Relevé Technique Terrain</h1>
          <p className="text-emerald-100 text-sm mt-1">Étape {step} / 3 : Informations Générales & Électriques</p>
        </div>
        
        <form className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Nom du client</label>
              <input type="text" className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Ex: Dupont" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Commune</label>
              <select className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-700">
                <option value="saint-leu">Saint-Leu</option>
                <option value="saint-paul">Saint-Paul</option>
                <option value="saint-pierre">Saint-Pierre</option>
                <option value="autre">Autre...</option>
              </select>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
            <label className="block text-sm font-bold text-slate-800 mb-3">Raccordement (PDL)</label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="raccordement" value="mono" className="w-4 h-4 text-emerald-600" defaultChecked />
                <span className="text-slate-700 font-medium">Monophasé (230V)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="raccordement" value="tri" className="w-4 h-4 text-emerald-600" />
                <span className="text-slate-700 font-medium">Triphasé (400V)</span>
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-between">
            <a href="/" className="px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors">← Retour</a>
            <button type="button" onClick={() => setStep(2)} className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-500 transition-colors">Toiture & Azimut →</button>
          </div>
        </form>
      </div>
    </div>
  );
}