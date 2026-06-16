"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function DetailVisite() {
  const { id } = useParams();
  const [visite, setVisite] = useState(null);
  const [clientData, setClientData] = useState(null);
  const [onglet, setOnglet] = useState("infos");
  const [loading, setLoading] = useState(true);

  const [materiel, setMateriel] = useState({
    panneau_marque: "Polycrown",
    panneau_modele: "Polycrown 585 Wc",
    panneau_wc: 585,
    nombre_panneaux: "",
    onduleur_marque: "SOFAR",
    onduleur_modele: "PowerAll",
    onduleur_puissance: "",
    batterie_marque: "",
    batterie_modele: "",
    batterie_kwh: "",
    structure_marque: "Novotegra",
    structure_modele: "",
  });

  const [electrique, setElectrique] = useState({
    abonnement: "",
    mono_tri: "mono",
    calibre_disjoncteur: "",
    section_cable_dc: "",
    section_cable_ac: "",
    distance_dc: "",
    distance_ac: "",
    type_pose: "surimpose",
    protection_dc: "",
    protection_ac: "",
  });

  useEffect(() => { if (id) charger(); }, [id]);

  async function charger() {
    setLoading(true);

    const { data: v } = await supabase
      .from("visites")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (v) {
      setVisite(v);
      const { data: c } = await supabase
        .from("clients")
        .select("*")
        .eq("id", v.client_id)
        .maybeSingle();
      if (c) setClientData(c);

      const { data: m } = await supabase
        .from("materiel")
        .select("*")
        .eq("visite_id", id)
        .maybeSingle();
      if (m) setMateriel(m);

      const { data: e } = await supabase
        .from("electrique")
        .select("*")
        .eq("visite_id", id)
        .maybeSingle();
      if (e) setElectrique(e);
    }

    setLoading(false);
  }

  async function sauvegarderMateriel() {
    const { data: existing } = await supabase
      .from("materiel").select("id").eq("visite_id", id).maybeSingle();
    if (existing) {
      await supabase.from("materiel").update(materiel).eq("visite_id", id);
    } else {
      await supabase.from("materiel").insert([{ ...materiel, visite_id: id }]);
    }
    alert("Materiel enregistre");
  }

  async function sauvegarderElectrique() {
    const { data: existing } = await supabase
      .from("electrique").select("id").eq("visite_id", id).maybeSingle();
    if (existing) {
      await supabase.from("electrique").update(electrique).eq("visite_id", id);
    } else {
      await supabase.from("electrique").insert([{ ...electrique, visite_id: id }]);
    }
    alert("Electrique enregistre");
  }

  async function changerStatut(statut) {
    await supabase.from("visites").update({ statut }).eq("id", id);
    setVisite(v => ({ ...v, statut }));
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-slate-400">Chargement...</p>
    </div>
  );

  const ONGLETS = [
    { id: "infos",      label: "Infos" },
    { id: "materiel",   label: "Materiel" },
    { id: "electrique", label: "Electrique" },
    { id: "pvgis",      label: "PVGIS" },
  ];

  const STATUTS = {
    brouillon: { label: "Brouillon", color: "#94a3b8" },
    en_cours:  { label: "En cours",  color: "#f59e0b" },
    termine:   { label: "Termine",   color: "#10b981" },
    annule:    { label: "Annule",    color: "#ef4444" },
  };

  const statut = STATUTS[visite?.statut] || STATUTS.brouillon;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-blue-950 text-white px-4 py-4 sticky top-0 z-50 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <a href="/clients"
              className="text-sm bg-blue-900/50 px-3 py-2 rounded-lg border border-blue-800 min-h-[44px] flex items-center">
              Retour
            </a>
            <div>
              <h1 className="font-bold text-base">
                {clientData ? clientData.prenom + " " + clientData.nom : "Visite"}
              </h1>
              <p className="text-blue-300 text-xs">{visite?.adresse_chantier}</p>
            </div>
          </div>
          <span className="text-xs font-bold px-3 py-1.5 rounded-full"
            style={{ background: statut.color + "30", color: statut.color }}>
            {statut.label}
          </span>
        </div>

        <div className="flex gap-1 overflow-x-auto">
          {ONGLETS.map(o => (
            <button key={o.id} onClick={() => setOnglet(o.id)}
              className="px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap min-h-[44px] transition-all"
              style={onglet === o.id
                ? { background: "#fff", color: "#1e3a8a" }
                : { background: "rgba(255,255,255,0.1)", color: "#93c5fd" }}>
              {o.label}
            </button>
          ))}
        </div>
      </header>

      <div className="p-4 max-w-2xl mx-auto space-y-4">

        {onglet === "infos" && (
          <div className="space-y-4">
            {clientData && (
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-bold text-slate-400 uppercase mb-2">Client</p>
                <p className="font-bold text-slate-800">{clientData.prenom} {clientData.nom}</p>
                {clientData.telephone && <p className="text-blue-600 text-sm mt-1">{clientData.telephone}</p>}
                {clientData.email && <p className="text-slate-400 text-xs">{clientData.email}</p>}
                {clientData.adresse && <p className="text-slate-400 text-xs">{clientData.adresse}, {clientData.ville}</p>}
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase">Details visite</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Date</p>
                  <p className="font-semibold">{visite?.date_visite}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Technicien</p>
                  <p className="font-semibold">{visite?.technicien}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Type toiture</p>
                  <p className="font-semibold">{visite?.type_toiture}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Statut</p>
                  <p className="font-semibold" style={{ color: statut.color }}>{statut.label}</p>
                </div>
              </div>
              {visite?.notes && (
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-400 mb-1">Notes</p>
                  <p className="text-sm text-slate-600">{visite.notes}</p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-bold text-slate-400 uppercase mb-3">Changer le statut</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(STATUTS).map(([key, val]) => (
                  <button key={key} onClick={() => changerStatut(key)}
                    className="min-h-[44px] rounded-xl text-xs font-bold border transition-all"
                    style={visite?.statut === key
                      ? { background: val.color, color: "#fff", borderColor: val.color }
                      : { background: "#f8fafc", color: "#64748b", borderColor: "#e2e8f0" }}>
                    {val.label}
                  </button>
                ))}
              </div>
            </div>

            <a href="/carte"
              className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-500 min-h-[44px] flex items-center justify-center">
              Ouvrir la carte et azimuts
            </a>
          </div>
        )}

        {onglet === "materiel" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <h2 className="font-bold text-blue-950">Materiel</h2>

            <p className="text-xs font-bold text-slate-400 uppercase">Panneaux</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Marque</label>
                <input value={materiel.panneau_marque}
                  onChange={e => setMateriel({...materiel, panneau_marque: e.target.value})}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-h-[44px]"/>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Modele</label>
                <input value={materiel.panneau_modele}
                  onChange={e => setMateriel({...materiel, panneau_modele: e.target.value})}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-h-[44px]"/>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Puissance (Wc)</label>
                <input type="number" value={materiel.panneau_wc}
                  onChange={e => setMateriel({...materiel, panneau_wc: parseInt(e.target.value)})}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-h-[44px]"/>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Nombre</label>
                <input type="number" value={materiel.nombre_panneaux}
                  onChange={e => setMateriel({...materiel, nombre_panneaux: parseInt(e.target.value)})}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-h-[44px]"/>
              </div>
            </div>

            {materiel.nombre_panneaux > 0 && (
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                <p className="text-xs text-blue-600">
                  Puissance totale : <strong>{((materiel.nombre_panneaux * materiel.panneau_wc) / 1000).toFixed(2)} kWc</strong>
                </p>
              </div>
            )}

            <hr className="border-slate-100"/>
            <p className="text-xs font-bold text-slate-400 uppercase">Onduleur</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Marque</label>
                <input value={materiel.onduleur_marque}
                  onChange={e => setMateriel({...materiel, onduleur_marque: e.target.value})}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-h-[44px]"/>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Modele</label>
                <input value={materiel.onduleur_modele}
                  onChange={e => setMateriel({...materiel, onduleur_modele: e.target.value})}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-h-[44px]"/>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Puissance onduleur (kW)</label>
              <input type="number" value={materiel.onduleur_puissance}
                onChange={e => setMateriel({...materiel, onduleur_puissance: parseFloat(e.target.value)})}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-h-[44px]"/>
            </div>

            <hr className="border-slate-100"/>
            <p className="text-xs font-bold text-slate-400 uppercase">Structure</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Marque</label>
                <input value={materiel.structure_marque}
                  onChange={e => setMateriel({...materiel, structure_marque: e.target.value})}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-h-[44px]"/>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Modele</label>
                <input value={materiel.structure_modele}
                  onChange={e => setMateriel({...materiel, structure_modele: e.target.value})}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-h-[44px]"/>
              </div>
            </div>

            <hr className="border-slate-100"/>
            <p className="text-xs font-bold text-slate-400 uppercase">Batterie (optionnel)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Marque</label>
                <input value={materiel.batterie_marque || ""}
                  onChange={e => setMateriel({...materiel, batterie_marque: e.target.value})}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-h-[44px]"/>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Capacite (kWh)</label>
                <input type="number" value={materiel.batterie_kwh || ""}
                  onChange={e => setMateriel({...materiel, batterie_kwh: parseFloat(e.target.value)})}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-h-[44px]"/>
              </div>
            </div>

            <button onClick={sauvegarderMateriel}
              className="w-full bg-blue-950 text-white font-bold py-3 rounded-xl hover:bg-blue-800 min-h-[44px]">
              Enregistrer le materiel
            </button>
          </div>
        )}

        {onglet === "electrique" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <h2 className="font-bold text-blue-950">Installation electrique</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Abonnement EDF</label>
                <input value={electrique.abonnement}
                  onChange={e => setElectrique({...electrique, abonnement: e.target.value})}
                  placeholder="Ex: 6 kVA"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-h-[44px]"/>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Mono / Tri</label>
                <select value={electrique.mono_tri}
                  onChange={e => setElectrique({...electrique, mono_tri: e.target.value})}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-h-[44px]">
                  <option value="mono">Monophase</option>
                  <option value="tri">Triphase</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Calibre disjoncteur (A)</label>
              <input type="number" value={electrique.calibre_disjoncteur}
                onChange={e => setElectrique({...electrique, calibre_disjoncteur: parseInt(e.target.value)})}
                placeholder="Ex: 30"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-h-[44px]"/>
            </div>

            <hr className="border-slate-100"/>
            <p className="text-xs font-bold text-slate-400 uppercase">Cables DC</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Section DC (mm2)</label>
                <input type="number" value={electrique.section_cable_dc}
                  onChange={e => setElectrique({...electrique, section_cable_dc: parseFloat(e.target.value)})}
                  placeholder="Ex: 4"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-h-[44px]"/>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Distance DC (m)</label>
                <input type="number" value={electrique.distance_dc}
                  onChange={e => setElectrique({...electrique, distance_dc: parseFloat(e.target.value)})}
                  placeholder="Ex: 10"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-h-[44px]"/>
              </div>
            </div>

            <hr className="border-slate-100"/>
            <p className="text-xs font-bold text-slate-400 uppercase">Cables AC</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Section AC (mm2)</label>
                <input type="number" value={electrique.section_cable_ac}
                  onChange={e => setElectrique({...electrique, section_cable_ac: parseFloat(e.target.value)})}
                  placeholder="Ex: 6"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-h-[44px]"/>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Distance AC (m)</label>
                <input type="number" value={electrique.distance_ac}
                  onChange={e => setElectrique({...electrique, distance_ac: parseFloat(e.target.value)})}
                  placeholder="Ex: 15"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-h-[44px]"/>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Type de pose</label>
              <select value={electrique.type_pose}
                onChange={e => setElectrique({...electrique, type_pose: e.target.value})}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-h-[44px]">
                <option value="surimpose">Surimpose / ventile</option>
                <option value="integre">Integre en toiture</option>
              </select>
            </div>

            <button onClick={sauvegarderElectrique}
              className="w-full bg-blue-950 text-white font-bold py-3 rounded-xl hover:bg-blue-800 min-h-[44px]">
              Enregistrer electrique
            </button>
          </div>
        )}

        {onglet === "pvgis" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <h2 className="font-bold text-blue-950">Simulation PVGIS</h2>
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <p className="text-slate-400 text-sm mb-3">
                Lancez la carte pour definir la position et les azimuts
              </p>
              <a href="/carte"
                className="inline-block bg-emerald-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-emerald-500 min-h-[44px]">
                Ouvrir la carte
              </a>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
