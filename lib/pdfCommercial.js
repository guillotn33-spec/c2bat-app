import jsPDF from "jspdf";

function couleurHex(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return [r,g,b];
}

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

function boussoleCanvas(azimut, couleur="#1e3a8a") {
  const canvas = document.createElement("canvas");
  canvas.width = 80; canvas.height = 80;
  const ctx = canvas.getContext("2d");
  const cx=40, cy=40, r=35;
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
  ctx.fillStyle="#f8fafc"; ctx.fill();
  ctx.strokeStyle="#e2e8f0"; ctx.lineWidth=1.5; ctx.stroke();
  const labels=[{t:"N",a:-90},{t:"S",a:90},{t:"E",a:0},{t:"O",a:180}];
  labels.forEach(l=>{
    const rad=l.a*Math.PI/180;
    ctx.fillStyle=l.t==="N"?"#1e3a8a":"#94a3b8";
    ctx.font="bold 10px Arial";
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(l.t, cx+(r-10)*Math.cos(rad), cy+(r-10)*Math.sin(rad));
  });
  const rad=((azimut-90)*Math.PI)/180;
  const ax=cx+(r*0.65)*Math.cos(rad), ay=cy+(r*0.65)*Math.sin(rad);
  const tr=rad+Math.PI;
  const tx=cx+(r*0.25)*Math.cos(tr), ty=cy+(r*0.25)*Math.sin(tr);
  ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(ax,ay);
  ctx.strokeStyle=couleur; ctx.lineWidth=3; ctx.lineCap="round"; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx,cy,5,0,Math.PI*2);
  ctx.fillStyle=couleur; ctx.fill();
  return canvas.toDataURL("image/png");
}

