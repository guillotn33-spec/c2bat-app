"use client";
import { useState, useRef, useCallback } from "react";

const STEPS = [
  "Client & Kap PV",
  "Toiture & Calepinage",
  "Électricité & Raccordement",
  "Annexes",
  "Signature & PDF",
];

function PhotoGrid({ photos, onAdd, onRemove, label, maxPhotos = 20 }) {
  const inputRef = useRef(null);
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-bold text-slate-700">{label}</label>
        <span className="text-xs text-slate-400">{photos.length} photo(s)</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p, i) => (
          <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100">
            <img src={p.base64} alt={p.name} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs leading-none flex items-center justify-center font-bold"
            >
              x
            </button>
          </div>
        ))}
        {photos.length < maxPhotos && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="aspect-square rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:border-emerald-500 hover:text-emerald-500 transition-colors"
          >
            <span className="text-2xl leading-none">+</span>
            <span className="text-xs mt-1">Ajouter</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onAdd(e.target.files)}
      />
    </div>
  );
}

export default function NouvelleVisite() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    client_nom: "",
    client_adresse: "",
    toiture_type: "tole_ondulee",
    structure: "bois",
    pannes_nb: "",
    pannes_entraxe: "",
    fixation: "delta_plus",
    desordres: "",
    pdl: "mono",
    compteur_position: "",
    cable_section: "",
    onduleur_position: "",
    td_conformite: "aux_normes",
    signature_client: "",
    signature_responsable: "",
  });
  const [photos, setPhotos] = useState({ s1: [], s2: [], s3: [], s4: [] });
  const [annule, setAnnule] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const addPhotos = useCallback((stepKey, files) => {
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) =>
        setPhotos((prev) => ({
          ...prev,
          [stepKey]: [...prev[stepKey], { name: file.name, base64: e.target.result }],
        }));
      reader.readAsDataURL(file);
    });
  }, []);

  const removePhoto = useCallback((stepKey, idx) => {
    setPhotos((prev) => ({
      ...prev,
      [stepKey]: prev[stepKey].filter((_, i) => i !== idx),
    }));
  }, []);

  const canProceedStep1 =
    form.client_nom.trim() && form.client_adresse.trim() && photos.s1.length >= 2;

  const handleGeneratePDF = async () => {
    setPdfLoading(true);
    try {
      const data = {
        ref: `VT-${Date.now()}`,
        date: new Date().toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        client_nom: form.client_nom,
        client_adresse: form.client_adresse,
        pdl: form.pdl,
        toiture_type: form.toiture_type,
        structure: form.structure,
        pannes_nb: form.pannes_nb,
        pannes_entraxe: form.pannes_entraxe,
        fixation: form.fixation,
        desordres: form.desordres,
        compteur_position: form.compteur_position,
        cable_section: form.cable_section,
        onduleur_position: form.onduleur_position,
        td_conformite: form.td_conformite,
        signature_client: form.signature_client,
        signature_responsable: form.signature_responsable,
        photos_s1: photos.s1.map((p) => p.base64),
        photos_s2: photos.s2.map((p) => p.base64),
        photos_s3: photos.s3.map((p) => p.base64),
        photos_s4: photos.s4.map((p) => p.base64),
      };
      const res = await fetch("/api/generate-visite-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erreur lors de la génération du PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `VT_${form.client_nom.replace(/\s+/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Erreur : " + e.message);
    } finally {
      setPdfLoading(false);
    }
  };

  if (annule) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl text-red-600 font-black">X</span>
          </div>
          <h2 className="text-xl font-black text-slate-800 mb-2">Visite annulée</h2>
          <p className="text-slate-500 mb-6">
            L&apos;installation a été déclarée impossible sur ce site.
          </p>
          <a
            href="/"
            className="inline-block px-6 py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-500 transition-colors"
          >
            Retour à l&apos;accueil
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Navigation propositions */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-wrap gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wide self-center mr-2">Propositions</span>
          <a
            href="/nouvelle-proposition"
            className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-200 transition-colors"
          >
            Nouvelle proposition (V1)
          </a>
          <a
            href="/nouvelle-proposition-v2"
            className="px-4 py-2 bg-emerald-50 text-emerald-700 text-sm font-semibold rounded-lg hover:bg-emerald-100 transition-colors border border-emerald-200"
          >
            Nouvelle proposition (V2 — bêta)
          </a>
        </div>

        {/* Header */}
        <div className="bg-emerald-600 rounded-2xl p-6 text-white">
          <h1 className="text-2xl font-black">Relevé Technique Terrain</h1>
          <p className="text-emerald-100 text-sm mt-1">
            Étape {step} / 5 — {STEPS[step - 1]}
          </p>
          <div className="mt-3 bg-emerald-800 rounded-full h-1.5">
            <div
              className="bg-white rounded-full h-1.5 transition-all duration-300"
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
          {/* ── ÉTAPE 1 ── */}
          {step === 1 && (
            <>
              <h2 className="text-lg font-black text-slate-800">Client &amp; Kap PV</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    Nom du client <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.client_nom}
                    onChange={(e) => set("client_nom", e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Ex : PAYET Marie"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    Adresse complète <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.client_adresse}
                    onChange={(e) => set("client_adresse", e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Ex : 12 rue des Flamboyants, Saint-Leu"
                  />
                </div>
              </div>

              <PhotoGrid
                photos={photos.s1}
                onAdd={(f) => addPhotos("s1", f)}
                onRemove={(i) => removePhoto("s1", i)}
                label={`Photos obligatoires (${photos.s1.length}/2 minimum) *`}
              />

              {photos.s1.length < 2 && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  Ajoutez au moins 2 photos pour continuer (façade + accès toiture).
                </p>
              )}

              <div className="pt-4 border-t border-slate-100 flex justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setAnnule(true)}
                  className="px-4 py-3 bg-red-50 text-red-600 font-bold rounded-lg hover:bg-red-100 transition-colors text-sm"
                >
                  Annuler le client — installation impossible
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!canProceedStep1}
                  className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Toiture →
                </button>
              </div>
            </>
          )}

          {/* ── ÉTAPE 2 ── */}
          {step === 2 && (
            <>
              <h2 className="text-lg font-black text-slate-800">Toiture &amp; Calepinage</h2>

              <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
                <span className="font-bold">Client :</span> {form.client_nom} —{" "}
                {form.client_adresse}
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Type de couverture
                  </label>
                  <div className="flex flex-col gap-2">
                    {[
                      { v: "tole_ondulee", l: "Tôle ondulée" },
                      { v: "tole_trapezoidal", l: "Tôle trapézoïdale" },
                      { v: "autre", l: "Autre" },
                    ].map(({ v, l }) => (
                      <label key={v} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="toiture_type"
                          value={v}
                          checked={form.toiture_type === v}
                          onChange={() => set("toiture_type", v)}
                          className="w-4 h-4 text-emerald-600"
                        />
                        <span className="text-slate-700">{l}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Structure</label>
                  <div className="flex gap-5">
                    {["Bois", "Béton", "Métal"].map((s) => (
                      <label key={s} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="structure"
                          value={s.toLowerCase()}
                          checked={form.structure === s.toLowerCase()}
                          onChange={() => set("structure", s.toLowerCase())}
                          className="w-4 h-4 text-emerald-600"
                        />
                        <span className="text-slate-700">{s}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                      Nombre de pannes
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={form.pannes_nb}
                      onChange={(e) => set("pannes_nb", e.target.value)}
                      className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="Ex : 4"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                      Entraxe pannes (cm)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={form.pannes_entraxe}
                      onChange={(e) => set("pannes_entraxe", e.target.value)}
                      className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="Ex : 80"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Type de fixation
                  </label>
                  <div className="flex gap-5">
                    {[
                      { v: "delta_plus", l: "Delta Plus" },
                      { v: "autre", l: "Autre" },
                    ].map(({ v, l }) => (
                      <label key={v} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="fixation"
                          value={v}
                          checked={form.fixation === v}
                          onChange={() => set("fixation", v)}
                          className="w-4 h-4 text-emerald-600"
                        />
                        <span className="text-slate-700">{l}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    Désordres constatés
                  </label>
                  <textarea
                    value={form.desordres}
                    onChange={(e) => set("desordres", e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    rows={3}
                    placeholder="Corrosion, déformation, infiltrations… (vide si aucun)"
                  />
                </div>
              </div>

              <PhotoGrid
                photos={photos.s2}
                onAdd={(f) => addPhotos("s2", f)}
                onRemove={(i) => removePhoto("s2", i)}
                label="Photos toiture (pans, vue globale, drone optionnel)"
              />

              <div className="pt-4 border-t border-slate-100 flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors"
                >
                  ← Retour
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-500 transition-colors"
                >
                  Électricité →
                </button>
              </div>
            </>
          )}

          {/* ── ÉTAPE 3 ── */}
          {step === 3 && (
            <>
              <h2 className="text-lg font-black text-slate-800">
                Électricité &amp; Raccordement
              </h2>

              <div className="space-y-5">
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <label className="block text-sm font-bold text-slate-800 mb-3">
                    Raccordement PDL
                  </label>
                  <div className="flex gap-6">
                    {[
                      { v: "mono", l: "Monophasé (230V)" },
                      { v: "tri", l: "Triphasé (400V)" },
                    ].map(({ v, l }) => (
                      <label key={v} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="pdl"
                          value={v}
                          checked={form.pdl === v}
                          onChange={() => set("pdl", v)}
                          className="w-4 h-4 text-emerald-600"
                        />
                        <span className="text-slate-700 font-medium">{l}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    Position compteur / disjoncteur de branchement
                  </label>
                  <input
                    type="text"
                    value={form.compteur_position}
                    onChange={(e) => set("compteur_position", e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Ex : Extérieur façade sud, h = 1,5 m"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    Section câble DJ-tête → TD (mm²)
                  </label>
                  <input
                    type="text"
                    value={form.cable_section}
                    onChange={(e) => set("cable_section", e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Ex : 6 mm²"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    Position onduleur prévue
                  </label>
                  <input
                    type="text"
                    value={form.onduleur_position}
                    onChange={(e) => set("onduleur_position", e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Ex : Garage, mur nord"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Tableau de distribution (TD) — conformité
                  </label>
                  <div className="flex flex-col gap-2">
                    {[
                      { v: "aux_normes", l: "Aux normes", color: "text-emerald-700" },
                      { v: "a_revoir", l: "À revoir", color: "text-amber-700" },
                      { v: "a_remplacer", l: "À remplacer", color: "text-red-600 font-bold" },
                    ].map(({ v, l, color }) => (
                      <label key={v} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="td_conformite"
                          value={v}
                          checked={form.td_conformite === v}
                          onChange={() => set("td_conformite", v)}
                          className="w-4 h-4 text-emerald-600"
                        />
                        <span className={color}>{l}</span>
                      </label>
                    ))}
                  </div>
                  {form.td_conformite !== "aux_normes" && (
                    <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      Le TD devra être mis aux normes avant l&apos;installation. À noter dans le
                      rapport.
                    </p>
                  )}
                </div>
              </div>

              <PhotoGrid
                photos={photos.s3}
                onAdd={(f) => addPhotos("s3", f)}
                onRemove={(i) => removePhoto("s3", i)}
                label="Photos compteur + TD (max 10)"
                maxPhotos={10}
              />

              <div className="pt-4 border-t border-slate-100 flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors"
                >
                  ← Retour
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-500 transition-colors"
                >
                  Annexes →
                </button>
              </div>
            </>
          )}

          {/* ── ÉTAPE 4 ── */}
          {step === 4 && (
            <>
              <h2 className="text-lg font-black text-slate-800">Annexes</h2>
              <p className="text-sm text-slate-500">
                Photos supplémentaires, plans, schémas électriques, photos de détails.
              </p>

              <PhotoGrid
                photos={photos.s4}
                onAdd={(f) => addPhotos("s4", f)}
                onRemove={(i) => removePhoto("s4", i)}
                label="Documents et photos libres"
                maxPhotos={30}
              />

              <div className="pt-4 border-t border-slate-100 flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors"
                >
                  ← Retour
                </button>
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-500 transition-colors"
                >
                  Signature →
                </button>
              </div>
            </>
          )}

          {/* ── ÉTAPE 5 ── */}
          {step === 5 && (
            <>
              <h2 className="text-lg font-black text-slate-800">Signature &amp; Clôture</h2>

              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100 space-y-1">
                <h3 className="text-sm font-black text-emerald-800 mb-2">Récapitulatif</h3>
                <p className="text-sm text-slate-700">
                  <span className="font-bold">Client :</span> {form.client_nom}
                </p>
                <p className="text-sm text-slate-700">
                  <span className="font-bold">Adresse :</span> {form.client_adresse}
                </p>
                <p className="text-sm text-slate-700">
                  <span className="font-bold">Toiture :</span>{" "}
                  {form.toiture_type.replace(/_/g, " ")} — {form.structure}
                </p>
                <p className="text-sm text-slate-700">
                  <span className="font-bold">PDL :</span>{" "}
                  {form.pdl === "mono" ? "Monophasé" : "Triphasé"}
                </p>
                <p className="text-sm text-slate-700">
                  <span className="font-bold">TD :</span>{" "}
                  {form.td_conformite.replace(/_/g, " ")}
                </p>
                <p className="text-sm text-slate-500 pt-1">
                  {photos.s1.length + photos.s2.length + photos.s3.length + photos.s4.length}{" "}
                  photo(s) au total
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    Signature client (nom + date) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.signature_client}
                    onChange={(e) => set("signature_client", e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Ex : Marie PAYET — 17/06/2026"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    Signature responsable technique <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.signature_responsable}
                    onChange={(e) => set("signature_responsable", e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Ex : J. GRONDIN — Technicien C2BAT"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors"
                >
                  ← Retour
                </button>
                <button
                  type="button"
                  onClick={handleGeneratePDF}
                  disabled={
                    pdfLoading ||
                    !form.signature_client.trim() ||
                    !form.signature_responsable.trim()
                  }
                  className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {pdfLoading ? "Génération…" : "Générer le rapport PDF"}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-2 pb-4">
          {STEPS.map((s, i) => (
            <div
              key={i}
              title={s}
              className={`h-2 rounded-full transition-all duration-300 ${
                i + 1 === step
                  ? "w-6 bg-emerald-600"
                  : i + 1 < step
                  ? "w-2 bg-emerald-300"
                  : "w-2 bg-slate-300"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
