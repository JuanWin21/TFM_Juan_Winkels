# Sistema de alerta temprana de conflicto armado

**Trabajo Fin de Máster — Juan Franziskus Winkels Blanco.**

---

## Origen del trabajo

Este TFM nace de un interés personal. Soy graduado en Relaciones Internacionales y, al cursar el máster, busqué desde el principio un objeto de investigación que tendiera un puente entre mi formación previa y las herramientas cuantitativas del programa. La pregunta por la predicción del conflicto armado —un problema clásico de la disciplina, abordado al menos desde Singer y los Correlates of War en los años 60, y hoy revitalizado por proyectos como ViEWS (Uppsala) o ACLED CAST— ofrecía exactamente ese puente: un fenómeno conceptualmente familiar para mí, con suficiente literatura crítica para ubicar mi trabajo, y empíricamente abordable mediante las técnicas de aprendizaje automático que el máster proporciona.

El objetivo no fue construir un predictor definitivo. Sistemas con recursos sustancialmente mayores llevan años en esa tarea con resultados parciales. Mi propósito fue más modesto y, creo, más adecuado al alcance de un TFM: construir un pipeline reproducible, auditarlo críticamente, y documentar de forma honesta tanto lo que el sistema consigue como lo que no.

---

## Pregunta de investigación

¿Es posible construir, a partir de fuentes públicas heterogéneas, un sistema cuantitativo que priorice países-mes en riesgo elevado de iniciar un episodio de conflicto armado en los próximos tres meses, con una tasa de alertas operativamente manejable y un poder discriminativo superior al de reglas heurísticas simples?

La pregunta se desdobla en tres subpreguntas que el trabajo aborda secuencialmente:

1. **Construcción**: ¿qué fuentes, qué granularidad temporal y qué definición de target permiten formular el problema de forma estable y reproducible?
2. **Evaluación**: ¿cómo se comporta el sistema bajo evaluaciones temporales rigurosas y comparado con baselines simples?
3. **Interpretabilidad**: ¿qué patrones aprende el modelo y dónde falla? ¿Son esos fallos consistentes con limitaciones conocidas de las fuentes o revelan sesgos del propio enfoque?

---

## Aporte

La contribución principal del trabajo no es algorítmica sino metodológica. Tras varias iteraciones, el proyecto entrega:

1. **Un pipeline reproducible** que integra cinco fuentes académicamente establecidas (ACLED, UCDP/PRIO, WDI, SIPRI, V-Dem) a granularidad país-mes con control explícito de leakage.
2. **Un sistema predictivo entrenado** con un protocolo de selección de umbrales metodológicamente correcto (validación temporal interna sobre el train, no sobre el holdout). El sistema produce alertas con precisión agregada superior a la del baseline de persistencia por un factor entre 2 y 4, manteniendo una carga operativa de alertas mensuales manejable.
3. **Una evaluación crítica empíricamente fundamentada** del sistema construido, que documenta tanto sus virtudes como sus límites. Esta evaluación incluye:
   - Intervalos de confianza Wilson y bootstrap iid, junto a **bootstrap clusterizado por país** que corrige la dependencia serial intra-cluster (sección 3.3 bis).
   - **Curva precision-recall y average precision** como métricas robustas a la rareza del evento (sección 3.5).
   - **Recalibración isotónica con scores OOF expanding window** que reduce el Brier score en más del 80% sin afectar al ranking (sección 4.3).
   - Comparación con dos líneas base independientes: persistencia heurística y **regresión logística L1 aprendida** (sección 6.3).
   - Análisis SHAP global, caso Chad (FP estructural) y caso Haití (FN principal con identificación del sesgo SIPRI).
   - Validación con definición estricta de conflicto intraestatal (sección 9).
   - **Análisis de utilidad asimétrica** que parametriza el umbral operativo en función del coste relativo de FN frente a FP (sección 10).

