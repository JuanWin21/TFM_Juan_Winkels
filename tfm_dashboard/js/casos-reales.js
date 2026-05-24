/**
 * Subseccion de acerca.html: validacion ex-post con los 4 paises que
 * transitaron de paz a conflicto armado durante 2024.
 *
 * Por cada pais en `onset_durante_2024`:
 *  - Encabezado: nombre, mes de onset, contexto del JSON.
 *  - Tabla con sus filas pre-onset: mes, score XGBoost, alerta XGBoost, target.
 *  - Mini grafico de la serie de scores hasta el onset.
 *  - Comentario interpretativo automatico (alerto / no alerto antes del onset).
 */

const THRESHOLD = 0.76;
const charts = [];

function fmt(v, decimals = 3) {
  const n = Number(v);
  return isFinite(n) ? n.toFixed(decimals) : "--";
}

function preOnsetRows(country, onsetMonth, store) {
  const all = store.byCountry.get(country) || [];
  // Filas con periodo < onsetMonth (lexicograficamente, formato YYYY-MM)
  return all.filter((r) => r.period < onsetMonth);
}

function interpretive(rows) {
  const hits = rows.filter((r) => Number(r.xgboost_alert) === 1).length;
  if (rows.length === 0) {
    return {
      tone: "neutral",
      text: "No hay observaciones pre-onset disponibles en el CSV.",
    };
  }
  if (hits > 0) {
    return {
      tone: "ok",
      text: `El sistema emitio alerta correcta en ${hits} de ${rows.length} meses pre-onset.`,
    };
  }
  return {
    tone: "warn",
    text: `El sistema no detecto el caso: ${rows.length} meses pre-onset sin alerta.`,
  };
}

function renderTable(rows) {
  if (rows.length === 0) {
    return '<p class="note">Sin filas pre-onset.</p>';
  }
  const head = `
    <tr>
      <th>Mes</th>
      <th>Score XGBoost</th>
      <th>Alerta</th>
      <th>Target</th>
    </tr>`;
  const body = rows
    .map((r) => `
      <tr class="${Number(r.xgboost_alert) === 1 ? "is-alert" : ""}">
        <td>${r.period}</td>
        <td>${fmt(r.xgboost_score, 3)}</td>
        <td>${r.xgboost_alert}</td>
        <td>${r.target}</td>
      </tr>`)
    .join("");
  return `
    <div class="table-scroll">
      <table>
        <thead>${head}</thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

function renderCard(info, store, idx) {
  const country = info.country;
  const rows = preOnsetRows(country, info.since_month, store);
  const interp = interpretive(rows);
  const toneCls = interp.tone === "ok" ? "interp--ok" : interp.tone === "warn" ? "interp--warn" : "interp--neutral";

  return `
    <article class="caso-real">
      <header class="caso-real__head">
        <h3>${country}</h3>
        <span class="caso-real__onset">Onset: <strong>${info.since_month}</strong></span>
      </header>
      <p class="caso-real__ctx">${info.context}</p>
      <div class="caso-real__grid">
        <div class="caso-real__chart">
          <h4>Serie de scores pre-onset</h4>
          <div class="canvas-wrap"><canvas id="caso-chart-${idx}"></canvas></div>
        </div>
        <div class="caso-real__table">
          <h4>Filas pre-onset en el CSV</h4>
          ${renderTable(rows)}
        </div>
      </div>
      <p class="caso-real__interp ${toneCls}">${interp.text}</p>
    </article>`;
}

function renderChart(canvasId, rows) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || rows.length === 0) return;
  const ctx = canvas.getContext("2d");
  const c = new Chart(ctx, {
    type: "line",
    data: {
      labels: rows.map((r) => r.period),
      datasets: [{
        label: "Score XGBoost",
        data: rows.map((r) => Number(r.xgboost_score)),
        borderColor: "#1f3a5f",
        backgroundColor: "#1f3a5f",
        tension: 0.2,
        pointRadius: rows.map((r) => (Number(r.xgboost_alert) === 1 ? 6 : 4)),
        pointBackgroundColor: rows.map((r) => (Number(r.xgboost_alert) === 1 ? "#c62828" : "#7c8a9a")),
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 1,
          ticks: { callback: (v) => v.toFixed(2) },
        },
      },
      plugins: {
        legend: { display: false },
        annotation: {
          annotations: {
            threshold: {
              type: "line",
              yMin: THRESHOLD,
              yMax: THRESHOLD,
              borderColor: "rgba(198, 40, 40, 0.6)",
              borderWidth: 1,
              borderDash: [4, 4],
              label: { display: false },
            },
          },
        },
      },
    },
  });
  charts.push(c);
}

export function renderCasosReales(store) {
  const container = document.getElementById("casos-reales-container");
  if (!container) return;
  const onsets = store.conflictos?.onset_durante_2024 || [];
  if (onsets.length === 0) {
    container.innerHTML = '<p class="note">Sin casos onset en el periodo.</p>';
    return;
  }
  container.innerHTML = onsets.map((info, i) => renderCard(info, store, i)).join("");
  onsets.forEach((info, i) => {
    const rows = preOnsetRows(info.country, info.since_month, store);
    renderChart(`caso-chart-${i}`, rows);
  });
}
