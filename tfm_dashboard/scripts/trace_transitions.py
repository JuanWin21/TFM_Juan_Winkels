import json
from pathlib import Path

p = Path(__file__).resolve().parent.parent / "data" / "conflictos_activos_2024.json"
with p.open(encoding="utf-8") as f:
    j = json.load(f)

print("Transiciones a conflicto activo (since_month == period):")
for m in range(1, 10):
    period = f"2024-{m:02d}"
    just = [o["country"] for o in j["onset_durante_2024"] if o["since_month"] == period]
    print(f"  {period}: {just if just else '(ninguna)'}")