El cuarto y más importante aporte es haber identificado y documentado un **sesgo conceptual del modelo hacia el conflicto estatal clásico** mediante análisis SHAP, y haber cuantificado empíricamente su impacto reconstruyendo el target con una definición estricta de conflicto intraestatal (UCDP type 3+4). Esta auditoría reformula la valoración del sistema y permite trazar con precisión las direcciones de mejora.

---

## Datos: fuentes y justificación

La selección final de fuentes responde a una división funcional del problema, donde cada base de datos aporta una dimensión específica del fenómeno:

### ACLED — Armed Conflict Location and Event Data

ACLED registra eventos individuales de violencia política con codificación mensual y atribución a actores específicos. Es la fuente más granular y contemporánea disponible para capturar la **dinámica reciente** del entorno de seguridad. Las variables derivadas de ACLED (eventos de violencia contra civiles, batallas, disturbios, fatalidades por categoría, agrupadas en ventanas temporales) son las que mejor capturan deterioro a corto plazo.

Limitación conocida: ACLED tiene cobertura global homogénea solo desde 2018, lo que condicionó la elección del periodo de estudio.

### UCDP/PRIO Armed Conflict Dataset

UCDP/PRIO es la fuente estándar académica para la codificación de conflictos armados. Aplica una definición estable (al menos 25 muertes por enfrentamiento organizado por año-conflicto) que permite construir un target reproducible. Se utiliza específicamente para:

- Derivar la señal `in_conflict` que sustenta el target.
- Validar la naturaleza de los positivos (conflicto estatal/intraestatal/internacionalizado) en el análisis crítico final.

Limitación conocida: la definición UCDP excluye violencia organizada por debajo del umbral de muertes (crisis criminales, violencia electoral, disturbios sostenidos), lo que afecta la calidad del target en contextos de violencia subestatal.

### WDI — World Bank Indicators

WDI aporta el contexto **socioeconómico estructural**: PIB per cápita, indicadores de empleo, deuda, exportaciones, desplazamiento forzoso, dependencia de exportaciones de combustibles. Estas variables capturan la fragilidad socioeconómica que la literatura especializada (Goldstone, Hegre y otros) identifica como factor de riesgo.

### V-Dem — Varieties of Democracy

V-Dem proporciona índices comparados de calidad democrática: democracia electoral, liberal, participativa, deliberativa, igualitaria. Aporta la dimensión **político-institucional** que las variables estrictamente económicas no capturan.

### SIPRI — Stockholm International Peace Research Institute

SIPRI registra el gasto militar en términos absolutos, per cápita y como porcentaje del PIB. Aporta la dimensión de **capacidad estatal y militar**. Esta fuente, sin embargo, introduce un sesgo conceptual identificado durante el análisis crítico: el modelo tiende a asociar gasto militar bajo con bajo riesgo de conflicto, lo que falla sistemáticamente en países donde la violencia es no estatal o subestatal (caso paradigmático: Haití, sin fuerzas armadas regulares desde 1995, donde la violencia es de pandillas).

### Fuentes consideradas y descartadas

Durante fases tempranas del proyecto se trabajó con fuentes adicionales que se descartaron en la versión final:

- **MID** (Militarized Interstate Disputes) y **ATOP** (Alliance Treaty Obligations and Provisions): se evaluaron en la fase del dataset histórico amplio (1975-2025), pero su alineación temporal y conceptual con el objetivo 2018-2024 resultó insuficiente.
- **NMC/COW** (National Material Capabilities): se descartó al observar que su contribución se solapaba con SIPRI y WDI sin aportar señal independiente.
- **Tecnología armamentística histórica**: aportaba señal lenta, antigua y poco conectada con la alerta temprana contemporánea.

Esta evolución se documenta en detalle en el historial de la investigación.

---

## Estructura del proyecto

