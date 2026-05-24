/**
 * Graficos basados en Chart.js: walk-forward temporal, comparativa target, precision@k.
 */

const COLORS = {
  xgboost: "#1f3a5f",
  baseline: "#b71c1c",
  lightgbm: "#3b6ea5",
  consenso: "#2e7d32",
  intra: "#ed6c02",
  original: "#1f3a5f",
};

export function renderWalkForward(store) {
  const ctx = document.getElementById("walkforward-chart").getContext("2d");
  const years = store.walkForward.map((r) => r.year);
  const sel = document.getElementById("wf-metric");

  function build(metric) {
    return {
      type: "line",
      data: {
        labels: years,
        datasets: [
          {
            label: `XGBoost ${metric}`,
            data: store.walkForward.map((r) => Number(r[metric])),
            borderColor: COLORS.xgboost,
            backgroundColor: COLORS.xgboost,
            tension: 0.2,
            pointRadius: 4,
          },
          {
            label: `Baseline ${metric}`,
            data: store.baseline.map((r) => Number(r[metric])),
            borderColor: COLORS.baseline,
            backgroundColor: COLORS.baseline,
            borderDash: [5, 4],
            tension: 0.2,
            pointRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, max: 1, ticks: { callback: (v) => (v * 100).toFixed(0) + "%" } },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${(ctx.parsed.y * 100).toFixed(1)}%`,
            },
          },
        },
      },
    };
  }

  let chart = new Chart(ctx, build(sel.value));
  sel.addEventListener("change", () => {
    chart.destroy();
    chart = new Chart(ctx, build(sel.value));
  });
}

export function renderComparativa(store) {
  const ctx = document.getElementById("comparativa-chart").getContext("2d");
  const rows = store.comparativa;
  const labels = rows.map((r) => `${r.estrategia} (${r.target})`);
  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Precision", data: rows.map((r) => Number(r.precision)), backgroundColor: "#1f3a5f" },
        { label: "Recall", data: rows.map((r) => Number(r.recall)), backgroundColor: "#3b6ea5" },
        { label: "F1", data: rows.map((r) => Number(r.f1)), backgroundColor: "#2e7d32" },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, max: 1, ticks: { callback: (v) => (v * 100).toFixed(0) + "%" } },
        x: { ticks: { font: { size: 10 } } },
      },
      plugins: {
        tooltip: {
          callbacks: { label: (c) => `${c.dataset.label}: ${(c.parsed.y * 100).toFixed(1)}%` },
        },
      },
    },
  });
}

export function renderTopK(store) {
  const ctx = document.getElementById("topk-chart").getContext("2d");
  const rows = store.topK;
  const ks = [...new Set(rows.map((r) => Number(r.k)))].sort((a, b) => a - b);
  const models = [...new Set(rows.map((r) => r.modelo))];
  const palette = { XGBoost: "#1f3a5f", LightGBM: "#3b6ea5", "Consenso (min)": "#2e7d32" };
  const datasets = models.map((m) => ({
    label: m,
    data: ks.map((k) => {
      const r = rows.find((x) => x.modelo === m && Number(x.k) === k);
      return r ? Number(r["precision@k"]) : null;
    }),
    borderColor: palette[m] || "#888",
    backgroundColor: palette[m] || "#888",
    tension: 0.2,
    pointRadius: 4,
  }));

  new Chart(ctx, {
    type: "line",
    data: { labels: ks, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: "k" } },
        y: { beginAtZero: true, max: 1, ticks: { callback: (v) => (v * 100).toFixed(0) + "%" } },
      },
      plugins: {
        tooltip: {
          callbacks: { label: (c) => `${c.dataset.label} @${c.label}: ${(c.parsed.y * 100).toFixed(1)}%` },
        },
      },
    },
  });
}
