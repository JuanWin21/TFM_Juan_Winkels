/**
 * Carga y prepara todos los datos del dashboard (v2).
 * Anade: conflictos_activos_2024.json, helpers labelOf() / opOf(),
 * lastObservedRow por pais, sets de categorias.
 */

const DATA_DIR = "data/";

function normalize(s) {
  if (s == null) return "";
  return s
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.,'`]/g, "")
    .replace(/[\/]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");
}

function loadCsv(path, opts = {}) {
  return new Promise((resolve, reject) => {
    Papa.parse(DATA_DIR + path, {
      download: true,
      header: true,
      dynamicTyping: opts.dynamicTyping !== false,
      skipEmptyLines: true,
      complete: (res) => {
        if (res.errors && res.errors.length) {
          console.warn(`Papa errors en ${path}:`, res.errors.slice(0, 3));
        }
        resolve(res.data);
      },
      error: reject,
    });
  });
}

async function loadJson(path) {
  const r = await fetch(DATA_DIR + path);
  if (!r.ok) throw new Error(`No se pudo cargar ${path}: ${r.status}`);
  return r.json();
}

export async function loadAll() {
  const [
    predicciones,
    metricas,
    comparativa,
    walkForward,
    baseline,
    topK,
    shapGlobal,
    shapChad,
    shapHaiti,
    geojson,
    featureLabels,
    conflictos,
  ] = await Promise.all([
    loadCsv("predicciones_test_2024.csv"),
    loadCsv("metricas_test_2024_con_ic.csv", { dynamicTyping: false }),
    loadCsv("comparativa_target.csv"),
    loadCsv("walk_forward_xgboost.csv"),
    loadCsv("baseline_persistencia.csv"),
    loadCsv("top_k_precision.csv"),
    loadCsv("shap_global.csv"),
    loadCsv("shap_chad.csv"),
    loadCsv("shap_haiti.csv"),
    loadJson("world_countries_110m.geojson"),
    loadJson("feature_labels.json"),
    loadJson("conflictos_activos_2024.json"),
  ]);

  const cleanPred = predicciones.filter((r) => r.country_name);
  const countries = [...new Set(cleanPred.map((r) => r.country_name))].sort();
  const periods = [...new Set(cleanPred.map((r) => r.period))].sort();
  const lastPeriod = periods[periods.length - 1];

  // GeoJSON: indice de nombre normalizado -> ADMIN canonico
  const geoIndex = new Map();
  for (const feat of geojson.features) {
    const p = feat.properties;
    const admin = p.ADMIN || p.NAME || "";
    for (const key of ["NAME", "NAME_LONG", "ADMIN", "FORMAL_EN", "NAME_EN"]) {
      const v = p[key];
      if (v) geoIndex.set(normalize(v), admin);
    }
  }
  // Aliases manuales para nombres en otros datasets (JSON de conflictos) que no
  // matchean los campos NAME/ADMIN del GeoJSON Natural Earth.
  const NAME_ALIASES = [
    { from: "Burma/Myanmar", to: "Myanmar" },
    { from: "Türkiye", to: "Turkey" },
  ];
  for (const { from, to } of NAME_ALIASES) {
    const adminTo = geoIndex.get(normalize(to));
    if (adminTo) geoIndex.set(normalize(from), adminTo);
  }

  // CSV country_name -> ADMIN GeoJSON
  const csvToGeo = new Map();
  for (const c of countries) {
    const m = geoIndex.get(normalize(c));
    if (m) csvToGeo.set(c, m);
  }

  // Categorias del mapa: conjuntos por nombre CSV original
  const conflictoContinuoSet = new Set(conflictos.conflicto_continuo || []);
  const onsetMap = new Map();
  for (const o of conflictos.onset_durante_2024 || []) {
    onsetMap.set(o.country, o);
  }

  // Tambien creo sets por ADMIN del GeoJSON para lookups rapidos desde map.js
  const continuoAdminSet = new Set();
  for (const name of conflictoContinuoSet) {
    const admin = geoIndex.get(normalize(name));
    if (admin) continuoAdminSet.add(admin);
  }
  const onsetAdminMap = new Map();
  for (const [name, info] of onsetMap.entries()) {
    const admin = geoIndex.get(normalize(name));
    if (admin) onsetAdminMap.set(admin, { ...info, country: name });
  }

  // Indices por (ADMIN, period) y por country_name
  const byAdminPeriod = new Map();
  for (const row of cleanPred) {
    const admin = csvToGeo.get(row.country_name);
    if (!admin) continue;
    byAdminPeriod.set(`${admin}|${row.period}`, row);
  }

  const byCountry = new Map();
  for (const row of cleanPred) {
    const k = row.country_name;
    if (!byCountry.has(k)) byCountry.set(k, []);
    byCountry.get(k).push(row);
  }
  for (const arr of byCountry.values()) {
    arr.sort((a, b) => a.period.localeCompare(b.period));
  }

  // Ultimo registro observado por pais (puede no ser 2024-09 si salio antes)
  const lastObservedByCountry = new Map();
  for (const [c, rows] of byCountry.entries()) {
    lastObservedByCountry.set(c, rows[rows.length - 1]);
  }

  // ADMIN GeoJSON -> ultimo registro
  const lastObservedByAdmin = new Map();
  for (const [c, row] of lastObservedByCountry.entries()) {
    const admin = csvToGeo.get(c);
    if (admin) lastObservedByAdmin.set(admin, row);
  }

  // Helpers para etiquetas (schema v2: objeto {label, operational})
  function labelOf(featureKey) {
    const entry = featureLabels[featureKey];
    if (!entry) return featureKey;
    if (typeof entry === "string") return entry; // por si quedan strings sueltos
    return entry.label || featureKey;
  }
  function opOf(featureKey) {
    const entry = featureLabels[featureKey];
    if (!entry || typeof entry === "string") return null;
    return entry.operational || null;
  }

  return {
    // datos crudos
    predicciones: cleanPred,
    metricas,
    comparativa,
    walkForward,
    baseline,
    topK,
    shapGlobal,
    shapChad,
    shapHaiti,
    geojson,
    featureLabels,
    conflictos,
    // vistas
    countries,
    periods,
    lastPeriod,
    csvToGeo,
    byAdminPeriod,
    byCountry,
    lastObservedByCountry,
    lastObservedByAdmin,
    conflictoContinuoSet,
    continuoAdminSet,
    onsetMap,
    onsetAdminMap,
    // helpers
    normalize,
    labelOf,
    opOf,
  };
}
