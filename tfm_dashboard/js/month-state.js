/**
 * Estado central del mes seleccionado (v4).
 * Monta el slider global y notifica a los modulos suscritos al cambiar.
 *
 * Uso:
 *   import { initMonthState, getCurrentPeriodIdx, getCurrentPeriod, subscribeMonth } from "./month-state.js";
 *   initMonthState(store);  // arranca con el ultimo mes del CSV
 *   subscribeMonth((idx, period) => { ... });
 */

let currentPeriodIdx = 0;
const subscribers = [];
let storeRef = null;

export function initMonthState(store) {
  storeRef = store;
  currentPeriodIdx = store.periods.length - 1; // default: ultimo mes (2024-09)

  const slider = document.getElementById("month-input");
  const label = document.getElementById("month-label");
  console.info("[month-state] init", {
    sliderFound: !!slider,
    labelFound: !!label,
    periods: store.periods.length,
    defaultIdx: currentPeriodIdx,
  });
  if (!slider || !label) {
    console.error("month-state: no se encontro #month-input o #month-label en el DOM");
    return;
  }
  // Usar setAttribute para garantizar que el browser reconoce el rango ampliado
  slider.setAttribute("min", "0");
  slider.setAttribute("max", String(store.periods.length - 1));
  slider.setAttribute("value", String(currentPeriodIdx));
  slider.value = currentPeriodIdx;
  label.textContent = store.periods[currentPeriodIdx];

  const fire = (idx) => {
    currentPeriodIdx = idx;
    label.textContent = store.periods[currentPeriodIdx];
    const period = store.periods[currentPeriodIdx];
    console.debug("[month-state] cambio", { idx, period, subs: subscribers.length });
    for (const cb of subscribers) {
      try { cb(currentPeriodIdx, period); } catch (err) { console.error("[month-state] subscriber error:", err); }
    }
  };

  slider.addEventListener("input", (e) => fire(Number(e.target.value)));
  slider.addEventListener("change", (e) => fire(Number(e.target.value)));
}

export function getCurrentPeriodIdx() {
  return currentPeriodIdx;
}

export function getCurrentPeriod(store) {
  const s = store || storeRef;
  if (!s) return null;
  return s.periods[currentPeriodIdx];
}

export function subscribeMonth(cb) {
  subscribers.push(cb);
}
