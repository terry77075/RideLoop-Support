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

const betaForm = document.querySelector("#beta-request-form");
if (betaForm) {
  const nameInput = betaForm.querySelector("#beta-name");
  const activityInput = betaForm.querySelector("#beta-activity");
  const deviceInputs = [...betaForm.querySelectorAll('input[name="device"]')];
  const nameError = document.querySelector("#beta-name-error");
  const deviceError = document.querySelector("#beta-device-error");
  const status = document.querySelector("#beta-form-status");
  const fallback = document.querySelector("#beta-email-fallback");
  const mailtoAgain = document.querySelector("#beta-mailto-again");
  const emailCopy = document.querySelector("#beta-email-copy");
  let requestIsPrepared = false;

  const clearNameError = () => {
    nameInput.setCustomValidity("");
    nameInput.removeAttribute("aria-invalid");
    nameError.textContent = "";
  };

  const invalidatePreparedRequest = () => {
    if (!requestIsPrepared) return;
    requestIsPrepared = false;
    mailtoAgain.removeAttribute("href");
    emailCopy.value = "";
    fallback.hidden = true;
    status.textContent = "Your answers changed. Prepare the email request again.";
  };

  nameInput.addEventListener("input", () => {
    clearNameError();
    invalidatePreparedRequest();
  });
  activityInput.addEventListener("input", invalidatePreparedRequest);
  deviceInputs.forEach((input) => input.addEventListener("change", () => {
    deviceInputs.forEach((deviceInput) => deviceInput.removeAttribute("aria-invalid"));
    deviceError.textContent = "";
    invalidatePreparedRequest();
  }));

  mailtoAgain.addEventListener("click", (event) => {
    if (!requestIsPrepared || !mailtoAgain.hasAttribute("href")) {
      event.preventDefault();
      status.textContent = "Complete the required fields and prepare the email request first.";
    }
  });

  betaForm.addEventListener("submit", (event) => {
    event.preventDefault();
    clearNameError();
    deviceError.textContent = "";
    status.textContent = "";

    const name = nameInput.value.trim();
    const selectedDevice = deviceInputs.find((input) => input.checked);

    if (!name) {
      nameInput.setCustomValidity("Please enter your name.");
      nameInput.setAttribute("aria-invalid", "true");
      nameError.textContent = "Enter your name before preparing the email.";
      nameInput.focus();
      nameInput.reportValidity();
      return;
    }

    if (!selectedDevice) {
      deviceInputs.forEach((input) => input.setAttribute("aria-invalid", "true"));
      deviceError.textContent = "Choose iPhone, Android, or Both.";
      deviceInputs[0].focus();
      deviceInputs[0].reportValidity();
      return;
    }

    const activity = activityInput.value.trim();
    const subject = `outabit beta access request — ${name}`;
    const body = [
      "Hi outabit team,",
      "",
      "I'd like to request beta access.",
      "",
      `Name: ${name}`,
      `Device: ${selectedDevice.value}`,
      `Favorite outdoor activity: ${activity || "Not provided"}`,
      "",
      "Please review my request."
    ].join("\n");
    const encodeMailtoPart = (value) => encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
    const mailto = `mailto:support@outabit.com?subject=${encodeMailtoPart(subject)}&body=${encodeMailtoPart(body)}`;

    mailtoAgain.href = mailto;
    emailCopy.value = `To: support@outabit.com\nSubject: ${subject}\n\n${body}`;
    fallback.hidden = false;
    requestIsPrepared = true;
    status.textContent = "Your email draft is ready. Tap Choose Gmail or Mail, then review it and press Send; the website has not sent anything automatically.";
    mailtoAgain.focus();
  });
}
