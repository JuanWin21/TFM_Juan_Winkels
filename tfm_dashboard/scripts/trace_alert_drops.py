import csv
from pathlib import Path

CSV = Path(__file__).resolve().parent.parent / "data" / "predicciones_test_2024.csv"
rows = list(csv.DictReader(open(CSV, encoding="utf-8")))

a01 = {r["country_name"] for r in rows if r["period"] == "2024-01" and float(r["xgboost_score"]) >= 0.76}
a02 = {r["country_name"] for r in rows if r["period"] == "2024-02" and float(r["xgboost_score"]) >= 0.76}

print("Alertas 2024-01:", sorted(a01))
print("Alertas 2024-02:", sorted(a02))
print()
dropped = a01 - a02
for c in sorted(dropped):
    r2 = [r for r in rows if r["country_name"] == c and r["period"] == "2024-02"]
    if r2:
        s = float(r2[0]["xgboost_score"])
        print(f"  {c} en 2024-02: score={s:.3f}  (sigue en CSV, dropeo natural)")
    else:
        print(f"  {c} en 2024-02: NO esta en CSV  (transito a conflicto)")
