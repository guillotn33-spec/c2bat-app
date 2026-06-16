import puppeteer from "puppeteer";

export async function POST(request) {
  const data = await request.json();
  const html = genererHTML(data);

  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "15mm", bottom: "15mm", left: "12mm", right: "12mm" },
  });
  await browser.close();

  return new Response(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Proposition_C2BAT.pdf"`,
    },
  });
}

function genererHTML({ client, kit, pans, position, aideChoisie, primeS24, kapAide, prixApresS24, prixApresKap, tauxAutoconso: tauxPassé, tarifEDF: tarifPassé }) {
  const dateStr = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const refDossier = "C2B-" + Date.now().toString().slice(-6);
  const netApayer = aideChoisie === "s24" ? prixApresS24 : prixApresKap;
  const aideLabel = aideChoisie === "s24" ? "Prime S24" : "Kap PV";
  const aideMontant = aideChoisie === "s24" ? primeS24 : kapAide;

  // Calculs PVGIS simplifiés La Réunion
  const irradiation = 1650;
  const pertes = 0.82;
  const productionAnnuelle = Math.round(kit.puissance_kwc * irradiation * pertes);
  const productionMensuelle = Math.round(productionAnnuelle / 12);
  const tarifEDF = tarifPassé ?? 0.1688;
  const tauxAutoconso = tauxPassé ?? 0.65;
  const economieAutoconso = Math.round(productionAnnuelle * tauxAutoconso * tarifEDF);
  const tarifRachat = kit.puissance_kwc <= 3 ? 0.2679 : 0.2282;
  const revenuSurplus = Math.round(productionAnnuelle * (1 - tauxAutoconso) * tarifRachat);
  const gainAnnuel = economieAutoconso + revenuSurplus;
  const roiAns = Math.ceil(netApayer / gainAnnuel);
  const gain25ans = gainAnnuel * 25 - netApayer;
  const tauxAutonomie = Math.round(tauxAutoconso * 100);

  const facteurs = [0.82, 0.87, 0.95, 1.02, 1.08, 1.10, 1.12, 1.10, 1.05, 0.97, 0.88, 0.80];
  const moisLabels = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  const productions = facteurs.map(f => Math.round(productionMensuelle * f));
  const maxProd = Math.max(...productions);

  const barres = productions.map((p, i) => {
    const h = Math.round((p / maxProd) * 100);
    const isPeak = p >= productionMensuelle;
    return `
      <div style="display:inline-block;vertical-align:bottom;width:7%;margin:0 0.4%;text-align:center;">
        <div style="font-size:7px;color:#64748b;margin-bottom:2px;">${p}</div>
        <div style="height:${h}px;background:${isPeak ? "#10b981" : "#cbd5e1"};border-radius:3px 3px 0 0;"></div>
        <div style="font-size:7px;color:#94a3b8;margin-top:3px;">${moisLabels[i]}</div>
      </div>`;
  }).join("");

  const annees = [1, 3, 5, 10, 15, 20, 25];
  const lignesROI = annees.map(an => {
    const total = gainAnnuel * an;
    const solde = total - netApayer;
    const positif = solde >= 0;
    return `
      <tr style="background:${positif ? "#f0fdf4" : "#ffffff"};">
        <td style="padding:6px 10px;font-size:9px;color:#64748b;">Année ${an}</td>
        <td style="padding:6px 10px;font-size:9px;text-align:right;">${total.toLocaleString("fr-FR")} €</td>
        <td style="padding:6px 10px;font-size:9px;text-align:right;font-weight:bold;color:${positif ? "#10b981" : "#ef4444"};">
          ${positif ? "+" : ""}${solde.toLocaleString("fr-FR")} €
        </td>
      </tr>`;
  }).join("");

  const pansHTML = pans.map(p => `
    <div style="display:inline-block;width:45%;margin:5px 2%;padding:10px;background:#f8fafc;border-radius:8px;border-left:4px solid #10b981;vertical-align:top;">
      <div style="font-size:11px;font-weight:bold;color:#0f172a;">${p.nom}</div>
      <div style="font-size:9px;color:#64748b;margin-top:3px;">Azimut : ${p.azimut}° · Inclinaison : ${p.inclinaison}° · Surface : ${p.surface || "—"} m²</div>
    </div>`).join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, Helvetica, sans-serif; background:#ffffff; color:#0f172a; }
  @page { size: A4; margin: 15mm 12mm; }
  .page { width:100%; min-height:257mm; page-break-after:always; position:relative; padding-bottom:20px; }
  .page:last-child { page-break-after:auto; }
  h1 { font-size:28px; font-weight:900; color:#0f172a; }
  h2 { font-size:18px; font-weight:800; color:#0f172a; margin-bottom:16px; }
  .tag { display:inline-block; background:#f1f5f9; color:#64748b; font-size:9px; padding:3px 8px; border-radius:20px; font-weight:600; }
  .kpi-row { display:table; width:100%; margin:16px 0; }
  .kpi { display:table-cell; width:33%; text-align:center; padding:16px 8px; }
  .kpi-val { font-size:36px; font-weight:900; line-height:1; }
  .kpi-label { font-size:9px; color:#64748b; margin-top:6px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; }
  .card-row { display:table; width:100%; margin:20px 0; }
  .card { display:table-cell; width:50%; padding:10px; vertical-align:top; }
  .card-inner { padding:24px; border-radius:12px; }
  .card-dark { background:#0f172a; color:#ffffff; }
  .card-light { background:#f0fdf4; border:2px solid #10b981; }
  .card-val { font-size:40px; font-weight:900; line-height:1.1; }
  .card-label { font-size:10px; opacity:0.7; margin-top:6px; font-weight:600; text-transform:uppercase; }
  .section-bg { background:#f8fafc; border-radius:12px; padding:20px; margin:16px 0; }
  .check-list { list-style:none; }
  .check-list li { font-size:10px; color:#1e293b; padding:5px 0; }
  .check-list li::before { content:"✓ "; color:#10b981; font-weight:900; }
  .badge-row { display:table; width:100%; margin:16px 0; }
  .badge { display:table-cell; text-align:center; padding:12px 6px; }
  .badge-inner { background:#f8fafc; border-radius:8px; padding:12px; border:1px solid #e2e8f0; }
  .badge-val { font-size:24px; font-weight:900; color:#0f172a; }
  .badge-label { font-size:8px; color:#64748b; margin-top:4px; text-transform:uppercase; font-weight:600; }
  .footer-page { position:absolute; bottom:0; left:0; right:0; border-top:1px solid #f1f5f9; padding-top:8px; }
  .footer-text { font-size:7px; color:#94a3b8; }
  .orange { color:#f97316; }
  .green { color:#10b981; }
  .sign-box { display:table-cell; width:50%; padding:0 10px; }
  .sign-inner { border:2px dashed #cbd5e1; border-radius:8px; padding:20px; min-height:80px; }
  table { width:100%; border-collapse:collapse; }
  td { border-bottom:1px solid #f1f5f9; }
</style>
</head>
<body>

<!-- PAGE 1 : HERO -->
<div class="page">
  <div style="margin-bottom:8px;">
    <span style="font-size:22px;font-weight:900;color:#0f172a;">C2BAT <span style="color:#10b981;">ELEC</span></span>
    <span style="float:right;font-size:9px;color:#94a3b8;margin-top:8px;">Réf. ${refDossier} · ${dateStr}</span>
  </div>
  <div style="height:2px;background:linear-gradient(to right,#0f172a,#10b981);margin-bottom:20px;border-radius:2px;"></div>

  <div style="margin-bottom:6px;">
    <span class="tag">Proposition Photovoltaïque · La Réunion</span>
  </div>
  <h1 style="margin:8px 0 4px;">Votre projet solaire,<br/>clé en main.</h1>
  <p style="font-size:11px;color:#64748b;margin-bottom:20px;">Préparé pour <strong>${client.prenom} ${client.nom.toUpperCase()}</strong> — ${client.adresse || ""} ${client.code_postal || ""} ${client.ville || ""}</p>

  <div class="card-row">
    <div class="card">
      <div class="card-inner card-dark">
        <div class="card-label" style="color:#94a3b8;">Installation proposée</div>
        <div class="card-val" style="color:#ffffff;">${kit.puissance_kwc} kWc</div>
        <div style="font-size:10px;color:#94a3b8;margin-top:8px;">${kit.nb_modules} modules ${kit.panneau_wc}Wc · ${kit.batterie_kwh} kWh</div>
        <div style="font-size:10px;color:#64748b;margin-top:4px;">${kit.nom}</div>
      </div>
    </div>
    <div class="card">
      <div class="card-inner card-light">
        <div class="card-label" style="color:#10b981;">Prix net — aides déduites</div>
        <div class="card-val" style="color:#0f172a;">${netApayer.toLocaleString("fr-FR")} €</div>
        <div style="font-size:10px;color:#64748b;margin-top:8px;">Aide ${aideLabel} : -${aideMontant.toLocaleString("fr-FR")} €</div>
        <div style="font-size:10px;color:#10b981;margin-top:4px;font-weight:700;">Prix TTC : ${kit.total_ttc.toLocaleString("fr-FR")} €</div>
      </div>
    </div>
  </div>

  <div style="background:#fff7ed;border-radius:12px;padding:24px;text-align:center;margin-top:8px;border:2px solid #f97316;">
    <div style="font-size:10px;color:#f97316;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Économie annuelle estimée</div>
    <div style="font-size:52px;font-weight:900;color:#f97316;">${gainAnnuel.toLocaleString("fr-FR")} €</div>
    <div style="font-size:10px;color:#64748b;margin-top:6px;">Autoconsommation + revenu vente surplus EDF</div>
  </div>

  <div class="footer-page">
    <span class="footer-text">C2BAT ELEC · Partenaire Kap PV · Spécialiste Photovoltaïque La Réunion</span>
    <span class="footer-text" style="float:right;">${client.tel || ""}</span>
  </div>
</div>

<!-- PAGE 2 : RENTABILITÉ -->
<div class="page">
  <h2>Votre Rentabilité Financière</h2>

  <div class="kpi-row">
    <div class="kpi" style="border-right:1px solid #f1f5f9;">
      <div class="kpi-val green">-70%</div>
      <div class="kpi-label">Facture EDF réduite</div>
    </div>
    <div class="kpi" style="border-right:1px solid #f1f5f9;">
      <div class="kpi-val orange">${roiAns} ans</div>
      <div class="kpi-label">Retour sur investissement</div>
    </div>
    <div class="kpi">
      <div class="kpi-val green">+${gain25ans.toLocaleString("fr-FR")} €</div>
      <div class="kpi-label">Gain net cumulé 25 ans</div>
    </div>
  </div>

  <div class="section-bg" style="margin-top:12px;">
    <div style="font-size:11px;font-weight:800;color:#0f172a;margin-bottom:12px;">Pourquoi c'est rentable dès maintenant</div>
    <ul class="check-list">
      <li>Valorisation immédiate de votre bien immobilier (+5 à 10%)</li>
      <li>Protection totale contre les hausses du prix de l'électricité EDF</li>
      <li>Production garantie 25 ans avec performance minimale assurée</li>
      <li>Indépendance énergétique grâce au stockage ${kit.batterie_kwh} kWh</li>
      <li>Revenu complémentaire via la vente du surplus au réseau EDF</li>
    </ul>
  </div>

  <div style="margin-top:16px;">
    <div style="font-size:11px;font-weight:800;color:#0f172a;margin-bottom:10px;">Tableau de retour sur investissement</div>
    <table>
      <thead>
        <tr style="background:#0f172a;">
          <td style="padding:8px 10px;font-size:8px;color:#ffffff;font-weight:700;">PÉRIODE</td>
          <td style="padding:8px 10px;font-size:8px;color:#ffffff;font-weight:700;text-align:right;">CUMUL GAINS</td>
          <td style="padding:8px 10px;font-size:8px;color:#ffffff;font-weight:700;text-align:right;">SOLDE NET</td>
        </tr>
      </thead>
      <tbody>${lignesROI}</tbody>
    </table>
  </div>

  <div class="footer-page">
    <span class="footer-text">Simulation indicative — Production réelle variable selon conditions locales · Réf. ${refDossier}</span>
  </div>
</div>

<!-- PAGE 3 : ÉQUIPEMENT -->
<div class="page">
  <h2>Votre Équipement Premium</h2>

  <div style="margin-bottom:12px;padding:20px;background:#f8fafc;border-radius:12px;border-left:4px solid #0f172a;">
    <div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:6px;">☀️ Panneaux Solaires Haute Performance</div>
    <div style="font-size:10px;color:#64748b;margin-bottom:6px;">${kit.nb_modules} modules × ${kit.panneau_wc} Wc — Puissance totale ${kit.puissance_kwc} kWc</div>
    <ul class="check-list">
      <li>Rendement optimal en conditions tropicales (chaleur, humidité)</li>
      <li>Résistance certifiée aux vents cycloniques — Structure Novotegra</li>
      <li>Garantie constructeur 10 ans pièces + 25 ans performance</li>
    </ul>
  </div>

  <div style="margin-bottom:12px;padding:20px;background:#f8fafc;border-radius:12px;border-left:4px solid #10b981;">
    <div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:6px;">⚡ Système de Pilotage Intelligent</div>
    <div style="font-size:10px;color:#64748b;margin-bottom:6px;">${kit.onduleur_modele} — Optimisation en temps réel</div>
    <ul class="check-list">
      <li>Monitoring 24h/24 via application smartphone</li>
      <li>Optimisation automatique de l'autoconsommation</li>
      <li>Alertes instantanées en cas d'anomalie</li>
    </ul>
  </div>

  <div style="margin-bottom:12px;padding:20px;background:#f8fafc;border-radius:12px;border-left:4px solid #f97316;">
    <div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:6px;">🔋 Batterie Nouvelle Génération</div>
    <div style="font-size:10px;color:#64748b;margin-bottom:6px;">${kit.batterie_kwh} kWh utile — Technologie LFP</div>
    <ul class="check-list">
      <li>Énergie solaire disponible même la nuit et par temps nuageux</li>
      <li>Mode secours automatique en cas de coupure EDF</li>
      <li>6000 cycles de vie garantis — durée de vie 15 à 20 ans</li>
    </ul>
  </div>

  <div style="padding:16px;background:#f0fdf4;border-radius:12px;border:1px solid #10b981;">
    <div style="font-size:10px;font-weight:700;color:#0f172a;margin-bottom:8px;">Analyse de votre toiture</div>
    <div>${pansHTML}</div>
  </div>

  <div class="footer-page">
    <span class="footer-text">C2BAT ELEC · Réf. ${refDossier} · ${dateStr}</span>
  </div>
</div>

<!-- PAGE 4 : SIMULATION PVGIS -->
<div class="page">
  <h2>Simulation de Production Solaire</h2>

  <div class="kpi-row">
    <div class="kpi" style="border-right:1px solid #f1f5f9;">
      <div class="kpi-val green">${productionAnnuelle.toLocaleString("fr-FR")}</div>
      <div style="font-size:9px;color:#10b981;font-weight:700;">kWh / an</div>
      <div class="kpi-label">Production annuelle</div>
    </div>
    <div class="kpi">
      <div class="kpi-val orange">${tauxAutonomie}%</div>
      <div class="kpi-label">Taux d'autonomie estimé</div>
    </div>
  </div>

  <div style="padding:20px;background:#f8fafc;border-radius:12px;margin:12px 0;">
    <div style="font-size:10px;font-weight:700;color:#0f172a;margin-bottom:12px;">Production mensuelle estimée (kWh)</div>
    <div style="text-align:center;height:130px;display:table;width:100%;">
      <div style="display:table-cell;vertical-align:bottom;padding-bottom:16px;">
        ${barres}
      </div>
    </div>
    <div style="margin-top:8px;font-size:8px;color:#94a3b8;text-align:center;">
      <span style="display:inline-block;width:10px;height:10px;background:#10b981;border-radius:2px;margin-right:4px;vertical-align:middle;"></span>Mois supérieurs à la moyenne
      <span style="display:inline-block;width:10px;height:10px;background:#cbd5e1;border-radius:2px;margin:0 4px 0 12px;vertical-align:middle;"></span>Mois inférieurs à la moyenne
    </div>
  </div>

  <div class="section-bg">
    <div style="display:table;width:100%;">
      <div style="display:table-cell;width:50%;padding-right:10px;">
        <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Données source</div>
        <div style="font-size:9px;color:#1e293b;">Irradiation La Réunion : ${irradiation} kWh/kWc/an</div>
        <div style="font-size:9px;color:#1e293b;">Performance système : ${Math.round(pertes * 100)}%</div>
        <div style="font-size:9px;color:#1e293b;">Pertes estimées : ${Math.round((1 - pertes) * 100)}%</div>
      </div>
      <div style="display:table-cell;width:50%;padding-left:10px;border-left:1px solid #f1f5f9;">
        <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Bilan énergétique</div>
        <div style="font-size:9px;color:#1e293b;">Autoconsommée : ${Math.round(productionAnnuelle * tauxAutoconso).toLocaleString("fr-FR")} kWh</div>
        <div style="font-size:9px;color:#1e293b;">Vendue EDF : ${Math.round(productionAnnuelle * (1 - tauxAutoconso)).toLocaleString("fr-FR")} kWh</div>
        <div style="font-size:9px;color:#10b981;font-weight:700;">Gain total : ${gainAnnuel.toLocaleString("fr-FR")} €/an</div>
      </div>
    </div>
  </div>

  <div class="footer-page">
    <span class="footer-text">Simulation basée sur données PVGIS · Valeurs indicatives · Réf. ${refDossier}</span>
  </div>
</div>

<!-- PAGE 5 : FINANCEMENT -->
<div class="page">
  <h2>Financement & Aides Disponibles</h2>

  <div class="card-row" style="margin-bottom:16px;">
    <div class="card">
      <div class="card-inner" style="background:#f0fdf4;border:2px solid #10b981;border-radius:12px;">
        <div style="font-size:9px;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Prime S24 — Autoconsommation</div>
        <div style="font-size:32px;font-weight:900;color:#0f172a;">-${primeS24.toLocaleString("fr-FR")} €</div>
        <div style="font-size:9px;color:#64748b;margin-top:8px;">${kit.prime_s24_eur_wc} €/Wc · Versée en une fois</div>
        <div style="font-size:9px;color:#64748b;margin-top:4px;">Arrêté tarifaire S24 · Valable 20 ans</div>
        ${aideChoisie === "s24" ? '<div style="margin-top:10px;background:#10b981;color:#fff;padding:6px 10px;border-radius:6px;font-size:9px;font-weight:700;text-align:center;">✓ AIDE RETENUE</div>' : ""}
      </div>
    </div>
    <div class="card">
      <div class="card-inner" style="background:#eef2ff;border:2px solid #6366f1;border-radius:12px;">
        <div style="font-size:9px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Kap PV — Région Réunion + Europe</div>
        <div style="font-size:32px;font-weight:900;color:#0f172a;">-${kapAide.toLocaleString("fr-FR")} €</div>
        <div style="font-size:9px;color:#64748b;margin-top:8px;">Subvention FEDER · Cofinancé Europe</div>
        <div style="font-size:9px;color:#64748b;margin-top:4px;">Dossier pris en charge à 100% par C2BAT</div>
        ${aideChoisie === "kap" ? '<div style="margin-top:10px;background:#6366f1;color:#fff;padding:6px 10px;border-radius:6px;font-size:9px;font-weight:700;text-align:center;">✓ AIDE RETENUE</div>' : ""}
      </div>
    </div>
  </div>

  <div style="background:#fff7ed;border:2px solid #f97316;border-radius:12px;padding:20px;text-align:center;margin-top:8px;">
    <div style="font-size:10px;color:#f97316;font-weight:700;text-transform:uppercase;margin-bottom:8px;">Votre investissement final</div>
    <div style="font-size:48px;font-weight:900;color:#0f172a;">${netApayer.toLocaleString("fr-FR")} €</div>
    <div style="font-size:10px;color:#64748b;margin-top:6px;">TTC · Clé en main · Aide ${aideLabel} déduite</div>
  </div>

  <div class="section-bg" style="margin-top:16px;">
    <div style="font-size:10px;font-weight:700;color:#0f172a;margin-bottom:8px;">C2BAT ELEC prend en charge 100% des démarches</div>
    <ul class="check-list">
      <li>Dépôt du dossier Kap PV auprès d'Energies Réunion</li>
      <li>Déclaration préalable de travaux en Mairie</li>
      <li>Demande de raccordement EDF SEI</li>
      <li>Visite de contrôle CONSUEL incluse</li>
      <li>Suivi administratif jusqu'au versement de l'aide</li>
    </ul>
  </div>

  <div class="footer-page">
    <span class="footer-text">⚠ Prime S24 et Kap PV non cumulables · Réf. ${refDossier}</span>
  </div>
</div>

<!-- PAGE 6 : GARANTIES -->
<div class="page">
  <h2>Sérénité & Garanties Totales</h2>

  <div class="badge-row">
    <div class="badge">
      <div class="badge-inner">
        <div class="badge-val green">25 ans</div>
        <div class="badge-label">Garantie performance modules</div>
      </div>
    </div>
    <div class="badge">
      <div class="badge-inner">
        <div class="badge-val orange">85%</div>
        <div class="badge-label">Performance min. à 25 ans</div>
      </div>
    </div>
    <div class="badge">
      <div class="badge-inner">
        <div class="badge-val" style="color:#0f172a;">10 ans</div>
        <div class="badge-label">Garantie matériel modules</div>
      </div>
    </div>
    <div class="badge">
      <div class="badge-inner">
        <div class="badge-val" style="color:#0f172a;">2 ans</div>
        <div class="badge-label">Garantie installateur</div>
      </div>
    </div>
  </div>

  <div class="section-bg" style="margin-top:8px;">
    <div style="font-size:11px;font-weight:800;color:#0f172a;margin-bottom:12px;">Certifications & Qualifications</div>
    <div style="display:table;width:100%;">
      <div style="display:table-cell;width:25%;text-align:center;padding:10px;">
        <div style="background:#0f172a;color:#ffffff;padding:10px;border-radius:8px;font-size:9px;font-weight:700;">RGE<br/>QualiPV</div>
      </div>
      <div style="display:table-cell;width:25%;text-align:center;padding:10px;">
        <div style="background:#10b981;color:#ffffff;padding:10px;border-radius:8px;font-size:9px;font-weight:700;">Partenaire<br/>Kap PV</div>
      </div>
      <div style="display:table-cell;width:25%;text-align:center;padding:10px;">
        <div style="background:#f97316;color:#ffffff;padding:10px;border-radius:8px;font-size:9px;font-weight:700;">Assurance<br/>Décennale</div>
      </div>
      <div style="display:table-cell;width:25%;text-align:center;padding:10px;">
        <div style="background:#6366f1;color:#ffffff;padding:10px;border-radius:8px;font-size:9px;font-weight:700;">FEDER<br/>Europe</div>
      </div>
    </div>
  </div>

  <div style="padding:16px;background:#f8fafc;border-radius:12px;margin-top:12px;">
    <div style="font-size:10px;font-weight:700;color:#0f172a;margin-bottom:8px;">Notre engagement qualité</div>
    <ul class="check-list">
      <li>Intervention sur site sous 48h en cas de dysfonctionnement</li>
      <li>Installation 100% conforme normes NF C 15-100 et XP C 15-712-3</li>
      <li>Structure Novotegra certifiée résistance cyclonique Réunion</li>
      <li>Adhérent éco-organisme SOREN (recyclage panneaux)</li>
      <li>Équipe locale basée à La Réunion — réactivité garantie</li>
    </ul>
  </div>

  <div class="footer-page">
    <span class="footer-text">C2BAT ELEC · La Réunion · Réf. ${refDossier}</span>
  </div>
</div>

<!-- PAGE 7 : SIGNATURE -->
<div class="page" style="page-break-after:auto;">
  <h2>Validation du Projet</h2>

  <div style="text-align:center;padding:20px;background:#f8fafc;border-radius:12px;margin-bottom:20px;">
    <div style="font-size:10px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase;">Récapitulatif de l'offre</div>
    <div style="font-size:16px;font-weight:900;color:#0f172a;">${kit.nom} — ${kit.puissance_kwc} kWc</div>
    <div style="font-size:12px;color:#64748b;margin-top:4px;">${kit.nb_modules} modules · ${kit.batterie_kwh} kWh · ${kit.onduleur_modele}</div>
    <div style="font-size:22px;font-weight:900;color:#10b981;margin-top:8px;">Net à payer : ${netApayer.toLocaleString("fr-FR")} €</div>
    <div style="font-size:10px;color:#64748b;">après aide ${aideLabel} de ${aideMontant.toLocaleString("fr-FR")} €</div>
  </div>

  <div style="display:table;width:100%;margin-bottom:20px;">
    <div class="sign-box">
      <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:8px;">Le Professionnel</div>
      <div class="sign-inner">
        <div style="font-size:9px;color:#94a3b8;">C2BAT ELEC</div>
        <div style="font-size:9px;color:#94a3b8;margin-top:4px;">Date : ${dateStr}</div>
      </div>
    </div>
    <div class="sign-box">
      <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:8px;">Le Client — Mention « Bon pour accord »</div>
      <div class="sign-inner">
        <div style="font-size:9px;color:#94a3b8;">${client.prenom} ${client.nom}</div>
        <div style="font-size:9px;color:#94a3b8;margin-top:4px;">Date : _____ / _____ / _________</div>
        <div style="margin-top:20px;font-size:8px;color:#cbd5e1;">Signature :</div>
      </div>
    </div>
  </div>

  <div style="padding:12px;background:#fef2f2;border-radius:8px;border:1px solid #fecaca;margin-bottom:10px;">
    <div style="font-size:8px;color:#991b1b;font-weight:700;margin-bottom:4px;">⚠ Mentions légales obligatoires</div>
    <div style="font-size:7.5px;color:#7f1d1d;line-height:1.5;">
      Vous disposez d'un délai de rétractation de 14 jours calendaires à compter de la signature (art. L221-18 Code Consommation). 
      Devis établi sous réserve d'accord de financement régional et européen. 
      Les travaux ne pourront démarrer qu'après réception de l'accord écrit. 
      Prime S24 et aide Kap PV non cumulables. 
      Offre valable 30 jours à compter du ${dateStr}.
    </div>
  </div>

  <div class="footer-page" style="position:relative;">
    <div style="height:3px;background:linear-gradient(to right,#0f172a,#10b981);border-radius:2px;margin-bottom:8px;"></div>
    <span class="footer-text">C2BAT ELEC · La Réunion · Partenaire certifié Kap PV · Réf. ${refDossier}</span>
  </div>
</div>

</body>
</html>`;
}