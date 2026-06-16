"use client";
import { useState, useEffect, useRef } from "react";
import { KITS, GAMMES, calculerPrimeS24 } from "@/lib/kits";
import ChampVille from "@/app/components/ChampVille";
import { geocodeAdresse } from "@/lib/geocode";
import DownloadPdfButton from "@/app/components/DownloadPdfButton";

const COULEURS = ["#f59e0b","#3b82f6","#10b981","#ef4444"];
const couleurPan = (i) => COULEURS[i % COULEURS.length];

function directionLabel(az) {
  if (az>=338||az<23) return "Nord";
  if (az<68) return "Nord-Est";
  if (az<113) return "Est";
  if (az<158) return "Sud-Est";
  if (az<203) return "Sud";
  if (az<248) return "Sud-Ouest";
  if (az<293) return "Ouest";
  return "Nord-Ouest";
}

const PLAFONDS_KAP = [
  {kwc:1,prix:6500},{kwc:2,prix:11000},{kwc:3,prix:15690},
  {kwc:4,prix:18960},{kwc:5,prix:22178},{kwc:6,prix:25500},
  {kwc:7,prix:28615},{kwc:8,prix:31833},{kwc:9,prix:35000},
];

function plafondKap(kwc) {
  if (kwc<=0) return 0;
  if (kwc>=9) return 35000;
  const inf = PLAFONDS_KAP.filter(p=>p.kwc<=kwc).pop();
  const sup = PLAFONDS_KAP.find(p=>p.kwc>kwc);
  if (!inf||!sup) return 0;
  return inf.prix+(kwc-inf.kwc)*(sup.prix-inf.prix)/(sup.kwc-inf.kwc);
}

// Répartition mensuelle type Réunion (proportions irradiation PVGIS)
const MONTHLY_WEIGHTS = [271, 287, 314, 337, 356, 363, 370, 363, 347, 320, 290, 264];
const MONTHLY_WEIGHTS_SUM = MONTHLY_WEIGHTS.reduce((a, b) => a + b, 0);
const fmtEur = (n) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n) => Math.round(n).toLocaleString("fr-FR");

function aideKap(kwc, avecStockage) {
  if (kwc<=0) return 0;
  if (kwc<=2) return avecStockage?2000:1500;
  return avecStockage?6000:3000;
}

function BoussoleMin({azimut, couleur, size=60}) {
  const cx=size/2, cy=size/2, r=size/2-3;
  const rad=((azimut-90)*Math.PI)/180;
  const ax=cx+(r*0.65)*Math.cos(rad), ay=cy+(r*0.65)*Math.sin(rad);
  const tr=rad+Math.PI;
  const tx=cx+(r*0.25)*Math.cos(tr), ty=cy+(r*0.25)*Math.sin(tr);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1"/>
      {["N","S"].map((d,i)=>{
        const a=(i*180-90)*Math.PI/180;
        return <text key={d} x={cx+(r-8)*Math.cos(a)} y={cy+(r-8)*Math.sin(a)}
          textAnchor="middle" dominantBaseline="central"
          fontSize={size*0.16} fontWeight="bold"
          fill={d==="N"?"#1e3a8a":"#94a3b8"}>{d}</text>;
      })}
      <line x1={tx} y1={ty} x2={ax} y2={ay} stroke={couleur} strokeWidth={size*0.06} strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r={size*0.07} fill={couleur}/>
    </svg>
  );
}

