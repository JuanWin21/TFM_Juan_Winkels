/**
 * Mapa operativo v4: usa el estado global de mes (month-state.js).
 *
 * Categorias (sin cambios respecto a v3):
 *   A) Analizado: en CSV en el mes actual. Gradiente por score XGBoost.
 *   C) En conflicto activo: conflicto_continuo OR (onset con since_month <= mes).
 *   D) Sin datos.
 */

import { getCurrentPeriodIdx, getCurrentPeriod, subscribeMonth } from "./month-state.js";

const RISK_BANDS = [
  { min: 0.76, color: "#c62828", label: "Riesgo muy alto" },
  { min: 0.65, color: "#ef6c00", label: "Riesgo elevado" },
  { min: 0.45, color: "#f9a825", label: "Riesgo moderado" },
  { min: 0.0,  color: "#a5d6a7", label: "Estable" },
];

function bandFor(score) {
  if (score == null || isNaN(score)) return RISK_BANDS[RISK_BANDS.length - 1];
  for (const b of RISK_BANDS) if (score >= b.min) return b;
  return RISK_BANDS[RISK_BANDS.length - 1];
}

const COLOR_NO_DATA = "#f0f0f0";
const COLOR_HATCH_BG = "#9e9e9e";

let map;
let geoLayer;
let store;
let mapState = {
  periodIdx: -1,
  customThreshold: null,
};

function injectHatchPattern() {
  const svg = document.querySelector(".leaflet-overlay-pane svg");
  if (!svg) return;
  if (svg.querySelector("#hatch-conflicto")) return;
  const ns = "http://www.w3.org/2000/svg";
  const defs = document.createElementNS(ns, "defs");
  defs.innerHTML = `
    <pattern id="hatch-conflicto" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
      <rect width="8" height="8" fill="${COLOR_HATCH_BG}"/>
      <line x1="0" y1="0" x2="0" y2="8" stroke="#666" stroke-width="2"/>
    </pattern>`;
  svg.insertBefore(defs, svg.firstChild);
}

function categoryOf(adminName) {
  const period = store.periods[mapState.periodIdx];
  if (store.byAdminPeriod.has(`${adminName}|${period}`)) return "A";
  if (store.continuoAdminSet.has(adminName)) return "C";
  const onset = store.onsetAdminMap.get(adminName);
  if (onset && period >= onset.since_month) return "C";
  return "D";
}

function currentRecord(adminName) {
  const period = store.periods[mapState.periodIdx];
  return store.byAdminPeriod.get(`${adminName}|${period}`) || null;
}

function styleFor(feature) {
  const admin = feature.properties.ADMIN || feature.properties.NAME;
  const cat = categoryOf(admin);

  if (cat === "D") {
    return {
      fillColor: COLOR_NO_DATA,
      fillOpacity: 0.85,
      color: "#cccccc",
      weight: 0.5,
      className: "cat-d",
    };
  }
  if (cat === "C") {
    return {
      fillColor: COLOR_HATCH_BG,
      fillOpacity: 1,
      color: "#666",
      weight: 0.6,
      className: "cat-c",
    };
  }
  const r = currentRecord(admin);
  let score = r ? Number(r.xgboost_score) : null;
  if (mapState.customThreshold != null && r) {
    const fill = score >= mapState.customThreshold ? "#c62828" : "#e5f5e0";
    return {
      fillColor: fill,
      fillOpacity: 0.85,
      color: "#666",
      weight: 0.6,
      className: "cat-a",
    };
  }
  const band = bandFor(score);
  return {
    fillColor: band.color,
    fillOpacity: 0.85,
    color: "#666",
    weight: 0.6,
    className: "cat-a",
  };
}

function csvNameForAdmin(adminName) {
  for (const [csv, admin] of store.csvToGeo.entries()) {
    if (admin === adminName) return csv;
  }
  return null;
}

function tooltipHtml(adminName) {
  const cat = categoryOf(adminName);
  if (cat === "D") {
    return `<strong>${adminName}</strong><br>Sin datos disponibles.`;
  }
  if (cat === "C") {
    return `<strong>${adminName}</strong><br>En conflicto activo. Fuera del alcance del sistema (que opera solo sobre paises en paz).`;
  }
  const r = currentRecord(adminName);
  const csv = csvNameForAdmin(adminName);
  if (!r) return `<strong>${csv || adminName}</strong><br>Sin observacion en este mes.`;
  const band = bandFor(Number(r.xgboost_score));
  return `<strong>${csv}</strong><br>${band.label}<br>Ultima observacion: ${r.period}`;
}

function onEachFeature(feature, layer) {
  const admin = feature.properties.ADMIN || feature.properties.NAME;

  layer.bindTooltip(() => tooltipHtml(admin), { sticky: true, className: "country-tip" });

  layer.on({
    mouseover: (e) => {
      const cat = categoryOf(admin);
      if (cat !== "A") return;
      e.target.setStyle({ weight: 1.6, color: "#1c1f23" });
      e.target.bringToFront();
    },
    mouseout: (e) => geoLayer.resetStyle(e.target),
    click: () => {
      const cat = categoryOf(admin);
      if (cat !== "A") return;
      const csv = csvNameForAdmin(admin);
      if (csv) {
        document.dispatchEvent(new CustomEvent("country-selected", { detail: { country: csv } }));
      }
    },
  });
}

function buildLegend() {
  const legend = L.control({ position: "bottomleft" });
  legend.onAdd = function () {
    const div = L.DomUtil.create("div", "map-legend");
    div.innerHTML = `
      <h4>Leyenda</h4>
      <div class="legend-section">
        <div class="legend-section-title">Paises analizados (en paz)</div>
        ${RISK_BANDS.map((b) => `
          <div class="legend-row-item">
            <span class="legend-swatch" style="background:${b.color}"></span>
            ${b.label}
          </div>`).join("")}
      </div>
      <div class="legend-section">
        <div class="legend-row-item">
          <span class="legend-swatch legend-swatch--hatch"></span>
          En conflicto activo (fuera de alcance)
        </div>
        <div class="legend-row-item">
          <span class="legend-swatch" style="background:${COLOR_NO_DATA};border:1px solid #ddd"></span>
          Sin datos disponibles
        </div>
      </div>`;
    L.DomEvent.disableClickPropagation(div);
    return div;
  };
  legend.addTo(map);
}

export function initMap(storeArg) {
  store = storeArg;
  mapState.periodIdx = getCurrentPeriodIdx();

  map = L.map("map", {
    worldCopyJump: true,
    zoomSnap: 0.5,
    minZoom: 1.5,
    maxZoom: 6,
    attributionControl: false,
  }).setView([15, 10], 1.8);

  geoLayer = L.geoJSON(store.geojson, {
    style: styleFor,
    onEachFeature,
  }).addTo(map);

  injectHatchPattern();
  buildLegend();

  subscribeMonth((idx) => {
    mapState.periodIdx = idx;
    geoLayer.setStyle(styleFor);
  });

  return {
    applyCustomThreshold(thr) {
      mapState.customThreshold = thr;
      geoLayer.setStyle(styleFor);
    },
  };
}
