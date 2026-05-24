/**
 * Barras horizontales SHAP. Render global y local (Chad, Haiti).
 * Acepta el nuevo schema de feature_labels (objeto {label, operational}) o string legacy.
 */

function labelText(feat, labels) {
  const entry = labels[feat];
  if (!entry) return feat;
  if (typeof entry === "string") return entry;
  return entry.label || feat;
}

/**
 * Renderiza barras SHAP en un contenedor.
 * @param {HTMLElement|string} container
 * @param {Array<{feature, mean_shap, mean_abs_shap, shap?}>} rows
 * @param {{labels: Record<string,object|string>, top?: number, signed?: boolean}} opts
 */
export function renderShapBars(container, rows, opts) {
  const el = typeof container === "string" ? document.querySelector(container) : container;
  if (!el) return;
  const { labels, top = 25, signed = true } = opts;

  const normalized = rows
    .map((r) => {
      const ms = r.mean_shap != null ? Number(r.mean_shap) : Number(r.shap);
      const abs = r.mean_abs_shap != null ? Number(r.mean_abs_shap) : Math.abs(ms);
      return { feature: r.feature, mean_shap: ms, abs };
    })
    .filter((r) => isFinite(r.abs) && r.abs > 0);

  normalized.sort((a, b) => b.abs - a.abs);
  const slice = normalized.slice(0, top);
  if (slice.length === 0) {
    el.innerHTML = '<p class="note">Sin datos SHAP disponibles.</p>';
    return;
  }

  const maxAbs = slice[0].abs;
  el.innerHTML = slice
    .map((r) => {
      const pct = ((r.abs / maxAbs) * 50).toFixed(1);
      const lblText = labelText(r.feature, labels);
      const isPositive = r.mean_shap > 0;
      const fillStyle = signed
        ? `width:${pct}%; ${isPositive ? "left:50%; background:var(--shap-pos);" : "right:50%; left:auto; background:var(--shap-neg);"}`
        : `width:${(r.abs / maxAbs * 100).toFixed(1)}%; background:var(--shap-pos);`;
      return `
        <div class="shap-bar ${signed ? "signed" : ""}" title="${r.feature}">
          <div class="lbl">${lblText}</div>
          <div class="bar-track">
            <div class="bar-fill" style="${fillStyle}"></div>
          </div>
          <div class="num">${r.mean_shap.toFixed(3)}</div>
        </div>`;
    })
    .join("");
}

export function renderShapGlobal(store) {
  renderShapBars("#shap-global-bars", store.shapGlobal, {
    labels: store.featureLabels,
    top: 25,
    signed: true,
  });
}