```
TFM_Final/
├── README.md                              (este documento)
├── HISTORIAL.md                           (historial cronológico de la investigación)
├── TFM_alerta_temprana_conflicto.ipynb    (notebook consolidado, entrega principal)
├── Datasets/
│   ├── final_dataset_acled_2018_2024_model_ready_clean.csv
│   └── UcdpPrioConflict_v25_1.csv
├── Resultados/
│   └── consolidado/                       (artefactos generados por el notebook)
│       ├── matrices_confusion_test_2024.png
│       ├── bootstrap_pareado.png
│       ├── bootstrap_clusterizado.csv
│       ├── curva_pr.png
│       ├── sensibilidad_umbral.png
│       ├── calibracion.png
│       ├── recalibracion_isotonica.png
│       ├── top_k.png
│       ├── carga_operativa.png
│       ├── baseline_logreg.csv
│       ├── shap_global.png
│       ├── shap_chad.png
│       ├── shap_haiti.png
│       ├── comparativa_target.png
│       ├── utility_umbral.png
│       └── (CSVs con métricas y predicciones)
└── tfm_dashboard/                         (caso de uso operativo, complementario)
    ├── index.html
    ├── acerca.html
    └── (resto del dashboard)
```

---

## El notebook consolidado

`TFM_alerta_temprana_conflicto.ipynb` constituye la entrega principal. Es un documento autosuficiente, ejecutable end-to-end en aproximadamente 8-12 minutos, que integra en un flujo coherente todo el proceso del trabajo: preparación de datos, modelado, evaluación, análisis crítico e interpretación.

Está organizado en once secciones:

1. **Datos y muestra modelable**: justificación metodológica de las decisiones de filtrado (peace-only mask, control de leakage, exclusión de señales contemporáneas).

2. **Modelado**: entrenamiento de XGBoost, LightGBM y consenso AND con hiperparámetros documentados y selección de umbrales por validación temporal interna (OOF) sobre el train, sin observar el holdout.

3. **Resultados sobre el conjunto de prueba 2024 con intervalos de confianza**: métricas puntuales acompañadas de intervalos Wilson, bootstrap iid y **bootstrap clusterizado por país** (sección 3.3 bis) que corrige la dependencia serial intra-cluster. Matrices de confusión visuales, bootstrap pareado para comparar XGBoost y consenso, análisis cualitativo de las alertas individuales (sección 3.4) que argumenta el reframing operativo de los falsos positivos como vigilancia justificada, y **curva precision-recall con average precision** (sección 3.5) como métricas robustas a la rareza del evento.

4. **Calibración y priorización top-K**: Brier score, diagrama de fiabilidad, precision@K, y **recalibración isotónica con scores OOF expanding window** (sección 4.3) que reduce el Brier score más de un 80% manteniendo el ranking intacto.

5. **Robustez temporal walk-forward 2019-2024**: evaluación incremental anual.

6. **Baseline de persistencia y carga operativa**: comparación con la regla simple `any_conflict_past12m == 1`, análisis de volumen de alertas mensuales, y **segundo baseline aprendido con regresión logística L1** (sección 6.3) que verifica si la complejidad del gradient boosting añade valor sobre un modelo lineal regularizado.

7. **Auditoría del leak de normalización**: cuantificación empírica del impacto del leak identificado en versiones previas del trabajo, demostrando que es operativamente nulo para modelos arbóreos.

8. **Interpretabilidad mediante SHAP**: importancia global, caso Chad (FP estructural) y caso Haití (FN principal, donde se identifica el sesgo SIPRI hacia conflicto estatal).

9. **Validación con definición estricta de conflicto intraestatal**: reconstrucción del target usando UCDP/PRIO type 3+4, eliminando los conflictos interestatales que contaminan la evaluación con casos expedicionarios (USA y UK en Yemen 2024). Sección con tres lecturas explícitas: métrica estricta, operativa, e interpretativa.

