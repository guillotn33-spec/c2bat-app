"use client";
import { useState, useEffect, useRef } from "react";

// ─── Constantes ────────────────────────────────────────────────────────────────
const COULEURS = ["#f59e0b","#3b82f6","#10b981","#ef4444","#8b5cf6","#ec4899","#14b8a6","#f97316"];
const couleurPan = (i) => COULEURS[i % COULEURS.length];

const DIRECTIONS = [
  {label:"N",az:0},{label:"NE",az:45},{label:"E",az:90},{label:"SE",az:135},
  {label:"S",az:180},{label:"SO",az:225},{label:"O",az:270},{label:"NO",az:315},
];

const OMBRAGES = [
  {label:"Aucun",perte:0,color:"#10b981"},
  {label:"Léger",perte:5,color:"#f59e0b"},
  {label:"Important",perte:15,color:"#ef4444"},
];

const TYPES_TOITURE = {
  "1 pan":     [{nom:"Pan unique",  azimut:0,   surface:"",inclinaison:20,ombrage:0}],
  "2 pans":    [{nom:"Pan A",       azimut:0,   surface:"",inclinaison:20,ombrage:0},
                {nom:"Pan B",       azimut:180, surface:"",inclinaison:20,ombrage:0}],
  "4 pans":    [{nom:"Pan Nord",    azimut:0,   surface:"",inclinaison:20,ombrage:0},
                {nom:"Pan Sud",     azimut:180, surface:"",inclinaison:20,ombrage:0},
                {nom:"Pan Est",     azimut:90,  surface:"",inclinaison:20,ombrage:0},
                {nom:"Pan Ouest",   azimut:270, surface:"",inclinaison:20,ombrage:0}],
  "Sur-mesure":[{nom:"Pan A",       azimut:0,   surface:"",inclinaison:20,ombrage:0}],
};

const PANS_DEFAUT = [{nom:"Pan A",azimut:0,surface:"",inclinaison:20,ombrage:0},
                     {nom:"Pan B",azimut:180,surface:"",inclinaison:20,ombrage:0}];

// ─── Helpers ───────────────────────────────────────────────────────────────────
function directionLabel(az) {
  if (az>=338||az<23)  return "Nord";
  if (az<68)  return "Nord-Est";
  if (az<113) return "Est";
  if (az<158) return "Sud-Est";
  if (az<203) return "Sud";
  if (az<248) return "Sud-Ouest";
  if (az<293) return "Ouest";
  return "Nord-Ouest";
}

function performanceAzimut(az) {
  const a = ((az%360)+360)%360;
  if (a<=45||a>=315)  return {label:"Excellent ✅",color:"#10b981",bg:"#d1fae5",score:100};
  if (a<=90||a>=270)  return {label:"Bon 👍",      color:"#3b82f6",bg:"#dbeafe",score:80};
  if (a<=135||a>=225) return {label:"Moyen ⚠️",    color:"#f59e0b",bg:"#fef3c7",score:55};
  return                      {label:"Défavorable ❌",color:"#ef4444",bg:"#fee2e2",score:20};
}

