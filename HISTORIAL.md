# Historial de la investigación

**Sistema de alerta temprana de conflicto armado — TFM**

Este documento narra el proceso de investigación de forma cronológica, integrando todas las fases del trabajo. Está pensado como complemento del notebook consolidado y del README: donde el notebook documenta el estado final y el README sintetiza el contexto, este historial reconstruye cómo se llegó hasta ahí, qué se intentó, qué funcionó, qué no, y por qué se tomaron las decisiones que se tomaron. La narrativa avanza en paralelo a los hallazgos: cada decisión se sitúa en su contexto y se justifica por la evidencia que la motivó.

---

## Fase 0 — Planteamiento inicial

El proyecto se inició con una pregunta amplia: ¿es posible construir un sistema cuantitativo de alerta temprana de conflicto armado a partir de fuentes públicas? La pregunta surgió de la motivación personal del autor (formación previa en Relaciones Internacionales) y se concretó tras una revisión preliminar de la literatura del campo: proyectos como ViEWS (Uppsala University) o ACLED CAST muestran que el problema es abordable computacionalmente pero está lejos de estar resuelto. El TFM se planteó desde el principio con expectativas realistas: no producir un sistema definitivo, sino aprender el oficio de evaluarlo rigurosamente.

La primera revisión estructural del repositorio identificó:

- Datasets disponibles a granularidad país-año procedentes de la literatura clásica del campo: UCDP/PRIO, MID, ATOP, NMC/COW.
- Datos socioeconómicos del Banco Mundial (WDI), gasto militar (SIPRI), índices de democracia (V-Dem).
- Un dataset de tecnología armamentística histórica.
- Scripts iniciales (`build_target.py`, `build_features.py`) para generar la variable objetivo, así como lags, medias móviles, deltas y otras variables temporales.

La unidad de análisis quedó fijada desde el principio como **país-mes**, una granularidad temporal más fina que la habitual en la literatura académica clásica (país-año), justificada por dos consideraciones: (i) permitir detección de transiciones agudas, no solo de tendencias anuales; (ii) aprovechar la granularidad disponible en ACLED.

---

## Fase 1 — Trabajo exploratorio sobre dataset histórico (1975-2025)

La primera versión del dataset cubría aproximadamente 50 años de historia (1975-2025), construida principalmente sobre fuentes país-año interpoladas a granularidad mensual. Sobre este dataset se desarrollaron los primeros notebooks de modelado, donde se probaron sistemáticamente cinco algoritmos:

- Regresión logística (modelo lineal de referencia)
- Random Forest (ensemble de árboles con bagging)
- HistGradientBoosting (variante eficiente de gradient boosting)
- Árbol de decisión simple (referencia interpretable)
- XGBoost (gradient boosting de referencia en el campo)

Esta primera ronda comparativa estableció un orden de magnitud orientativo de qué era razonable esperar, y reveló los problemas estructurales que dominarían el resto del proyecto:

1. **Desbalance extremo de clases**: la proporción de positivos sobre el total raramente superaba el 1%, lo que invalidaba métricas estándar como accuracy y exigía técnicas específicas (reponderación, métricas adaptadas).
2. **Falsos positivos masivos**: cualquier modelo con sensibilidad razonable producía un volumen de alertas operativamente inmanejable.
3. **Variables duplicadas**: la presencia simultánea de variables normalizadas (z-score, z_log) y no normalizadas inducía confusión sin aportar señal independiente.
4. **Columnas con porcentajes extremos de nulos**, que el dataset arrastraba sin haber sido depurados.
5. **Variables históricas demasiado lentas**: indicadores estructurales con cambios mínimos mes a mes que producían predicciones casi estáticas para cada país.
6. **Riesgo de leakage**: identificadores (`country_name`, `cow_country_code`), variables del target, señales de conflicto contemporáneo y fechas, todas ellas susceptibles de filtrar información al modelo.
7. **Confusión estructural-coyuntural**: el modelo no distinguía bien entre países con riesgo estructural crónico (estables en el tiempo) y países con riesgo inminente (cambios rápidos en variables dinámicas).

El reconocimiento explícito de estos siete problemas reorientó el trabajo: en lugar de continuar refinando un modelo sobre datos potencialmente comprometidos, se priorizó el saneamiento metodológico del pipeline.

---

## Fase 2 — Experimentos diagnósticos sobre el dataset histórico

Antes de tomar la decisión de cambiar el dataset, se ejecutaron doce experimentos sobre el dataset histórico para entender qué señales aprendía cada configuración del modelo:

1. Baseline XGBoost actual (referencia).
2. XGBoost sin NMC/COW.
3. XGBoost sin variables estructurales lentas.
4. XGBoost solo con señales recientes.
5. Comparación de evaluaciones por episodios.
6. XGBoost híbrido reciente con memoria histórica controlada.
7. XGBoost híbrido fino con memoria en bins.
8. Comparación de estrategias de alerta.
9. Sensibilidad por país.
10. Calibración de probabilidades.
11. SHAP del modelo híbrido.
12. Notebook final de comparación.

Los aprendizajes de esta fase fueron decisivos:

