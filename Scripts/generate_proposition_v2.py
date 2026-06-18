"""
C2BAT ELEC — Génération PDF proposition photovoltaïque — V2 (thème clair, 4 pages)
Usage : python3 generate_proposition_v2.py [input.json] [output.pdf]
"""

import json
import re
import sys
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

SP = {"xs": 4, "sm": 8, "md": 12, "lg": 16, "xl": 20, "xxl": 28}
FS = {"xs": 9, "sm": 10.5, "base": 12, "md": 14, "lg": 18, "xl": 24, "xxl": 30}

COL = {
    "bg":      "#f8fafc",
    "panel":   "#ffffff",
    "panel2":  "#f1f5f9",
    "border":  "#e2e8f0",
    "green":   "#059669",
    "green_l": "#d1fae5",
    "blue":    "#0ea5e9",
    "blue_l":  "#e0f2fe",
    "yellow":  "#d97706",
    "yellow_l": "#fef3c7",
    "red":     "#dc2626",
    "ink":     "#0f172a",
    "muted":   "#64748b",
    "white":   "#ffffff",
    "border_green": "#6ee7b7",
}

PAGE_PAD = 36
SECTION_GAP = SP["xxl"]


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
    "roof_map_base64": None,
}


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


def score_solaire(d):
    # NOTE : masque_ombrage est forcé à False tant que la visite technique
    # et la proposition commerciale ne partagent pas de base de données commune.
    masque_ombrage = False

    score = 0

    # Irradiation locale (30 pts max)
    irr = d.get("irradiation", 0)
    if irr >= 1700:
        score += 30
    elif irr >= 1600:
        score += 25
    elif irr >= 1500:
        score += 20
    elif irr >= 1400:
        score += 15
    else:
        score += 10

    # Performance système (20 pts max)
    perf = d.get("performance", 0)
    if perf >= 85:
        score += 20
    elif perf >= 80:
        score += 16
    elif perf >= 75:
        score += 12
    else:
        score += 8

    # Azimut — écart par rapport au plein sud (20 pts max)
    azimut_str = d.get("azimut", "")
    try:
        m = re.search(r'(\d+(?:\.\d+)?)', str(azimut_str))
        if not m:
            raise ValueError("no digits")
        deg = float(m.group(1))
        ecart = abs(deg - 180)
        if ecart > 180:
            ecart = 360 - ecart
        if ecart <= 15:
            score += 20
        elif ecart <= 30:
            score += 17
        elif ecart <= 60:
            score += 12
        elif ecart <= 90:
            score += 7
        else:
            score += 3
    except (ValueError, TypeError):
        score += 10

    # Taux d'autoconsommation (20 pts max)
    taux = d.get("taux_autonomie", 0)
    if taux >= 80:
        score += 20
    elif taux >= 65:
        score += 16
    elif taux >= 50:
        score += 12
    else:
        score += 8

    # Absence de masque d'ombrage (10 pts)
    if not masque_ombrage:
        score += 10

    return min(score, 100)


def fmt_eur(v, decimals=0):
    s = f"{v:,.{decimals}f}".replace(",", " ").replace(".", ",")
    return f"{s} €"


def fmt_int(v):
    return f"{v:,.0f}".replace(",", " ")


def orientation_label(azimut_str):
    if not azimut_str:
        return ""
    try:
        m = re.search(r'(\d+(?:\.\d+)?)', str(azimut_str))
        if not m:
            return ""
        deg = float(m.group(1))
    except (ValueError, TypeError):
        return ""
    dirs = ["Nord", "Nord-Est", "Est", "Sud-Est", "Sud", "Sud-Ouest", "Ouest", "Nord-Ouest"]
    idx = round(deg / 45) % 8
    return dirs[idx]


def score_label(score):
    if score >= 90:
        return "Excellent"
    elif score >= 75:
        return "Très bon"
    elif score >= 60:
        return "Bon"
    elif score >= 45:
        return "Correct"
    else:
        return "Moyen"


def chart_prod_svg(prod, width=815, height=200):
    months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jui', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
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
        color = COL["green"] if v >= avg else "#94a3b8"
        s.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w2:.1f}" height="{bh:.1f}" rx="3" fill="{color}"/>')
        s.append(f'<text x="{x+w2/2:.1f}" y="{y-6:.1f}" font-size="10" fill="{COL["ink"]}" font-weight="600" text-anchor="middle" font-family="Inter,sans-serif">{v}</text>')
        s.append(f'<text x="{x+w2/2:.1f}" y="{pad_t+ch+16:.1f}" font-size="9.5" fill="{COL["muted"]}" text-anchor="middle" font-family="Inter,sans-serif">{months[i]}</text>')
    s.append('</svg>')
    return ''.join(s)


