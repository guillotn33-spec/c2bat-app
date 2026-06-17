"""
C2BAT ELEC — Génération PDF proposition photovoltaïque — V3
Thème sombre intégral, structure en 3 blocs numérotés, 2 pages denses et harmonisées.
Usage : python3 generate_proposition_html.py [input.json] [output.pdf]
"""

import json
import sys
from playwright.sync_api import sync_playwright

# Force UTF-8 sur stdout/stderr — évite UnicodeEncodeError sur Windows (cp1252 par défaut)
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

# ════════════════════════════════════════════════════════════════════════════
# DESIGN SYSTEM
# ════════════════════════════════════════════════════════════════════════════
SP = {"xs": 4, "sm": 8, "md": 12, "lg": 16, "xl": 20, "xxl": 28}
FS = {"xs": 9, "sm": 10.5, "base": 12, "md": 14, "lg": 18, "xl": 24, "xxl": 30}

COL = {
    "bg":      "#0b1220",   # fond de page principal (un seul ton sombre, pas de dégradé violent)
    "panel":   "#121b2d",   # cartes / panneaux légèrement plus clairs que le fond
    "panel2":  "#0e1726",   # variante panneau (tableaux, alternance de lignes)
    "border":  "#22304a",   # bordures discrètes
    "cyan":    "#22d3ee",   # accent 1 — investissement / data
    "green":   "#a3e635",   # accent 2 — économie / validé / positif
    "yellow":  "#facc15",   # accent 3 — alerte douce / ROI / icônes
    "red":     "#f87171",   # négatif
    "ink":     "#eef2f7",   # texte principal (presque blanc)
    "muted":   "#7c8aa3",   # texte secondaire
    "white":   "#ffffff",
}

PAGE_PAD = 36
SECTION_GAP = SP["xxl"]


# ════════════════════════════════════════════════════════════════════════════
# DONNÉES PAR DÉFAUT
# ════════════════════════════════════════════════════════════════════════════
DEFAULT_DATA = {
    "ref": "C2B-752992",
    "date": "16 juin 2026",
    "client_nom": "Nicolas GUILLOT",
    "client_ville": "Saint-Leu, La Réunion",
    "puissance_kwc": 2.93,
    "modules": 5,
    "module_wc": 585,
    "batterie_kwh": 9.98,
    "onduleur": "ESI 3K-S1",
    "prix_ttc": 12496.70,
    "aide_kap": 6000,
    "economie_annuelle": 807,
    "production_annuelle": 3964,
    "irradiation": 1650,
    "performance": 82,
    "pertes": 18,
    "production_mensuelle": [271, 287, 314, 337, 356, 363, 370, 363, 347, 320, 290, 264],
    "azimut": "324°",
    "inclinaison": "20°",
    "surface": "50 m²",
    "phone": "0693 88 23 17",
    "prix_kwh_edf": 0.18,
    "consommation_annuelle_edf": None,
}


# ════════════════════════════════════════════════════════════════════════════
# CALCULS DÉRIVÉS
# ════════════════════════════════════════════════════════════════════════════
def compute_derived(d):
    prod = d["production_annuelle"]
    conso = d.get("consommation_annuelle_edf")
    prix_kwh = d.get("prix_kwh_edf", 0.18)
    has_real_conso = conso is not None and conso > 0

    if has_real_conso:
        autoconsommee = min(prod * 0.65, conso)
        vendue = max(prod - autoconsommee, 0)
        taux_autonomie = round(min(100, (autoconsommee / conso) * 100))
        facture_avant = round(conso * prix_kwh)
        economie_autoconso = round(autoconsommee * prix_kwh)
        economie_vente = round(vendue * 0.10)
        economie_annuelle = economie_autoconso + economie_vente
        facture_apres = max(facture_avant - economie_annuelle, 0)
        reduction_pct = round((economie_annuelle / facture_avant) * 100) if facture_avant else 0
    else:
        autoconsommee = round(prod * 0.65)
        vendue = prod - autoconsommee
        taux_autonomie = 65
        tarif_surplus = d.get("tarif_surplus_edf", 0.10)
        economie_annuelle = round(autoconsommee * prix_kwh) + round(vendue * tarif_surplus)
        facture_avant = None
        facture_apres = None
        reduction_pct = 70

    prix_net = d["prix_ttc"] - d["aide_kap"]
    gain_25ans = economie_annuelle * 25 - prix_net
    roi_ans = 0
    if economie_annuelle:
        cumul = 0
        for yr in range(1, 51):
            cumul += economie_annuelle
            if cumul >= prix_net:
                roi_ans = yr
                break

    return {
        **d,
        "has_real_conso": has_real_conso,
        "autoconsommee": round(autoconsommee),
        "vendue": round(vendue),
        "taux_autonomie": taux_autonomie,
        "economie_annuelle": round(economie_annuelle),
        "facture_avant": facture_avant,
        "facture_apres": facture_apres,
        "reduction_pct": reduction_pct,
        "prix_net": prix_net,
        "gain_25ans": round(gain_25ans),
        "roi_ans": roi_ans,
    }


