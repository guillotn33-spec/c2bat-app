"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import ChampVille from "@/app/components/ChampVille";
import { geocodeAdresse } from "@/lib/geocode";

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [form, setForm] = useState({
    nom: "", prenom: "", telephone: "", email: "",
    adresse: "", ville: "", code_postal: "", notes: ""
  });

  useEffect(() => { chargerClients(); }, []);

  async function chargerClients() {
    setLoading(true);
    const { data, error } = await supabase
      .from("clients").select("*").order("created_at", { ascending: false });
    if (!error) setClients(data);
    setLoading(false);
  }

  async function ajouterClient() {
    if (!form.nom) return alert("Le nom est obligatoire");
    setGeocoding(true);
    let geoData = {};
    if (form.adresse && form.ville) {
      const geo = await geocodeAdresse(form.adresse, form.ville, form.code_postal);
      if (geo) geoData = geo;
    }
    const { error } = await supabase.from("clients").insert([{ ...form, ...geoData }]);
    setGeocoding(false);
    if (!error) {
      setForm({ nom:"", prenom:"", telephone:"", email:"", adresse:"", ville:"", code_postal:"", notes:"" });
      setShowForm(false);
      chargerClients();
    }
  }

  async function supprimerClient(id) {
    if (!confirm("Supprimer ce client ?")) return;
    await supabase.from("clients").delete().eq("id", id);
    chargerClients();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-blue-950 text-white px-4 py-4 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-3">
          <a href="/" className="text-sm bg-blue-900/50 px-3 py-2 rounded-lg border border-blue-800 min-h-[44px] flex items-center">
            Retour
          </a>
          <h1 className="font-bold text-lg">Clients</h1>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-yellow-500 text-slate-900 font-bold px-4 py-2 rounded-xl text-sm hover:bg-yellow-400 min-h-[44px]">
          Nouveau client
        </button>
      </header>

      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {showForm && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
            <h2 className="font-bold text-blue-950">Nouveau client</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Nom</label>
                <input value={form.nom} onChange={e => setForm({...form, nom: e.target.value})}
                  placeholder="Dupont"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-h-[44px]"/>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Prenom</label>
                <input value={form.prenom} onChange={e => setForm({...form, prenom: e.target.value})}
                  placeholder="Jean"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-h-[44px]"/>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Telephone</label>
                <input value={form.telephone} onChange={e => setForm({...form, telephone: e.target.value})}
                  placeholder="0692 xx xx xx"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-h-[44px]"/>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Email</label>
                <input value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  placeholder="jean@mail.com"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-h-[44px]"/>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Adresse</label>
              <input value={form.adresse} onChange={e => setForm({...form, adresse: e.target.value})}
                placeholder="12 rue des Flamboyants"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-h-[44px]"/>
            </div>

            <ChampVille
              ville={form.ville}
              codePostal={form.code_postal}
              onChange={({ ville, codePostal }) => setForm({...form, ville, code_postal: codePostal})}
            />

            <div>
              <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
                placeholder="Informations complementaires" rows={2}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none"/>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={ajouterClient} disabled={geocoding}
                className="flex-1 bg-blue-950 text-white font-bold py-3 rounded-xl hover:bg-blue-800 disabled:opacity-50 min-h-[44px]">
                {geocoding ? "Localisation en cours..." : "Enregistrer"}
              </button>
              <button onClick={() => setShowForm(false)}
                className="flex-1 border-2 border-slate-200 text-slate-600 font-bold py-3 rounded-xl min-h-[44px]">
                Annuler
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-10 text-slate-400">Chargement...</div>
        ) : clients.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl border border-slate-200">
            <p className="text-slate-500 font-semibold">Aucun client pour linstant</p>
            <p className="text-slate-400 text-sm mt-1">Cliquez sur Nouveau client pour commencer</p>
          </div>
        ) : (
          clients.map((client) => (
            <div key={client.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h3 className="font-bold text-slate-800 text-base">{client.prenom} {client.nom}</h3>
                  {client.telephone && <p className="text-sm text-blue-600 mt-0.5">{client.telephone}</p>}
                  {client.adresse && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {client.adresse}{client.code_postal ? ", " + client.code_postal : ""} {client.ville}
                    </p>
                  )}
                  {client.latitude && (
                    <a href={client.google_maps_url} target="_blank" rel="noreferrer"
                      className="text-xs text-emerald-600 mt-0.5 inline-block">
                      GPS localise — Voir sur Maps
                    </a>
                  )}
                  {client.notes && <p className="text-xs text-slate-400 mt-1 italic">{client.notes}</p>}
                </div>
                <div className="flex flex-col gap-2">
                  <a href={"/visites/new?client_id=" + client.id}
                    className="bg-green-600 text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-green-500 text-center min-h-[44px] flex items-center">
                    Nouvelle visite
                  </a>
                  <button onClick={() => supprimerClient(client.id)}
                    className="bg-red-50 text-red-500 text-xs font-bold px-3 py-2 rounded-xl border border-red-100 min-h-[44px]">
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}