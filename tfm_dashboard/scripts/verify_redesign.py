"""
Verifica el rediseno v2:
- Que los nombres del JSON de conflictos matcheen con el GeoJSON.
- Que ningun pais del CSV este tambien en conflicto_continuo
  (excepto onset_durante_2024 que SI deben estar en el CSV).
- Que los 4 onsets esten en el CSV.
- Cuantos paises caen en cada categoria (A/B/C/D) del mapa.
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
    # Aliases manuales (mismos que en data.js)
    aliases = [("Burma/Myanmar", "Myanmar"), ("Türkiye", "Turkey")]
    for src, dst in aliases:
        if normalize(dst) in geo_admin_by_norm:
            geo_admin_by_norm[normalize(src)] = geo_admin_by_norm[normalize(dst)]
    csv_countries = set()
    with CSV.open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            csv_countries.add(r["country_name"].strip())

    continuo = conf["conflicto_continuo"]
    onsets = [o["country"] for o in conf["onset_durante_2024"]]

    print("== Match JSON -> GeoJSON ==")
    miss_continuo = [n for n in continuo if normalize(n) not in geo_admin_by_norm]
    miss_onsets = [n for n in onsets if normalize(n) not in geo_admin_by_norm]
    print(f"  conflicto_continuo: {len(continuo)} paises, {len(miss_continuo)} sin match en GeoJSON: {miss_continuo}")
    print(f"  onset_durante_2024: {len(onsets)} paises, {len(miss_onsets)} sin match en GeoJSON: {miss_onsets}")

    print()
    print("== Solapamiento con CSV ==")
    continuo_in_csv = [n for n in continuo if n in csv_countries]
    onsets_in_csv = [n for n in onsets if n in csv_countries]
    print(f"  Paises en CSV: {len(csv_countries)}")
    print(f"  conflicto_continuo TAMBIEN en CSV (no deberia haber): {len(continuo_in_csv)} -> {continuo_in_csv[:10]}")
    print(f"  onset_durante_2024 en CSV (deberia ser los 4): {len(onsets_in_csv)} -> {onsets_in_csv}")

    print()
    print("== Categorias del mapa ==")
    # Para cada pais en el GeoJSON, asignarle categoria
    cats = {"A": [], "B": [], "C": [], "D": []}
    csv_admins = set()
    for c in csv_countries:
        admin = geo_admin_by_norm.get(normalize(c))
        if admin: csv_admins.add(admin)

    continuo_admins = set()
    for n in continuo:
        admin = geo_admin_by_norm.get(normalize(n))
        if admin: continuo_admins.add(admin)

    onset_admins = set()
    for n in onsets:
        admin = geo_admin_by_norm.get(normalize(n))
        if admin: onset_admins.add(admin)

    for feat in gj["features"]:
        admin = feat["properties"].get("ADMIN") or feat["properties"].get("NAME")
        if admin in onset_admins:
            cats["B"].append(admin)
        elif admin in continuo_admins:
            cats["C"].append(admin)
        elif admin in csv_admins:
            cats["A"].append(admin)
        else:
            cats["D"].append(admin)
    for k in "ABCD":
        print(f"  Categoria {k}: {len(cats[k])} paises")
    print(f"  Total: {sum(len(v) for v in cats.values())} (debe coincidir con features GeoJSON: {len(gj['features'])})")

    # Solapamiento B y A: B no deberian estar en A (porque hayonset_admins se filtra antes)
    inter = set(cats["A"]) & set(cats["B"])
    print(f"  Solapamiento A-B (debe ser 0): {len(inter)}")


if __name__ == "__main__":
    main()