// ─── Composant Boussole ────────────────────────────────────────────────────────
function Boussole({azimut, couleur, size=88}) {
  const cx=size/2, cy=size/2, r=size/2-4;
  const rad=((azimut-90)*Math.PI)/180;
  const aLen=r*0.68;
  const ax=cx+aLen*Math.cos(rad), ay=cy+aLen*Math.sin(rad);
  const tr=rad+Math.PI;
  const tx=cx+r*0.28*Math.cos(tr), ty=cy+r*0.28*Math.sin(tr);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5"/>
      {[...Array(36)].map((_,i)=>{
        const a=(i*10-90)*Math.PI/180,r1=r-3,r2=r-(i%9===0?11:7);
        return <line key={i} x1={cx+r1*Math.cos(a)} y1={cy+r1*Math.sin(a)}
          x2={cx+r2*Math.cos(a)} y2={cy+r2*Math.sin(a)}
          stroke="#cbd5e1" strokeWidth={i%9===0?1.5:0.7}/>;
      })}
      {["N","E","S","O"].map((d,i)=>{
        const a=(i*90-90)*Math.PI/180,lx=cx+(r-12)*Math.cos(a),ly=cy+(r-12)*Math.sin(a);
        return <text key={d} x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
          fontSize={size*0.13} fontWeight="bold" fill={d==="N"?"#1e3a8a":"#94a3b8"}>{d}</text>;
      })}
      <line x1={tx} y1={ty} x2={ax} y2={ay} stroke={couleur} strokeWidth={size*0.055} strokeLinecap="round"/>
      <circle cx={ax} cy={ay} r={size*0.055} fill={couleur}/>
      <circle cx={cx} cy={cy} r={size*0.07} fill={couleur}/>
      <text x={cx} y={size-3} textAnchor="middle" fontSize={size*0.145} fontWeight="bold" fill={couleur}>{azimut}°</text>
    </svg>
  );
}

// ─── Grille de panneaux ────────────────────────────────────────────────────────
function GrillePanneaux({nb, couleur}) {
  if (!nb||nb<=0) return null;
  const affich = Math.min(nb, 40);
  return (
    <div>
      <p className="text-xs text-slate-500 mb-1.5">
        Disposition estimée : <strong className="text-slate-700">{nb} panneau{nb>1?"x":""} 585 Wc</strong>
        {nb>40?" (40 affichés)":""}
      </p>
      <div className="flex flex-wrap gap-1">
        {[...Array(affich)].map((_,i)=>(
          <div key={i} style={{
            width:14,height:20,borderRadius:2,
            background:couleur,opacity:0.75,
            border:`1px solid ${couleur}`
          }}/>
        ))}
        {nb>40&&<span className="text-xs text-slate-400 self-center">+{nb-40}</span>}
      </div>
    </div>
  );
}

