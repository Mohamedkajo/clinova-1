window.addEventListener("error", (event) => {
  const app = document.getElementById("app");
  if (app && !app.innerHTML) app.textContent = event.message || "Application failed to load.";
});

window.addEventListener("unhandledrejection", (event) => {
  const app = document.getElementById("app");
  if (app && !app.innerHTML) app.textContent = event.reason?.message || "Application failed to load.";
});