- **El modelo híbrido mejoraba el ranking predictivo** respecto al baseline (AP test de 0,1014 frente a 0,0697), pero esta mejora en ranking no se traducía automáticamente en clasificación con pocos falsos positivos.
- **Quitar NMC no resolvía nada**: el modelo simplemente sustituía esas variables por otras estructurales (SIPRI, V-Dem, memoria histórica de conflicto).
- **Quitar variables estructurales lentas reducía la dependencia estructural** pero hacía que el modelo se apoyara excesivamente en la memoria de conflicto pasado, generando alertas persistentes sobre los mismos países.
- **Las señales recientes ayudaban pero no bastaban** para separar limpiamente TP y FP.
- **Los falsos positivos estaban concentrados sistemáticamente por país**, no distribuidos aleatoriamente: el modelo aprendía a "etiquetar" países de riesgo crónico, repitiendo la misma alerta mes tras mes.
- **La evaluación por episodios** (agrupando alertas mensuales consecutivas de un mismo país en un único episodio) resultó más honesta que la evaluación país-mes tradicional, al no penalizar artificialmente la persistencia de una alerta justificada.

### Análisis de sensibilidad por país

Se exploró si era razonable suprimir del entrenamiento aquellos países con cero verdaderos positivos en validación y muchas alertas falsas. La idea era penalizar a los generadores estructurales de FP. El resultado fue desalentador: las reglas que reducían FP también eliminaban TP en test. Un caso ilustrativo fue la República Democrática del Congo (DRC), que en validación parecía candidata a supresión pero en test producía positivos reales que el sistema detectaba correctamente. La conclusión metodológica fue clara: no incorporar reglas fijas de exclusión por país, y usar la sensibilidad por país solo como diagnóstico de robustez.

### Calibración de probabilidades

Se probaron dos estrategias de calibración (isotonic regression y Platt scaling/sigmoid). Los hallazgos:

- Las probabilidades del modelo estaban sobreestimadas: medias en torno a 0,33-0,35 frente a una tasa real positiva mucho menor.
- La calibración reducía Brier score y Expected Calibration Error.
- Isotonic mejoraba la calibración pero podía degradar el ranking.
- Sigmoid era más estable.
- Los umbrales recalculados tras calibración no mejoraban la política operativa principal.

La conclusión metodológica: las probabilidades del modelo deben interpretarse como **scores de riesgo o ranking**, no como probabilidades absolutas. La calibración es útil para comunicar incertidumbre pero no sustituye a la política de alerta. Este aprendizaje preliminar volvería a aparecer reforzado en la fase 8 con datos contemporáneos.

### SHAP en la fase histórica

El SHAP del modelo híbrido reveló que el modelo estaba dominado por:

- Meses desde el último conflicto.
- Historial acumulado de conflicto.
- Conflicto en los últimos 12 meses.
- Señales regionales.

Esta caracterización del comportamiento aprendido fue lo que terminó motivando el cambio de dataset: si el modelo se apoyaba mayoritariamente en memoria histórica, el problema no era tanto de algoritmo como de **fuentes y horizonte temporal**. Un dataset demasiado largo arrastraba ruido histórico; uno demasiado corto carecía de historia para aprender. La pregunta era encontrar el equilibrio.

---

## Fase 3 — Reconstrucción hacia ACLED 2018-2024

La decisión de reconstruir el dataset con un enfoque más contemporáneo fue uno de los puntos de inflexión del trabajo. Se justificó por varias razones:

- **Coherencia temporal**: ACLED proporciona cobertura global homogénea solo desde 2018. Cualquier ventana temporal previa introducía heterogeneidad de cobertura difícil de modelar.
- **Granularidad operativa**: ACLED captura eventos granulares de violencia política, exactamente el tipo de señal dinámica que la fase histórica había echado en falta.
- **Coherencia con casos contemporáneos**: el sistema se evaluaría sobre conflictos recientes (Yemen, Ucrania, Sahel, Haití), y un dataset que llega hasta 2024 permite evaluación inmediata sobre la realidad reciente.

La reconstrucción implicó:

1. Reformulación del periodo a 2018-2024.
2. Incorporación de múltiples datasets ACLED para mejorar cobertura geográfica.
3. Mantenimiento de UCDP/PRIO como base del target.
4. Conservación de WDI, SIPRI y V-Dem como variables estructurales complementarias.
5. Eliminación de MID, ATOP y tecnología armamentística histórica del modelo final, por su alineación temporal insuficiente con el objetivo 2018-2024.
6. Normalización sistemática mediante z-score y z_log según la naturaleza asimétrica o no de cada variable.

### Reconstrucción del target

El target se redefinió:

- Se descartaron los targets a seis meses, que en el periodo corto reducían demasiado el universo de positivos.
- Se introdujo `target_preconflict_next_3m`: vale 1 si el país-mes correspondiente está en paz pero alguno de los tres meses siguientes registra conflicto activo (según `in_conflict` derivada de UCDP/PRIO).
- El horizonte de tres meses buscó un compromiso operativo entre dos extremos: ventanas demasiado cortas (un mes) sacrifican casos detectables con preaviso variable; ventanas más largas (seis o doce meses) diluyen la señal y aumentan la dependencia respecto a variables estructurales lentas.

### Limpieza final del dataset

Se aplicaron decisiones explícitas de limpieza:

- Eliminación de columnas duplicadas no normalizadas cuando existía versión normalizada.
- Eliminación de columnas con más del 99% de nulos.
- Eliminación de tecnología armamentística histórica.
- Eliminación de países no mapeados por ACLED.
- Eliminación de Taiwán en la versión final por incompatibilidades de codificación.
- Conservación de variables binarias en formato original.
- Imputación de nulos UCDP derivados mediante media temporal de los valores observados más cercanos.
- Normalización mediante z-score o z_log según la naturaleza de cada variable.

El dataset final, `final_dataset_acled_2018_2024_model_ready_clean.csv`, quedó configurado con:

- 14.616 filas país-mes
- 743 columnas (de las cuales 684 son features tras filtrado adicional en el notebook)
- 174 países
- 92 positivos del target sobre 11.476 filas modelables (peace-only, no nulos)

### Control de leakage explícito