def fmt_eur(v, decimals=0):
    s = f"{v:,.{decimals}f}".replace(",", " ").replace(".", ",")
    return f"{s} €"


def fmt_int(v):
    return f"{v:,.0f}".replace(",", " ")


def orientation_label(azimut_str):
    """Convertit un azimut (ex: '180°') en label cardinal pour affichage."""
    if not azimut_str:
        return ""
    try:
        deg = float(str(azimut_str).replace("°", "").strip())
    except (ValueError, TypeError):
        return ""
    dirs = ["Nord", "Nord-Est", "Est", "Sud-Est", "Sud", "Sud-Ouest", "Ouest", "Nord-Ouest"]
    idx = round(deg / 45) % 8
    return dirs[idx]


# ════════════════════════════════════════════════════════════════════════════
# GRAPHIQUE PRODUCTION — barres verticales sur fond sombre, légende haute/basse saison
# ════════════════════════════════════════════════════════════════════════════
def chart_prod_svg(prod, width=815, height=205):
    months = ['Jan','Fév','Mar','Avr','Mai','Jui','Jul','Aoû','Sep','Oct','Nov','Déc']
    avg = sum(prod) / len(prod)
    pad_l, pad_r, pad_b, pad_t = 8, 8, 24, 14
    cw, ch = width - pad_l - pad_r, height - pad_b - pad_t
    bw = cw / len(prod)
    vmin, vmax = 200, max(prod) * 1.12

    s = [f'<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">']
    for i, v in enumerate(prod):
        x = pad_l + i * bw + bw * 0.16
        w2 = bw * 0.68
        bh = (v - vmin) / (vmax - vmin) * ch
        y = pad_t + ch - bh
        color = COL["cyan"] if v >= avg else "#3a4a66"
        s.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w2:.1f}" height="{bh:.1f}" rx="3" fill="{color}"/>')
        s.append(f'<text x="{x+w2/2:.1f}" y="{y-7:.1f}" font-size="10.5" fill="{COL["ink"]}" font-weight="600" text-anchor="middle" font-family="Inter,sans-serif">{v}</text>')
        s.append(f'<text x="{x+w2/2:.1f}" y="{pad_t+ch+16:.1f}" font-size="9.5" fill="{COL["muted"]}" text-anchor="middle" font-family="Inter,sans-serif">{months[i]}</text>')
    s.append('</svg>')
    return ''.join(s)


def chart_finance_rows_svg():
    pass  # remplacé par HTML direct, gardé pour extension future


