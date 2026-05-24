"""
Verifica los criterios de aceptacion 1-5 de prompt2.md (transiciones A->C
de USA, UK, Haiti, Angola en distintos meses del slider).

Para cada mes del CSV (2024-01..2024-09), calcula la categoria que recibirian
los 4 paises onset segun la nueva logica de categoryOf en map.js.
"""

import csv
import json
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV = ROOT / "data" / "predicciones_test_2024.csv"
GEO = ROOT / "data" / "world_countries_110m.geojson"
CONF = ROOT / "data" / "conflictos_activos_2024.json"


def normalize(s):
    if s is None: return ""
    s = str(s).strip().lower()
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    for ch in [".", ",", "'", "`"]: s = s.replace(ch, "")
    s = s.replace("/", " ").replace("-", " ")
    return " ".join(s.split())


def main():
    with CONF.open(encoding="utf-8") as f:
        conf = json.load(f)
    with GEO.open(encoding="utf-8") as f:
        gj = json.load(f)
    geo_admin_by_norm = {}
    for feat in gj["features"]:
        p = feat["properties"]
        admin = p.get("ADMIN") or p.get("NAME") or ""
        for key in ("NAME", "NAME_LONG", "ADMIN", "FORMAL_EN", "NAME_EN"):
            v = p.get(key)
            if v: geo_admin_by_norm[normalize(v)] = admin
    aliases = [("Burma/Myanmar", "Myanmar"), ("Türkiye", "Turkey")]
    for src, dst in aliases:
        if normalize(dst) in geo_admin_by_norm:
            geo_admin_by_norm[normalize(src)] = geo_admin_by_norm[normalize(dst)]

    # Cargar CSV: byAdminPeriod
    by_admin_period = {}
    csv_to_geo = {}
    with CSV.open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            c = r["country_name"].strip()
            admin = geo_admin_by_norm.get(normalize(c))
            if not admin: continue
            csv_to_geo[c] = admin
            by_admin_period[f"{admin}|{r['period']}"] = r

    continuo_admins = set()
    for n in conf["conflicto_continuo"]:
        a = geo_admin_by_norm.get(normalize(n))
        if a: continuo_admins.add(a)
    onset_admin_map = {}
    for o in conf["onset_durante_2024"]:
        a = geo_admin_by_norm.get(normalize(o["country"]))
        if a: onset_admin_map[a] = o

    # 4 paises onset
    targets = ["United States of America", "United Kingdom", "Haiti", "Angola"]
    targets_admin = {c: geo_admin_by_norm[normalize(c)] for c in targets}

    periods = [f"2024-{m:02d}" for m in range(1, 13)]

    def category(admin, period):
        if f"{admin}|{period}" in by_admin_period: return "A"
        if admin in continuo_admins: return "C"
        if admin in onset_admin_map:
            if period >= onset_admin_map[admin]["since_month"]:
                return "C"
        return "D"

    print(f"{'pais':<28}", *[p for p in periods])
    for c in targets:
        adm = targets_admin[c]
        row = [category(adm, p) for p in periods]
        print(f"{c:<28}", *row)

    print()
    print("Onset months registrados:")
    for o in conf["onset_durante_2024"]:
        print(f"  {o['country']:<28} -> {o['since_month']}")


if __name__ == "__main__":
    main()
