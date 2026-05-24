/**
 * Ficha por pais (v4.1).
 *
 * - La timeline muestra los 9 meses del CSV del pais.
 * - Linea vertical sutil que marca el mes seleccionado por el slider global.
 * - El encabezado refleja el ESTADO DEL MES SELECCIONADO:
 *     - Si el pais esta en cat C ese mes (continuo OR onset alcanzado): "En conflicto activo" en gris.
 *     - Si tiene observacion ese mes (cat A): nivel de riesgo + score de ese mes.
 *     - Si no hay observacion y no es C: muestra la ultima observacion disponible.
 */

import { getCurrentPeriodIdx, subscribeMonth } from "./month-state.js";

let chart = null;
let store = null;
let currentCountry = null;
let selectedPeriodIdx = 0;

function riskBand(score) {
  if (score >= 0.85) return { label: "Riesgo muy alto", color: "#c62828", confidence: "Estimacion firme" };
  if (score >= 0.76) return { label: "Riesgo elevado", color: "#ef6c00", confidence: "Estimacion en el limite" };
  if (score >= 0.45) return { label: "Riesgo moderado", color: "#f9a825", confidence: null };
  return { label: "Estable", color: "#2e7d32", confidence: null };
}

function pointColor(score) {
  if (score >= 0.76) return "#c62828";
  if (score >= 0.45) return "#ef6c00";
  return "#7c8a9a";
}

function isInConflict(country, period) {
  if (store.conflictoContinuoSet.has(country)) return true;
  const onset = store.onsetMap.get(country);
  if (onset && period >= onset.since_month) return true;
  return false;
}

function renderHeader(country) {
  const el = document.getElementById("pais-header");
  const period = store.periods[selectedPeriodIdx];

  // Estado en el mes seleccionado
  if (isInConflict(country, period)) {
    const onset = store.onsetMap.get(country);
    const sub = onset
      ? `En conflicto activo desde ${onset.since_month}.`
      : `En conflicto activo durante todo el periodo observado.`;
    el.innerHTML = `
      <h3>${country}</h3>
      <p class="pais-meta">
        Mes seleccionado: <strong>${period}</strong>
        <span class="risk-pill risk-pill--conflict">En conflicto activo</span>
      </p>
      <p class="note">${sub} Fuera del alcance del sistema de alerta temprana.</p>`;
    return;
  }

  // Observacion en el mes seleccionado (cat A)
  const obs = store.byCountry.get(country)?.find((r) => r.period === period);
  if (obs) {
    const score = Number(obs.xgboost_score);
    const band = riskBand(score);
    const confLine = band.confidence ? `<span class="conf">${band.confidence}</span>` : "";
    el.innerHTML = `
      <h3>${country}</h3>
      <p class="pais-meta">
        Mes seleccionado: <strong>${period}</strong>
        <span class="risk-pill" style="background:${band.color}">${band.label}</span>
        ${confLine}
      </p>`;
    return;
  }

  // No esta en CSV este mes y no es C: cae a ultima observacion
  const last = store.lastObservedByCountry.get(country);
  if (last) {
    const score = Number(last.xgboost_score);
    const band = riskBand(score);
    const confLine = band.confidence ? `<span class="conf">${band.confidence}</span>` : "";
    el.innerHTML = `
      <h3>${country}</h3>
      <p class="pais-meta">
        Sin observacion en ${period}. Ultima disponible: <strong>${last.period}</strong>
        <span class="risk-pill" style="background:${band.color}">${band.label}</span>
        ${confLine}
      </p>`;
    return;
  }

  el.innerHTML = `<h3>${country}</h3><p class="note">Sin observaciones disponibles.</p>`;
}