Tras los aprendizajes de la fase histórica, se documentó explícitamente el control de leakage. Se excluyen del entrenamiento:

- Identificadores: `cow_country_code`, `country_name`, `country_cow_abbr`, `year`, `month`, `period`.
- Variables del target: cualquier columna que empiece por `target_`.
- Señales de conflicto contemporáneo: `in_conflict`, `conflict_onset`, `war_onset`, `currently_at_peace`.
- Variables ACLED y UCDP contemporáneas (no históricas) del mismo mes.

Se conservan exclusivamente:

- Variables estructurales (WDI, SIPRI, V-Dem) en su valor del mes.
- Variables ACLED y UCDP en formato histórico: lags, ventanas rolling, deltas.
- La variable derivada `any_conflict_past12m`, que sirve también como baseline de persistencia en la evaluación crítica.

---

## Fase 4 — Modelado final sobre ACLED 2018-2024

Sobre el dataset reconstruido se entrenaron cuatro modelos:

- Regresión logística
- Random Forest
- XGBoost
- LightGBM

La configuración final del entrenamiento:

- Train: 2018-2023.
- Test holdout: 2024 (enero a septiembre, 1.264 filas, 5 positivos).
- Restricción a muestra peace-only.
- Exclusiones de leakage según el esquema documentado.
- Selección de umbrales mediante validación temporal interna (OOF) sobre el train.

La política de umbrales buscó un punto medio operacional: no maximizar recall a cualquier coste, no reducir falsos positivos hasta perder casi todos los verdaderos positivos, limitar la tasa de alerta a un nivel revisable, mantener salida operacionalmente útil. Los umbrales finales fueron:

- LightGBM: 0,46
- XGBoost: 0,76

Los resultados sobre el conjunto de prueba 2024 (en su ejecución inicial):

**XGBoost**: TP=2, FP=10, FN=3, TN=1249, precisión 16,7%, recall 40,0%, F1 23,5%.

**LightGBM**: TP=2, FP=15, FN=3, TN=1244, precisión 11,8%, recall 40,0%, F1 18,2%.

**Consenso (AND)**: TP=2, FP=9, FN=3, TN=1250, precisión 18,2%, recall 40,0%, F1 25,0%.

La lectura inicial fue que XGBoost ofrecía el mejor equilibrio individual, el consenso mantenía los mismos TP con un FP menos, y LightGBM era el más sensible pero también el más ruidoso.

### Evaluación por episodios

Considerando los aprendizajes de la fase histórica sobre la concentración de FP por país, se introdujo una evaluación complementaria que agrupa meses consecutivos de alerta en episodios:

**Consenso alta confianza**: 3 episodios totales (2 TP, 1 FP), 11 meses de alerta, precisión por episodio 66,7%.

**XGBoost principal**: 4 episodios (2 TP, 2 FP), 12 meses de alerta, precisión por episodio 50,0%.

La métrica por episodios validó la lectura cualitativa: Chad como caso paradigmático aparece como FP persistente durante varios meses, pero operativamente constituye un único episodio de vigilancia, no nueve errores independientes.

### Robustez temporal walk-forward 2019-2024

Para validar que el sistema no estaba sobreajustado al holdout 2024, se realizó un test walk-forward anual. Para cada año objetivo entre 2019 y 2024, se reentrenó el modelo con los años anteriores y se evaluó sobre el año objetivo.

Resultados agregados 2019-2024:

**XGBoost**: TP=12, FP=65, FN=58, precisión 15,6%, recall 17,1%, F1 16,3%, 77 alertas totales.

**Consenso**: TP=9, FP=32, FN=61, precisión 22,0%, recall 12,9%, F1 16,2%, 41 alertas totales.

**LightGBM**: TP=15, FP=153, FN=55, precisión 8,9%, recall 21,4%, F1 12,6%, 168 alertas totales.

La lectura del walk-forward: XGBoost mantiene el mejor equilibrio agregado, el consenso obtiene F1 casi idéntico con la mitad de FP, LightGBM detecta más positivos pero a coste alto en falsos positivos.

### Comparación con baseline de persistencia

Se incorporó una comparación obligatoria con un baseline simple: alertar si `any_conflict_past12m == 1`. Resultados pooled 2019-2024:

**Baseline persistencia**: TP=11, FP=228, FN=59, precisión 4,6%, recall 15,7%, F1 7,1%.

**XGBoost** (comparativa): TP=12, FP=65, FN=58, recall similar, precisión 3,4 veces superior.

El aprendizaje fue significativo y honesto: el modelo no aporta cobertura radicalmente mayor que el baseline, pero filtra los FP de forma sustancialmente más eficiente. Esta lectura se incorporó como aporte central del trabajo en la versión final.

---

## Fase 5 — Análisis crítico empírico

Tras el cierre de la fase de modelado, se inició una fase de análisis crítico empírico que reformularía varias conclusiones del trabajo inicial. Esta fase produjo tres conjuntos de análisis complementarios.

### Intervalos de confianza y bootstrap pareado

Reconociendo que con solo 5 positivos en el holdout 2024 las métricas puntuales eran inestables, se calcularon:

- **Intervalos de Wilson 95%** para precisión y recall (solución analítica para proporciones binomiales con bajos conteos).
- **Intervalos de bootstrap percentil 95%** con 5.000 remuestreos para precisión, recall y F1.

Los resultados fueron categóricos:

**XGBoost**: precisión 16,7% con IC95 [4,7%; 44,8%], recall 40,0% con IC95 [11,8%; 76,9%], F1 23,5% con bootstrap IC95 [0,0%; 50,0%].