# ════════════════════════════════════════════════════════════════════════════
# CSS
# ════════════════════════════════════════════════════════════════════════════
def build_css():
    return f"""
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:'Inter',sans-serif;background:{COL["bg"]};color:{COL["ink"]};
  -webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:{FS["base"]}px;line-height:1.5}}

.page{{page-break-after:always;background:{COL["bg"]};padding:{PAGE_PAD}px {PAGE_PAD}px;
  min-height:1085px;position:relative;display:flex;flex-direction:column}}
.page:last-child{{page-break-after:avoid}}
.page::before{{content:'';position:absolute;top:0;left:0;right:0;height:90px;
  background:linear-gradient(180deg,#16223a 0%,rgba(22,34,58,0) 100%);pointer-events:none;z-index:0}}

/* ── Header ── */
.topbar{{display:flex;justify-content:space-between;align-items:center;margin-bottom:{SP["xl"]}px;
  position:relative;z-index:1}}
.logo{{display:flex;align-items:center;gap:{SP["sm"]}px;font-size:{FS["lg"]}px;font-weight:700;color:{COL["white"]}}}
.logo .accent{{color:{COL["cyan"]}}}
.logo-sub{{font-size:{FS["xs"]}px;color:{COL["muted"]};font-weight:500;letter-spacing:1px}}
.topbar-right{{display:flex;align-items:center;gap:{SP["md"]}px}}
.ref{{font-size:{FS["sm"]}px;color:{COL["muted"]}}}
.status-pill{{font-size:{FS["xs"]}px;font-weight:700;color:{COL["green"]};border:1px solid {COL["green"]};
  padding:5px {SP["md"]}px;border-radius:20px;letter-spacing:0.4px}}

.kicker{{font-size:{FS["xs"]}px;letter-spacing:1.4px;text-transform:uppercase;color:{COL["green"]};
  font-weight:700;margin-bottom:{SP["sm"]}px}}
.h1{{font-size:{FS["xxl"]}px;font-weight:700;color:{COL["white"]};margin-bottom:{SP["sm"]}px;line-height:1.15}}
.h1-sub{{font-size:{FS["base"]}px;color:{COL["muted"]};margin-bottom:{SP["xl"]}px}}
.h1-sub strong{{color:{COL["ink"]};font-weight:600}}

/* ── KPI cards (en haut, 3 colonnes, accent = couleur de bordure) ── */
.kpi-row{{display:grid;grid-template-columns:1fr 1fr 1fr;gap:{SP["md"]}px;margin-bottom:{SP["xxl"]}px}}
.kpi{{background:{COL["panel"]};border:1.5px solid {COL["border"]};border-radius:10px;padding:{SP["lg"]}px}}
.kpi.cyan{{border-color:{COL["cyan"]}}}
.kpi.green{{border-color:{COL["green"]}}}
.kpi-label{{font-size:{FS["xs"]}px;letter-spacing:0.6px;text-transform:uppercase;color:{COL["muted"]};
  margin-bottom:{SP["sm"]}px;font-weight:600}}
.kpi-val{{font-size:{FS["xl"]}px;font-weight:700;margin-bottom:3px}}
.kpi-val.cyan{{color:{COL["cyan"]}}}
.kpi-val.green{{color:{COL["green"]}}}
.kpi-val span{{font-size:{FS["base"]}px;font-weight:500;color:{COL["muted"]}}}
.kpi-sub{{font-size:{FS["xs"]}px;color:{COL["muted"]}}}

/* ── Section header (numéroté, barre verte) ── */
.sec-title{{display:flex;align-items:center;gap:{SP["sm"]}px;font-size:{FS["md"]}px;font-weight:700;
  color:{COL["white"]};margin-bottom:{SP["lg"]}px;letter-spacing:0.3px}}
.sec-title::before{{content:'';width:4px;height:20px;background:{COL["green"]};border-radius:2px;flex-shrink:0}}

/* ── Panel générique ── */
.panel{{background:{COL["panel"]};border:1px solid {COL["border"]};border-radius:10px;padding:{SP["lg"]}px}}
.panel-row{{display:grid;gap:{SP["md"]}px}}
.cols-2{{grid-template-columns:1fr 1fr}}
.cols-4{{grid-template-columns:1fr 1fr 1fr 1fr}}

.data-line{{display:flex;justify-content:space-between;align-items:baseline;padding:{SP["sm"]+2}px 0;
  border-bottom:1px solid {COL["border"]}}}
.data-line:last-child{{border-bottom:none}}
.data-line .lbl{{font-size:{FS["base"]}px;color:{COL["muted"]}}}
.data-line .val{{font-size:{FS["md"]}px;font-weight:700;color:{COL["ink"]}}}
.data-line .val.cyan{{color:{COL["cyan"]}}}
.data-line .val.strong{{font-size:{FS["lg"]}px}}

.note-box{{background:{COL["panel2"]};border:1px solid {COL["border"]};border-radius:8px;padding:{SP["md"]}px;
  font-size:{FS["sm"]}px;color:{COL["muted"]};line-height:1.6;margin-top:{SP["md"]}px}}
.note-box strong{{color:{COL["ink"]}}}

/* ── Légende graphique ── */
.legend{{display:flex;gap:{SP["lg"]}px;font-size:{FS["xs"]}px;color:{COL["muted"]};margin-bottom:{SP["sm"]}px}}
.legend span{{display:flex;align-items:center;gap:5px}}
.dot{{width:9px;height:9px;border-radius:2px;display:inline-block}}

/* ── Footer panels (système global / certification) ── */
.foot-row{{display:grid;grid-template-columns:1fr 1fr;gap:{SP["md"]}px;margin-top:auto}}
.foot-panel{{background:{COL["panel"]};border:1px solid {COL["border"]};border-radius:10px;
  padding:{SP["lg"]}px}}
.foot-label{{font-size:{FS["xs"]}px;letter-spacing:0.6px;text-transform:uppercase;color:{COL["muted"]};
  margin-bottom:{SP["sm"]}px;font-weight:600}}
.foot-val{{font-size:{FS["md"]}px;font-weight:700;color:{COL["white"]}}}
.cert-pill{{display:inline-block;font-size:{FS["xs"]}px;font-weight:700;color:{COL["green"]};
  border:1px solid {COL["green"]};padding:3px {SP["md"]}px;border-radius:20px;margin-left:{SP["sm"]}px}}

.page-num{{position:absolute;bottom:{SP["lg"]}px;right:{PAGE_PAD}px;font-size:{FS["xs"]}px;color:{COL["muted"]}}}

/* ── Page 2 : composants ── */
.comp-row{{display:flex;align-items:flex-start;gap:{SP["lg"]}px;padding:{SP["md"]}px 0;
  border-bottom:1px solid {COL["border"]}}}
.comp-row:last-child{{border-bottom:none}}
.comp-icon{{font-size:18px;flex-shrink:0;width:24px;text-align:center}}
.comp-tag{{font-size:{FS["base"]}px;font-weight:700;margin-bottom:2px}}
.comp-tag.cyan{{color:{COL["cyan"]}}}
.comp-tag.green{{color:{COL["green"]}}}
.comp-tag.red{{color:{COL["red"]}}}
.comp-tag.yellow{{color:{COL["yellow"]}}}
.comp-desc{{font-size:{FS["sm"]}px;color:{COL["muted"]};line-height:1.5}}
.comp-desc strong{{color:{COL["ink"]}}}

.gar-row{{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:{SP["md"]}px}}
.gar-card{{background:{COL["panel"]};border:1px solid {COL["border"]};border-radius:10px;
  padding:{SP["md"]}px;text-align:center}}
.gar-val{{font-size:{FS["lg"]}px;font-weight:700;color:{COL["green"]};margin-bottom:2px}}
.gar-label{{font-size:{FS["xs"]}px;color:{COL["muted"]}}}

/* ── Tableau financier ── */
.fin-table{{width:100%;border-collapse:collapse;font-size:{FS["base"]}px}}
.fin-table th{{font-size:{FS["xs"]}px;letter-spacing:0.5px;text-transform:uppercase;color:{COL["muted"]};
  text-align:left;padding:{SP["sm"]}px 0;border-bottom:1px solid {COL["border"]};font-weight:600}}
.fin-table th:last-child{{text-align:right}}
.fin-table td{{padding:{SP["md"]}px 0;border-bottom:1px solid {COL["border"]};vertical-align:top}}
.fin-table td:last-child{{text-align:right;font-weight:700}}
.fin-table tr.total td{{font-weight:700;font-size:{FS["md"]}px;color:{COL["cyan"]};
  border-top:1.5px solid {COL["cyan"]};border-bottom:1.5px solid {COL["cyan"]}}}
.fin-table tr.milestone td{{color:{COL["yellow"]}}}
.fin-table td.neg{{color:{COL["red"]}}}
.fin-table td.pos{{color:{COL["green"]}}}
.fin-table .ico{{margin-right:6px}}

/* ── Signature ── */
.sign-row{{display:grid;grid-template-columns:1fr 1fr;gap:{SP["md"]}px;margin-top:{SP["xl"]}px}}
.sign-box{{border:1px solid {COL["border"]};border-radius:10px;padding:{SP["lg"]}px;min-height:96px}}
.sign-box.client{{border-color:{COL["green"]}}}
.sign-role{{font-size:{FS["xs"]}px;color:{COL["muted"]};letter-spacing:0.5px;margin-bottom:{SP["sm"]}px}}
.sign-role.green{{color:{COL["green"]}}}
.sign-name{{font-size:{FS["md"]}px;font-weight:700;color:{COL["white"]};margin-bottom:{SP["sm"]}px}}
.sign-status{{font-size:{FS["xs"]}px;color:{COL["muted"]};font-style:italic}}

.mentions{{font-size:{FS["xs"]}px;color:#5a6680;line-height:1.7;margin-top:{SP["xl"]}px}}
.mentions strong{{color:{COL["muted"]}}}
"""


