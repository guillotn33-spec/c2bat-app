"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ChampVille from "@/app/components/ChampVille";

export default function NouvelleVisite() {
  const searchParams = useSearchParams();
  const client_id = searchParams.get("client_id");

  const [clientData, setClientData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    adresse_chantier: "",
    code_postal: "",
    ville: "",
    date_visite: new Date().toISOString().split("T")[0],
    technicien: "C2BAT ELEC",
    type_toiture: "2 pans",
    statut: "brouillon",
    notes: "",
  });

  useEffect(() => {
    if (client_id) chargerClient();
  }, [client_id]);

  async function chargerClient() {
    const { data } = await supabase
      .from("clients").select("*").eq("id", client_id).maybeSingle();
    if (data) {
      setClientData(data);
      setForm(f => ({
        ...f,
        adresse_chantier: data.adresse || "",
        ville: data.ville || "",
        code_postal: data.code_postal || "",
      }));
    }
  }

  async function enregistrer() {
    setLoading(true);
    const { data, error } = await supabase
      .from("visites")
      .insert([{ ...form, client_id }])
      .select()
      .maybeSingle();
    if (!error && data) {
      window.location.href = "/visites/" + data.id;
    } else {
      console.error(error);
      alert("Erreur lors de la creation de la visite");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-blue-950 text-white px-4 py-4 flex items-center gap-3 sticky top-0 z-50 shadow-md">
        <a href="/clients"
          className="text-sm bg-blue-900/50 px-3 py-2 rounded-lg border border-blue-800 min-h-[44px] flex items-center">
          Retour
        </a>
        <h1 className="font-bold text-lg">Nouvelle visite</h1>
      </header>

      <div className="p-4 max-w-2xl mx-auto space-y-4">

        {clientData && (
          <div className="bg-blue-950 text-white rounded-2xl p-4">
            <p className="text-xs text-blue-300 uppercase font-bold mb-1">Client</p>
            <p className="font-bold text-lg">{clientData.prenom} {clientData.nom}</p>
            {clientData.telephone && <p className="text-blue-200 text-sm">{clientData.telephone}</p>}
            {clientData.adresse && (
              <p className="text-blue-300 text-xs mt-0.5">
                {clientData.adresse} {clientData.code_postal} {clientData.ville}
              </p>
            )}
            {clientData.latitude && (
              <a href={clientData.google_maps_url} target="_blank" rel="noreferrer"
                className="text-xs text-yellow-400 mt-1 inline-block">
                GPS disponible — Voir sur Maps
              </a>
            )}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
          <h2 className="font-bold text-blue-950">Informations de la visite</h2>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Date de visite</label>
            <input type="date" value={form.date_visite}
              onChange={e => setForm({...form, date_visite: e.target.value})}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-h-[44px]"/>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Adresse du chantier</label>
            <input value={form.adresse_chantier}
              onChange={e => setForm({...form, adresse_chantier: e.target.value})}
              placeholder="Adresse du chantier"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-h-[44px]"/>
          </div>

          <ChampVille
            ville={form.ville}
            codePostal={form.code_postal}
            onChange={({ ville, codePostal }) => setForm({...form, ville, code_postal: codePostal})}
          />

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Technicien</label>
            <input value={form.technicien}
              onChange={e => setForm({...form, technicien: e.target.value})}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-h-[44px]"/>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Type de toiture</label>
            <select value={form.type_toiture}
              onChange={e => setForm({...form, type_toiture: e.target.value})}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-h-[44px]">
              <option value="1 pan">1 pan</option>
              <option value="2 pans">2 pans</option>
              <option value="4 pans">4 pans</option>
              <option value="Sur-mesure">Sur-mesure</option>
              <option value="Terrasse">Terrasse</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Statut</label>
            <select value={form.statut}
              onChange={e => setForm({...form, statut: e.target.value})}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-h-[44px]">
              <option value="brouillon">Brouillon</option>
              <option value="en_cours">En cours</option>
              <option value="termine">Termine</option>
              <option value="annule">Annule</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Notes</label>
            <textarea value={form.notes}
              onChange={e => setForm({...form, notes: e.target.value})}
              placeholder="Observations, remarques..." rows={3}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none"/>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {clientData?.latitude && (
            <a href={"/carte?lat=" + clientData.latitude + "&lng=" + clientData.longitude}
              className="bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-500 min-h-[44px] flex items-center justify-center text-sm">
              Voir sur la carte
            </a>
          )}
          {!clientData?.latitude && (
            <a href="/carte"
              className="bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-500 min-h-[44px] flex items-center justify-center text-sm">
              Ouvrir la carte
            </a>
          )}
          <button onClick={enregistrer} disabled={loading}
            className="bg-blue-950 text-white font-bold py-3 rounded-xl hover:bg-blue-800 min-h-[44px] disabled:opacity-50">
            {loading ? "Enregistrement..." : "Enregistrer la visite"}
          </button>
        </div>

      </div>
    </div>
  );
}