export async function genererPDFCommercial({ client, pans, kit, position, aideChoisie, primeS24, kapAide, prixApresS24, prixApresKap }) {
  const pdf = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });
  const W=210, H=297;
  const dateStr = new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"});
  const refDossier = "C2B-" + Date.now().toString().slice(-6);

  // ── COULEURS ──
  const BLEU = [30,58,138];
  const BLEU_CLAIR = [239,246,255];
  const VERT = [16,185,129];
  const JAUNE = [245,158,11];
  const GRIS = [100,116,139];
  const GRIS_CLAIR = [248,250,252];

  // ═══════════════════════════════════════════
  // PAGE 1 — PRÉSENTATION
  // ═══════════════════════════════════════════
  // Header bleu
  pdf.setFillColor(...BLEU);
  pdf.rect(0,0,W,55,"F");

  // Titre
  pdf.setTextColor(255,255,255);
  pdf.setFontSize(26); pdf.setFont("helvetica","bold");
  pdf.text("PROPOSITION PHOTOVOLTAÏQUE", W/2, 22, {align:"center"});
  pdf.setFontSize(12); pdf.setFont("helvetica","normal");
  pdf.text("C2BAT ELEC — La Réunion", W/2, 32, {align:"center"});

  // Badge ref
  pdf.setFillColor(245,158,11);
  pdf.roundedRect(W/2-30,38,60,12,3,3,"F");
  pdf.setTextColor(30,41,59); pdf.setFontSize(9); pdf.setFont("helvetica","bold");
  pdf.text("Réf. " + refDossier, W/2, 45.5, {align:"center"});

  // Infos client
  pdf.setTextColor(...BLEU);
  pdf.setFontSize(14); pdf.setFont("helvetica","bold");
  pdf.text("Préparé pour :", 20, 70);

  pdf.setFillColor(...BLEU_CLAIR);
  pdf.roundedRect(15, 75, W-30, 40, 4, 4, "F");
  pdf.setTextColor(15,23,42);
  pdf.setFontSize(18); pdf.setFont("helvetica","bold");
  pdf.text(client.prenom + " " + client.nom.toUpperCase(), 25, 90);
  pdf.setFontSize(10); pdf.setFont("helvetica","normal");
  pdf.setTextColor(...GRIS);
  if (client.adresse) pdf.text(client.adresse, 25, 100);
  pdf.text((client.code_postal||"") + " " + (client.ville||""), 25, 107);
  if (client.tel) pdf.text("Tel : " + client.tel, 25, 114);

  // Date
  pdf.setTextColor(...GRIS);
  pdf.setFontSize(9);
  pdf.text("Date : " + dateStr, W-20, 107, {align:"right"});

  // Résumé kit
  pdf.setFillColor(...BLEU);
  pdf.roundedRect(15, 125, W-30, 60, 4, 4, "F");
  pdf.setTextColor(255,255,255);
  pdf.setFontSize(11); pdf.setFont("helvetica","bold");
  pdf.text("INSTALLATION PROPOSÉE", 25, 138);
  pdf.setFontSize(22); pdf.setFont("helvetica","bold");
  pdf.text(kit.nom, 25, 153);
  pdf.setFontSize(10); pdf.setFont("helvetica","normal");
  pdf.text(kit.nb_modules + " modules " + kit.panneau_wc + "Wc  ·  " + kit.puissance_kwc + " kWc  ·  " + kit.batterie_kwh + " kWh stockage", 25, 163);
  pdf.text("Onduleur : " + kit.onduleur_modele, 25, 171);

  // Net à payer
  const netApayer = aideChoisie==="s24" ? prixApresS24 : prixApresKap;
  const aideLabel = aideChoisie==="s24" ? "Prime S24" : "Kap PV";
  const aideMontant = aideChoisie==="s24" ? primeS24 : kapAide;

  pdf.setFillColor(245,158,11);
  pdf.roundedRect(15, 198, W-30, 45, 4, 4, "F");
  pdf.setTextColor(15,23,42);
  pdf.setFontSize(10); pdf.setFont("helvetica","bold");
  pdf.text("FINANCEMENT RETENU : " + aideLabel.toUpperCase(), 25, 210);
  pdf.setFontSize(9); pdf.setFont("helvetica","normal");
  pdf.text("Prix TTC : " + kit.total_ttc.toLocaleString("fr-FR") + " €", 25, 220);
  pdf.text("Aide " + aideLabel + " : - " + aideMontant.toLocaleString("fr-FR") + " €", 25, 228);
  pdf.setFontSize(18); pdf.setFont("helvetica","bold");
  pdf.text("NET À PAYER : " + netApayer.toLocaleString("fr-FR") + " €", 25, 240);

  // GPS
  if (position) {
    pdf.setFillColor(...GRIS_CLAIR);
    pdf.roundedRect(15, 255, W-30, 18, 3, 3, "F");
    pdf.setTextColor(...GRIS);
    pdf.setFontSize(8); pdf.setFont("helvetica","normal");
    pdf.text("Position GPS : " + position.lat.toFixed(5) + " S / " + position.lng.toFixed(5) + " E", 25, 264);
    if (client.google_maps_url) pdf.text("Google Maps : " + client.google_maps_url, 25, 270);
  }

  // Footer p1
  pdf.setFillColor(...BLEU);
  pdf.rect(0,282,W,15,"F");
  pdf.setTextColor(255,255,255); pdf.setFontSize(8);
  pdf.text("C2BAT ELEC · La Réunion · Partenaire Kap PV · Spécialiste Photovoltaïque", W/2, 291, {align:"center"});

  // ═══════════════════════════════════════════
  // PAGE 2 — INSTALLATION + TOITURE
  // ═══════════════════════════════════════════
  pdf.addPage();

  pdf.setFillColor(...BLEU);
  pdf.rect(0,0,W,18,"F");
  pdf.setTextColor(255,255,255); pdf.setFontSize(13); pdf.setFont("helvetica","bold");
  pdf.text("DÉTAIL DE L'INSTALLATION", W/2, 12, {align:"center"});

  // Matériel
  pdf.setTextColor(...BLEU);
  pdf.setFontSize(12); pdf.setFont("helvetica","bold");
  pdf.text("Matériel inclus", 20, 30);

  const lignes = [
    ["Modules photovoltaïques", kit.nb_modules + " x " + kit.panneau_wc + "Wc = " + kit.puissance_kwc + " kWc"],
    ["Onduleur", kit.onduleur_modele],
    ["Batteries LFP", kit.batterie_kwh + " kWh utile"],
    ["Structure de fixation", "Novotegra — conforme cyclones"],
    ["Monitoring", "Application mobile incluse"],
    ["CONSUEL", "Visite de contrôle incluse"],
    ["Garantie matériel", "10 ans modules / 5 ans onduleur"],
    ["Garantie installateur", "2 ans"],
  ];

  let y=38;
  lignes.forEach((l,i)=>{
    if (i%2===0) {
      pdf.setFillColor(248,250,252);
      pdf.rect(15,y-5,W-30,10,"F");
    }
    pdf.setTextColor(15,23,42); pdf.setFontSize(9); pdf.setFont("helvetica","bold");
    pdf.text(l[0], 20, y);
    pdf.setFont("helvetica","normal"); pdf.setTextColor(...GRIS);
    pdf.text(l[1], W-20, y, {align:"right"});
    y+=10;
  });

  // Toiture
  pdf.setTextColor(...BLEU);
  pdf.setFontSize(12); pdf.setFont("helvetica","bold");
  pdf.text("Analyse de la toiture", 20, y+10);
  y+=18;

  const COULEURS_PANS = ["#f59e0b","#3b82f6","#10b981","#ef4444"];
  pans.forEach((pan,i)=>{
    const couleur = COULEURS_PANS[i%4];
    const img = boussoleCanvas(pan.azimut, couleur);
    pdf.addImage(img,"PNG",20,y,18,18);
    pdf.setTextColor(15,23,42); pdf.setFontSize(10); pdf.setFont("helvetica","bold");
    pdf.text(pan.nom, 42, y+6);
    pdf.setFont("helvetica","normal"); pdf.setTextColor(...GRIS); pdf.setFontSize(9);
    pdf.text("Azimut : " + pan.azimut + "° (" + directionLabel(pan.azimut) + ")", 42, y+12);
    pdf.text("Inclinaison : " + pan.inclinaison + "°" + (pan.surface?" · Surface : "+pan.surface+" m²":""), 42, y+18);
    y+=24;
  });

  // Footer p2
  pdf.setFillColor(...BLEU);
  pdf.rect(0,282,W,15,"F");
  pdf.setTextColor(255,255,255); pdf.setFontSize(8);
  pdf.text("C2BAT ELEC · Réf. " + refDossier + " · " + dateStr, W/2, 291, {align:"center"});

  // ═══════════════════════════════════════════
  // PAGE 3 — SIMULATION PVGIS
  // ═══════════════════════════════════════════
  pdf.addPage();

  pdf.setFillColor(...BLEU);
  pdf.rect(0,0,W,18,"F");
  pdf.setTextColor(255,255,255); pdf.setFontSize(13); pdf.setFont("helvetica","bold");
  pdf.text("SIMULATION DE PRODUCTION", W/2, 12, {align:"center"});

  // Estimation PVGIS (calcul simplifié La Réunion)
  const irradiation = 1650; // kWh/kWc/an moyenne La Réunion
  const pertes = 0.82; // 18% pertes système
  const productionAnnuelle = Math.round(kit.puissance_kwc * irradiation * pertes);
  const productionMensuelle = Math.round(productionAnnuelle / 12);
  const tarifEDF = 0.1688; // €/kWh EDF Réunion
  const tauxAutoconsoEstime = 0.65;
  const economieAutoconsoAnnuelle = Math.round(productionAnnuelle * tauxAutoconsoEstime * tarifEDF);

  // Tarif rachat S24
  const tarifRachat = kit.puissance_kwc <= 3 ? 0.2679 : kit.puissance_kwc <= 9 ? 0.2282 : 0.1632;
  const surplusVendu = Math.round(productionAnnuelle * (1 - tauxAutoconsoEstime) * tarifRachat);
  const economieTotal = economieAutoconsoAnnuelle + surplusVendu;

  pdf.setTextColor(...BLEU);
  pdf.setFontSize(11); pdf.setFont("helvetica","bold");
  pdf.text("Estimation basée sur les données PVGIS — La Réunion", 20, 30);
  pdf.setFontSize(8); pdf.setFont("helvetica","normal"); pdf.setTextColor(...GRIS);
  pdf.text("Irradiation moyenne : " + irradiation + " kWh/kWc/an · Pertes système : " + Math.round((1-pertes)*100) + "%", 20, 36);

  // Cartes chiffres clés
  const cards = [
    {label:"Production annuelle", val: productionAnnuelle.toLocaleString("fr-FR") + " kWh", color:VERT},
    {label:"Production mensuelle", val: productionMensuelle.toLocaleString("fr-FR") + " kWh", color:BLEU},
    {label:"Economie autoconso/an", val: economieAutoconsoAnnuelle.toLocaleString("fr-FR") + " €", color:[245,158,11]},
    {label:"Revenu vente surplus/an", val: surplusVendu.toLocaleString("fr-FR") + " €", color:[99,102,241]},
  ];

  let cx2=15;
  cards.forEach((c,i)=>{
    const x=cx2+i*(W-30)/4;
    const w=(W-30)/4-3;
    pdf.setFillColor(...c.color);
    pdf.roundedRect(x,44,w,28,3,3,"F");
    pdf.setTextColor(255,255,255);
    pdf.setFontSize(14); pdf.setFont("helvetica","bold");
    pdf.text(c.val, x+w/2, 56, {align:"center"});
    pdf.setFontSize(7); pdf.setFont("helvetica","normal");
    pdf.text(c.label, x+w/2, 63, {align:"center"});
  });

  // Tableau mensuel production estimée
  pdf.setTextColor(...BLEU);
  pdf.setFontSize(11); pdf.setFont("helvetica","bold");
  pdf.text("Production mensuelle estimée (kWh)", 20, 85);

  const mois = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
  const facteurs = [0.82,0.87,0.95,1.02,1.08,1.10,1.12,1.10,1.05,0.97,0.88,0.80];
  const productions = facteurs.map(f=>Math.round(productionMensuelle*f));
  const maxProd = Math.max(...productions);

  let xBar=15, yBar=90;
  const barW=(W-30)/12-2;
  productions.forEach((p,i)=>{
    const h=Math.max(4,(p/maxProd)*35);
    const col = p>productionMensuelle ? VERT : BLEU;
    pdf.setFillColor(...col);
    pdf.rect(xBar+i*(barW+2), yBar+35-h, barW, h, "F");
    pdf.setTextColor(...GRIS); pdf.setFontSize(6.5);
    pdf.text(mois[i], xBar+i*(barW+2)+barW/2, yBar+40, {align:"center"});
    pdf.text(p.toString(), xBar+i*(barW+2)+barW/2, yBar+32-h, {align:"center"});
  });

  // Bilan energetique
  y=145;
  pdf.setFillColor(...BLEU_CLAIR);
  pdf.roundedRect(15,y,W-30,50,4,4,"F");
  pdf.setTextColor(...BLEU);
  pdf.setFontSize(11); pdf.setFont("helvetica","bold");
  pdf.text("Bilan énergétique annuel", 25, y+12);

  const bilanLignes=[
    ["Production totale", productionAnnuelle.toLocaleString("fr-FR") + " kWh/an"],
    ["Autoconsommation estimée (65%)", Math.round(productionAnnuelle*0.65).toLocaleString("fr-FR") + " kWh/an"],
    ["Surplus vendu à EDF (35%)", Math.round(productionAnnuelle*0.35).toLocaleString("fr-FR") + " kWh/an"],
    ["Tarif rachat EDF S24", tarifRachat.toFixed(4) + " €/kWh"],
    ["Économie sur facture EDF", economieAutoconsoAnnuelle.toLocaleString("fr-FR") + " €/an"],
    ["Revenus vente surplus", surplusVendu.toLocaleString("fr-FR") + " €/an"],
    ["GAIN TOTAL ANNUEL", economieTotal.toLocaleString("fr-FR") + " €/an"],
  ];

  let yb=y+20;
  bilanLignes.forEach((l,i)=>{
    const bold = i===bilanLignes.length-1;
    pdf.setFont("helvetica", bold?"bold":"normal");
    pdf.setFontSize(bold?10:9);
    pdf.setTextColor(...(bold ? BLEU : GRIS));
    pdf.text(l[0], 25, yb);
    pdf.setFont("helvetica","bold");
    pdf.setTextColor(15,23,42);
    pdf.text(l[1], W-25, yb, {align:"right"});
    yb+=bold?0:7;
  });

  // Footer p3
  pdf.setFillColor(...BLEU);
  pdf.rect(0,282,W,15,"F");
  pdf.setTextColor(255,255,255); pdf.setFontSize(8);
  pdf.text("Simulation indicative — Production réelle peut varier selon conditions locales", W/2, 291, {align:"center"});

  // ═══════════════════════════════════════════
  // PAGE 4 — ROI + FINANCEMENT
  // ═══════════════════════════════════════════
  pdf.addPage();

  pdf.setFillColor(...BLEU);
  pdf.rect(0,0,W,18,"F");
  pdf.setTextColor(255,255,255); pdf.setFontSize(13); pdf.setFont("helvetica","bold");
  pdf.text("RENTABILITÉ & FINANCEMENT", W/2, 12, {align:"center"});

  // Comparatif S24 vs Kap PV
  pdf.setTextColor(...BLEU);
  pdf.setFontSize(12); pdf.setFont("helvetica","bold");
  pdf.text("Comparatif des aides disponibles", 20, 30);

  // S24
  pdf.setFillColor(240,253,250);
  pdf.roundedRect(15,35,90,55,4,4,"F");
  pdf.setFillColor(...VERT);
  pdf.roundedRect(15,35,90,12,4,4,"F");
  pdf.setTextColor(255,255,255); pdf.setFontSize(10); pdf.setFont("helvetica","bold");
  pdf.text("Option A — Prime S24", 60,43,{align:"center"});
  pdf.setTextColor(15,23,42); pdf.setFontSize(9); pdf.setFont("helvetica","normal");
  pdf.text("Aide : -" + primeS24.toLocaleString("fr-FR") + " €", 25, 55);
  pdf.text("Net à payer :", 25, 63);
  pdf.setFontSize(14); pdf.setFont("helvetica","bold"); pdf.setTextColor(...VERT);
  pdf.text(prixApresS24.toLocaleString("fr-FR") + " €", 25, 74);
  pdf.setFontSize(7); pdf.setFont("helvetica","normal"); pdf.setTextColor(...GRIS);
  pdf.text("Versée en 1 fois · 20 ans garantie", 25, 82);

  // Kap PV
  pdf.setFillColor(238,242,255);
  pdf.roundedRect(108,35,87,55,4,4,"F");
  pdf.setFillColor(99,102,241);
  pdf.roundedRect(108,35,87,12,4,4,"F");
  pdf.setTextColor(255,255,255); pdf.setFontSize(10); pdf.setFont("helvetica","bold");
  pdf.text("Option B — Kap PV", 151,43,{align:"center"});
  pdf.setTextColor(15,23,42); pdf.setFontSize(9); pdf.setFont("helvetica","normal");
  pdf.text("Aide : -" + kapAide.toLocaleString("fr-FR") + " €", 118, 55);
  pdf.text("Net à payer :", 118, 63);
  pdf.setFontSize(14); pdf.setFont("helvetica","bold"); pdf.setTextColor(99,102,241);
  pdf.text(prixApresKap.toLocaleString("fr-FR") + " €", 118, 74);
  pdf.setFontSize(7); pdf.setFont("helvetica","normal"); pdf.setTextColor(...GRIS);
  pdf.text("Subvention Région + Europe", 118, 82);

  // ROI Tableau
  pdf.setTextColor(...BLEU);
  pdf.setFontSize(12); pdf.setFont("helvetica","bold");
  pdf.text("Tableau de retour sur investissement", 20, 105);

  const invest = netApayer;
  const gainAn = economieTotal;
  const roiAns = Math.ceil(invest/gainAn);

  const annees = [1,2,3,5,8,10,15,20,25];
  const headers = ["Année","Cumul économies","Cumul revenus","Total gains","Solde net"];

  // Header tableau
  pdf.setFillColor(...BLEU);
  pdf.rect(15,110,W-30,8,"F");
  pdf.setTextColor(255,255,255); pdf.setFontSize(8); pdf.setFont("helvetica","bold");
  const cols=[15,45,85,125,160];
  const heads=["Année","Cumul économies","Cumul revenus","Total gains","Solde net"];
  heads.forEach((h,i)=>pdf.text(h,cols[i]+2,116));

  let yRoi=118;
  annees.forEach((an,i)=>{
    const cumEco = Math.round(economieAutoconsoAnnuelle*an);
    const cumRev = Math.round(surplusVendu*an);
    const total = cumEco+cumRev;
    const solde = total-invest;
    const positif = solde>=0;

    if (i%2===0) { pdf.setFillColor(248,250,252); pdf.rect(15,yRoi,W-30,8,"F"); }
    if (positif) { pdf.setFillColor(240,253,250); pdf.rect(15,yRoi,W-30,8,"F"); }

    pdf.setTextColor(positif ? VERT[0] : 15, positif ? VERT[1] : 23, positif ? VERT[2] : 42);
    pdf.setFontSize(8); pdf.setFont("helvetica", positif?"bold":"normal");
    pdf.text("An " + an, cols[0]+2, yRoi+6);
    pdf.setTextColor(15,23,42);
    pdf.text(cumEco.toLocaleString("fr-FR") + " €", cols[1]+2, yRoi+6);
    pdf.text(cumRev.toLocaleString("fr-FR") + " €", cols[2]+2, yRoi+6);
    pdf.setFont("helvetica","bold");
    pdf.text(total.toLocaleString("fr-FR") + " €", cols[3]+2, yRoi+6);
    pdf.setTextColor(
  positif ? VERT[0] : 239,
  positif ? VERT[1] : 68,
  positif ? VERT[2] : 68
);
    pdf.text((positif?"+":"") + solde.toLocaleString("fr-FR") + " €", cols[4]+2, yRoi+6);
    yRoi+=8;
  });

  // Retour investissement
  pdf.setFillColor(245,158,11);
  pdf.roundedRect(15,yRoi+5,W-30,16,3,3,"F");
  pdf.setTextColor(15,23,42); pdf.setFontSize(11); pdf.setFont("helvetica","bold");
  pdf.text("Retour sur investissement estimé : " + roiAns + " ans", W/2, yRoi+15, {align:"center"});

  // Footer p4
  pdf.setFillColor(...BLEU);
  pdf.rect(0,282,W,15,"F");
  pdf.setTextColor(255,255,255); pdf.setFontSize(8);
  pdf.text("C2BAT ELEC · Réf. " + refDossier + " · " + dateStr, W/2, 291, {align:"center"});

  // ═══════════════════════════════════════════
  // PAGE 5 — MENTIONS LÉGALES
  // ═══════════════════════════════════════════
  pdf.addPage();

  pdf.setFillColor(...BLEU);
  pdf.rect(0,0,W,18,"F");
  pdf.setTextColor(255,255,255); pdf.setFontSize(13); pdf.setFont("helvetica","bold");
  pdf.text("INFORMATIONS IMPORTANTES", W/2, 12, {align:"center"});

  const mentions = [
    {
      titre:"Délai de rétractation",
      texte:"Conformément à l'article L221-18 du Code de la Consommation, vous disposez d'un délai de 14 jours calendaires à compter de la signature du bon de commande pour exercer votre droit de rétractation, sans avoir à justifier de motifs ni à payer de pénalités."
    },
    {
      titre:"Non-cumul des aides S24 et Kap PV",
      texte:"L'aide régionale et européenne Kap Photovoltaïque n'est pas cumulable avec la prime à l'investissement Pk instaurée par l'arrêté tarifaire S24. Le client doit choisir une seule aide par installation."
    },
    {
      titre:"Devis sous réserve",
      texte:"Ce document est établi sous réserve d'accord de financement régional et européen (Kap PV) et/ou de l'accord du gestionnaire de réseau EDF SEI. Les travaux ne pourront démarrer qu'après réception de l'accord écrit de la Région Réunion pour le dispositif Kap PV."
    },
    {
      titre:"Garanties",
      texte:"Les modules sont garantis 10 ans (pièces) avec garantie de performance 80% à 25 ans. L'onduleur est garanti 5 ans minimum. La garantie installateur est de 2 ans sur l'ensemble de l'installation. En cas de dysfonctionnement, C2BAT ELEC s'engage à intervenir sous 48h ouvrées."
    },
    {
      titre:"Certification",
      texte:"C2BAT ELEC est partenaire certifié du dispositif Kap Photovoltaïque de la Région Réunion. Nos installations sont conformes aux normes NF C 15-100, XP C 15-712-3, et aux exigences techniques du cahier des charges Kap PV (Energies Réunion)."
    },
    {
      titre:"Protection des données",
      texte:"Les données personnelles collectées sont utilisées uniquement dans le cadre de ce projet photovoltaïque et de l'obtention du financement. Elles ne sont pas transmises à des tiers sans votre accord, conformément au RGPD."
    },
  ];

  let yM=28;
  mentions.forEach(m=>{
    pdf.setFillColor(...BLEU_CLAIR);
    pdf.roundedRect(15,yM,W-30,6,2,2,"F");
    pdf.setTextColor(...BLEU); pdf.setFontSize(9); pdf.setFont("helvetica","bold");
    pdf.text(m.titre, 20, yM+4.5);
    yM+=8;
    pdf.setTextColor(50,50,50); pdf.setFontSize(8); pdf.setFont("helvetica","normal");
    const lines=pdf.splitTextToSize(m.texte, W-40);
    pdf.text(lines, 20, yM);
    yM+=lines.length*4.5+6;
  });

  // Signature
  pdf.setFillColor(248,250,252);
  pdf.roundedRect(15,yM,W-30,35,3,3,"F");
  pdf.setTextColor(...GRIS); pdf.setFontSize(9); pdf.setFont("helvetica","bold");
  pdf.text("Bon pour accord — Signature du client :", 20, yM+10);
  pdf.text("Date : _____ / _____ / _________", 20, yM+20);
  pdf.setFontSize(7); pdf.setFont("helvetica","normal");
  pdf.text("Mention manuscrite obligatoire : « Bon pour accord »", 20, yM+28);

  // Footer p5
  pdf.setFillColor(...BLEU);
  pdf.rect(0,282,W,15,"F");
  pdf.setTextColor(255,255,255); pdf.setFontSize(8);
  pdf.text("C2BAT ELEC · La Réunion · Réf. " + refDossier, W/2, 291, {align:"center"});

  // ── SAVE ──
  const nomFichier = "Proposition_" + client.nom + "_" + client.prenom + "_" + refDossier + ".pdf";
  pdf.save(nomFichier);
}