**Consenso**: precisión 18,2% con IC95 [5,1%; 47,7%], recall 40,0% con IC95 [11,8%; 76,9%], F1 25,0% con bootstrap IC95 [0,0%; 53,3%].

Los intervalos son amplísimos. La rareza del fenómeno y el tamaño del holdout hacen que cualquier afirmación basada en cifras puntuales sea insostenible sin contextualizar la incertidumbre.

Un **bootstrap pareado** XGBoost vs consenso confirmó que XGBoost no superaba al consenso en ninguna de las 5.000 reasignaciones (P = 0%). La diferencia observada de -1,5 puntos de F1 a favor del consenso quedaba dentro del ruido muestral. La conclusión metodológica reformuló la designación de "modelo principal": XGBoost y consenso son **estadísticamente indistinguibles** bajo F1; la elección entre ambos debe argumentarse por criterios operativos (calibración, capacidad de ranking, interpretabilidad), no por F1.

### Calibración y top-K

El análisis de Brier scores mostró que XGBoost (~0,025) era 3-4 veces peor en calibración que LightGBM (~0,008) o consenso (~0,008). Este diferencial se debe a la asignación sostenida de scores muy altos (~0,94) a países de fragilidad crónica como Chad, sin que se materialice un onset codificado.

El análisis precision@K reveló un patrón aún más nítido: LightGBM y consenso colocaban los TP reales (UK y USA en enero 2024) en el top-3 de scores, mientras que XGBoost tenía su top-3 ocupado por meses consecutivos de Chad. Para una mesa de analistas que prioriza por score, LightGBM/consenso son operativamente superiores.

Esta combinación de hallazgos (indistinguibilidad estadística en F1, mejor calibración de LightGBM/consenso, mejor ranking en top-K) constituyó argumento metodológico para reformular el discurso del trabajo: la designación de XGBoost como modelo principal no se sostiene por F1; se sostiene únicamente si se prioriza la captura amplia de Estados en riesgo crónico, lo que es operativamente válido pero debe argumentarse explícitamente.

### Casebook: Chad, USA, UK, Haití, Angola

Se documentó cualitativamente cada caso relevante del holdout 2024:

**Chad**: aparece como FP estructural persistente durante los 9 meses observables. SHAP muestra que el modelo se apoya en PIB per cápita bajo, historial UCDP reciente, violencia ACLED contra civiles y variables estructurales. La lectura: no es ruido mensual, es una alerta-vigilancia sobre riesgo crónico. UCDP/PRIO no codifica un nuevo onset en 2024 para Chad, pero el país transita una transición presidencial tensa tras el asesinato de Idriss Déby (2021), enfrenta presión fronteriza del conflicto sudanés, registra actividad de Boko Haram, y mantiene niveles de desplazamiento interno entre los más elevados del continente. La alerta sostenida es operativamente defendible.

**USA y Reino Unido**: aparecen como TP en el target original por participación en conflicto UCDP relacionado con Yemen (operación Red Sea iniciada el 12 de enero de 2024 contra los hutíes). UCDP/PRIO codifica este enfrentamiento como conflicto interestatal puro (type 2), con USA, UK y Yemen entre sus partes. La inclusión de este caso como TP en la evaluación es problemática conceptualmente: el sistema se construye para detectar inicio de conflicto en un país, no participación expedicionaria. El modelo es "premiado" por anticipar intervenciones militares de potencias occidentales, no por anticipar transiciones internas a la guerra civil. Esta observación motivaría más adelante el experimento de target intraestatal estricto.

**Haití**: aparece como FN principal del periodo. xgb_score = 0,635, por debajo del umbral 0,76. SHAP del caso revela un patrón estructural muy nítido: el modelo SÍ identifica indicadores positivos de riesgo (violencia ACLED contra civiles, baja calidad democrática V-Dem, desplazamiento forzoso). Pero otras features lo arrastran sostenidamente hacia abajo: SIPRI gasto militar absoluto (SHAP fuertemente negativo), su transformación logarítmica (refuerza el efecto negativo), PIB per cápita. El modelo ha aprendido la asociación estadística "bajo gasto militar → bajo riesgo de conflicto". Esa asociación funciona en la mayoría del panel, pero falla precisamente en Haití, que carece de fuerzas armadas regulares desde 1995 y cuya violencia es de pandillas (Viv Ansanm). Este caso reveló el sesgo conceptual del modelo hacia el conflicto estatal clásico.

**Angola**: aparece como FN cerca del umbral. Bajar el umbral capturaría Angola pero a costa de FP adicionales.

### Baseline de persistencia con análisis de carga operativa

Se cuantificó la carga operativa de cada estrategia: número total de alertas generadas en el periodo walk-forward. El baseline producía aproximadamente 3,4 veces más alertas que el modelo XGBoost (alrededor de 239 frente a 70), con recall similar. La conclusión operativa cristalizó la formulación honesta del aporte del modelo: **no mejora la cobertura del baseline, pero sí su densidad informativa**. En contextos donde la capacidad de revisión analista es escasa (lo habitual en organizaciones de seguridad, agencias humanitarias o departamentos diplomáticos), la mejora de precisión a igual recall es operativamente decisiva.

### Cuantificación empírica del leak de normalización

Una limitación documentada en versiones previas del trabajo señalaba que la normalización (z-score) sobre el dataset completo 2018-2024 técnicamente contaminaba el train con estadísticas del test. Se cuantificó empíricamente el impacto: se reentrenó XGBoost reemplazando todas las features normalizadas por versiones recalculadas usando exclusivamente estadísticos del conjunto de entrenamiento.