10. **Sensibilidad operativa: función de utilidad asimétrica**: incorporación de costes asimétricos para falsos negativos y falsos positivos, evaluación del umbral óptimo bajo tres regímenes plausibles (γ/β = 5, 10, 20) y comparación con el umbral OOF seleccionado. Demuestra que la elección del umbral es decisión de política, no de algoritmo.

11. **Discusión, limitaciones y trabajo futuro**.

---

## Reproducibilidad

Requisitos:

- Python 3.10 o superior.
- Librerías: `pandas`, `numpy`, `scikit-learn`, `xgboost`, `lightgbm`, `shap`, `matplotlib`, `seaborn`.
- Los dos ficheros de la carpeta `Datasets/` deben estar presentes (`final_dataset_acled_2018_2024_model_ready_clean.csv` y `UcdpPrioConflict_v25_1.csv`).

Para ejecutar:

```
jupyter notebook TFM_alerta_temprana_conflicto.ipynb
```

El notebook detecta automáticamente la ruta de los datasets si está en la estructura indicada. Genera aproximadamente 20 artefactos (gráficos PNG y CSVs intermedios) en `Resultados/consolidado/`.

**Notas sobre reproducibilidad numérica**: XGBoost no es estrictamente determinista entre máquinas (depende del build, OS, y dependencias). Las cifras pueden variar ligeramente entre ejecuciones distintas. Las conclusiones cualitativas son estables; las cifras puntuales reportadas en los markdowns del notebook son orientativas.

---

## Limitaciones

El trabajo asume y documenta las siguientes limitaciones, todas ellas tratadas explícitamente en el notebook:

**Limitaciones inherentes al problema**:

- Rareza extrema del evento positivo (~0,85% en la muestra modelable). Esto produce intervalos de confianza estructuralmente amplios, especialmente bajo bootstrap clusterizado: el IC F1 al 95% para XGBoost en el test 2024 se extiende de 0% a más del 80% cuando se respeta la dependencia serial. Cualquier sistema de alerta temprana a horizonte de tres meses sobre el universo global enfrenta esta limitación.
- Cobertura temporal limitada (2018-2024) por la disponibilidad homogénea de ACLED. Los años tempranos del walk-forward son los menos estables por escasez de historial de entrenamiento.

**Limitaciones específicas del sistema construido**:

- **Sesgo conceptual hacia conflicto estatal clásico**: documentado mediante SHAP en el caso Haití (sección 8 del notebook). El modelo aprende a asociar capacidad militar formal (SIPRI) con presencia de riesgo de conflicto, fallando sistemáticamente cuando la violencia es no estatal. Es la limitación principal del trabajo.
- **Tratamiento de Estados en riesgo crónico**: el modelo emite alertas sostenidas sobre países de fragilidad cronificada (Chad, Uganda) que son operativamente defendibles como vigilancia, pero que no constituyen predicciones de transición aguda. La metodología de evaluación por episodios atenúa parcialmente este efecto pero no lo elimina.
- **Limitada capacidad de detección de positivos intraestatales reales**: confirmada en la sección 9 del notebook. Haití y Angola, los onsets intraestatales más claros del periodo, reciben scores cercanos al umbral pero por debajo. La sección 10 muestra que un régimen de coste asimétrico humanitario (γ/β ≥ 10) los recuperaría a costa de FP adicionales.

**Limitaciones revisadas y reformuladas durante el trabajo**:

- El leak de normalización identificado en versiones previas fue auditado empíricamente (sección 7) y demostrado operativamente irrelevante para los modelos arbóreos.
- La designación inicial de XGBoost como modelo principal exclusivo fue revisada hacia una evaluación conjunta XGBoost / LightGBM / consenso, donde la elección entre estrategias se argumenta por criterios operativos (calibración, ranking, conservadurismo) y no por F1, dado que las diferencias en F1 entre estrategias son estadísticamente indistinguibles.
- La selección del umbral por protocolo OOF se contextualiza ahora explícitamente como decisión bajo asimetría de costes implícita (γ/β ≈ 5): un usuario con tolerancia menor a FN debería operar con umbrales más bajos, como muestra la sección 10.