// Plugin: linea vertical sutil en el mes seleccionado
const selectedMonthLinePlugin = {
  id: "selectedMonthLine",
  afterDatasetsDraw(c) {
    const periodLabel = store?.periods[selectedPeriodIdx];
    if (!periodLabel) return;
    const labels = c.data.labels || [];
    const idx = labels.indexOf(periodLabel);
    if (idx < 0) return;
    const x = c.scales.x.getPixelForValue(idx);
    const ctx = c.ctx;
    const top = c.chartArea.top;
    const bottom = c.chartArea.bottom;
    ctx.save();
    ctx.strokeStyle = "rgba(31, 58, 95, 0.45)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(31, 58, 95, 0.7)";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Mes seleccionado`, x + 4, top + 10);
    ctx.restore();
  },
};

function renderTimeline(country, rows) {
  const canvas = document.getElementById("pais-chart");
  if (chart) { chart.destroy(); chart = null; }
  if (!rows || rows.length === 0) {
    canvas.style.display = "none";
    return;
  }
  canvas.style.display = "";

  const labels = rows.map((r) => r.period);
  const data = rows.map((r) => Number(r.xgboost_score));

  chart = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Nivel de riesgo",
        data,
        borderColor: "#1f3a5f",
        backgroundColor: "#1f3a5f",
        tension: 0.2,
        pointRadius: data.map((v) => (v >= 0.76 ? 6 : 4)),
        pointBackgroundColor: data.map((v) => pointColor(v)),
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 1,
          title: { display: true, text: "Nivel de riesgo" },
          ticks: { callback: (v) => (v >= 0.76 ? "Alerta" : v >= 0.45 ? "Moderado" : "Bajo") },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (c) => {
              const v = c.parsed.y;
              return `${v >= 0.76 ? "Alerta" : v >= 0.45 ? "Moderado" : "Bajo"}`;
            },
          },
        },
      },
    },
    plugins: [selectedMonthLinePlugin],
  });
}

function renderFactors(country) {
  const el = document.getElementById("pais-factors");
  let rows = null;
  if (country === "Chad") rows = store.shapChad;
  else if (country === "Haiti") rows = store.shapHaiti;

  if (!rows) {
    el.innerHTML = "";
    el.style.display = "none";
    return;
  }
  el.style.display = "";

  const top = rows
    .map((r) => {
      const ms = r.mean_shap != null ? Number(r.mean_shap) : Number(r.shap);
      const abs = r.mean_abs_shap != null ? Number(r.mean_abs_shap) : Math.abs(ms);
      return { feature: r.feature, mean: ms, abs };
    })
    .filter((r) => isFinite(r.abs) && r.abs > 0)
    .sort((a, b) => b.abs - a.abs)
    .slice(0, 6);

  if (top.length === 0) {
    el.innerHTML = "";
    return;
  }

  const max = top[0].abs;
  const bars = top.map((r) => {
    const op = store.opOf(r.feature) || store.labelOf(r.feature);
    const pct = ((r.abs / max) * 100).toFixed(0);
    const isPos = r.mean > 0;
    const fill = isPos ? "#c62828" : "#1e88e5";
    const arrow = isPos ? "aumenta el riesgo" : "reduce el riesgo";
    return `
      <div class="factor-row">
        <div class="factor-lbl">${op}</div>
        <div class="factor-bar"><div class="factor-fill" style="width:${pct}%;background:${fill}"></div></div>
        <div class="factor-eff">${arrow}</div>
      </div>`;
  }).join("");

  el.innerHTML = `
    <h4>Factores principales</h4>
    <p class="note">Variables que mas pesan en la estimacion para este pais.</p>
    ${bars}`;
}

function show() {
  const sec = document.getElementById("pais");
  sec.classList.add("is-active");
  sec.scrollIntoView({ behavior: "smooth", block: "start" });
}

function render(country) {
  currentCountry = country;
  const rows = store.byCountry.get(country) || [];
  renderHeader(country);
  renderTimeline(country, rows);
  renderFactors(country);
  show();
}

export function initCountryCard(storeArg) {
  store = storeArg;
  selectedPeriodIdx = getCurrentPeriodIdx();

  document.addEventListener("country-selected", (e) => {
    const c = e.detail?.country;
    if (c && store.byCountry.has(c)) render(c);
  });

  subscribeMonth((idx) => {
    selectedPeriodIdx = idx;
    // Si la ficha esta abierta: re-renderiza header (estado del mes) y refresca chart (linea vertical)
    if (currentCountry) renderHeader(currentCountry);
    if (chart) chart.update("none");
  });

  const closeBtn = document.getElementById("pais-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      document.getElementById("pais").classList.remove("is-active");
    });
  }
}
