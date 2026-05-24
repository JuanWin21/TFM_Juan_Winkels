/**
 * Simulador de umbral aplicado SOLO a XGBoost.
 * Recalcula TP/FP/FN/TN, precision, recall, F1 sobre las predicciones 2024
 * y reescribe la tabla de alertas.
 *
 * Si "Recolorear mapa" esta activo, llama a mapApi.applyCustomThreshold(thr).
 */

function metrics(rows, thr) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const r of rows) {
    const score = Number(r.xgboost_score);
    const target = Number(r.target);
    const alert = score >= thr ? 1 : 0;
    if (alert === 1 && target === 1) tp++;
    else if (alert === 1 && target === 0) fp++;
    else if (alert === 0 && target === 1) fn++;
    else tn++;
  }
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  return { tp, fp, fn, tn, precision, recall, f1, alertas: tp + fp };
}

function renderMetrics(target, m) {
  target.innerHTML = `
    <h3>Confusion y metricas</h3>
    <table class="conf-table">
      <thead>
        <tr><th></th><th>Pred 0</th><th>Pred 1</th></tr>
      </thead>
      <tbody>
        <tr><th>Real 0</th><td class="conf-tn">${m.tn}</td><td class="conf-fp">${m.fp}</td></tr>
        <tr><th>Real 1</th><td class="conf-fn">${m.fn}</td><td class="conf-tp">${m.tp}</td></tr>
      </tbody>
    </table>
    <ul class="metric-list">
      <li><span>Alertas totales</span><span class="val">${m.alertas}</span></li>
      <li><span>Precision</span><span class="val">${(m.precision * 100).toFixed(1)}%</span></li>
      <li><span>Recall</span><span class="val">${(m.recall * 100).toFixed(1)}%</span></li>
      <li><span>F1</span><span class="val">${(m.f1 * 100).toFixed(1)}%</span></li>
    </ul>
  `;
}

function renderAlertsTable(tbody, rows, thr) {
  const filtered = rows
    .filter((r) => Number(r.xgboost_score) >= thr)
    .sort((a, b) => Number(b.xgboost_score) - Number(a.xgboost_score));
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="note" style="padding:0.75rem;">Sin alertas a este umbral.</td></tr>`;
    return;
  }
  tbody.innerHTML = filtered
    .map((r) => {
      const truthCls = Number(r.target) === 1 ? "is-truth" : "";
      return `<tr class="${truthCls}">
        <td>${r.country_name}</td>
        <td>${r.period}</td>
        <td>${Number(r.xgboost_score).toFixed(3)}</td>
        <td>${r.target}</td>
      </tr>`;
    })
    .join("");
}

export function initThresholdSim(store, mapApi) {
  const slider = document.getElementById("threshold-slider");
  const valEl = document.getElementById("threshold-value");
  const applyMap = document.getElementById("threshold-apply-map");
  const metricsEl = document.getElementById("thr-metrics");
  const tbody = document.querySelector("#thr-alerts tbody");

  function refresh() {
    const thr = Number(slider.value);
    valEl.textContent = thr.toFixed(2);
    const m = metrics(store.predicciones, thr);
    renderMetrics(metricsEl, m);
    renderAlertsTable(tbody, store.predicciones, thr);
    if (applyMap.checked && mapApi) mapApi.applyCustomThreshold(thr);
  }

  // Throttle ligero
  let raf = 0;
  slider.addEventListener("input", () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; refresh(); });
  });
  applyMap.addEventListener("change", () => {
    if (applyMap.checked) mapApi?.applyCustomThreshold(Number(slider.value));
    else mapApi?.applyCustomThreshold(null);
  });

  refresh();
}
