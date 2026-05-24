/**
 * Tabla pais-mes con filtros (texto, solo alertas, solo positivos) y orden por columna.
 */

let sortKey = "consensus_score";
let sortDir = -1; // descendente

function num(v) {
  const n = Number(v);
  return isFinite(n) ? n : null;
}

function applyFilters(rows) {
  const q = document.getElementById("tabla-filter").value.trim().toLowerCase();
  const onlyAlerts = document.getElementById("tabla-only-alerts").checked;
  const onlyTruth = document.getElementById("tabla-only-truth").checked;
  return rows.filter((r) => {
    if (q && !r.country_name.toLowerCase().includes(q)) return false;
    if (onlyAlerts && !(num(r.xgboost_alert) || num(r.lightgbm_alert) || num(r.consensus_alert))) return false;
    if (onlyTruth && num(r.target) !== 1) return false;
    return true;
  });
}

function fmt(v, k) {
  if (v == null) return "";
  if (["xgboost_score", "lightgbm_score", "consensus_score"].includes(k)) {
    return Number(v).toFixed(3);
  }
  return v;
}

function render(tbody, rows) {
  const filtered = applyFilters(rows).slice();
  filtered.sort((a, b) => {
    const av = num(a[sortKey]);
    const bv = num(b[sortKey]);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return (av - bv) * sortDir;
  });

  tbody.innerHTML = filtered
    .slice(0, 1000) // proteccion: tabla grande pero limitada
    .map((r) => {
      const isTruth = Number(r.target) === 1;
      const isAlert =
        Number(r.xgboost_alert) === 1 ||
        Number(r.lightgbm_alert) === 1 ||
        Number(r.consensus_alert) === 1;
      const cls = [isTruth ? "is-truth" : "", isAlert ? "is-alert" : ""].filter(Boolean).join(" ");
      return `<tr class="${cls}">
        <td>${r.country_name}</td>
        <td>${r.period}</td>
        <td>${fmt(r.xgboost_score, "xgboost_score")}</td>
        <td>${fmt(r.lightgbm_score, "lightgbm_score")}</td>
        <td>${fmt(r.consensus_score, "consensus_score")}</td>
        <td>${r.xgboost_alert}</td>
        <td>${r.lightgbm_alert}</td>
        <td>${r.consensus_alert}</td>
        <td>${r.target}</td>
      </tr>`;
    })
    .join("");
}

export function initTable(store) {
  const tbody = document.querySelector("#tabla-predicciones tbody");
  const table = document.getElementById("tabla-predicciones");

  function refresh() { render(tbody, store.predicciones); }

  document.getElementById("tabla-filter").addEventListener("input", refresh);
  document.getElementById("tabla-only-alerts").addEventListener("change", refresh);
  document.getElementById("tabla-only-truth").addEventListener("change", refresh);

  table.querySelectorAll("th[data-key]").forEach((th) => {
    th.addEventListener("click", () => {
      const k = th.dataset.key;
      if (sortKey === k) sortDir = -sortDir;
      else { sortKey = k; sortDir = -1; }
      table.querySelectorAll("th").forEach((x) => x.classList.remove("sort-asc", "sort-desc"));
      th.classList.add(sortDir > 0 ? "sort-asc" : "sort-desc");
      refresh();
    });
  });

  // Marcar columna ordenada por defecto
  const def = table.querySelector(`th[data-key="${sortKey}"]`);
  if (def) def.classList.add("sort-desc");

  refresh();
}
