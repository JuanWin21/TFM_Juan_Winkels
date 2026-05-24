"""
Comprueba que paises de predicciones_test_2024.csv NO matchean con el GeoJSON
Natural Earth por NAME / NAME_LONG / ADMIN tras normalizacion (lowercase, sin acentos).

Imprime:
- Total de paises unicos en el CSV
- Lista de paises CSV que NO matchean
- Para cada uno, sugiere candidatos del GeoJSON (similitud por prefijo)
"""

import csv
import json
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "data" / "predicciones_test_2024.csv"
GEOJSON_PATH = ROOT / "data" / "world_countries_110m.geojson"


def normalize(s: str) -> str:
    if s is None:
        return ""
    s = str(s).strip().lower()
    # quita acentos
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    # quita puntuacion comun
    for ch in [".", ",", "'", "`"]:
        s = s.replace(ch, "")
    s = s.replace("-", " ")
    s = " ".join(s.split())
    return s


def main():
    # 1) paises unicos del CSV
    csv_countries = set()
    with CSV_PATH.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            csv_countries.add(row["country_name"].strip())

    print(f"Paises unicos en el CSV: {len(csv_countries)}")

    # 2) cargar GeoJSON y construir indice por NAME, NAME_LONG, ADMIN
    with GEOJSON_PATH.open(encoding="utf-8") as f:
        gj = json.load(f)

    geo_index = {}  # normalized -> ADMIN canonico
    geo_admin_list = []
    for feat in gj["features"]:
        props = feat["properties"]
        admin = props.get("ADMIN") or props.get("NAME") or ""
        geo_admin_list.append(admin)
        for key in ("NAME", "NAME_LONG", "ADMIN", "FORMAL_EN", "NAME_EN"):
            val = props.get(key)
            if val:
                geo_index[normalize(val)] = admin

    print(f"Paises en GeoJSON: {len(gj['features'])}")
    print(f"Claves normalizadas en indice: {len(geo_index)}")
    print()

    # 3) matchear
    unmatched = []
    matched = []
    for c in sorted(csv_countries):
        key = normalize(c)
        if key in geo_index:
            matched.append((c, geo_index[key]))
        else:
            unmatched.append(c)

    print(f"Matcheados directamente: {len(matched)}")
    print(f"NO matcheados: {len(unmatched)}")
    print()
    print("=" * 60)
    print("PAISES DEL CSV SIN MATCH DIRECTO:")
    print("=" * 60)
    for c in unmatched:
        key = normalize(c)
        # sugerir candidatos por prefijo
        candidates = [a for a in geo_admin_list if normalize(a).startswith(key[:4])]
        candidates = sorted(set(candidates))[:5]
        print(f"  CSV: {c!r}")
        print(f"       normalizado: {key!r}")
        if candidates:
            print(f"       candidatos cercanos en GeoJSON: {candidates}")
        else:
            print(f"       (sin candidatos cercanos)")
        print()


if __name__ == "__main__":
    main()