// ─── Composant PanCard ─────────────────────────────────────────────────────────
function PanCard({pan, index, onUpdate, onDelete, canDelete}) {
  const [showDims, setShowDims] = useState(false);
  const [longueur, setLongueur] = useState("");
  const [largeur,  setLargeur]  = useState("");
  const couleur  = couleurPan(index);
  const perf     = performanceAzimut(pan.azimut);
  const surface  = parseFloat(pan.surface)||0;
  const nbPanneaux = Math.floor(surface/2);
  const puissance  = (nbPanneaux*0.585).toFixed(2);
  const perteFactor= 1-(pan.ombrage/100);
  const puissanceNette = (parseFloat(puissance)*perteFactor).toFixed(2);

  function updateAzimut(val) {
    let v=parseInt(val)||0;
    v=((v%360)+360)%360;
    onUpdate(index,"azimut",v);
  }
  function handleDim(l,la) {
    const s=(parseFloat(l)||0)*(parseFloat(la)||0);
    if(s>0) onUpdate(index,"surface",s.toFixed(1));
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
      style={{borderLeft:`5px solid ${couleur}`}}>
      <div className="p-4 space-y-4">

        {/* ── En-tête pan ── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Boussole azimut={pan.azimut} couleur={couleur} size={88}/>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-slate-800 text-base truncate">{pan.nom}</h4>
              <p className="text-xs text-slate-400 mt-0.5">0° = Nord · sens horaire</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{background:perf.bg,color:perf.color}}>
                  {perf.label}
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {directionLabel(pan.azimut)} · {pan.azimut}°
                </span>
              </div>
            </div>
          </div>
          {canDelete&&(
            <button onClick={()=>onDelete(index)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-red-50 hover:bg-red-100 text-red-500 border border-red-100 transition-all flex-shrink-0"
              title="Supprimer ce pan">🗑️</button>
          )}
        </div>

        {/* ── Boutons direction rapide ── */}
        <div className="grid grid-cols-8 gap-1">
          {DIRECTIONS.map((d)=>{
            const active=Math.abs(pan.azimut-d.az)<23||(d.az===0&&pan.azimut>=338);
            return (
              <button key={d.label} onClick={()=>updateAzimut(d.az)}
                className="min-h-[44px] rounded-xl text-xs font-bold border transition-all"
                style={active
                  ?{background:couleur,color:"#fff",borderColor:couleur}
                  :{background:"#f8fafc",color:"#64748b",borderColor:"#e2e8f0"}}>
                {d.label}
              </button>
            );
          })}
        </div>

        {/* ── Slider azimut + saisie ── */}
        <div className="flex items-center gap-3">
          <div className="flex-1" style={{color:couleur}}>
            <input type="range" min="0" max="359" value={pan.azimut}
              onChange={(e)=>updateAzimut(e.target.value)}
              className="w-full cursor-pointer"/>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <input type="number" min="0" max="359" value={pan.azimut}
              onChange={(e)=>updateAzimut(e.target.value)}
              className="w-16 border border-slate-300 rounded-xl px-2 py-2 text-sm text-center font-bold focus:outline-none min-h-[44px]"
              style={{color:couleur}}/>
            <span className="text-sm text-slate-400 font-bold">°</span>
          </div>
        </div>

        {/* ── Inclinaison individuelle ── */}
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs font-bold text-slate-600">📐 Inclinaison du pan</p>
            <span className="text-sm font-black px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700">{pan.inclinaison}°</span>
          </div>
          <p className="text-xs text-slate-400 mb-2">Optimal Réunion : 15° – 25°</p>
          <div style={{color:"#3b82f6"}}>
            <input type="range" min="0" max="60" value={pan.inclinaison}
              onChange={(e)=>onUpdate(index,"inclinaison",parseInt(e.target.value))}
              className="w-full cursor-pointer"/>
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>0° (plat)</span><span>30°</span><span>60° (vertical)</span>
          </div>
        </div>

        {/* ── Ombrage local ── */}
        <div>
          <p className="text-xs font-bold text-slate-600 mb-2">🌳 Ombrage local (masque proche)</p>
          <div className="grid grid-cols-3 gap-2">
            {OMBRAGES.map((o)=>(
              <button key={o.label} onClick={()=>onUpdate(index,"ombrage",o.perte)}
                className="min-h-[44px] rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center py-2 gap-0.5"
                style={pan.ombrage===o.perte
                  ?{background:o.color,color:"#fff",borderColor:o.color}
                  :{background:"#f8fafc",color:"#64748b",borderColor:"#e2e8f0"}}>
                <span>{o.label}</span>
                <span className="font-normal opacity-80">-{o.perte}%</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Surface + calcul dims ── */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Surface disponible (m²)
              </label>
              <input type="number" value={pan.surface} placeholder="Ex : 25"
                onChange={(e)=>onUpdate(index,"surface",e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:border-slate-400 min-h-[44px]"/>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 min-h-[44px] flex flex-col justify-center">
              <p className="text-xs text-slate-500">Brut : <strong className="text-slate-800">{puissance} kWc</strong></p>
              {pan.ombrage>0&&(
                <p className="text-xs text-orange-600">Avec ombrage : <strong>{puissanceNette} kWc</strong></p>
              )}
            </div>
          </div>

          {/* Calcul depuis dimensions */}
          <button onClick={()=>setShowDims(!showDims)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 py-1 transition-colors">
            📐 {showDims?"Masquer le calculateur":"Calculer via les dimensions du pan"}
          </button>

          {showDims&&(
            <div className="bg-blue-50 rounded-xl p-3 border border-blue-100 space-y-2">
              <p className="text-xs font-bold text-blue-700">Dimensions du versant</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-blue-600 font-semibold block mb-1">Longueur (m)</label>
                  <input type="number" value={longueur} placeholder="Ex : 8"
                    onChange={(e)=>{setLongueur(e.target.value);handleDim(e.target.value,largeur);}}
                    className="w-full border border-blue-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-blue-400 min-h-[44px]"/>
                </div>
                <div>
                  <label className="text-xs text-blue-600 font-semibold block mb-1">Largeur (m)</label>
                  <input type="number" value={largeur} placeholder="Ex : 4"
                    onChange={(e)=>{setLargeur(e.target.value);handleDim(longueur,e.target.value);}}
                    className="w-full border border-blue-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-blue-400 min-h-[44px]"/>
                </div>
              </div>
              {longueur&&largeur&&parseFloat(longueur)>0&&parseFloat(largeur)>0&&(
                <p className="text-xs font-bold text-blue-800 bg-blue-100 rounded-lg px-3 py-2">
                  ✅ Surface calculée : {(parseFloat(longueur)*parseFloat(largeur)).toFixed(1)} m²
                </p>
              )}
            </div>
          )}

          {/* Grille panneaux */}
          {nbPanneaux>0&&(
            <div className="pt-2">
              <GrillePanneaux nb={nbPanneaux} couleur={couleur}/>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page principale ───────────────────────────────────────────────────────────
export default function Carte() {
  const mapRef         = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef      = useRef(null);
  const linesRef       = useRef([]);

  const [adresse,     setAdresse]     = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [position,    setPosition]    = useState(null);
  const [typeToiture, setTypeToiture] = useState("2 pans");
  const [pans,        setPans]        = useState(PANS_DEFAUT);
  const [afficherOptionsAvancees, setAfficherOptionsAvancees] = useState(false);
  const [technologie, setTechnologie] = useState("crystic");
  const [typePose,    setTypePose]    = useState("free");
  const [pertes,      setPertes]      = useState(14);
  const [prixKwh,     setPrixKwh]     = useState(0.25);
  const [ready,       setReady]       = useState(false);

  // Chargement Leaflet
  useEffect(()=>{
    if(typeof window==="undefined") return;
    if(window.L){setReady(true);return;}
    const link=document.createElement("link");
    link.rel="stylesheet";
    link.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    const script=document.createElement("script");
    script.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload=()=>setReady(true);
    document.head.appendChild(script);
  },[]);

  // Init carte
  useEffect(()=>{
    if(!ready||!mapRef.current||mapInstanceRef.current) return;
    const L=window.L;
    const map=L.map(mapRef.current).setView([-21.1151,55.5364],10);
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {attribution:"Esri World Imagery",maxZoom:20}
    ).addTo(map);
    map.on("click",(e)=>setPosition({lat:e.latlng.lat,lng:e.latlng.lng}));
    mapInstanceRef.current=map;
  },[ready]);

  // Mise à jour marqueur + lignes azimut
  useEffect(()=>{
    if(!position||!mapInstanceRef.current) return;
    const L=window.L, map=mapInstanceRef.current;
    if(markerRef.current) markerRef.current.remove();
    linesRef.current.forEach(l=>l.remove());
    linesRef.current=[];

    markerRef.current=L.circleMarker([position.lat,position.lng],{
      radius:7,color:"#ffffff",fillColor:"#1e3a8a",fillOpacity:1,weight:3,
    }).addTo(map);

    pans.forEach((pan,i)=>{
      const rad=((90-pan.azimut)*Math.PI)/180;
      const d=0.0004;
      const endLat=position.lat+d*Math.sin(rad);
      const endLng=position.lng+d*Math.cos(rad);
      const line=L.polyline([[position.lat,position.lng],[endLat,endLng]],{
        color:couleurPan(i),weight:4,dashArray:"6 4",
      }).bindTooltip(`${pan.nom} — ${pan.azimut}° ${directionLabel(pan.azimut)}`,{
        permanent:true,direction:"center",className:"custom-leaflet-tooltip",
      }).addTo(map);
      linesRef.current.push(line);
    });
  },[position,pans]);

  function changerType(type) {
    setTypeToiture(type);
    setPans(TYPES_TOITURE[type].map(p=>({...p})));
  }

  function updatePan(i,champ,val) {
    setPans(prev=>{
      const n=[...prev];
      n[i]={...n[i],[champ]:val};
      return n;
    });
  }

  function ajouterPan() {
    const lettres="ABCDEFGHIJKLMNOP";
    setPans(prev=>[...prev,{
      nom:`Pan ${lettres[prev.length]||prev.length+1}`,
      azimut:Math.round(Math.random()*359),
      surface:"",inclinaison:20,ombrage:0,
    }]);
  }

  function supprimerPan(i) {
    setPans(prev=>prev.filter((_,idx)=>idx!==i));
  }

  function reinitialiser() {
    setPosition(null);
    setTypeToiture("2 pans");
    setPans(PANS_DEFAUT.map(p=>({...p})));
    setAdresse("");
    setSuggestions([]);
  }

  async function rechercherAdresse(val) {
    setAdresse(val);
    if(val.length<3){setSuggestions([]);return;}
    const res=await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val+" La Réunion")}&format=json&limit=5`
    );
    const data=await res.json();
    setSuggestions(data);
  }

  function selectionnerAdresse(item) {
    const lat=parseFloat(item.lat),lng=parseFloat(item.lon);
    setAdresse(item.display_name);
    setSuggestions([]);
    setPosition({lat,lng});
    mapInstanceRef.current?.setView([lat,lng],19);
  }

  // Calculs globaux
  const surfaceTotale=pans.reduce((s,p)=>s+(parseFloat(p.surface)||0),0);
  const puissanceBrute=pans.reduce((s,p)=>{
    const nb=Math.floor((parseFloat(p.surface)||0)/2);
    return s+(nb*0.585);
  },0);
  const puissanceNette=pans.reduce((s,p)=>{
    const nb=Math.floor((parseFloat(p.surface)||0)/2);
    return s+(nb*0.585*(1-p.ombrage/100));
  },0);
  const nbTotalPanneaux=pans.reduce((s,p)=>s+Math.floor((parseFloat(p.surface)||0)/2),0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <style jsx global>{`
        .custom-leaflet-tooltip{
          background:rgba(255,255,255,0.97)!important;
          border:1px solid #1e3a8a!important;
          border-radius:6px!important;
          padding:2px 8px!important;
          font-weight:bold!important;
          font-size:11px!important;
          color:#1e3a8a!important;
          box-shadow:0 2px 6px rgba(0,0,0,0.15);
        }
        input[type="range"]{
          height:8px;-webkit-appearance:none;
          background:#e2e8f0;border-radius:9999px;width:100%;
        }
        input[type="range"]::-webkit-slider-thumb{
          -webkit-appearance:none;width:28px;height:28px;
          background:currentColor;border-radius:50%;
          cursor:pointer;box-shadow:0 2px 5px rgba(0,0,0,0.25);
        }
      `}</style>

      {/* ── Header ── */}
      <header className="bg-blue-950 text-white px-4 py-3 flex items-center justify-between shadow-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <a href="/"
            className="min-h-[44px] flex items-center text-sm bg-blue-900/50 hover:bg-blue-900 px-3 py-1.5 rounded-lg border border-blue-800 transition-all">
            ← Retour
          </a>
          <h1 className="font-bold text-base tracking-wide">🗺️ Cap Solaire Réunion</h1>
        </div>
        <div className="flex items-center gap-2">
          {position&&(
            <span className="bg-emerald-600 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider hidden sm:inline">
              Toit ✓
            </span>
          )}
          <button onClick={reinitialiser}
            className="min-h-[44px] flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-900/50 hover:bg-blue-900 border border-blue-800 transition-all">
            🔄 <span className="hidden sm:inline">Réinitialiser</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-56px)]">

        {/* ── Carte ── */}
        <div className="lg:col-span-5 relative h-[300px] sm:h-[400px] lg:h-auto lg:sticky lg:top-[56px]">
          <div ref={mapRef} className="w-full h-full z-10" style={{minHeight:"300px"}}/>
          {!position&&(
            <div className="absolute inset-x-4 top-4 z-20 pointer-events-none text-center">
              <span className="bg-blue-950/90 text-white text-xs px-4 py-2.5 rounded-xl shadow-lg inline-block border border-blue-700">
                📍 Cliquez sur votre toit pour positionner le repère
              </span>
            </div>
          )}
        </div>

        {/* ── Panneau droite ── */}
        <div className="lg:col-span-7 p-4 md:p-6 space-y-5 overflow-y-auto">

          {/* Recherche adresse */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 relative z-30">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Trouver mon toit
            </label>
            <input value={adresse} onChange={(e)=>rechercherAdresse(e.target.value)}
              placeholder="Ex : 12 rue des Flamboyants, Saint-Denis..."
              className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-950 focus:ring-2 focus:ring-blue-100 bg-slate-50 min-h-[44px]"/>
            {suggestions.length>0&&(
              <div className="absolute left-4 right-4 bg-white border border-slate-200 rounded-xl shadow-xl mt-1 overflow-hidden z-40 max-h-60 overflow-y-auto">
                {suggestions.map((s)=>(
                  <button key={s.place_id} onClick={()=>selectionnerAdresse(s)}
                    className="w-full text-left px-4 py-3 text-xs hover:bg-blue-50 border-b border-slate-100 last:border-0 text-slate-700 min-h-[44px]">
                    📍 {s.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Type de toiture */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
            <p className="font-bold text-blue-950 mb-3">🏠 Type de toiture</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.keys(TYPES_TOITURE).map((type)=>(
                <button key={type} onClick={()=>changerType(type)}
                  className={`min-h-[44px] py-2.5 px-2 rounded-xl text-xs font-bold border transition-all ${
                    typeToiture===type
                      ?"bg-blue-950 text-white border-blue-950 shadow-sm"
                      :"text-slate-600 border-slate-200 hover:border-blue-400 bg-slate-50"
                  }`}>
                  {type==="Sur-mesure"?"✏️ Sur-mesure":type}
                </button>
              ))}
            </div>
          </div>

          {/* Pans */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <p className="font-bold text-blue-950 text-sm">🔆 Versants & orientations</p>
              {typeToiture==="Sur-mesure"&&(
                <button onClick={ajouterPan}
                  className="min-h-[44px] flex items-center gap-2 bg-blue-950 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-blue-800 active:scale-95 transition-all shadow-sm">
                  ➕ Ajouter un versant
                </button>
              )}
            </div>

            {pans.map((pan,i)=>(
              <PanCard
                key={`${pan.nom}-${i}`}
                pan={pan}
                index={i}
                onUpdate={updatePan}
                onDelete={supprimerPan}
                canDelete={typeToiture==="Sur-mesure"&&pans.length>1}
              />
            ))}
          </div>

          {/* Options avancées PVGIS */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <button onClick={()=>setAfficherOptionsAvancees(!afficherOptionsAvancees)}
              className="w-full flex justify-between items-center px-4 py-3.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left min-h-[44px]">
              <span className="font-bold text-slate-700 text-sm">🛠️ Options avancées PVGIS</span>
              <span className="text-xs font-bold text-blue-600">{afficherOptionsAvancees?"Masquer ▲":"Configurer ▼"}</span>
            </button>
            {afficherOptionsAvancees&&(
              <div className="p-4 border-t border-slate-100 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Technologie</label>
                  <select value={technologie} onChange={(e)=>setTechnologie(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 text-sm min-h-[44px]">
                    <option value="crystic">Silicium cristallin (standard)</option>
                    <option value="cis">CIS / CIGS</option>
                    <option value="cdte">Tellurure de cadmium (CdTe)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Type de montage</label>
                  <select value={typePose} onChange={(e)=>setTypePose(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 text-sm min-h-[44px]">
                    <option value="free">Surimposé / ventilé (conseillé Réunion)</option>
                    <option value="building">Intégré en toiture</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Pertes système (%)</label>
                    <input type="number" value={pertes} onChange={(e)=>setPertes(parseInt(e.target.value)||0)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 text-sm min-h-[44px]"/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Prix kWh EDF (€)</label>
                    <input type="number" step="0.01" value={prixKwh} onChange={(e)=>setPrixKwh(parseFloat(e.target.value)||0)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 text-sm min-h-[44px]"/>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Dashboard résultats */}
          {position&&(
            <div className="bg-emerald-950 text-emerald-100 rounded-2xl p-5 space-y-4 border border-emerald-900 shadow-md">
              <div className="border-b border-emerald-800 pb-3">
                <h3 className="font-black text-white text-base">📊 Dimensionnement pré-PVGIS</h3>
                <p className="text-xs text-emerald-300 mt-0.5">
                  {position.lat.toFixed(5)}°S / {position.lng.toFixed(5)}°E
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-emerald-900/40 rounded-xl p-3 border border-emerald-800">
                  <p className="text-xs uppercase font-bold text-emerald-300 tracking-widest">Surface</p>
                  <p className="text-xl font-black text-white mt-1">{surfaceTotale.toFixed(1)}<span className="text-xs font-normal"> m²</span></p>
                </div>
                <div className="bg-emerald-900/40 rounded-xl p-3 border border-emerald-800">
                  <p className="text-xs uppercase font-bold text-emerald-300 tracking-widest">Panneaux</p>
                  <p className="text-xl font-black text-white mt-1">{nbTotalPanneaux}<span className="text-xs font-normal"> mod.</span></p>
                </div>
                <div className="bg-emerald-900/40 rounded-xl p-3 border border-emerald-800">
                  <p className="text-xs uppercase font-bold text-emerald-300 tracking-widest">Puissance brute</p>
                  <p className="text-xl font-black text-yellow-400 mt-1">{puissanceBrute.toFixed(2)}<span className="text-xs font-normal text-white"> kWc</span></p>
                </div>
                <div className="bg-emerald-900/40 rounded-xl p-3 border border-emerald-800">
                  <p className="text-xs uppercase font-bold text-emerald-300 tracking-widest">Puissance nette</p>
                  <p className="text-xl font-black text-green-300 mt-1">{puissanceNette.toFixed(2)}<span className="text-xs font-normal text-white"> kWc</span></p>
                </div>
              </div>

              {/* Détail par pan */}
              <div className="space-y-1.5">
                {pans.map((pan,i)=>{
                  const nb=Math.floor((parseFloat(pan.surface)||0)/2);
                  const perf=performanceAzimut(pan.azimut);
                  const ombr=OMBRAGES.find(o=>o.perte===pan.ombrage)||OMBRAGES[0];
                  return (
                    <div key={i} className="flex items-center justify-between text-xs rounded-xl px-3 py-2 bg-emerald-900/30 gap-2">
                      <span className="font-bold flex-shrink-0" style={{color:couleurPan(i)}}>{pan.nom}</span>
                      <span className="text-emerald-200 flex-1 min-w-0 truncate">
                        {pan.azimut}° · {pan.inclinaison}° incl.
                        {pan.surface?` · ${pan.surface}m²`:""}
                        {nb>0?` · ${nb} pan.`:""}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-bold flex-shrink-0"
                        style={{background:perf.bg,color:perf.color}}>{perf.label}</span>
                      {pan.ombrage>0&&(
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-bold flex-shrink-0"
                          style={{background:"#fef3c7",color:"#f59e0b"}}>-{pan.ombrage}%</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="text-xs text-emerald-300 space-y-0.5 pt-1 border-t border-emerald-800">
                <p>Techno : <strong className="text-white">{technologie==="crystic"?"Silicium cristallin":technologie.toUpperCase()}</strong>
                  {" "}· Montage : <strong className="text-white">{typePose==="free"?"Surimposé ventilé":"Intégré toiture"}</strong>
                  {" "}· Pertes : <strong className="text-white">{pertes}%</strong>
                  {" "}· kWh : <strong className="text-white">{prixKwh}€</strong>
                </p>
              </div>

              <button
                onClick={()=>alert("PVGIS automatique — prochaine étape !")}
                className="w-full bg-yellow-500 text-slate-950 py-4 rounded-xl font-black text-sm hover:bg-yellow-400 active:scale-95 transition-all shadow-lg min-h-[44px]">
                🚀 Lancer la simulation PVGIS →
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}