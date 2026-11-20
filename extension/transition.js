import { readPreferences } from "./preferences.js";
import { setLocale, translate, translateDom } from "./i18n.js";

const title = document.querySelector("#title");
const status = document.querySelector("#status");
const actions = document.querySelector("#actions");
const retry = document.querySelector("#retry");
const messages = {
  busy: "Hay una operación en curso. Espera un momento y vuelve a intentarlo.",
  interrupted: "Abre MultiTikTok para consultar el estado de la sesión o reintenta abrir TikTok.",
  locked: "Abre MultiTikTok y desbloquea la bóveda para continuar.",
  multiple_tabs: "Deja una sola pestaña de TikTok abierta para continuar.",
  open_failed: "Chrome no pudo abrir TikTok. Puedes reintentar desde aquí.",
  park_failed: "Chrome no pudo preparar la pestaña. Reintenta abrir TikTok cuando esté disponible.",
  permission: "Abre MultiTikTok y concede el acceso a TikTok para continuar.",
  recovery: "La sesión anterior está pendiente de restauración. Reintenta para recuperarla.",
  unexpected: "Abre MultiTikTok para consultar el estado de la sesión."
};
let sending = false;
let shownError = null;

function render(result) {
  if (result?.working || result?.opened) {
    if (result.mode === "switch" && result.alias) title.textContent = translate(`Cambiando a «${result.alias}»…`);
    else if (result.mode === "login") title.textContent = translate("Abriendo TikTok para iniciar sesión");
    else if (result.mode === "recover") title.textContent = translate("Restaurando la sesión anterior");
    status.textContent = translate("Espera un momento mientras se prepara TikTok.");
    actions.hidden = true;
    shownError = null;
    return;
  }
  const error = result?.error ?? "unexpected";
  if (shownError !== error) {
    title.textContent = translate("No se pudo completar el cambio");
    status.textContent = translate(messages[error] ?? messages.unexpected);
    shownError = error;
  }
  actions.hidden = false;
  retry.hidden = !result?.retry;
}

async function send(command) {
  if (sending) return;
  sending = true;
  try {
    if (command === "transitionRetry") {
      title.textContent = translate("Preparando la sesión");
      render({ working: true });
    }
    const result = await chrome.runtime.sendMessage({ command });
    render(command === "transitionRetry" && result?.error ? { ...result, retry: true } : result);
    // Keep direct errors such as a locked vault readable until the next attempt.
    if (command === "transitionView" && result?.working) setTimeout(refresh, 750);
  } catch {
    render({ error: "unexpected" });
  } finally {
    sending = false;
  }
}

function refresh() {
  return send("transitionView");
}

retry.addEventListener("click", () => send("transitionRetry"));
readPreferences().then(({ locale }) => {
  setLocale(locale);
  translateDom();
}, () => console.warn("MultiTikTok: preferencias de idioma no disponibles."))
  .then(refresh);