El resultado fue concluyente: correlación entre los scores con y sin leak = 1,000000, diferencia absoluta = 0. Las predicciones eran idénticas. La explicación teórica: los modelos basados en árboles son invariantes a transformaciones monótonas crecientes; los puntos de corte que selecciona el algoritmo son los mismos sobre la versión escalada que sobre la original. El leak existe formalmente pero **no afecta a los modelos arbóreos** del trabajo. La limitación se reformuló: solo afectaría a versiones futuras que incorporaran modelos lineales.

### SHAP del modelo final

Se calculó SHAP sistemáticamente sobre el modelo final ACLED 2018-2024:

**Importancia global** (test 2024): las features más pesadas combinan tres familias conceptuales:

- Variables dinámicas de violencia: ACLED violencia contra civiles (rolling 6m y 12m), eventos políticos, fatalidades por categoría.
- Variables estructurales lentamente cambiantes: SIPRI gasto militar, GDP per cápita, índices V-Dem de calidad democrática, población desplazada.
- Variables históricas de conflicto: conteo de conflictos pasados en ventana 12m, indicador binario `any_conflict_past12m`.

Variables principales en XGBoost: `z_sipri_milex_constant_2023_usd_millions`, `z_acled_violence_against_civilians_events_roll6m`, `z_wdi_gdp_per_capita_current_usd`, `z_wdi_forcibly_displaced_people`, `z_vdem_participatory_democracy_index`.

Variables principales en LightGBM: `z_acled_violence_against_civilians_events_roll6m`, `z_vdem_participatory_democracy_index_lag12`, `z_wdi_forcibly_displaced_people`, `z_acled_total_events_delta3m`, `z_wdi_international_migrant_stock_pct_population_roll6m`.

La interpretación: XGBoost combina estructura económica/militar, desplazamiento y violencia reciente, mientras que LightGBM es más sensible a ACLED reciente y variables políticas. El consenso es defendible porque exige coincidencia entre dos modelos con sensibilidades distintas. Los FP se explican por fragilidad estructural y violencia reciente, no solo por ruido. Los FN aparecen cuando las señales locales de violencia existen pero no encajan con el patrón estructural aprendido.

---

## Fase 6 — Validación con target intraestatal estricto

El hallazgo más decisivo de la fase crítica fue el experimento de target intraestatal. Motivado por la observación del caso USA/UK (conflicto interestatal contaminando el target), se reconstruyó el target restringiendo UCDP/PRIO a:

- Type 3: intraestatal puro (gobierno vs grupo no estatal en territorio propio).
- Type 4: intraestatal internacionalizado (intraestatal con intervención extranjera).

Se excluyeron explícitamente:

- Type 1 (extrasistémico, colonial).
- Type 2 (interestatal puro, donde caen USA y UK por Yemen).

### Implicación sobre la ventana temporal

El target reconstruido tiene una particularidad: requiere observar el estado del país en los tres meses **posteriores** a cada observación. Como UCDP/PRIO v25.1 codifica hasta diciembre de 2024, los positivos para los meses cercanos al fin de 2024 no son construibles. El holdout natural cuando se utiliza el target estricto es por tanto **2023, no 2024**. Los positivos relevantes son los meses previos al onset de los conflictos codificados por UCDP en 2024: principalmente Haití octubre-diciembre 2023 (los tres meses previos al onset Viv Ansanm) y Angola octubre-diciembre 2023 (los tres meses previos al onset de Cabinda).

### Resultados del experimento

Test 2023 con mismo XGBoost y umbral 0,76:

**Target original**: TP=3, FP=20, FN=5, precisión 13,0%, recall 37,5%, F1 19,4%.

**Target intraestatal**: TP=0, FP=4, FN=6, precisión 0,0%, recall 0,0%, F1 0,0%.

Walk-forward 2019-2023 pooled:

**XGBoost target original**: precisión 15,6%, recall 15,4%, F1 15,5%.

**XGBoost target intraestatal**: precisión 14,7%, recall 11,9%, F1 13,2%.

**Baseline target intraestatal**: precisión 8,4%, recall 54,8%, F1 14,6%.

### Tres lecturas del experimento

La fase crítica reconoció que el resultado admitía tres interpretaciones legítimas:

**Lectura métrica estricta**: cuando se restringe al target intraestatal, el F1 walk-forward del modelo se aproxima al del baseline (14,6%), e incluso queda por debajo en algunas ejecuciones. Parte de la ventaja aparente del modelo en el informe inicial provenía de la presencia de los onsets expedicionarios (UK, USA en Yemen), que el modelo predice con relativa facilidad a partir de features estructurales como SIPRI gasto militar y GDP.

**Lectura operativa**: el baseline opera con recall del 55% sobre el target intraestatal, generando 273 alertas con precisión del 8,4%. El modelo opera con recall del 12% y aproximadamente 30 alertas con precisión del 14,7%. Bajo el criterio de carga operativa, el modelo conserva ventaja: su densidad informativa sigue siendo aproximadamente el doble que la del baseline.

**Lectura interpretativa**: la incapacidad del modelo para detectar los positivos intraestatales reales del test (Haití octubre-diciembre 2023 con scores 0,18-0,25; Angola con scores 0,40-0,53) confirma el diagnóstico SHAP. El modelo aprende patrones de conflicto estatal clásico y se desempeña mal sobre transiciones a violencia no estatal o subestatal. El sesgo SIPRI persiste incluso con target limpio.

### Síntesis del experimento

