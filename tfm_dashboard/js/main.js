/**
 * Orquestador de la pagina principal (v4).
 * Orden: hero -> initMonthState -> summary -> alert-cards -> map -> country-card.
 * Los modulos posteriores a initMonthState leen el mes inicial y se suscriben
 * a los cambios.
 */

import { loadAll } from "./data.js";
import { renderHero } from "./hero.js";
import { initMonthState } from "./month-state.js";
import { renderSummary } from "./summary.js";
import { renderAlertCards } from "./alert-cards.js";
import { initMap } from "./map.js";
import { initCountryCard } from "./country-card.js";

function showError(msg) {
  const div = document.createElement("div");
  div.style.cssText = "background:#b71c1c;color:white;padding:1rem;text-align:center;font-family:sans-serif;";
  div.textContent = `Error: ${msg}. Asegurate de servir el dashboard con "python -m http.server" desde la raiz del proyecto.`;
  document.body.prepend(div);
}

async function bootstrap() {
  try {
    const store = await loadAll();
    renderHero();
    initMonthState(store);
    renderSummary(store);
    renderAlertCards(store);
    initMap(store);
    initCountryCard(store);
    console.info(
      `Dashboard operativo v4 listo. ${store.countries.length} paises analizados, ${store.periods.length} meses (default ${store.lastPeriod}).`,
    );
  } catch (e) {
    console.error(e);
    showError(e.message || e.toString());
  }
}

bootstrap();
