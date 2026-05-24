/**
 * Resumen del mes seleccionado (v4.1).
 *
 * Tres numeros con diff individual respecto al mes anterior, mas una linea
 * narrativa que explicita las transiciones de "alerta" a "conflicto activo"
 * del mes (los paises que dejaron de aparecer en CSV porque entraron en
 * conflicto). Esa narrativa es la "verdad numerica": una baja de alertas
 * por transicion no es lo mismo que una baja por moderacion del riesgo.
 */

import { getCurrentPeriodIdx, subscribeMonth } from "./month-state.js";

const ALERT_THRESHOLD = 0.76;
const FOLLOW_THRESHOLD = 0.45;

function countsForPeriod(store, period) {
  let alerts = 0;
  let follow = 0;
  const alertCountries = new Set();
  for (const r of store.predicciones) {
    if (r.period !== period) continue;
    const s = Number(r.xgboost_score);
    if (s >= ALERT_THRESHOLD) { alerts++; alertCountries.add(r.country_name); }
    else if (s >= FOLLOW_THRESHOLD) follow++;
  }
  // Cat C: continuo + onset alcanzado
  let conflict = store.continuoAdminSet.size;
  for (const info of store.onsetAdminMap.values()) {
    if (period >= info.since_month) conflict++;
  }
  return { alerts, follow, conflict, alertCountries };
}

function fmtDiff(d) {
  if (d === 0) return `<span class="diff diff--neutral">sin cambios</span>`;
  const sign = d > 0 ? "+" : "";
  const cls = d > 0 ? "diff--up" : "diff--down";
  return `<span class="diff ${cls}">${sign}${d}</span>`;
}

function transitionLine(store, period, prevPeriod) {
  if (!prevPeriod) return "";
  // Onsets cuyo since_month === period: paises que JUSTO entraron en conflicto este mes
  const justEntered = [];
  for (const info of store.onsetAdminMap.values()) {
    if (info.since_month === period) justEntered.push(info.country);
  }
  if (justEntered.length === 0) return "";
  const list = justEntered.join(", ");
  const verb = justEntered.length === 1 ? "transito" : "transitaron";
  return `<div class="transition-line">
    <strong>${list}</strong> ${verb} a conflicto activo este mes.
  </div>`;
}

function render(store, periodIdx) {
  const period = store.periods[periodIdx];
  const prevPeriod = periodIdx > 0 ? store.periods[periodIdx - 1] : null;
  const curr = countsForPeriod(store, period);
  const prev = prevPeriod ? countsForPeriod(store, prevPeriod) : null;

  const dAlerts = prev ? curr.alerts - prev.alerts : null;
  const dFollow = prev ? curr.follow - prev.follow : null;
  const dConflict = prev ? curr.conflict - prev.conflict : null;

  const el = document.getElementById("summary-block");
  el.innerHTML = `
    <div class="summary-item">
      <div class="summary-num">${curr.alerts}</div>
      <div class="summary-lbl">paises en alerta activa</div>
      <div class="summary-diff">${dAlerts !== null ? fmtDiff(dAlerts) : '<span class="diff diff--neutral">primer mes</span>'}</div>
    </div>
    <div class="summary-item">
      <div class="summary-num">${curr.follow}</div>
      <div class="summary-lbl">paises en seguimiento</div>
      <div class="summary-diff">${dFollow !== null ? fmtDiff(dFollow) : '<span class="diff diff--neutral">primer mes</span>'}</div>
    </div>
    <div class="summary-item">
      <div class="summary-num">${curr.conflict}</div>
      <div class="summary-lbl">paises en conflicto activo</div>
      <div class="summary-diff">${dConflict !== null ? fmtDiff(dConflict) : '<span class="diff diff--neutral">primer mes</span>'}</div>
    </div>`;

  const cmpEl = document.getElementById("summary-compare");
  if (cmpEl) {
    const trans = transitionLine(store, period, prevPeriod);
    cmpEl.innerHTML = trans
      || (prevPeriod
            ? `<span class="cmp cmp--neutral">Cambios respecto a ${prevPeriod}. Sin nuevas transiciones a conflicto activo.</span>`
            : `<span class="cmp cmp--neutral">Primer mes del periodo observado.</span>`);
  }
}

export function renderSummary(store) {
  render(store, getCurrentPeriodIdx());
  subscribeMonth((idx) => render(store, idx));
}