# ════════════════════════════════════════════════════════════════════════════
# CONSTRUCTION HTML
# ════════════════════════════════════════════════════════════════════════════
def build_html(raw_data):
    d = compute_derived(raw_data)
    prod_svg = chart_prod_svg(d["production_mensuelle"])
    css = build_css()
    orientation = orientation_label(d.get("azimut"))

    avg = sum(d["production_mensuelle"]) / len(d["production_mensuelle"])

    # ── Tableau financier — lignes ──
    fin_rows = f"""
      <tr>
        <td>Architecture Matérielle &amp; Pose Clé en Main <span style="color:{COL['muted']};font-weight:400">(Raccordement CONSUEL inclus)</span></td>
        <td>{fmt_eur(d['prix_ttc'], 2)}</td>
      </tr>
      <tr>
        <td style="color:{COL['green']}">Subvention Régionale &amp; Européenne KAP PV <span style="color:{COL['muted']};font-weight:400">(Gestion directe C2BAT)</span></td>
        <td class="pos">−{fmt_eur(d['aide_kap'], 2)}</td>
      </tr>
      <tr class="total">
        <td>Votre investissement net final</td>
        <td>{fmt_eur(d['prix_net'], 2)}</td>
      </tr>
      <tr>
        <td><span class="ico">📉</span>Cumul Année 1 : Économie de {fmt_eur(d['economie_annuelle'])}</td>
        <td class="neg">Solde : −{fmt_eur(d['prix_net'] - d['economie_annuelle'])}</td>
      </tr>
      <tr class="milestone">
        <td><span class="ico">⚡</span>Année {d['roi_ans']} : Seuil de Rentabilité atteint (ROI)</td>
        <td>Solde : {fmt_eur(d['roi_ans']*d['economie_annuelle'] - d['prix_net'])}</td>
      </tr>
      <tr>
        <td><span class="ico">☀️</span>Cumul Année 25 : Gains totaux de {fmt_eur(d['economie_annuelle']*25)}</td>
        <td class="pos">Bénéfice net : +{fmt_eur(d['gain_25ans'])}</td>
      </tr>
    """

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Proposition PV — {d['client_nom']}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>{css}</style>
</head>
<body>

