/**
 * Orquestador de acerca.html (documentacion tecnica).
 * Inicializa: KPIs, walk-forward, comparativa, top-K, SHAP global,
 * simulador de umbral, tabla, lightbox.
 *
 * No carga ni el mapa ni el modulo de tarjetas operativas.
 */

import { loadAll } from "./data.js";
import { renderKpis } from "./kpis.js";
import { renderWalkForward, renderComparativa, renderTopK } from "./charts.js";
import { renderShapGlobal } from "./shap.js";
import { initThresholdSim } from "./threshold-sim.js";
import { initTable } from "./table.js";
import { initLightbox } from "./lightbox.js";
import { renderCasosReales } from "./casos-reales.js";

function showError(msg) {
  const div = document.createElement("div");
  div.style.cssText = "background:#b71c1c;color:white;padding:1rem;text-align:center;font-family:sans-serif;";
  div.textContent = `Error: ${msg}. Asegurate de servir el dashboard con "python -m http.server" desde la raiz del proyecto.`;
  document.body.prepend(div);
}

async function bootstrap() {
  try {
    const store = await loadAll();
    renderKpis(store);
    renderWalkForward(store);
    renderComparativa(store);
    renderTopK(store);
    renderShapGlobal(store);
    initThresholdSim(store, null);
    initTable(store);
    renderCasosReales(store);
    initLightbox();
    console.info("acerca.html listo.");
  } catch (e) {
    console.error(e);
    showError(e.message || e.toString());
  }
}

bootstrap();