def build_css():
    return f"""
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:'Inter',sans-serif;background:{COL["bg"]};color:{COL["ink"]};
  -webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:{FS["base"]}px;line-height:1.5}}

.page{{page-break-after:always;background:{COL["bg"]};padding:{PAGE_PAD}px;
  min-height:1085px;position:relative;display:flex;flex-direction:column}}
.page:last-child{{page-break-after:avoid}}

.topbar{{display:flex;justify-content:space-between;align-items:center;
  margin-bottom:{SP["xl"]}px;padding-bottom:{SP["md"]}px;border-bottom:2px solid {COL["border"]}}}
.logo{{font-size:{FS["lg"]}px;font-weight:800;color:{COL["ink"]}}}
.logo .accent{{color:{COL["green"]}}}
.logo-sub{{font-size:{FS["xs"]}px;color:{COL["muted"]};font-weight:500;letter-spacing:1px}}
.ref{{font-size:{FS["sm"]}px;color:{COL["muted"]}}}
.status-pill{{font-size:{FS["xs"]}px;font-weight:700;color:{COL["green"]};
  background:{COL["green_l"]};padding:5px {SP["md"]}px;border-radius:20px;letter-spacing:0.4px}}

.kicker{{font-size:{FS["xs"]}px;letter-spacing:1.4px;text-transform:uppercase;
  color:{COL["green"]};font-weight:700;margin-bottom:{SP["sm"]}px}}
.h1{{font-size:{FS["xxl"]}px;font-weight:800;color:{COL["ink"]};margin-bottom:{SP["sm"]}px;line-height:1.15}}
.h1-sub{{font-size:{FS["base"]}px;color:{COL["muted"]};margin-bottom:{SP["xl"]}px}}
.h1-sub strong{{color:{COL["ink"]};font-weight:600}}

.kpi-row{{display:grid;grid-template-columns:1fr 1fr 1fr;gap:{SP["md"]}px;margin-bottom:{SP["xxl"]}px}}
.kpi{{background:{COL["panel"]};border:1.5px solid {COL["border"]};border-radius:12px;padding:{SP["lg"]}px}}
.kpi.green{{border-color:{COL["green"]}}}
.kpi.blue{{border-color:{COL["blue"]}}}
.kpi-label{{font-size:{FS["xs"]}px;letter-spacing:0.6px;text-transform:uppercase;
  color:{COL["muted"]};margin-bottom:{SP["sm"]}px;font-weight:600}}
.kpi-val{{font-size:{FS["xl"]}px;font-weight:800;margin-bottom:3px;color:{COL["ink"]}}}
.kpi-val.green{{color:{COL["green"]}}}
.kpi-val.blue{{color:{COL["blue"]}}}
.kpi-val span{{font-size:{FS["base"]}px;font-weight:500;color:{COL["muted"]}}}
.kpi-sub{{font-size:{FS["xs"]}px;color:{COL["muted"]}}}

.score-box{{background:{COL["panel"]};border:2px solid {COL["green"]};border-radius:14px;
  padding:{SP["lg"]}px {SP["xl"]}px;display:flex;align-items:center;gap:{SP["xl"]}px;
  margin-bottom:{SP["xxl"]}px}}
.score-circle{{width:72px;height:72px;border-radius:50%;background:{COL["green_l"]};
  display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0}}
.score-num{{font-size:{FS["xxl"]}px;font-weight:800;color:{COL["green"]};line-height:1}}
.score-max{{font-size:{FS["sm"]}px;color:{COL["muted"]}}}
.score-title{{font-size:{FS["md"]}px;font-weight:700;color:{COL["ink"]}}}
.score-label{{font-size:{FS["base"]}px;color:{COL["green"]};font-weight:600;margin-bottom:4px}}
.score-bar-bg{{background:{COL["border"]};border-radius:4px;height:8px;margin-top:6px}}
.score-bar-fg{{background:{COL["green"]};border-radius:4px;height:8px}}

.sec-title{{display:flex;align-items:center;gap:{SP["sm"]}px;font-size:{FS["md"]}px;font-weight:700;
  color:{COL["ink"]};margin-bottom:{SP["lg"]}px;letter-spacing:0.3px}}
.sec-title::before{{content:'';width:4px;height:20px;background:{COL["green"]};
  border-radius:2px;flex-shrink:0}}

.panel{{background:{COL["panel"]};border:1px solid {COL["border"]};border-radius:12px;padding:{SP["lg"]}px}}
.panel-row{{display:grid;gap:{SP["md"]}px}}
.cols-2{{grid-template-columns:1fr 1fr}}

.data-line{{display:flex;justify-content:space-between;align-items:baseline;
  padding:{SP["sm"]+2}px 0;border-bottom:1px solid {COL["border"]}}}
.data-line:last-child{{border-bottom:none}}
.data-line .lbl{{font-size:{FS["base"]}px;color:{COL["muted"]}}}
.data-line .val{{font-size:{FS["md"]}px;font-weight:700;color:{COL["ink"]}}}
.data-line .val.green{{color:{COL["green"]}}}
.data-line .val.blue{{color:{COL["blue"]}}}

.note-box{{background:{COL["panel2"]};border:1px solid {COL["border"]};border-radius:8px;
  padding:{SP["md"]}px;font-size:{FS["sm"]}px;color:{COL["muted"]};line-height:1.6;margin-top:{SP["md"]}px}}
.note-box strong{{color:{COL["ink"]}}}

.legend{{display:flex;gap:{SP["lg"]}px;font-size:{FS["xs"]}px;color:{COL["muted"]};margin-bottom:{SP["sm"]}px}}
.legend span{{display:flex;align-items:center;gap:5px}}
.dot{{width:9px;height:9px;border-radius:2px;display:inline-block}}

.foot-row{{display:grid;grid-template-columns:1fr 1fr;gap:{SP["md"]}px;margin-top:auto}}
.foot-panel{{background:{COL["panel"]};border:1px solid {COL["border"]};border-radius:10px;padding:{SP["lg"]}px}}
.foot-label{{font-size:{FS["xs"]}px;letter-spacing:0.6px;text-transform:uppercase;
  color:{COL["muted"]};margin-bottom:{SP["sm"]}px;font-weight:600}}
.foot-val{{font-size:{FS["md"]}px;font-weight:700;color:{COL["ink"]}}}
.cert-pill{{display:inline-block;font-size:{FS["xs"]}px;font-weight:700;color:{COL["green"]};
  background:{COL["green_l"]};padding:3px {SP["md"]}px;border-radius:20px;margin-left:{SP["sm"]}px}}

.page-num{{position:absolute;bottom:{SP["lg"]}px;right:{PAGE_PAD}px;
  font-size:{FS["xs"]}px;color:{COL["muted"]}}}

.comp-row{{display:flex;align-items:flex-start;gap:{SP["lg"]}px;padding:{SP["md"]}px 0;
  border-bottom:1px solid {COL["border"]}}}
.comp-row:last-child{{border-bottom:none}}
.comp-icon{{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;
  justify-content:center;flex-shrink:0;font-size:16px}}
.comp-tag{{font-size:{FS["base"]}px;font-weight:700;margin-bottom:2px;color:{COL["ink"]}}}
.comp-tag.green{{color:{COL["green"]}}}
.comp-tag.blue{{color:{COL["blue"]}}}
.comp-tag.yellow{{color:{COL["yellow"]}}}
.comp-desc{{font-size:{FS["sm"]}px;color:{COL["muted"]};line-height:1.5}}
.comp-desc strong{{color:{COL["ink"]}}}

.gar-row{{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:{SP["md"]}px}}
.gar-card{{background:{COL["panel2"]};border:1px solid {COL["border"]};border-radius:10px;
  padding:{SP["md"]}px;text-align:center}}
.gar-val{{font-size:{FS["lg"]}px;font-weight:800;color:{COL["green"]};margin-bottom:2px}}
.gar-label{{font-size:{FS["xs"]}px;color:{COL["muted"]}}}

.fin-table{{width:100%;border-collapse:collapse;font-size:{FS["base"]}px}}
.fin-table th{{font-size:{FS["xs"]}px;letter-spacing:0.5px;text-transform:uppercase;
  color:{COL["muted"]};text-align:left;padding:{SP["sm"]}px 0;
  border-bottom:2px solid {COL["border"]};font-weight:600}}
.fin-table th:last-child{{text-align:right}}
.fin-table td{{padding:{SP["md"]}px 0;border-bottom:1px solid {COL["border"]};vertical-align:top}}
.fin-table td:last-child{{text-align:right;font-weight:700}}
.fin-table tr.total td{{font-weight:800;font-size:{FS["md"]}px;color:{COL["blue"]};
  border-top:2px solid {COL["blue"]};border-bottom:2px solid {COL["blue"]}}}
.fin-table tr.milestone td{{color:{COL["yellow"]}}}
.fin-table td.neg{{color:{COL["red"]}}}
.fin-table td.pos{{color:{COL["green"]}}}

.sign-row{{display:grid;grid-template-columns:1fr 1fr;gap:{SP["md"]}px;margin-top:{SP["xl"]}px}}
.sign-box{{border:1px solid {COL["border"]};border-radius:10px;padding:{SP["lg"]}px;min-height:96px}}
.sign-box.client{{border-color:{COL["green"]};background:{COL["green_l"]}}}
.sign-role{{font-size:{FS["xs"]}px;color:{COL["muted"]};letter-spacing:0.5px;margin-bottom:{SP["sm"]}px}}
.sign-role.green{{color:{COL["green"]}}}
.sign-name{{font-size:{FS["md"]}px;font-weight:700;color:{COL["ink"]};margin-bottom:{SP["sm"]}px}}
.sign-status{{font-size:{FS["xs"]}px;color:{COL["muted"]};font-style:italic}}

.mentions{{font-size:{FS["xs"]}px;color:{COL["muted"]};line-height:1.7;margin-top:{SP["xl"]}px}}
.mentions strong{{color:{COL["ink"]}}}
"""