El experimento de target intraestatal documenta empíricamente una limitación conceptual del sistema construido, sin invalidar su utilidad operativa. La performance reportada del modelo en el informe inicial es real, pero responde parcialmente a la definición amplia del target. Cuando el target se ajusta para medir estrictamente onsets internos, el modelo conserva ventaja en precisión frente al baseline pero pierde la mayoría de su capacidad de cobertura. Esto es coherente con su diseño (features dominadas por proxies de capacidad estatal) y traza una dirección clara de trabajo futuro: incorporar features de violencia no estatal para contrapesar el sesgo, o considerar una arquitectura de dos modelos diferenciados por tipología de conflicto.

La metáfora operativa que mejor captura el resultado: el sistema construido funciona como un **detector de país en estado crítico** robusto, pero como un **predictor de onset agudo** limitado. Ambas funciones tienen valor operativo distinto en aplicaciones reales.

---

## Fase 7 — Consolidación en notebook único

Tras los análisis críticos, el trabajo evolucionó hacia una consolidación. La estructura de seis notebooks de trabajo (entrenamiento final, robustez temporal, casebook, análisis crítico, robustez y baseline, target intraestatal) era apropiada para el proceso de investigación pero poco adecuada para la entrega académica. Se construyó un notebook unificado, `TFM_alerta_temprana_conflicto.ipynb`, que integra todo el flujo en secciones secuenciales.

El proceso de consolidación implicó dos iteraciones de refinamiento sobre la estructura:

**Primera iteración**: integración técnica. Verificación de que el notebook único reproducía los resultados de los notebooks separados, gestión de la ejecución end-to-end, generación consolidada de artefactos.

**Segunda iteración**: refinamiento académico. Reescritura de los markdowns con registro académico (tercera persona, conectores formales, referencias conceptuales a la literatura sin citas inventadas). Incorporación de matriz de confusión visual. Reframing operativo de los falsos positivos como vigilancia justificada en lugar de errores puros. Análisis de carga operativa explícito. Tres lecturas matizadas del experimento de target intraestatal. Autosuficiencia del documento sin referencias a los notebooks intermedios.

El notebook resultante de estas dos iteraciones quedó como entrega base, organizado en diez secciones. Tras una primera ejecución de la versión académica, sin embargo, el trabajo entró en una fase adicional de refuerzo metodológico que se documenta a continuación.

---

## Fase 8 — Refuerzos metodológicos finales

La versión académica del notebook, aun siendo sólida, presentaba algunos puntos donde la práctica metodológica podía elevarse. El autor revisó la entrega completa identificando cinco áreas concretas de refuerzo, cada una abordada como una sub-sección o sección nueva del notebook. Esta fase representa el cierre académico del trabajo y eleva el documento desde "evaluación crítica" hasta "evaluación crítica con auditoría metodológica completa".

### 8.1 Bootstrap clusterizado por país (sección 3.3 bis)

El bootstrap iid utilizado en el análisis crítico inicial asume observaciones independientes e idénticamente distribuidas. Esta hipótesis es claramente violada en una serie país-mes: las observaciones de Chad en marzo, abril y mayo de 2024 están altamente correlacionadas porque comparten la misma estructura subyacente (economía, instituciones, historial de violencia). Bajo dependencia serial intra-cluster, los intervalos iid son sistemáticamente demasiado estrechos.

La corrección estándar en este escenario es el **bootstrap clusterizado**: en lugar de remuestrear filas individuales con reposición, se remuestrean países completos (clusters) con reposición. Esto preserva la dependencia intra-cluster y genera intervalos consistentes con la estructura jerárquica.

Los resultados de la comparación iid vs clusterizado son informativos por sí mismos. Para XGBoost en el test 2024:

- Bootstrap iid F1 IC95: [0%, 50%].
- Bootstrap clusterizado F1 IC95: [0%, 85,7%].

Para el Consenso, el IC F1 clusterizado se extiende hasta el 100%. La diferencia confirma empíricamente que parte de la "precisión aparente" del análisis inicial provenía de la hipótesis iid incorrecta. Los intervalos clusterizados son los metricamente correctos en presencia de correlación serial; los iid se conservan en el notebook como referencia comparativa y por continuidad con el informe inicial.

### 8.2 Curva precision-recall y average precision (sección 3.5)

Las métricas reportadas hasta esta fase dependían del umbral fijado (`THR_XGB=0.76`, `THR_LGBM=0.46`). En sistemas operativos, la sensibilidad de la salida al umbral es información clave. Se incorporó la **curva precision-recall** sobre el test 2024 para los tres modelos, junto al barrido completo de métricas en el rango de umbrales relevante.

La curva PR es la métrica primaria recomendada por la literatura para eventos raros: el F1 a un umbral concreto es un punto de esa curva. El **average precision (AP)**, área bajo la curva PR, sintetiza la capacidad de ranking del modelo independientemente del umbral, lo que la hace más robusta que F1 puntual ante la rareza del evento positivo. Esta métrica ya se había utilizado puntualmente en la fase histórica pero se incorporó sistemáticamente al notebook final.

### 8.3 Recalibración isotónica con scores OOF (sección 4.3)

El Brier score de XGBoost (~0,024) identificado en el análisis crítico reflejaba sobreconfianza sistemática: el modelo asigna scores mucho más altos que las probabilidades empíricas reales. Esta sub-sección incorporó un experimento de recalibración **isotónica** (`IsotonicRegression`), ajustada sobre los scores OOF del train (generados con expanding window 2019-2023 para evitar leakage), y aplicada sobre los scores de test 2024.

La isotónica preserva el orden de los scores —y por tanto el ranking, sin afectar precision@K ni AP— pero los redistribuye hacia probabilidades calibradas a la frecuencia empírica del train. Los resultados fueron espectaculares:

- Brier XGBoost bruto: 0,0249.
- Brier XGBoost recalibrado isotónica OOF: 0,0046.
- Reducción relativa: **81,5%**.

