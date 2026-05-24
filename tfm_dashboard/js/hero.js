/**
 * Banner de incertidumbre en el hero. Sin numeros (sin % ni F1).
 */

export function renderHero() {
  const el = document.getElementById("hero-uncertainty");
  if (!el) return;
  el.textContent =
    "Las alertas representan riesgo elevado de conflicto armado en los proximos 3 meses, no certeza. " +
    "Cada caso requiere validacion humana antes de actuar.";
}
