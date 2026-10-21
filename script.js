document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });
});

const steps = [...document.querySelectorAll(".journey-steps li")];
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.find((entry) => entry.isIntersecting);
    if (!visible) return;
    steps.forEach((step) => step.classList.toggle("is-active", step === visible.target));
  }, { rootMargin: "-35% 0px -45%", threshold: 0 });
  steps.forEach((step) => observer.observe(step));
}