La distribución de scores se ajusta proporcionalmente: la media baja de 0,075 a 0,013, el percentil 95 de 0,376 a 0,035, valores ya consistentes con la frecuencia real positiva del test (0,004). Esto confirma cuantitativamente la lectura de "modelo sobre-confiado" y proporciona un procedimiento concreto para una versión operativa calibrada.

### 8.4 Segundo baseline con regresión logística L1 (sección 6.3)

Hasta esta fase, el único baseline considerado había sido la regla heurística de persistencia. Se incorporó un segundo baseline aprendido: **regresión logística con penalización L1** (Lasso). La justificación es metodológica: en presencia de eventos raros y muchas features, los modelos lineales regularizados a veces ofrecen rendimiento competitivo respecto a modelos no lineales más complejos, y constituyen un test legítimo de si la complejidad del gradient boosting está efectivamente añadiendo valor predictivo.

Los resultados fueron informativamente matizados:

- Average precision sobre test 2024: XGBoost 0,113, **LogReg L1 0,100**, LightGBM 0,336.
- La regresión logística L1 está prácticamente al mismo nivel que XGBoost en ranking, lo que reformula la valoración del aporte del gradient boosting: gran parte de la señal predictiva es capturable por un modelo lineal con selección automática de features (178 de 684 coeficientes activos).
- LightGBM sí es claramente superior, lo que valida su inclusión en el sistema.
- A igual carga de alertas (top-12, equivalente al umbral OOF de XGBoost), LogReg detecta 1 TP frente a los 2 TP de XGBoost. Operativamente XGBoost sigue ganando, pero por margen menor de lo que la diferencia algorítmica sugeriría.

### 8.5 Función de utilidad asimétrica (sección 10)

Todas las métricas reportadas hasta este punto (F1, precision, recall) ponderan implícitamente los falsos positivos y los falsos negativos por igual. Esta simetría es una convención estadística, no una propiedad del dominio. En alerta temprana de conflicto, el coste asimétrico es esencial: un falso negativo —no detectar un onset y, por tanto, no preparar respuesta humanitaria, diplomática o de protección— tiene consecuencias humanas potencialmente catastróficas, mientras que un falso positivo —revisar un país que finalmente no transita a conflicto— tiene un coste operativo modesto (horas analista).

La nueva sección 10 introduce una función de utilidad explícita:

`utility(thr) = α · TP(thr) - β · FP(thr) - γ · FN(thr)`

donde la relación γ/β codifica la asimetría de costes. Se evaluó el umbral óptimo bajo tres regímenes plausibles:

- **γ/β = 5** (asimetría moderada): umbral óptimo ≈ 0,71. El umbral 0,76 seleccionado por el protocolo OOF es prácticamente óptimo bajo este régimen. La política OOF actual asume implícitamente esta asimetría.
- **γ/β = 10** (asimetría alta, perfil humanitario clásico): umbral óptimo ≈ 0,59. Se recuperan 4 TP (incluyendo Haití y Angola) a costa de 30 FP. La utilidad mejora respecto al umbral 0,76.
- **γ/β = 20** (asimetría muy alta, perfil de protección crítica): el óptimo se mantiene en 0,59, pero la ganancia de utilidad respecto al umbral 0,76 se amplía (delta +22 unidades de utilidad).

La lectura central: **el umbral 0,76 seleccionado por el protocolo OOF es coherente con un régimen de coste donde un FN cuesta aproximadamente 5 veces lo que un FP**. Esto contextualiza retrospectivamente la política OOF como una decisión bajo asimetría implícita modesta. Un usuario con tolerancia menor a FN —típicamente una organización humanitaria o de protección, donde la no-detección de un onset es inaceptable— debería operar con umbrales sustancialmente más bajos.

Esta sección clarifica un punto que las métricas estándar ocultaban: la elección del umbral es una decisión de política, no de algoritmo. El sistema deja parametrizada su salida según la asimetría de costes que el usuario final aporte al ejercicio.

### Síntesis de la fase 8

Los cinco refuerzos elevaron el rigor metodológico del trabajo a un nivel que no había sido alcanzado en versiones previas. Cada uno responde a una práctica estándar en la literatura especializada que la primera versión académica no había incorporado todavía:

- El bootstrap clusterizado responde a la práctica estándar en evaluación de modelos sobre series jerárquicas (Bertsimas y otros).
- La curva PR y el AP son recomendaciones explícitas de la literatura sobre clasificación con eventos raros (Davis y Goadrich, Saito y Rehmsmeier).
- La recalibración isotónica con OOF es la práctica de despliegue estándar en sistemas operacionales (Niculescu-Mizil y Caruana).
- El segundo baseline aprendido implementa la guía de no declarar mejora algorítmica sin contraste contra un modelo simple regularizado (Schmidt et al., "Spurious vs Real Improvements").
- La función de utilidad asimétrica implementa la guía de Drummond y Holte sobre análisis de coste-beneficio en clasificación con clases desbalanceadas.

El notebook resultante de esta fase es el documento final del trabajo. Cuenta once secciones y se ejecuta end-to-end en aproximadamente 8-12 minutos.

---

## Fase 9 — Caso de uso operativo (anexo)

Como complemento al notebook académico, se inició el desarrollo de un dashboard estático en HTML que comunica los resultados del sistema en lenguaje operativo, pensado para un perfil de analista de riesgo sin formación técnica en aprendizaje automático.

El dashboard quedó estructurado en dos páginas:

