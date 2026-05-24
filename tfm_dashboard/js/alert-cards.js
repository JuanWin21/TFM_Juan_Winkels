/**
 * Tarjetas de alerta del mes seleccionado (v4).
 * Filtra por xgboost_score >= 0.45 y agrupa en dos secciones:
 *   - "Alertas activas" (>= 0.76)
 *   - "Paises en seguimiento" (0.45 - 0.76)
 * Niveles internos:
 *   >= 0.85           Riesgo muy alto      rojo intenso
 *   0.76 <= s < 0.85  Riesgo elevado       naranja
 *   0.65 <= s < 0.76  Riesgo moderado-alto amarillo oscuro
 *   0.45 <= s < 0.65  En seguimiento       amarillo claro
 */

import { getCurrentPeriodIdx, subscribeMonth } from "./month-state.js";

const ALERT_THRESHOLD = 0.76;
const FOLLOW_THRESHOLD = 0.45;

function levelOf(score) {
  if (score >= 0.85) return { risk: "Riesgo muy alto", color: "#c62828", confidence: "Estimacion firme" };
  if (score >= 0.76) return { risk: "Riesgo elevado", color: "#ef6c00", confidence: "Estimacion en el limite" };
  if (score >= 0.65) return { risk: "Riesgo moderado-alto", color: "#b58b00", confidence: null };
  return { risk: "En seguimiento", color: "#a78b00", confidence: null };
}

function cardHtml(r) {
  const score = Number(r.xgboost_score);
  const lvl = levelOf(score);
  const conf = lvl.confidence ? `<p class="conf-line">${lvl.confidence}</p>` : "";
  return `
    <article class="alert-card" data-country="${r.country_name}" style="border-left-color:${lvl.color}">
      <header>
        <h3>${r.country_name}</h3>
      </header>
      <p class="risk-line" style="color:${lvl.color}">
        <strong>${lvl.risk}</strong>
      </p>
      ${conf}
      <button class="alert-card__open" type="button">Ver detalle del pais</button>
    </article>`;
}

function groupHtml(title, items) {
  if (items.length === 0) return "";
  const cards = items.map(cardHtml).join("");
  return `
    <div class="alert-group">
      <h3 class="alert-group__title">${title} <span class="alert-group__count">(${items.length})</span></h3>
      <div class="alert-cards-grid">${cards}</div>
    </div>`;
}

function render(store, periodIdx) {
  const period = store.periods[periodIdx];

  // Titulo dinamico de la seccion
  const titleEl = document.getElementById("alerts-title");
  if (titleEl) titleEl.textContent = `Alertas - ${period}`;

  const rows = store.predicciones
    .filter((r) => r.period === period && Number(r.xgboost_score) >= FOLLOW_THRESHOLD)
    .sort((a, b) => Number(b.xgboost_score) - Number(a.xgboost_score));

  const alerts = rows.filter((r) => Number(r.xgboost_score) >= ALERT_THRESHOLD);
  const follow = rows.filter((r) => {
    const s = Number(r.xgboost_score);
    return s >= FOLLOW_THRESHOLD && s < ALERT_THRESHOLD;
  });

  const container = document.getElementById("alert-cards");
  if (alerts.length === 0 && follow.length === 0) {
    container.innerHTML = `<p class="note">Sin paises en alerta o seguimiento en ${period}.</p>`;
    return;
  }

  container.innerHTML =
    groupHtml("Alertas activas", alerts) +
    groupHtml("Paises en seguimiento", follow);

  container.querySelectorAll(".alert-card").forEach((el) => {
    el.addEventListener("click", () => {
      const c = el.dataset.country;
      document.dispatchEvent(new CustomEvent("country-selected", { detail: { country: c } }));
    });
  });
}

export function renderAlertCards(store) {
  render(store, getCurrentPeriodIdx());
  subscribeMonth((idx) => render(store, idx));
}
