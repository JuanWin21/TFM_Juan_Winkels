"""
Verifica los 7 checkpoints de prompt3.md a nivel de datos (no UI):
- Para cada mes 2024-01..2024-09, calcula:
  * Numero de paises en alerta (>= 0.76)
  * Numero de paises en seguimiento (0.45-0.76)
  * Numero de paises en conflicto activo (categoria C)
  * Diferencia de alertas respecto al mes anterior
  * Si USA, UK, Haiti, Chad aparecerian en "Alertas activas" o "En seguimiento" o nada
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
    for src, dst in [("Burma/Myanmar", "Myanmar"), ("Türkiye", "Turkey")]:
        if normalize(dst) in geo_admin_by_norm:
            geo_admin_by_norm[normalize(src)] = geo_admin_by_norm[normalize(dst)]

    rows = []
    with CSV.open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows.append(r)
    continuo_admins = set()
    for n in conf["conflicto_continuo"]:
        a = geo_admin_by_norm.get(normalize(n))
        if a: continuo_admins.add(a)
    onset_admin_map = {}
    for o in conf["onset_durante_2024"]:
        a = geo_admin_by_norm.get(normalize(o["country"]))
        if a: onset_admin_map[a] = o

    periods = sorted({r["period"] for r in rows})
    focos = ["United States of America", "United Kingdom", "Haiti", "Chad"]
    print(f"{'periodo':<10} {'alertas':>7} {'seg':>4} {'conf':>5} {'dif':>5}   {'foco':<25}")
    print("-" * 95)
    prev_alerts = None
    for p in periods:
        alerts, follow = 0, 0
        for r in rows:
            if r["period"] != p: continue
            s = float(r["xgboost_score"])
            if s >= 0.76: alerts += 1
            elif s >= 0.45: follow += 1
        conf_n = len(continuo_admins) + sum(1 for info in onset_admin_map.values() if p >= info["since_month"])
        diff = "" if prev_alerts is None else f"{alerts - prev_alerts:+d}"
        # Estado de los 4 focos en este mes
        statuses = []
        for c in focos:
            row = next((r for r in rows if r["country_name"] == c and r["period"] == p), None)
            if row:
                s = float(row["xgboost_score"])
                if s >= 0.76: statuses.append(f"{c[:6]}=ALR({s:.2f})")
                elif s >= 0.45: statuses.append(f"{c[:6]}=SEG({s:.2f})")
                else: statuses.append(f"{c[:6]}=baj")
            else:
                # No esta en CSV: continuo o post-onset
                statuses.append(f"{c[:6]}=C")
        line = " | ".join(statuses)
        print(f"{p:<10} {alerts:>7} {follow:>4} {conf_n:>5} {diff:>5}   {line}")
        prev_alerts = alerts


if __name__ == "__main__":
    main()