<!-- ═══ PAGE 1 ═══ -->
<div class="page">
  <div class="topbar">
    <div>
      <div class="logo"><span>C2BAT</span><span class="accent">ELEC</span></div>
      <div class="logo-sub">ÉTUDE SOLAIRE ACTIVE</div>
    </div>
    <div class="topbar-right">
      <span class="ref">Réf : {d['ref']}</span>
      <span class="status-pill">● ÉTUDE SOLAIRE ACTIVE</span>
    </div>
  </div>

  <div class="kicker">PROPOSITION ÉMISE LE {d['date'].upper()}</div>
  <div class="h1">Votre centrale solaire avec stockage intelligent</div>
  <div class="h1-sub">Configuration sur-mesure pour <strong>{d['client_nom']}</strong> — {d['client_ville']}</div>

  <div class="kpi-row">
    <div class="kpi cyan">
      <div class="kpi-label">Investissement net</div>
      <div class="kpi-val cyan">{fmt_eur(d['prix_net'])}</div>
      <div class="kpi-sub">Clé en main, aides KAP PV déduites</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Économie annuelle</div>
      <div class="kpi-val">{fmt_eur(d['economie_annuelle'])}<span>/an</span></div>
      <div class="kpi-sub">Générée dès la mise en service</div>
    </div>
    <div class="kpi green">
      <div class="kpi-label">Autonomie estimée</div>
      <div class="kpi-val green">{d['taux_autonomie']} %</div>
      <div class="kpi-sub">Couverture de vos besoins réels</div>
    </div>
  </div>

  <div class="sec-title">1. ANALYSE D'IMPLANTATION &amp; DONNÉES PVGIS</div>

  <div class="panel-row cols-2" style="margin-bottom:{SP['lg']}px">
    <div class="panel">
      <div class="data-line"><span class="lbl">Irradiation locale</span><span class="val">{d['irradiation']} kWh/kWc/an</span></div>
      <div class="data-line"><span class="lbl">Performance système</span><span class="val">{d['performance']} % <span style="color:{COL['muted']};font-weight:500">(Pertes {d['pertes']}%)</span></span></div>
      <div class="data-line"><span class="lbl">Productible Final Estimé</span><span class="val cyan strong">{fmt_int(d['production_annuelle'])} kWh/an</span></div>
      <div class="note-box">
        <strong>Orientation :</strong> Azimut {d['azimut']} ({orientation}) / Inclinaison {d['inclinaison']}<br>
        <strong>Surface utile :</strong> ~{d['surface']} de toiture analysée
      </div>
    </div>
    <div class="panel" style="display:flex;flex-direction:column;justify-content:center;align-items:center;gap:{SP['md']}px">
      <div style="font-size:{FS['xs']}px;color:{COL['muted']};letter-spacing:0.5px;text-transform:uppercase">Position GPS analysée</div>
      <div style="width:64px;height:64px;border-radius:50%;background:radial-gradient(circle,{COL['green']}55,transparent 70%);
        display:flex;align-items:center;justify-content:center">
        <div style="width:14px;height:14px;border-radius:50%;background:{COL['green']};box-shadow:0 0 16px {COL['green']}"></div>
      </div>
      <div style="font-size:{FS['sm']}px;color:{COL['muted']}">Toiture orientée {orientation}</div>
    </div>
  </div>

  <div class="panel" style="margin-bottom:{SP['lg']}px">
    <div class="sec-title" style="font-size:{FS['base']}px;margin-bottom:{SP['md']}px">
      FLUX DE PRODUCTION MENSUEL VS ENSOLEILLEMENT
    </div>
    <div class="legend">
      <span><span class="dot" style="background:{COL['cyan']}"></span>Haute saison</span>
      <span><span class="dot" style="background:#3a4a66"></span>Basse saison</span>
    </div>
    <div style="position:relative;width:100%;height:205px">{prod_svg}</div>
  </div>

  <div class="foot-row">
    <div class="foot-panel">
      <div class="foot-label">Système global</div>
      <div class="foot-val">Puissance : {d['puissance_kwc']} kWc &nbsp;|&nbsp; Batterie : {d['batterie_kwh']} kWh</div>
    </div>
    <div class="foot-panel">
      <div class="foot-label">Entreprise certifiée</div>
      <div class="foot-val">C2BAT ELEC <span class="cert-pill">RGE QualiPV</span></div>
    </div>
  </div>

  <div class="page-num">Page 1 / 2</div>