function Section({num, titre, children, active, done}) {
  return (
    <div className={`bg-white rounded-2xl border-2 overflow-hidden transition-all ${
      active?"border-blue-950 shadow-md":done?"border-emerald-400":"border-slate-200"
    }`}>
      <div className={`px-4 py-3 flex items-center gap-3 ${
        active?"bg-blue-950 text-white":done?"bg-emerald-50":"bg-slate-50"
      }`}>
        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 ${
          active?"bg-white text-blue-950":done?"bg-emerald-500 text-white":"bg-slate-200 text-slate-500"
        }`}>{done?"✓":num}</span>
        <h2 className={`font-bold text-sm ${
          active?"text-white":done?"text-emerald-800":"text-slate-500"
        }`}>{titre}</h2>
      </div>
      {(active||done)&&<div className="p-4">{children}</div>}
    </div>
  );
}

export default function Commercial() {
  const [etape, setEtape] = useState(1);
  const [client, setClient] = useState({
    nom:"", prenom:"", tel:"", adresse:"", ville:"", code_postal:"",
    latitude:null, longitude:null, google_maps_url:""
  });
  const [geocoding, setGeocoding] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const linesRef = useRef([]);
  const proposalRefNum = useRef(`C2B-${Math.floor(100000 + Math.random() * 899999)}`);
  const [ready, setReady] = useState(false);
  const [position, setPosition] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [recherche, setRecherche] = useState("");

  const [pans, setPans] = useState([
    { nom:"Pan A", azimut:0, surface:"", inclinaison:20 },
    { nom:"Pan B", azimut:180, surface:"", inclinaison:20 },
  ]);

  const [gamme, setGamme] = useState("SOFAR PowerAll");
  const [kitId, setKitId] = useState(null);
  const [aideChoisie, setAideChoisie] = useState(null);
  const [edfData, setEdfData] = useState(null);
  const [edfLoading, setEdfLoading] = useState(false);

  const kitsGamme = KITS.filter(k=>k.gamme===gamme);
  const kit = KITS.find(k=>k.id===kitId);

  // Chargement Leaflet — une seule fois
  useEffect(()=>{
    if (typeof window==="undefined") return;
    if (window.L) { setReady(true); return; }
    const link=document.createElement("link");
    link.rel="stylesheet";
    link.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    const script=document.createElement("script");
    script.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload=()=>setReady(true);
    document.head.appendChild(script);
  },[]);

  // Initialisation carte quand etape 2 active
  useEffect(()=>{
    if (!ready || etape!==2 || !mapRef.current) return;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.invalidateSize();
      return;
    }
    setTimeout(()=>{
      if (!mapRef.current) return;
      const L=window.L;
      const map=L.map(mapRef.current).setView([-21.1151,55.5364],10);
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {attribution:"Esri",maxZoom:20}
      ).addTo(map);
      map.on("click",e=>setPosition({lat:e.latlng.lat,lng:e.latlng.lng}));
      mapInstanceRef.current=map;
      if (position) map.setView([position.lat,position.lng],19);
    },300);
  },[ready, etape]);

  // Marqueur + lignes azimuts
  useEffect(()=>{
    if (!position||!mapInstanceRef.current) return;
    const L=window.L, map=mapInstanceRef.current;
    if (markerRef.current) markerRef.current.remove();
    linesRef.current.forEach(l=>l.remove());
    linesRef.current=[];
    markerRef.current=L.circleMarker([position.lat,position.lng],
      {radius:7,color:"#fff",fillColor:"#1e3a8a",fillOpacity:1,weight:3}).addTo(map);
    pans.forEach((pan,i)=>{
      const rad=((90-pan.azimut)*Math.PI)/180;
      const d=0.0004;
      const line=L.polyline(
        [[position.lat,position.lng],[position.lat+d*Math.sin(rad),position.lng+d*Math.cos(rad)]],
        {color:couleurPan(i),weight:4,dashArray:"6 4"}
      ).addTo(map);
      linesRef.current.push(line);
    });
  },[position,pans]);

  async function rechercherAdresse(val) {
    setRecherche(val);
    if (val.length<3) { setSuggestions([]); return; }
    const url="https://nominatim.openstreetmap.org/search?q="+encodeURIComponent(val+" La Reunion")+"&format=json&limit=5";
    const res=await fetch(url);
    const data=await res.json();
    setSuggestions(data);
  }

  function selectionnerAdresse(item) {
    const lat=parseFloat(item.lat), lng=parseFloat(item.lon);
    setRecherche(item.display_name);
    setSuggestions([]);
    setPosition({lat,lng});
    mapInstanceRef.current?.setView([lat,lng],19);
  }

  async function passerEtape2() {
    setGeocoding(true);
    if (client.adresse&&client.ville) {
      const geo=await geocodeAdresse(client.adresse,client.ville,client.code_postal);
      if (geo) {
        setClient(c=>({...c,...geo}));
        setPosition({lat:geo.latitude,lng:geo.longitude});
        setTimeout(()=>{
          mapInstanceRef.current?.setView([geo.latitude,geo.longitude],19);
        },400);
      }
    }
    setGeocoding(false);
    setEtape(2);
  }

  function updatePan(i,champ,val) {
    setPans(prev=>{
      const n=[...prev];
      n[i]={...n[i],[champ]:champ==="azimut"||champ==="inclinaison"?parseInt(val)||0:val};
      return n;
    });
  }

  async function analyserEDF(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEdfLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/analyser-edf", { method: "POST", body: fd });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEdfData(data);
    } catch (err) {
      alert("Erreur analyse EDF : " + err.message);
    }
    setEdfLoading(false);
  }

  async function telechargerPDF() {
    if (!kit || !aideChoisie) return alert("Choisissez un kit et une aide avant de générer le PDF");
    setPdfLoading(true);
    try {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client,
          kit,
          pans,
          position,
          aideChoisie,
          primeS24,
          kapAide,
          prixApresS24: prixTtcApresS24,
          prixApresKap: prixTtcApresKap,
          tauxAutoconso,
          tarifEDF: tarifEDFReel,
        }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Proposition_" + client.nom + "_" + client.prenom + ".pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch(e) {
      alert("Erreur génération PDF : " + e.message);
    }
    setPdfLoading(false);
  }

  const surfaceTotale=pans.reduce((s,p)=>s+(parseFloat(p.surface)||0),0);
  const primeS24=kit?calculerPrimeS24(kit):0;
  const kapAide=kit?aideKap(kit.puissance_kwc,true):0;
  const kapPlafond=kit?plafondKap(kit.puissance_kwc):0;
  const prixTtcApresS24=kit?kit.total_ttc-primeS24:0;
  const prixTtcApresKap=kit?kit.total_ttc-kapAide:0;
  const recommandation=kit&&primeS24>kapAide?"s24":"kap";

  const productionAnnuelle=kit?Math.round(kit.puissance_kwc*1650*0.82):0;
  const tauxAutoconso=edfData?.consoAnnuelleKwh&&productionAnnuelle>0
    ?Math.min(0.85,edfData.consoAnnuelleKwh/(productionAnnuelle*1.15))
    :0.65;
  const tarifEDFReel=edfData?.montantAnnuelEur&&edfData?.consoAnnuelleKwh&&edfData.consoAnnuelleKwh>0
    ?Math.round((edfData.montantAnnuelEur/edfData.consoAnnuelleKwh)*10000)/10000
    :0.1688;
  const tarifRachat=kit?.puissance_kwc<=3?0.2679:0.2282;
  const economieAutoconso=kit?Math.round(productionAnnuelle*tauxAutoconso*tarifEDFReel):0;
  const revenuSurplus=kit?Math.round(productionAnnuelle*(1-tauxAutoconso)*tarifRachat):0;
  const gainAnnuel=economieAutoconso+revenuSurplus;
  const roiAns=gainAnnuel>0?(aideChoisie==="s24"?Math.ceil(prixTtcApresS24/gainAnnuel):Math.ceil(prixTtcApresKap/gainAnnuel)):null;

  const clientOk=client.nom&&client.prenom&&client.tel;
  const carteOk=!!position;
  const toitureOk=pans.some(p=>parseFloat(p.surface)>0);
  const kitOk=!!kitId;

  const prixNet = aideChoisie === "s24" ? prixTtcApresS24 : prixTtcApresKap;
  const proposalData = kit ? {
    ref: proposalRefNum.current,
    date: new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
    client_nom: `${client.prenom} ${client.nom}`.trim().toUpperCase(),
    client_adresse: `${client.adresse} — ${client.code_postal} ${client.ville}`,
    puissance_kwc: kit.puissance_kwc,
    modules: kit.nb_modules,
    module_wc: kit.panneau_wc,
    batterie_kwh: kit.batterie_kwh,
    onduleur: kit.onduleur_modele,
    prix_ttc: fmtEur(kit.total_ttc),
    aide_kap: fmtInt(kapAide),
    prix_net: fmtEur(prixNet),
    economie_annuelle: gainAnnuel,
    production_annuelle: fmtInt(productionAnnuelle),
    autonomie: Math.round(tauxAutoconso * 100),
    autoconsommee: fmtInt(productionAnnuelle * tauxAutoconso),
    vendue: fmtInt(productionAnnuelle * (1 - tauxAutoconso)),
    irradiation: 1650,
    performance: 82,
    pertes: 18,
    roi_ans: roiAns || 0,
    gain_25ans: fmtInt(Math.max(0, gainAnnuel * 25 - prixNet)),
    reduction_facture: Math.round(tauxAutoconso * 100),
    production_mensuelle: MONTHLY_WEIGHTS.map(w => Math.round(productionAnnuelle * w / MONTHLY_WEIGHTS_SUM)),
    azimut: `${pans[0].azimut}°`,
    inclinaison: `${pans[0].inclinaison}°`,
    surface: `${surfaceTotale} m²`,
    phone: client.tel,
  } : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-blue-950 text-white px-4 py-4 flex items-center gap-3 sticky top-0 z-50 shadow-md">
        <a href="/" className="text-sm bg-blue-900/50 px-3 py-2 rounded-lg border border-blue-800 min-h-[44px] flex items-center">
          Retour
        </a>
        <div>
          <h1 className="font-bold">Visite commerciale</h1>
          <p className="text-blue-300 text-xs">Etape {Math.min(etape,5)} / 5</p>
        </div>
      </header>

      <div className="p-4 max-w-2xl mx-auto space-y-4">

        {/* RELEVE EDF */}
        <div className="bg-white rounded-2xl border-2 border-amber-200 overflow-hidden">
          <div className="px-4 py-3 bg-amber-50 flex items-center gap-3">
            <span className="text-amber-600 text-xl">⚡</span>
            <div>
              <h2 className="font-bold text-sm text-amber-800">Relevé de consommation EDF</h2>
              <p className="text-xs text-amber-600">Optionnel — personnalise les calculs d'économies</p>
            </div>
          </div>
          <div className="p-4">
            {!edfData ? (
              <label className="block cursor-pointer">
                <input type="file" accept=".pdf,image/*" className="hidden" onChange={analyserEDF} disabled={edfLoading}/>
                <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${edfLoading?"border-amber-300 bg-amber-50":"border-slate-200 hover:border-amber-300 hover:bg-amber-50"}`}>
                  {edfLoading?(
                    <>
                      <p className="text-2xl mb-2">⏳</p>
                      <p className="font-bold text-amber-700 text-sm">Analyse en cours...</p>
                      <p className="text-xs text-amber-500">Claude lit votre relevé EDF</p>
                    </>
                  ):(
                    <>
                      <p className="text-3xl mb-2">📄</p>
                      <p className="font-bold text-slate-700 text-sm">Uploader votre relevé EDF</p>
                      <p className="text-xs text-slate-400 mt-1">PDF ou image · Données utilisées pour les calculs réels</p>
                    </>
                  )}
                </div>
              </label>
            ):(
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {label:"Abonnement",value:edfData.tarif||"—"},
                    {label:"Puissance souscrite",value:edfData.puissanceSouscrite?edfData.puissanceSouscrite+" kVA":"—"},
                    {label:"Consommation annuelle",value:edfData.consoAnnuelleKwh?edfData.consoAnnuelleKwh.toLocaleString("fr-FR")+" kWh":"—",hl:true},
                    {label:"Montant annuel EDF",value:edfData.montantAnnuelEur?edfData.montantAnnuelEur.toLocaleString("fr-FR")+" €":"—"},
                  ].map(({label,value,hl})=>(
                    <div key={label} className={`rounded-xl p-3 border ${hl?"bg-emerald-50 border-emerald-200":"bg-slate-50 border-slate-200"}`}>
                      <p className="text-xs text-slate-400">{label}</p>
                      <p className={`font-bold text-sm ${hl?"text-emerald-700":"text-slate-800"}`}>{value}</p>
                    </div>
                  ))}
                </div>
                <button onClick={()=>setEdfData(null)} className="w-full text-xs text-slate-400 py-2 rounded-lg border border-slate-200 hover:bg-slate-50">
                  Changer de relevé
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ETAPE 1 */}
        <Section num="1" titre="Informations client" active={etape===1} done={etape>1}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Prenom</label>
                <input value={client.prenom} onChange={e=>setClient({...client,prenom:e.target.value})}
                  placeholder="Jean" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-h-[44px]"/>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Nom</label>
                <input value={client.nom} onChange={e=>setClient({...client,nom:e.target.value})}
                  placeholder="Dupont" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-h-[44px]"/>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Telephone</label>
              <input value={client.tel} onChange={e=>setClient({...client,tel:e.target.value})}
                placeholder="0692 xx xx xx" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-h-[44px]"/>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Adresse</label>
              <input value={client.adresse} onChange={e=>setClient({...client,adresse:e.target.value})}
                placeholder="12 rue des Flamboyants" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-h-[44px]"/>
            </div>
            <ChampVille
              ville={client.ville}
              codePostal={client.code_postal}
              onChange={({ville,codePostal})=>setClient({...client,ville,code_postal:codePostal})}
            />
            <button onClick={()=>clientOk&&passerEtape2()} disabled={!clientOk||geocoding}
              className="w-full bg-blue-950 text-white font-bold py-3 rounded-xl hover:bg-blue-800 disabled:opacity-40 min-h-[44px]">
              {geocoding?"Localisation GPS en cours...":"Suivant — Localiser le toit"}
            </button>
          </div>
        </Section>

        {/* ETAPE 2 */}
        <Section num="2" titre="Localisation du toit" active={etape===2} done={etape>2}>
          <div className="space-y-3">
            <div className="relative">
              <input value={recherche} onChange={e=>rechercherAdresse(e.target.value)}
                placeholder="Affiner la position sur la carte..."
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none min-h-[44px]"/>
              {suggestions.length>0&&(
                <div className="absolute left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl mt-1 overflow-hidden z-40">
                  {suggestions.map(s=>(
                    <button key={s.place_id} onClick={()=>selectionnerAdresse(s)}
                      className="w-full text-left px-4 py-3 text-xs hover:bg-blue-50 border-b border-slate-100 last:border-0">
                      {s.display_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div ref={mapRef} style={{height:"280px",borderRadius:"12px",overflow:"hidden",zIndex:1}}/>
            {position&&(
              <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200 text-xs">
                <p className="font-bold text-emerald-700">Position confirmee</p>
                <p className="text-emerald-600">{position.lat.toFixed(5)} S / {position.lng.toFixed(5)} E</p>
                {client.google_maps_url&&(
                  <a href={client.google_maps_url} target="_blank" rel="noreferrer"
                    className="text-blue-600 underline mt-1 inline-block">Ouvrir dans Google Maps</a>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={()=>setEtape(1)}
                className="border-2 border-slate-200 text-slate-600 font-bold py-3 rounded-xl min-h-[44px]">Retour</button>
              <button onClick={()=>carteOk&&setEtape(3)} disabled={!carteOk}
                className="bg-blue-950 text-white font-bold py-3 rounded-xl hover:bg-blue-800 disabled:opacity-40 min-h-[44px]">Suivant</button>
            </div>
          </div>
        </Section>

        {/* ETAPE 3 */}
        <Section num="3" titre="Toiture et orientations" active={etape===3} done={etape>3}>
          <div className="space-y-4">
            {pans.map((pan,i)=>(
              <div key={i} className="bg-slate-50 rounded-xl p-3 border-l-4" style={{borderColor:couleurPan(i)}}>
                <div className="flex items-center gap-3 mb-3">
                  <BoussoleMin azimut={pan.azimut} couleur={couleurPan(i)} size={56}/>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-slate-800">{pan.nom}</p>
                    <p className="text-xs font-bold" style={{color:couleurPan(i)}}>{pan.azimut}° — {directionLabel(pan.azimut)}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Azimut (0=Nord)</label>
                    <input type="range" min="0" max="359" value={pan.azimut}
                      onChange={e=>updatePan(i,"azimut",e.target.value)}
                      className="w-full" style={{accentColor:couleurPan(i)}}/>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Surface (m2)</label>
                      <input type="number" value={pan.surface} placeholder="Ex: 25"
                        onChange={e=>updatePan(i,"surface",e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none min-h-[44px]"/>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Inclinaison</label>
                      <input type="number" value={pan.inclinaison} min="0" max="60"
                        onChange={e=>updatePan(i,"inclinaison",e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none min-h-[44px]"/>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {surfaceTotale>0&&(
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-100 text-sm">
                <p className="text-blue-700">Surface totale : <strong>{surfaceTotale} m²</strong></p>
                <p className="text-blue-600 text-xs">Potentiel : ~{((surfaceTotale/2.4)*0.585).toFixed(2)} kWc</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={()=>setEtape(2)}
                className="border-2 border-slate-200 text-slate-600 font-bold py-3 rounded-xl min-h-[44px]">Retour</button>
              <button onClick={()=>toitureOk&&setEtape(4)} disabled={!toitureOk}
                className="bg-blue-950 text-white font-bold py-3 rounded-xl hover:bg-blue-800 disabled:opacity-40 min-h-[44px]">Suivant</button>
            </div>
          </div>
        </Section>

        {/* ETAPE 4 */}
        <Section num="4" titre="Choix du kit" active={etape===4} done={etape>4}>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {GAMMES.map(g=>(
                <button key={g} onClick={()=>setGamme(g)}
                  className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all min-h-[44px] ${
                    gamme===g?"bg-blue-950 text-white border-blue-950":"text-slate-600 border-slate-200 bg-slate-50"
                  }`}>
                  {g==="SOFAR PowerAll"?"SOFAR":g==="Alpha ESS SMILE"?"SMILE":"MICRO"}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {kitsGamme.map(k=>{
                const prime=calculerPrimeS24(k);
                const sel=kitId===k.id;
                return (
                  <div key={k.id} onClick={()=>setKitId(sel?null:k.id)}
                    className={`rounded-2xl border-2 p-4 cursor-pointer transition-all ${sel?"border-blue-950 bg-blue-50":"border-slate-200 bg-white"}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{k.nom}</p>
                        <p className="text-xs text-slate-400">{k.nb_modules} panneaux {k.panneau_wc}Wc · {k.batterie_kwh}kWh</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-base" style={{color:k.color}}>{k.total_ttc.toLocaleString("fr-FR")} €</p>
                        <p className="text-xs text-slate-400">TTC</p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">S24 : -{prime.toLocaleString("fr-FR")} €</span>
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">Kap : -{aideKap(k.puissance_kwc,true).toLocaleString("fr-FR")} €</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={()=>setEtape(3)}
                className="border-2 border-slate-200 text-slate-600 font-bold py-3 rounded-xl min-h-[44px]">Retour</button>
              <button onClick={()=>kitOk&&setEtape(5)} disabled={!kitOk}
                className="bg-blue-950 text-white font-bold py-3 rounded-xl hover:bg-blue-800 disabled:opacity-40 min-h-[44px]">Voir les resultats</button>
            </div>
          </div>
        </Section>

        {/* ETAPE 5 */}
        <Section num="5" titre="Resultats et comparaison des aides" active={etape===5} done={false}>
          {kit&&(
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <p className="text-xs font-bold text-slate-400 uppercase mb-2">Installation selectionnee</p>
                <p className="font-bold text-slate-800">{kit.nom}</p>
                <p className="text-sm text-slate-600">{kit.nb_modules} x {kit.panneau_wc}Wc = {kit.puissance_kwc} kWc</p>
                <p className="text-sm text-slate-600">{kit.onduleur_modele} · {kit.batterie_kwh} kWh stockage</p>
                <p className="text-lg font-black text-slate-800 mt-2">{kit.total_ttc.toLocaleString("fr-FR")} € TTC</p>
              </div>

              <div className={`rounded-xl p-4 border ${edfData?"bg-amber-50 border-amber-200":"bg-slate-50 border-slate-200"}`}>
                <p className="text-xs font-bold text-slate-400 uppercase mb-3">
                  Economies estimees{edfData?" · basées sur votre relevé EDF":" · valeurs par défaut"}
                </p>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-white rounded-xl p-3 text-center border border-slate-100">
                    <p className="text-base font-black text-orange-500">{gainAnnuel.toLocaleString("fr-FR")} €</p>
                    <p className="text-xs text-slate-400 mt-0.5">Gain annuel</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 text-center border border-slate-100">
                    <p className="text-base font-black text-blue-600">{Math.round(tauxAutoconso*100)}%</p>
                    <p className="text-xs text-slate-400 mt-0.5">Autoconsommation</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 text-center border border-slate-100">
                    <p className="text-base font-black text-slate-700">{roiAns?roiAns+" ans":"—"}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Retour invest.</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                  <div className="flex justify-between bg-white rounded-lg px-3 py-2 border border-slate-100">
                    <span>Autoconso.</span><span className="font-bold text-emerald-600">{economieAutoconso.toLocaleString("fr-FR")} €</span>
                  </div>
                  <div className="flex justify-between bg-white rounded-lg px-3 py-2 border border-slate-100">
                    <span>Vente surplus</span><span className="font-bold text-blue-600">{revenuSurplus.toLocaleString("fr-FR")} €</span>
                  </div>
                </div>
              </div>

              <div className={`rounded-xl p-3 border text-xs font-bold ${recommandation==="s24"?"bg-emerald-50 border-emerald-300 text-emerald-800":"bg-indigo-50 border-indigo-300 text-indigo-800"}`}>
                Recommandation : {recommandation==="s24"
                  ?"Prime S24 plus avantageuse (+" + Math.abs(primeS24-kapAide).toLocaleString("fr-FR") + " euros)"
                  :"Kap PV plus avantageux (+" + Math.abs(kapAide-primeS24).toLocaleString("fr-FR") + " euros)"}
              </div>

              <div onClick={()=>setAideChoisie("s24")}
                className={`rounded-2xl border-2 p-4 cursor-pointer transition-all ${aideChoisie==="s24"?"border-emerald-500 bg-emerald-50":"border-slate-200 bg-white"}`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-black text-emerald-700">Option A — Prime S24</p>
                    <p className="text-xs text-slate-400">Autoconsommation avec vente du surplus</p>
                  </div>
                  {aideChoisie==="s24"&&<span className="text-emerald-600 font-bold text-lg">✓</span>}
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Prix TTC</span><span className="font-semibold">{kit.total_ttc.toLocaleString("fr-FR")} €</span></div>
                  <div className="flex justify-between text-emerald-600"><span>Prime S24 ({kit.prime_s24_eur_wc} €/Wc)</span><span className="font-bold">- {primeS24.toLocaleString("fr-FR")} €</span></div>
                  <div className="flex justify-between border-t border-slate-200 pt-1 mt-1">
                    <span className="font-bold text-slate-800">Net a payer</span>
                    <span className="font-black text-xl text-emerald-700">{prixTtcApresS24.toLocaleString("fr-FR")} €</span>
                  </div>
                </div>
                <div className="mt-3 bg-emerald-100 rounded-lg p-2 text-xs text-emerald-700">Versee en une fois · Tranche {kit.tranche_s24} · Valable 20 ans</div>
              </div>

              <div onClick={()=>setAideChoisie("kap")}
                className={`rounded-2xl border-2 p-4 cursor-pointer transition-all ${aideChoisie==="kap"?"border-indigo-500 bg-indigo-50":"border-slate-200 bg-white"}`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-black text-indigo-700">Option B — Kap PV</p>
                    <p className="text-xs text-slate-400">Subvention Region Reunion + Europe (FEDER)</p>
                  </div>
                  {aideChoisie==="kap"&&<span className="text-indigo-600 font-bold text-lg">✓</span>}
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Prix TTC</span><span className="font-semibold">{kit.total_ttc.toLocaleString("fr-FR")} €</span></div>
                  <div className="flex justify-between"><span className="text-slate-400 text-xs">Plafond Kap ({kit.puissance_kwc} kWc)</span><span className="text-slate-400 text-xs">{kapPlafond.toLocaleString("fr-FR")} € max</span></div>
                  <div className="flex justify-between text-indigo-600"><span>Subvention Kap PV (avec stockage)</span><span className="font-bold">- {kapAide.toLocaleString("fr-FR")} €</span></div>
                  <div className="flex justify-between border-t border-slate-200 pt-1 mt-1">
                    <span className="font-bold text-slate-800">Net a payer</span>
                    <span className="font-black text-xl text-indigo-700">{prixTtcApresKap.toLocaleString("fr-FR")} €</span>
                  </div>
                </div>
                <div className="mt-3 bg-amber-50 rounded-lg p-2 text-xs text-amber-700 border border-amber-200">Non cumulable avec S24 · Dossier a monter · Delai 18 mois</div>
              </div>

              <div className="bg-blue-950 text-white rounded-2xl p-4">
                <p className="text-xs text-blue-300 uppercase font-bold mb-2">Recapitulatif client</p>
                <p className="font-bold">{client.prenom} {client.nom}</p>
                <p className="text-blue-200 text-sm">{client.tel}</p>
                <p className="text-blue-300 text-xs">{client.adresse} {client.code_postal} {client.ville}</p>
                {position&&<p className="text-blue-300 text-xs mt-1">{position.lat.toFixed(4)}S / {position.lng.toFixed(4)}E</p>}
                {client.google_maps_url&&(
                  <a href={client.google_maps_url} target="_blank" rel="noreferrer" className="text-yellow-400 text-xs underline mt-1 inline-block">Ouvrir dans Google Maps</a>
                )}
                {aideChoisie&&(
                  <p className="font-bold text-yellow-400 mt-2">
                    Aide choisie : {aideChoisie==="s24"?"Prime S24":"Kap PV"} — Net : {(aideChoisie==="s24"?prixTtcApresS24:prixTtcApresKap).toLocaleString("fr-FR")} €
                  </p>
                )}
              </div>

              {proposalData && <DownloadPdfButton proposalData={proposalData} label="Télécharger la proposition PDF" />}
            </div>
          )}
        </Section>

      </div>
    </div>
  );
}