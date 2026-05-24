/**
 * Lightbox para la galeria de PNG.
 */

export function initLightbox() {
  const box = document.getElementById("lightbox");
  const img = document.getElementById("lightbox-img");
  const close = document.getElementById("lightbox-close");

  document.querySelectorAll(".gallery img").forEach((el) => {
    el.addEventListener("click", () => {
      img.src = el.src;
      img.alt = el.alt;
      box.classList.add("is-open");
      box.setAttribute("aria-hidden", "false");
    });
  });

  function dismiss() {
    box.classList.remove("is-open");
    box.setAttribute("aria-hidden", "true");
    img.src = "";
  }
  close.addEventListener("click", dismiss);
  box.addEventListener("click", (e) => { if (e.target === box) dismiss(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") dismiss(); });
}
