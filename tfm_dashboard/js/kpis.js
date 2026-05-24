/**
 * Renderiza las 4 tarjetas de la cabecera:
 * 3 modelos (XGBoost, LightGBM, Consenso) + carga operativa.
 */

const MODEL_LABEL = {
  XGBoost: "XGBoost",
  LightGBM: "LightGBM",
  "Consenso (AND)": "Consenso",
};

const KPI_TARGETS = [
  { key: "XGBoost", el: "#kpi-xgboost" },
  { key: "LightGBM", el: "#kpi-lightgbm" },
  { key: "Consenso (AND)", el: "#kpi-consenso" },
];

function fmtPct(x) {
  const n = Number(x);
  if (!isFinite(n)) return "--";
  return (n * 100).toFixed(1) + "%";
}

function modelCard(row) {
  const tp = Number(row.tp);
  const fp = Number(row.fp);
  const fn = Number(row.fn);
  const alertas = Number(row.alertas);
  return `
    <h3>${MODEL_LABEL[row.modelo] || row.modelo}</h3>
    <div class="kpi-metric">
      <span class="lbl">Precision</span>
      <span><span class="val">${fmtPct(row.precision)}</span> <span class="ic">${row.prec_wilson95 || ""}</span></span>
    </div>
    <div class="kpi-metric">
      <span class="lbl">Recall</span>
      <span><span class="val">${fmtPct(row.recall)}</span> <span class="ic">${row.rec_wilson95 || ""}</span></span>
    </div>
    <div class="kpi-metric">
      <span class="lbl">F1</span>
      <span><span class="val">${fmtPct(row.f1)}</span> <span class="ic">${row.f1_boot95 || ""}</span></span>
    </div>
    <div class="kpi-foot">${alertas} alertas, ${tp} TP, ${fp} FP, ${fn} FN.</div>
  `;
}

function cargaOperativa(walkForward, baseline) {
  const sum = (rows, key) => rows.reduce((s, r) => s + Number(r[key] || 0), 0);
  const xgbAlerts = sum(walkForward, "alerts");
  const baseAlerts = sum(baseline, "alerts");
  // Meses cubiertos: 12 por anio salvo 2024 (segun datos, 9 meses); usamos suma de alertas / total filas pais-mes implicito.
  // Asumimos misma cobertura temporal entre XGBoost y baseline (mismas particiones walk-forward).
  // n_periods = (filas validas en cada CSV * 12 meses si anio completo; 2024 = 9). Lo deducimos de las propias filas: cada
  // fila representa un anio. Para "alertas/mes" calculamos sobre el agregado total = sum(alerts) / total_meses,
  // donde total_meses = sum_per_row(12 si anio<=2023 else 9). Se mantiene comparable entre ambos.
  let totalMeses = 0;
  for (const r of walkForward) totalMeses += Number(r.year) === 2024 ? 9 : 12;
  const xgbPerMonth = xgbAlerts / totalMeses;
  const basePerMonth = baseAlerts / totalMeses;
  const reduccion = baseAlerts > 0 ? ((baseAlerts - xgbAlerts) / baseAlerts) * 100 : 0;

  return `
    <h3>Carga operativa</h3>
    <div class="kpi-metric">
      <span class="lbl">XGBoost</span>
      <span><span class="val">${xgbAlerts}</span> alertas (${xgbPerMonth.toFixed(1)}/mes)</span>
    </div>
    <div class="kpi-metric">
      <span class="lbl">Baseline</span>
      <span><span class="val">${baseAlerts}</span> alertas (${basePerMonth.toFixed(1)}/mes)</span>
    </div>
    <div class="big">${reduccion.toFixed(0)}% menos alertas</div>
    <div class="kpi-foot">Walk-forward 2019 - 2024.</div>
  `;
}

export function renderKpis(store) {
  const metricasByModel = new Map(store.metricas.map((r) => [r.modelo, r]));
  for (const { key, el } of KPI_TARGETS) {
    const row = metricasByModel.get(key);
    if (!row) continue;
    document.querySelector(el).innerHTML = modelCard(row);
  }
  document.querySelector("#kpi-carga").innerHTML = cargaOperativa(
    store.walkForward,
    store.baseline,
  );
}
