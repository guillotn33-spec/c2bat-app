import json, sys
sys.path.insert(0, 'Scripts')
from generate_proposition_v2 import compute_derived, score_solaire, build_html

def check_kit(json_file, kit_label):
    with open(json_file, encoding='utf-8') as f:
        raw = json.load(f)

    html = build_html(raw)
    c = compute_derived(raw)
    s = score_solaire(c)

    pages = html.count('class="page"')
    print(f"\n=== {kit_label} ===")
    print(f"  Pages trouvees : {pages} (attendu 4)")
    print(f"  Score solaire  : {s}/100")
    print(f"  Economie       : {c['economie_annuelle']} EUR/an")
    print(f"  ROI            : {c['roi_ans']} ans")
    print(f"  Taille HTML    : {len(html)} chars")

    checks = [
        ("Hero titre",                "centrale solaire avec stockage intelligent"),
        ("Score Solaire label",       "Score Solaire"),
        ("KPI investissement net",    "Investissement net"),
        ("Page 2 PVGIS",             "PVGIS"),
        ("Page 2 SVG chart",          "<svg"),
        ("Page 3 composants",         "COMPOSANTS PREMIUM"),
        ("Page 3 garanties",          "GARANTIES CONTRACTUELLES"),
        ("Page 4 tableau financier",  "fin-table"),
        ("Page 4 signatures",         "sign-row"),
        ("Aide provisionnelle OK",    "sous réserve de validation"),
        ("Client nom présent",        c["client_nom"]),
        ("Score numerique OK",        str(s)),
        ("Prix net OK",               str(int(c["prix_net"]))),
        ("Pas de mot AUTONOME seul",  True),  # checked below
    ]

    # Wording check : "autonome" seul = interdit (règle 4 CLAUDE.md)
    import re
    autonome_seul = bool(re.search(r'\bautonome\b', html, re.IGNORECASE))
    checks[-1] = ("Pas de mot AUTONOME seul", not autonome_seul)

    all_ok = True
    for label, expected in checks:
        if isinstance(expected, bool):
            ok = expected
        else:
            ok = expected in html
        status = "OK" if ok else "MANQUANT"
        if not ok:
            all_ok = False
        print(f"  [{status}] {label}")

    print(f"  Resultat global : {'PASS' if all_ok else 'FAIL'}")
    return all_ok

ok1 = check_kit("Scripts/test_data.json",           "Kit1 - Nicolas GUILLOT (2.93 kWc, sans conso EDF)")
ok2 = check_kit("Scripts/test_data_grand_kit.json", "Kit2 - Marie PAYET     (5.86 kWc, conso EDF 8200)")

print(f"\nBilan : {'TOUS OK' if ok1 and ok2 else 'ECHEC'}")