---

## Trabajo futuro

Por orden de prioridad de impacto esperado, las direcciones de trabajo futuro identificadas son:

1. **Incorporación de features de violencia no estatal**: desglose ACLED por categoría de actor (`Political militias`, `Rioters`, `Identity militias`), indicadores de violencia urbana, atribución de fatalidades a actores criminales o paraestatales. Es la dirección más directamente conectada con el sesgo principal documentado.

2. **Definición del target con precisión a priori**: una v2 debería partir de una definición explícita y justificada del fenómeno a predecir (onset intraestatal puro, intraestatal internacionalizado, o cualquier escalada de violencia organizada) y mantener esa definición consistente desde la construcción del dataset hasta la evaluación final.

3. **Arquitectura de dos modelos**: dada la evidencia de comportamiento aprendido distinto sobre conflicto estatal y subestatal, una arquitectura de dos clasificadores especializados podría superar las limitaciones de un modelo único.

4. **Despliegue operativo con scores calibrados**: la sección 4.3 del notebook proporciona el procedimiento para producir scores isotónicamente recalibrados con OOF. Una v2 operativa debería emitir las predicciones en este formato calibrado, manteniendo el ranking pero proporcionando probabilidades interpretables.

5. **Función de utilidad parametrizada por el usuario**: la sección 10 documenta cómo el umbral óptimo cambia según la asimetría de costes. Una herramienta operativa real debería permitir al usuario final declarar su relación γ/β y devolver alertas conforme a su política de riesgo.

6. **Horizonte múltiple**: evaluación paralela sobre horizontes de 3, 6 y 12 meses para identificar el horizonte óptimo y caracterizar el trade-off temprano-tardío.

7. **Comparación con sistemas de referencia**: ViEWS (Uppsala) y ACLED CAST publican predicciones a granularidad similar. Una v2 debería situar su desempeño comparativamente respecto a estos sistemas.

8. **Regularización por país o efectos fijos**: contrapesar la dominancia de features estructurales mediante penalizaciones sobre la dependencia estática del modelo respecto a cada país.

---

## Caso de uso operativo (anexo)

La carpeta `tfm_dashboard/` contiene un caso de uso complementario: un dashboard estático en HTML que comunica los resultados del sistema en lenguaje operativo, pensado para un perfil de analista de riesgo sin formación técnica en aprendizaje automático. Está estructurado en dos páginas:

- `index.html`: vista operativa con tarjetas de países en alerta, mapa coroplético con cuatro categorías (analizados, países que entraron en conflicto durante 2024, en conflicto activo, sin datos) y ficha por país. No utiliza terminología técnica.
- `acerca.html`: vista documental para revisores del sistema, con matrices de confusión, walk-forward, SHAP global, comparativa con baseline, simulador de umbral y tabla de predicciones país-mes.

Este componente se considera complementario al TFM principal, no central. Su desarrollo continúa más allá del cierre de este documento.

---

## Síntesis

El sistema construido funciona como herramienta de priorización sobre el panel de países observable, no como predictor probabilístico calibrado de onsets futuros. Su valor real está en el filtrado informacionado de un universo grande de países hacia un conjunto pequeño operativamente revisable. Esta funcionalidad, aun acotada, constituye un aporte legítimo al ejercicio de la alerta temprana cuantitativa, y la documentación crítica de sus límites traza con precisión las direcciones de mejora para versiones posteriores.

El conjunto de auditorías metodológicas incorporadas en el notebook final (bootstrap clusterizado, curva PR, recalibración isotónica, segundo baseline aprendido, función de utilidad asimétrica) refuerza la honestidad cuantitativa del trabajo: cada afirmación se acompaña de su intervalo de incertidumbre apropiado, cada elección metodológica (modelo, umbral, baseline) se somete a contraste, y la valoración global del sistema queda parametrizada por la política de costes del usuario final.
