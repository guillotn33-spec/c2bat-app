import sys
import json
import math
from datetime import datetime

try:
    from weasyprint import HTML
except ImportError:
    print("weasyprint not installed. Run: pip install weasyprint", file=sys.stderr)
    sys.exit(1)

def generer_html(data):
    client = data.get("client", {})
    kit = data.get("kit", {})
    pans = data.get("pans", [])
    aide_choisie = data.get("aideChoisie", "s24")
    prime_s24 = data.get("primeS24", 0)
    kap_aide = data.get("kapAide", 0)
    prix_apres_s24 = data.get("prixApresS24", 0)
    prix_apres_kap = data.get("prixApresKap", 0)
    taux_autoconso = data.get("tauxAutoconso") or 0.65
    tarif_edf = data.get("tarifEDF") or 0.1688

    date_str = datetime.now().strftime("%d %B %Y")
    ref_dossier = "C2B-" + str(int(datetime.now().timestamp() * 1000))[-6:]

    net_a_payer = prix_apres_s24 if aide_choisie == "s24" else prix_apres_kap
    aide_label = "Prime S24" if aide_choisie == "s24" else "Kap PV"
    aide_montant = prime_s24 if aide_choisie == "s24" else kap_aide

    puissance_kwc = kit.get("puissance_kwc", 0)
    irradiation = 1650
    pertes = 0.82
    production_annuelle = round(puissance_kwc * irradiation * pertes)
    production_mensuelle = round(production_annuelle / 12)
    taux_autoconso = min(float(taux_autoconso), 0.99)
    economie_autoconso = round(production_annuelle * taux_autoconso * tarif_edf)
    tarif_rachat = 0.2679 if puissance_kwc <= 3 else 0.2282
    revenu_surplus = round(production_annuelle * (1 - taux_autoconso) * tarif_rachat)
    gain_annuel = economie_autoconso + revenu_surplus
    roi_ans = math.ceil(net_a_payer / gain_annuel) if gain_annuel > 0 else 0
    gain_25ans = gain_annuel * 25 - net_a_payer
    taux_autonomie = round(taux_autoconso * 100)

    facteurs = [0.82, 0.87, 0.95, 1.02, 1.08, 1.10, 1.12, 1.10, 1.05, 0.97, 0.88, 0.80]
    mois_labels = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]
    productions = [round(production_mensuelle * f) for f in facteurs]
    max_prod = max(productions) if productions else 1

    barres = ""
    for i, p in enumerate(productions):
        h = round((p / max_prod) * 100)
        is_peak = p >= production_mensuelle
        color = "#10b981" if is_peak else "#cbd5e1"
        barres += f"""
      <div style="display:inline-block;vertical-align:bottom;width:7%;margin:0 0.4%;text-align:center;">
        <div style="font-size:7px;color:#64748b;margin-bottom:2px;">{p}</div>
        <div style="height:{h}px;background:{color};border-radius:3px 3px 0 0;"></div>
        <div style="font-size:7px;color:#94a3b8;margin-top:3px;">{mois_labels[i]}</div>
      </div>"""

    annees = [1, 3, 5, 10, 15, 20, 25]
    lignes_roi = ""
    for an in annees:
        total = gain_annuel * an
        solde = total - net_a_payer
        positif = solde >= 0
        bg = "#f0fdf4" if positif else "#ffffff"
        sign = "+" if positif else ""
        color = "#10b981" if positif else "#ef4444"
        lignes_roi += f"""
      <tr style="background:{bg};">
        <td style="padding:6px 10px;font-size:9px;color:#64748b;">Année {an}</td>
        <td style="padding:6px 10px;font-size:9px;text-align:right;">{total:,.0f} €</td>
        <td style="padding:6px 10px;font-size:9px;text-align:right;font-weight:bold;color:{color};">
          {sign}{solde:,.0f} €
        </td>
      </tr>"""

    pans_html = ""
    for p in pans:
        nom = p.get("nom", "")
        azimut = p.get("azimut", 0)
        inclinaison = p.get("inclinaison", 0)
        surface = p.get("surface", "") or "—"
        pans_html += f"""
    <div style="display:inline-block;width:45%;margin:5px 2%;padding:10px;background:#f8fafc;border-radius:8px;border-left:4px solid #10b981;vertical-align:top;">
      <div style="font-size:11px;font-weight:bold;color:#0f172a;">{nom}</div>
      <div style="font-size:9px;color:#64748b;margin-top:3px;">Azimut : {azimut}° · Inclinaison : {inclinaison}° · Surface : {surface} m²</div>
    </div>"""

    aide_s24_badge = '<div style="margin-top:10px;background:#10b981;color:#fff;padding:6px 10px;border-radius:6px;font-size:9px;font-weight:700;text-align:center;">✓ AIDE RETENUE</div>' if aide_choisie == "s24" else ""
    aide_kap_badge = '<div style="margin-top:10px;background:#6366f1;color:#fff;padding:6px 10px;border-radius:6px;font-size:9px;font-weight:700;text-align:center;">✓ AIDE RETENUE</div>' if aide_choisie == "kap" else ""

    prenom = client.get("prenom", "")
    nom_client = client.get("nom", "").upper()
    adresse = client.get("adresse", "")
    code_postal = client.get("code_postal", "")
    ville = client.get("ville", "")
    tel = client.get("tel", "")

    nb_modules = kit.get("nb_modules", "")
    panneau_wc = kit.get("panneau_wc", "")
    batterie_kwh = kit.get("batterie_kwh", "")
    nom_kit = kit.get("nom", "")
    total_ttc = kit.get("total_ttc", 0)
    onduleur = kit.get("onduleur_modele", "")
    prime_s24_eur_wc = kit.get("prime_s24_eur_wc", "")
    tranche_s24 = kit.get("tranche_s24", "")

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ font-family: Arial, Helvetica, sans-serif; background:#ffffff; color:#0f172a; }}
  @page {{ size: A4; margin: 15mm 12mm; }}
  .page {{ width:100%; min-height:257mm; page-break-after:always; position:relative; padding-bottom:20px; }}
  .page:last-child {{ page-break-after:auto; }}
  h1 {{ font-size:28px; font-weight:900; color:#0f172a; }}
  h2 {{ font-size:18px; font-weight:800; color:#0f172a; margin-bottom:16px; }}
  .tag {{ display:inline-block; background:#f1f5f9; color:#64748b; font-size:9px; padding:3px 8px; border-radius:20px; font-weight:600; }}
  .kpi-row {{ display:table; width:100%; margin:16px 0; }}
  .kpi {{ display:table-cell; width:33%; text-align:center; padding:16px 8px; }}
  .kpi-val {{ font-size:36px; font-weight:900; line-height:1; }}
  .kpi-label {{ font-size:9px; color:#64748b; margin-top:6px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; }}
  .card-row {{ display:table; width:100%; margin:20px 0; }}
  .card {{ display:table-cell; width:50%; padding:10px; vertical-align:top; }}
  .card-inner {{ padding:24px; border-radius:12px; }}
  .card-dark {{ background:#0f172a; color:#ffffff; }}
  .card-light {{ background:#f0fdf4; border:2px solid #10b981; }}
  .card-val {{ font-size:40px; font-weight:900; line-height:1.1; }}
  .card-label {{ font-size:10px; opacity:0.7; margin-top:6px; font-weight:600; text-transform:uppercase; }}
  .section-bg {{ background:#f8fafc; border-radius:12px; padding:20px; margin:16px 0; }}
  .check-list {{ list-style:none; }}
  .check-list li {{ font-size:10px; color:#1e293b; padding:5px 0; }}
  .check-list li::before {{ content:"✓ "; color:#10b981; font-weight:900; }}
  .badge-row {{ display:table; width:100%; margin:16px 0; }}
  .badge {{ display:table-cell; text-align:center; padding:12px 6px; }}
  .badge-inner {{ background:#f8fafc; border-radius:8px; padding:12px; border:1px solid #e2e8f0; }}
  .badge-val {{ font-size:24px; font-weight:900; color:#0f172a; }}
  .badge-label {{ font-size:8px; color:#64748b; margin-top:4px; text-transform:uppercase; font-weight:600; }}
  .footer-page {{ position:absolute; bottom:0; left:0; right:0; border-top:1px solid #f1f5f9; padding-top:8px; }}
  .footer-text {{ font-size:7px; color:#94a3b8; }}
  .orange {{ color:#f97316; }}
  .green {{ color:#10b981; }}
  .sign-box {{ display:table-cell; width:50%; padding:0 10px; }}
  .sign-inner {{ border:2px dashed #cbd5e1; border-radius:8px; padding:20px; min-height:80px; }}
  table {{ width:100%; border-collapse:collapse; }}
  td {{ border-bottom:1px solid #f1f5f9; }}
</style>
</head>
<body>

<!-- PAGE 1 -->
<div class="page">
  <div style="margin-bottom:8px;">
    <span style="font-size:22px;font-weight:900;color:#0f172a;">C2BAT <span style="color:#10b981;">ELEC</span></span>
    <span style="float:right;font-size:9px;color:#94a3b8;margin-top:8px;">Réf. {ref_dossier} · {date_str}</span>
  </div>
  <div style="height:2px;background:linear-gradient(to right,#0f172a,#10b981);margin-bottom:20px;border-radius:2px;"></div>
  <div style="margin-bottom:6px;"><span class="tag">Proposition Photovoltaïque · La Réunion</span></div>
  <h1 style="margin:8px 0 4px;">Votre projet solaire,<br/>clé en main.</h1>
  <p style="font-size:11px;color:#64748b;margin-bottom:20px;">Préparé pour <strong>{prenom} {nom_client}</strong> — {adresse} {code_postal} {ville}</p>
  <div class="card-row">
    <div class="card">
      <div class="card-inner card-dark">
        <div class="card-label" style="color:#94a3b8;">Installation proposée</div>
        <div class="card-val" style="color:#ffffff;">{puissance_kwc} kWc</div>
        <div style="font-size:10px;color:#94a3b8;margin-top:8px;">{nb_modules} modules {panneau_wc}Wc · {batterie_kwh} kWh</div>
        <div style="font-size:10px;color:#64748b;margin-top:4px;">{nom_kit}</div>
      </div>
    </div>
    <div class="card">
      <div class="card-inner card-light">
        <div class="card-label" style="color:#10b981;">Prix net — aides déduites</div>
        <div class="card-val" style="color:#0f172a;">{net_a_payer:,.0f} €</div>
        <div style="font-size:10px;color:#64748b;margin-top:8px;">Aide {aide_label} : -{aide_montant:,.0f} €</div>
        <div style="font-size:10px;color:#10b981;margin-top:4px;font-weight:700;">Prix TTC : {total_ttc:,.0f} €</div>
      </div>
    </div>
  </div>
  <div style="background:#fff7ed;border-radius:12px;padding:24px;text-align:center;margin-top:8px;border:2px solid #f97316;">
    <div style="font-size:10px;color:#f97316;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Économie annuelle estimée</div>
    <div style="font-size:52px;font-weight:900;color:#f97316;">{gain_annuel:,.0f} €</div>
    <div style="font-size:10px;color:#64748b;margin-top:6px;">Autoconsommation + revenu vente surplus EDF</div>
  </div>
  <div class="footer-page">
    <span class="footer-text">C2BAT ELEC · Partenaire Kap PV · Spécialiste Photovoltaïque La Réunion</span>
    <span class="footer-text" style="float:right;">{tel}</span>
  </div>
</div>

<!-- PAGE 2 -->
<div class="page">
  <h2>Votre Rentabilité Financière</h2>
  <div class="kpi-row">
    <div class="kpi" style="border-right:1px solid #f1f5f9;">
      <div class="kpi-val green">-70%</div>
      <div class="kpi-label">Facture EDF réduite</div>
    </div>
    <div class="kpi" style="border-right:1px solid #f1f5f9;">
      <div class="kpi-val orange">{roi_ans} ans</div>
      <div class="kpi-label">Retour sur investissement</div>
    </div>
    <div class="kpi">
      <div class="kpi-val green">+{gain_25ans:,.0f} €</div>
      <div class="kpi-label">Gain net cumulé 25 ans</div>
    </div>
  </div>
  <div class="section-bg" style="margin-top:12px;">
    <div style="font-size:11px;font-weight:800;color:#0f172a;margin-bottom:12px;">Pourquoi c'est rentable dès maintenant</div>
    <ul class="check-list">
      <li>Valorisation immédiate de votre bien immobilier (+5 à 10%)</li>
      <li>Protection totale contre les hausses du prix de l'électricité EDF</li>
      <li>Production garantie 25 ans avec performance minimale assurée</li>
      <li>Indépendance énergétique grâce au stockage {batterie_kwh} kWh</li>
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
      <tbody>{lignes_roi}</tbody>
    </table>
  </div>
  <div class="footer-page">
    <span class="footer-text">Simulation indicative — Production réelle variable selon conditions locales · Réf. {ref_dossier}</span>
  </div>
</div>

<!-- PAGE 3 -->
<div class="page">
  <h2>Votre Équipement Premium</h2>
  <div style="margin-bottom:12px;padding:20px;background:#f8fafc;border-radius:12px;border-left:4px solid #0f172a;">
    <div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:6px;">Panneaux Solaires Haute Performance</div>
    <div style="font-size:10px;color:#64748b;margin-bottom:6px;">{nb_modules} modules × {panneau_wc} Wc — Puissance totale {puissance_kwc} kWc</div>
    <ul class="check-list">
      <li>Rendement optimal en conditions tropicales (chaleur, humidité)</li>
      <li>Résistance certifiée aux vents cycloniques — Structure Novotegra</li>
      <li>Garantie constructeur 10 ans pièces + 25 ans performance</li>
    </ul>
  </div>
  <div style="margin-bottom:12px;padding:20px;background:#f8fafc;border-radius:12px;border-left:4px solid #10b981;">
    <div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:6px;">Système de Pilotage Intelligent</div>
    <div style="font-size:10px;color:#64748b;margin-bottom:6px;">{onduleur} — Optimisation en temps réel</div>
    <ul class="check-list">
      <li>Monitoring 24h/24 via application smartphone</li>
      <li>Optimisation automatique de l'autoconsommation</li>
      <li>Alertes instantanées en cas d'anomalie</li>
    </ul>
  </div>
  <div style="margin-bottom:12px;padding:20px;background:#f8fafc;border-radius:12px;border-left:4px solid #f97316;">
    <div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:6px;">Batterie Nouvelle Génération</div>
    <div style="font-size:10px;color:#64748b;margin-bottom:6px;">{batterie_kwh} kWh utile — Technologie LFP</div>
    <ul class="check-list">
      <li>Énergie solaire disponible même la nuit et par temps nuageux</li>
      <li>Mode secours automatique en cas de coupure EDF</li>
      <li>6000 cycles de vie garantis — durée de vie 15 à 20 ans</li>
    </ul>
  </div>
  <div style="padding:16px;background:#f0fdf4;border-radius:12px;border:1px solid #10b981;">
    <div style="font-size:10px;font-weight:700;color:#0f172a;margin-bottom:8px;">Analyse de votre toiture</div>
    <div>{pans_html}</div>
  </div>
  <div class="footer-page">
    <span class="footer-text">C2BAT ELEC · Réf. {ref_dossier} · {date_str}</span>
  </div>
</div>

<!-- PAGE 4 -->
<div class="page">
  <h2>Simulation de Production Solaire</h2>
  <div class="kpi-row">
    <div class="kpi" style="border-right:1px solid #f1f5f9;">
      <div class="kpi-val green">{production_annuelle:,}</div>
      <div style="font-size:9px;color:#10b981;font-weight:700;">kWh / an</div>
      <div class="kpi-label">Production annuelle</div>
    </div>
    <div class="kpi">
      <div class="kpi-val orange">{taux_autonomie}%</div>
      <div class="kpi-label">Taux d'autonomie estimé</div>
    </div>
  </div>
  <div style="padding:20px;background:#f8fafc;border-radius:12px;margin:12px 0;">
    <div style="font-size:10px;font-weight:700;color:#0f172a;margin-bottom:12px;">Production mensuelle estimée (kWh)</div>
    <div style="text-align:center;height:130px;display:table;width:100%;">
      <div style="display:table-cell;vertical-align:bottom;padding-bottom:16px;">
        {barres}
      </div>
    </div>
  </div>
  <div class="section-bg">
    <div style="display:table;width:100%;">
      <div style="display:table-cell;width:50%;padding-right:10px;">
        <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Données source</div>
        <div style="font-size:9px;color:#1e293b;">Irradiation La Réunion : {irradiation} kWh/kWc/an</div>
        <div style="font-size:9px;color:#1e293b;">Performance système : {round(pertes * 100)}%</div>
      </div>
      <div style="display:table-cell;width:50%;padding-left:10px;border-left:1px solid #f1f5f9;">
        <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Bilan énergétique</div>
        <div style="font-size:9px;color:#1e293b;">Autoconsommée : {round(production_annuelle * taux_autoconso):,} kWh</div>
        <div style="font-size:9px;color:#1e293b;">Vendue EDF : {round(production_annuelle * (1 - taux_autoconso)):,} kWh</div>
        <div style="font-size:9px;color:#10b981;font-weight:700;">Gain total : {gain_annuel:,.0f} €/an</div>
      </div>
    </div>
  </div>
  <div class="footer-page">
    <span class="footer-text">Simulation basée sur données PVGIS · Valeurs indicatives · Réf. {ref_dossier}</span>
  </div>
</div>

<!-- PAGE 5 -->
<div class="page">
  <h2>Financement &amp; Aides Disponibles</h2>
  <div class="card-row" style="margin-bottom:16px;">
    <div class="card">
      <div class="card-inner" style="background:#f0fdf4;border:2px solid #10b981;border-radius:12px;">
        <div style="font-size:9px;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Prime S24 — Autoconsommation</div>
        <div style="font-size:32px;font-weight:900;color:#0f172a;">-{prime_s24:,.0f} €</div>
        <div style="font-size:9px;color:#64748b;margin-top:8px;">{prime_s24_eur_wc} €/Wc · Versée en une fois</div>
        {aide_s24_badge}
      </div>
    </div>
    <div class="card">
      <div class="card-inner" style="background:#eef2ff;border:2px solid #6366f1;border-radius:12px;">
        <div style="font-size:9px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Kap PV — Région Réunion + Europe</div>
        <div style="font-size:32px;font-weight:900;color:#0f172a;">-{kap_aide:,.0f} €</div>
        <div style="font-size:9px;color:#64748b;margin-top:8px;">Subvention FEDER · Cofinancé Europe</div>
        {aide_kap_badge}
      </div>
    </div>
  </div>
  <div style="background:#fff7ed;border:2px solid #f97316;border-radius:12px;padding:20px;text-align:center;margin-top:8px;">
    <div style="font-size:10px;color:#f97316;font-weight:700;text-transform:uppercase;margin-bottom:8px;">Votre investissement final</div>
    <div style="font-size:48px;font-weight:900;color:#0f172a;">{net_a_payer:,.0f} €</div>
    <div style="font-size:10px;color:#64748b;margin-top:6px;">TTC · Clé en main · Aide {aide_label} déduite</div>
  </div>
  <div class="footer-page">
    <span class="footer-text">Prime S24 et Kap PV non cumulables · Réf. {ref_dossier}</span>
  </div>
</div>

<!-- PAGE 6 -->
<div class="page">
  <h2>Sérénité &amp; Garanties Totales</h2>
  <div class="badge-row">
    <div class="badge"><div class="badge-inner"><div class="badge-val green">25 ans</div><div class="badge-label">Garantie performance modules</div></div></div>
    <div class="badge"><div class="badge-inner"><div class="badge-val orange">85%</div><div class="badge-label">Performance min. à 25 ans</div></div></div>
    <div class="badge"><div class="badge-inner"><div class="badge-val">10 ans</div><div class="badge-label">Garantie matériel modules</div></div></div>
    <div class="badge"><div class="badge-inner"><div class="badge-val">2 ans</div><div class="badge-label">Garantie installateur</div></div></div>
  </div>
  <div class="section-bg" style="margin-top:8px;">
    <div style="font-size:11px;font-weight:800;color:#0f172a;margin-bottom:12px;">Certifications &amp; Qualifications</div>
    <div style="display:table;width:100%;">
      <div style="display:table-cell;width:25%;text-align:center;padding:10px;"><div style="background:#0f172a;color:#ffffff;padding:10px;border-radius:8px;font-size:9px;font-weight:700;">RGE<br/>QualiPV</div></div>
      <div style="display:table-cell;width:25%;text-align:center;padding:10px;"><div style="background:#10b981;color:#ffffff;padding:10px;border-radius:8px;font-size:9px;font-weight:700;">Partenaire<br/>Kap PV</div></div>
      <div style="display:table-cell;width:25%;text-align:center;padding:10px;"><div style="background:#f97316;color:#ffffff;padding:10px;border-radius:8px;font-size:9px;font-weight:700;">Assurance<br/>Décennale</div></div>
      <div style="display:table-cell;width:25%;text-align:center;padding:10px;"><div style="background:#6366f1;color:#ffffff;padding:10px;border-radius:8px;font-size:9px;font-weight:700;">FEDER<br/>Europe</div></div>
    </div>
  </div>
  <div class="footer-page">
    <span class="footer-text">C2BAT ELEC · La Réunion · Réf. {ref_dossier}</span>
  </div>
</div>

<!-- PAGE 7 -->
<div class="page" style="page-break-after:auto;">
  <h2>Validation du Projet</h2>
  <div style="text-align:center;padding:20px;background:#f8fafc;border-radius:12px;margin-bottom:20px;">
    <div style="font-size:10px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase;">Récapitulatif de l'offre</div>
    <div style="font-size:16px;font-weight:900;color:#0f172a;">{nom_kit} — {puissance_kwc} kWc</div>
    <div style="font-size:12px;color:#64748b;margin-top:4px;">{nb_modules} modules · {batterie_kwh} kWh · {onduleur}</div>
    <div style="font-size:22px;font-weight:900;color:#10b981;margin-top:8px;">Net à payer : {net_a_payer:,.0f} €</div>
    <div style="font-size:10px;color:#64748b;">après aide {aide_label} de {aide_montant:,.0f} €</div>
  </div>
  <div style="display:table;width:100%;margin-bottom:20px;">
    <div class="sign-box">
      <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:8px;">Le Professionnel</div>
      <div class="sign-inner">
        <div style="font-size:9px;color:#94a3b8;">C2BAT ELEC</div>
        <div style="font-size:9px;color:#94a3b8;margin-top:4px;">Date : {date_str}</div>
      </div>
    </div>
    <div class="sign-box">
      <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:8px;">Le Client — Mention « Bon pour accord »</div>
      <div class="sign-inner">
        <div style="font-size:9px;color:#94a3b8;">{prenom} {nom_client}</div>
        <div style="font-size:9px;color:#94a3b8;margin-top:4px;">Date : _____ / _____ / _________</div>
        <div style="margin-top:20px;font-size:8px;color:#cbd5e1;">Signature :</div>
      </div>
    </div>
  </div>
  <div style="padding:12px;background:#fef2f2;border-radius:8px;border:1px solid #fecaca;margin-bottom:10px;">
    <div style="font-size:8px;color:#991b1b;font-weight:700;margin-bottom:4px;">Mentions légales obligatoires</div>
    <div style="font-size:7.5px;color:#7f1d1d;line-height:1.5;">
      Vous disposez d'un délai de rétractation de 14 jours calendaires à compter de la signature.
      Prime S24 et aide Kap PV non cumulables. Offre valable 30 jours à compter du {date_str}.
    </div>
  </div>
  <div class="footer-page" style="position:relative;">
    <div style="height:3px;background:linear-gradient(to right,#0f172a,#10b981);border-radius:2px;margin-bottom:8px;"></div>
    <span class="footer-text">C2BAT ELEC · La Réunion · Partenaire certifié Kap PV · Réf. {ref_dossier}</span>
  </div>
</div>

</body>
</html>"""


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python generate_proposition.py <data.json>", file=sys.stderr)
        sys.exit(1)

    json_path = sys.argv[1]
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    html = generer_html(data)
    pdf_bytes = HTML(string=html).write_pdf()
    sys.stdout.buffer.write(pdf_bytes)