</div>

<!-- ═══ PAGE 2 ═══ -->
<div class="page">
  <div class="topbar">
    <div class="logo"><span>C2BAT</span><span class="accent">ELEC</span></div>
    <span class="status-pill">PLAN TECHNIQUE VALIDÉ</span>
  </div>

  <div class="sec-title">2. COMPOSANTS PREMIUM ET GARANTIES</div>

  <div class="panel" style="margin-bottom:{SP['lg']}px">
    <div class="comp-row">
      <div class="comp-icon">☀️</div>
      <div>
        <div class="comp-tag cyan">{d['modules']} Panneaux</div>
        <div class="comp-desc"><strong>POLYCROWN {d['module_wc']} Wc</strong> (NS585MH144). Haute tolérance cyclonique (Norme IEC 61215).</div>
      </div>
    </div>
    <div class="comp-row">
      <div class="comp-icon">🔋</div>
      <div>
        <div class="comp-tag green">Stockage LFP</div>
        <div class="comp-desc"><strong>Batterie Lithium-Fer-Phosphate {d['batterie_kwh']} kWh</strong> (6 000 cycles, secours d'urgence EDF inclus).</div>
      </div>
    </div>
    <div class="comp-row">
      <div class="comp-icon">🧠</div>
      <div>
        <div class="comp-tag red">Cœur Hybride</div>
        <div class="comp-desc"><strong>Onduleur SOFAR PowerAll {d['onduleur']}</strong>. Monitoring applicatif intelligent via WiFi.</div>
      </div>
    </div>
    <div class="comp-row">
      <div class="comp-icon">🏗️</div>
      <div>
        <div class="comp-tag yellow">Châssis DROM</div>
        <div class="comp-desc">Structure sur-toiture <strong>Novotegra</strong> en aluminium renforcé (Norme DTU 40.35).</div>
      </div>
    </div>
  </div>

  <div class="gar-row" style="margin-bottom:{SP['xxl']}px">
    <div class="gar-card"><div class="gar-val">25 Ans</div><div class="gar-label">Garantie Prod.</div></div>
    <div class="gar-card"><div class="gar-val">10 Ans</div><div class="gar-label">Garantie Pièces</div></div>
    <div class="gar-card"><div class="gar-val">6 000</div><div class="gar-label">Cycles Batterie</div></div>
    <div class="gar-card"><div class="gar-val">48h</div><div class="gar-label">Délai S.A.V.</div></div>
  </div>

  <div class="sec-title">3. ÉTUDE FINANCIÈRE &amp; VENTILATION KAP PV</div>

  <div class="panel" style="margin-bottom:{SP['xl']}px">
    <table class="fin-table">
      <thead><tr><th>Poste budgétaire / Période prévisionnelle</th><th>Montant TTC / Flux</th></tr></thead>
      <tbody>{fin_rows}</tbody>
    </table>
  </div>

  <div class="sign-row">
    <div class="sign-box">
      <div class="sign-role">L'INSTALLATEUR</div>
      <div class="sign-name">C2BAT ELEC</div>
      <div class="sign-status">Validé par signature numérique RGE QualiPV.</div>
    </div>
    <div class="sign-box client">
      <div class="sign-role green">LE CLIENT (BON POUR ACCORD)</div>
      <div class="sign-name">{d['client_nom']}</div>
    </div>
  </div>

  <div class="mentions">
    <strong>Clauses contractuelles :</strong> Délai de rétractation de 14 jours (art. L221-18 du Code de la Consommation).
    Proposition conditionnée à la validation finale du dossier de subvention KAP PV par la Région Réunion et le FEDER.
    Offre commerciale ferme et valable durant 30 jours à compter du {d['date']}.
  </div>

  <div class="page-num">Page 2 / 2</div>
</div>

</body>
</html>"""


# ════════════════════════════════════════════════════════════════════════════
# GÉNÉRATION PDF
# ════════════════════════════════════════════════════════════════════════════
def generate_pdf(output_path, data):
    html = build_html(data)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 900, "height": 1200})
        page.set_content(html, wait_until="load")
        page.wait_for_timeout(350)
        page.pdf(
            path=output_path, format="A4", print_background=True,
            margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
        )
        browser.close()
    print(f"✅ PDF généré : {output_path}")


if __name__ == "__main__":
    if len(sys.argv) >= 3:
        input_json, output_pdf = sys.argv[1], sys.argv[2]
        with open(input_json, "r", encoding="utf-8") as f:
            data = json.load(f)
        merged = {**DEFAULT_DATA, **data}
        generate_pdf(output_pdf, merged)
    elif len(sys.argv) == 1:
        generate_pdf("/mnt/user-data/outputs/proposition_v3.pdf", DEFAULT_DATA)
    else:
        print("Usage: python3 generate_proposition_html.py [input.json output.pdf]")
        sys.exit(1)