- **Página principal (`index.html`)**: vista operativa con tarjetas de países en alerta del último mes disponible, mapa coroplético con cuatro categorías visuales (países analizados, países que entraron en conflicto durante 2024, países en conflicto activo, sin datos), ficha de detalle por país. No utiliza terminología técnica (no menciona XGBoost, LightGBM, SHAP, F1, etc.).
- **Página técnica (`acerca.html`)**: vista documental para revisores del sistema, con matrices de confusión, walk-forward, SHAP global, comparativa con baseline, simulador de umbral y tabla de predicciones país-mes.

La distinción entre páginas resuelve una tensión identificada durante el diseño: el público académico (tribunal, revisor) necesita la información técnica detallada; el público operativo (analista de riesgo) necesita lo opuesto, una abstracción del modelo que solo muestre el riesgo.

El desarrollo del dashboard ilustró además algunas tensiones de honestidad operativa. La más significativa: el marcado explícito de onsets como "casos confirmados" en la vista operativa convertía el dashboard en una herramienta de validación retrospectiva, no de uso operativo (un analista en un escenario real no sabe qué países harán onset). La corrección consistió en eliminar todo marcado ex-post de la página principal y trasladar esa información a una subsección de validación en la página técnica.

Este componente se considera complementario al TFM principal, no central. Su desarrollo continúa más allá del cierre de este documento.

---

## Decisión final del proyecto

Tras todas las iteraciones, las decisiones defendibles del trabajo son:

- **Modelo principal**: XGBoost, justificado por el balance entre cobertura, precisión y carga operativa en walk-forward agregado. La designación de XGBoost no se sostiene por F1 (estadísticamente indistinguible del consenso) sino por el criterio operativo de captura amplia de Estados en riesgo crónico.
- **Señal de alta confianza**: consenso AND entre LightGBM y XGBoost. Mejor calibración y ranking, conservadurismo operativo apropiado para alertas de alta prioridad.
- **Reporte de ambas salidas** en el sistema, con explicitación de los criterios de elección entre una y otra según el caso de uso.
- **Evaluación por episodios** además de país-mes, para no penalizar artificialmente la persistencia de alertas justificadas sobre Estados de riesgo crónico.
- **Análisis SHAP y casebook** como herramientas obligatorias de interpretación para entender FP y FN.
- **Declaración explícita de las limitaciones del target y de las fuentes**: ambigüedad geográfica del target original, diferencia ACLED-UCDP, sesgo de las features hacia conflicto estatal clásico.
- **Umbral operativo parametrizado por asimetría de costes**: el umbral 0,76 seleccionado por OOF se contextualiza como decisión bajo asimetría implícita γ/β ≈ 5; el sistema documenta cómo recalcular el umbral óptimo bajo otras asimetrías.

---

## Contribución final del TFM

La contribución principal no es haber creado un modelo perfecto, sino haber construido una evaluación metodológicamente honesta y completa de un sistema de alerta temprana.

El proyecto demuestra empíricamente que:

- ACLED mejora la capacidad del sistema de capturar violencia reciente, en contraste con datasets históricos que dependen excesivamente de variables estructurales.
- UCDP/PRIO permite construir un target estándar reproducible, pero introduce decisiones conceptuales importantes (qué se considera conflicto, qué tipos se incluyen) que el trabajo documenta y problematiza.
- Los modelos aprenden señales útiles, pero también heredan sesgos del target y de las fuentes; identificar estos sesgos es parte esencial del trabajo de evaluación.
- XGBoost filtra muchos FP frente a un baseline de persistencia, pero esta ventaja se reformula críticamente: no es cobertura, es densidad informativa.
- El consenso reduce ruido con coste moderado de cobertura.
- Evaluar por episodios es metodológicamente más apropiado que contar meses repetidos como errores independientes.
- La interpretabilidad mediante SHAP es imprescindible para entender FP y FN.
- Algunos FP son mejor entendidos como alertas de vigilancia legítima sobre Estados en riesgo crónico, no como errores.
- Algunos FN revelan limitaciones conceptuales del modelo: el caso Haití documenta el sesgo hacia conflicto estatal clásico.
- La incertidumbre de las métricas, una vez correctamente cuantificada con bootstrap clusterizado, es sustancialmente mayor que la que el bootstrap iid sugería. Esta corrección reformula la prudencia con que cualquier afirmación puntual debe ser presentada.
- La calibración del modelo es deficiente en bruto pero recuperable mediante recalibración isotónica con scores OOF. Esto traza el camino para un despliegue operativo con probabilidades interpretables.
- La complejidad del gradient boosting añade valor sobre un modelo lineal regularizado, pero por margen menor del que la elección algorítmica sugeriría: gran parte de la señal predictiva es capturable por modelos más simples.
- La elección del umbral es decisión de política, no de algoritmo, y debe parametrizarse explícitamente por la asimetría de costes del usuario final.

La conclusión equilibrada que el trabajo defiende:

> El sistema desarrollado es útil como herramienta de priorización y vigilancia, no como predictor autónomo de conflictos. Su valor está en ordenar riesgo, reducir ruido frente a reglas simples y hacer explicables las alertas. Sus limitaciones principales son el desbalance, la ambigüedad del target, la diferencia entre violencia ACLED y conflicto UCDP, y el sesgo hacia patrones de conflicto estatal clásico.

Esta formulación es la que el TFM defiende ante el tribunal: no la celebración de un modelo predictivo, sino la documentación honesta de un sistema con valor operativo acotado y límites bien identificados, junto con direcciones precisas de trabajo futuro. El conjunto de auditorías metodológicas incorporadas en la fase 8 (bootstrap clusterizado, curva PR, recalibración isotónica, segundo baseline aprendido, función de utilidad asimétrica) refuerza la honestidad cuantitativa del trabajo y eleva el rigor de la evaluación a un nivel apropiado para un trabajo académico de cierre.