def header(d, page_label=""):
    return f"""
  <div class="topbar">
    <div>
      <div class="logo"><span>C2BAT</span><span class="accent">ELEC</span></div>
      <div class="logo-sub">ÉTUDE SOLAIRE ACTIVE</div>
    </div>
    <div style="display:flex;align-items:center;gap:12px">
      <span class="ref">Réf : {d['ref']} — {d['date']}</span>
      {f'<span class="status-pill">{page_label}</span>' if page_label else ''}
    </div>
  </div>"""


def build_html(raw_data):
    d = compute_derived(raw_data)
    prod_svg = chart_prod_svg(d["production_mensuelle"])
    css = build_css()
    orientation = orientation_label(d.get("azimut"))
    sol_score = score_solaire(d)
    sol_label = score_label(sol_score)

    photo_b64 = d.get("photo_fond_base64")
    if photo_b64:
        h = COL["bg"].lstrip('#')
        r, g, b_ = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        bg_overlay = f'rgba({r},{g},{b_},0.90)'
        page1_bg = (
            f'style="background-image:linear-gradient({bg_overlay},{bg_overlay}),url({photo_b64});'
            f'background-size:auto,cover;background-position:0 0,center"'
        )
    else:
        page1_bg = ''

    roof_img = d.get("roof_map_base64")
    if roof_img:
        roof_html = f'<img src="{roof_img}" style="width:100%;height:180px;object-fit:cover;border-radius:10px;border:1px solid {COL["border"]}" alt="Carte toiture"/>'
    else:
        roof_html = f"""
        <div style="height:180px;background:{COL["panel2"]};border-radius:10px;border:1px solid {COL["border"]};
          display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px">
          <div style="width:40px;height:40px;border-radius:50%;background:{COL["green_l"]};
            display:flex;align-items:center;justify-content:center">
            <div style="width:10px;height:10px;border-radius:50%;background:{COL["green"]}"></div>
          </div>
          <div style="font-size:11px;color:{COL["muted"]}">Orientation : {orientation}</div>
        </div>"""

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
        <td>Cumul Année 1 — Économie de {fmt_eur(d['economie_annuelle'])}</td>
        <td class="neg">Solde : −{fmt_eur(d['prix_net'] - d['economie_annuelle'])}</td>
      </tr>
      <tr class="milestone">
        <td>Année {d['roi_ans']} — Seuil de Rentabilité atteint (ROI)</td>
        <td>Solde : {fmt_eur(d['roi_ans']*d['economie_annuelle'] - d['prix_net'])}</td>
      </tr>
      <tr>
        <td>Cumul Année 25 — Gains totaux de {fmt_eur(d['economie_annuelle']*25)}</td>
        <td class="pos">Bénéfice net : +{fmt_eur(d['gain_25ans'])}</td>
      </tr>"""

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Proposition PV V2 — {d['client_nom']}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>{css}</style>
</head>
<body>

<!-- ═══ PAGE 1 : HERO ═══ -->
<div class="page" {page1_bg}>
  {header(d, "ÉTUDE SOLAIRE ACTIVE")}

  <div class="kicker">PROPOSITION ÉMISE LE {d['date'].upper()}</div>
  <div class="h1">Votre centrale solaire avec stockage intelligent</div>
  <div class="h1-sub">Configuration sur-mesure pour <strong>{d['client_nom']}</strong> — {d['client_ville']}</div>

  <div class="score-box">
    <div class="score-circle">
      <div class="score-num">{sol_score}</div>
      <div class="score-max">/100</div>
    </div>
    <div style="flex:1">
      <div class="score-label">{sol_label}</div>
      <div class="score-title">Score Solaire du site</div>
      <div style="font-size:11px;color:{COL['muted']};margin-top:4px">
        Évaluation basée sur l'irradiation, la performance, l'orientation et l'autoconsommation.
        Masque d'ombrage : à valider lors de la visite technique.
      </div>
      <div class="score-bar-bg" style="margin-top:8px">
        <div class="score-bar-fg" style="width:{sol_score}%"></div>
      </div>
    </div>
  </div>

  <div class="kpi-row">
    <div class="kpi blue">
      <div class="kpi-label">Investissement net</div>
      <div class="kpi-val blue">{fmt_eur(d['prix_net'])}</div>
      <div class="kpi-sub">Clé en main, aides KAP PV provisionnelles déduites</div>
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

  <div class="panel-row cols-2" style="margin-top:auto">
    <div class="foot-panel">
      <div class="foot-label">Système global</div>
      <div class="foot-val">{d['puissance_kwc']} kWc &nbsp;|&nbsp; {d['batterie_kwh']} kWh batterie</div>
    </div>
    <div class="foot-panel">
      <div class="foot-label">Entreprise certifiée</div>
      <div class="foot-val">C2BAT ELEC <span class="cert-pill">RGE QualiPV</span></div>
    </div>
  </div>

  <div class="page-num">Page 1 / 4</div>
</div>

<!-- ═══ PAGE 2 : TECHNIQUE ═══ -->
<div class="page">
  {header(d, "ANALYSE TECHNIQUE")}

  <div class="sec-title">ANALYSE D'IMPLANTATION &amp; DONNÉES PVGIS</div>

  <div class="panel-row cols-2" style="margin-bottom:{SP['lg']}px">
    <div class="panel">
      <div class="data-line"><span class="lbl">Irradiation locale</span><span class="val">{d['irradiation']} kWh/kWc/an</span></div>
      <div class="data-line"><span class="lbl">Performance système</span><span class="val">{d['performance']} % <span style="color:{COL['muted']};font-weight:500">(pertes {d['pertes']}%)</span></span></div>
      <div class="data-line"><span class="lbl">Productible estimé</span><span class="val green">{fmt_int(d['production_annuelle'])} kWh/an</span></div>
      <div class="note-box">
        <strong>Orientation :</strong> Azimut {d['azimut']} ({orientation}) / Inclinaison {d['inclinaison']}<br>
        <strong>Surface utile :</strong> ~{d['surface']} analysée
      </div>
    </div>
    <div class="panel">
      {roof_html}
      <div style="font-size:11px;color:{COL['muted']};margin-top:6px;text-align:center">
        Toiture orientée {orientation} — {d['surface']}
      </div>
    </div>
  </div>

  <div class="panel" style="margin-bottom:{SP['lg']}px">
    <div style="font-size:12px;font-weight:700;color:{COL['ink']};margin-bottom:8px;text-transform:uppercase;letter-spacing:0.3px">
      Production mensuelle estimée (kWh)
    </div>
    <div class="legend">
      <span><span class="dot" style="background:{COL['green']}"></span>Haute saison</span>
      <span><span class="dot" style="background:#94a3b8"></span>Basse saison</span>
    </div>
    <div style="position:relative;width:100%;height:200px">{prod_svg}</div>
  </div>

  <div class="foot-row" style="margin-top:auto">
    <div class="foot-panel">
      <div class="foot-label">Score Solaire</div>
      <div class="foot-val" style="color:{COL['green']}">{sol_score}/100 — {sol_label}</div>
    </div>
    <div class="foot-panel">
      <div class="foot-label">ROI prévisionnel</div>
      <div class="foot-val">Rentabilité en <span style="color:{COL['green']}">{d['roi_ans']} ans</span></div>
    </div>
  </div>

  <div class="page-num">Page 2 / 4</div>
</div>

<!-- ═══ PAGE 3 : ARCHITECTURE ═══ -->
<div class="page">
  {header(d, "ARCHITECTURE MATÉRIELLE")}

  <div class="sec-title">COMPOSANTS PREMIUM ET GARANTIES</div>

  <div class="panel" style="margin-bottom:{SP['xl']}px">
    <div class="comp-row">
      <div class="comp-icon" style="background:{COL['yellow_l']}">☀️</div>
      <div>
        <div class="comp-tag yellow">{d['modules']} Panneaux {d['module_wc']} Wc</div>
        <div class="comp-desc"><strong>POLYCROWN {d['module_wc']} Wc</strong> (NS585MH144). Haute tolérance cyclonique, Norme IEC 61215. Structure Novotegra aluminium renforcé (DTU 40.35).</div>
      </div>
    </div>
    <div class="comp-row">
      <div class="comp-icon" style="background:{COL['green_l']}">🔋</div>
      <div>
        <div class="comp-tag green">Batterie LFP {d['batterie_kwh']} kWh</div>
        <div class="comp-desc"><strong>Lithium-Fer-Phosphate</strong> — 6 000 cycles garantis. Fonctionnement en secours EDF inclus. Zéro maintenance sur toute la durée de vie.</div>
      </div>
    </div>
    <div class="comp-row">
      <div class="comp-icon" style="background:{COL['blue_l']}">🧠</div>
      <div>
        <div class="comp-tag blue">Onduleur hybride {d['onduleur']}</div>
        <div class="comp-desc"><strong>SOFAR PowerAll</strong> — Monitoring intelligent via WiFi. Gestion automatique production / consommation / batterie / réseau. Mise à jour OTA.</div>
      </div>
    </div>
    <div class="comp-row">
      <div class="comp-icon" style="background:{COL['panel2']}">🏗️</div>
      <div>
        <div class="comp-tag">Châssis DROM Novotegra</div>
        <div class="comp-desc">Aluminium anodisé, fixations <strong>Delta Plus</strong>, adapté zone cyclonique La Réunion. Raccordement CONSUEL inclus. Mise en service complète par technicien RGE.</div>
      </div>
    </div>
  </div>

  <div class="sec-title">GARANTIES CONTRACTUELLES</div>

  <div class="gar-row" style="margin-bottom:{SP['xxl']}px">
    <div class="gar-card"><div class="gar-val">25 ans</div><div class="gar-label">Garantie Production panneaux</div></div>
    <div class="gar-card"><div class="gar-val">10 ans</div><div class="gar-label">Garantie pièces matériel</div></div>
    <div class="gar-card"><div class="gar-val">6 000</div><div class="gar-label">Cycles batterie garantis</div></div>
    <div class="gar-card"><div class="gar-val">48 h</div><div class="gar-label">Délai d'intervention SAV</div></div>
  </div>

  <div class="note-box" style="margin-top:auto">
    <strong>Norme cyclonique :</strong> Installation conforme DTU 40.35 / NF P 84-204. Structure calculée pour vents de 250 km/h (zone Réunion). Certification RGE QualiPV obligatoire pour l'éligibilité à la subvention KAP PV.
  </div>

  <div class="page-num">Page 3 / 4</div>
</div>

<!-- ═══ PAGE 4 : FINANCEMENT ═══ -->
<div class="page">
  {header(d, "ÉTUDE FINANCIÈRE")}

  <div class="sec-title">ÉTUDE FINANCIÈRE &amp; VENTILATION KAP PV</div>

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
    Proposition conditionnée à la validation finale du dossier de subvention KAP PV par la Région Réunion et le FEDER — <strong>aide provisionnelle, sous réserve de validation</strong>.
    Offre commerciale ferme et valable durant 30 jours à compter du {d['date']}.
  </div>

  <div class="page-num">Page 4 / 4</div>
</div>

</body>
</html>"""


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
    print(f"PDF V2 genere : {output_path}")


if __name__ == "__main__":
    if len(sys.argv) >= 3:
        input_json, output_pdf = sys.argv[1], sys.argv[2]
        with open(input_json, "r", encoding="utf-8") as f:
            data = json.load(f)
        merged = {**DEFAULT_DATA, **data}
        generate_pdf(output_pdf, merged)
    elif len(sys.argv) == 1:
        generate_pdf("Scripts/proposition_v2_test.pdf", DEFAULT_DATA)
    else:
        print("Usage: python3 generate_proposition_v2.py [input.json output.pdf]")
        sys.exit(1)
