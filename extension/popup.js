import { hostPermission } from "./sessions.js";

const ui = Object.fromEntries(
  Array.from(document.querySelectorAll("[id]"), (element) => [element.id, element])
);
const collator = new Intl.Collator("es", { sensitivity: "base" });
const messages = {
  alias: "Escribe un alias de hasta 48 caracteres.",
  busy: "Hay una operación en curso. Si el selector se cierra, vuelve a abrirlo.",
  expired: "La sesión guardada venció. Inicia sesión en TikTok y vuelve a guardarla.",
  locked: "Desbloquea las sesiones con tu frase de acceso.",
  multiple_tabs: "Cierra las otras pestañas de TikTok, incluidas las de otras ventanas de este perfil.",
  park_failed: "Chrome no pudo preparar la pestaña. Guarda tu trabajo y vuelve a intentarlo.",
  permission: "Permite el acceso a TikTok para continuar.",
  phrase_length: "Escribe una frase de acceso de entre 12 y 256 caracteres.",
  recovery: "El cambio se interrumpió. Restaura la sesión anterior para continuar.",
  restored: "El cambio falló y se restauró la sesión anterior.",
  save_tab: "Deja una sola pestaña de TikTok abierta para guardar la sesión.",
  sign_in: "No se detectó una sesión compatible. Inicia sesión en TikTok y comprueba tu @usuario.",
  storage: "Chrome no pudo guardar las sesiones. El cambio quedó sin aplicar.",
  unknown_account: "La cuenta ya no está guardada.",
  unsaved: "Guarda la sesión abierta o ciérrala desde TikTok antes de cambiar.",
  wrong_phrase: "Comprueba tu frase de acceso e inténtalo de nuevo.",
  unexpected: "La acción quedó sin completar. Cierra y vuelve a abrir el selector."
};

let model = {};
let editingId;
let action;
let busy = false;

function announce(text, error = false) {
  ui.status.textContent = text;
  ui.status.dataset.error = String(error);
}

function render() {
  const { allowed, unlocked, protected: protectionEnabled, accounts = [], recovery, active, previous, invite } = model;
  ui.permission.hidden = allowed !== false;
  ui.unlock.hidden = !allowed || unlocked || !protectionEnabled;
  ui.settings.hidden = !unlocked;
  ui.manager.hidden = !allowed || !unlocked || recovery;
  ui.recovery.hidden = !allowed || !recovery;
  ui.invite.hidden = !allowed || !invite || recovery;
  ui.add.hidden = !accounts.length;
  ui.previous.hidden = !accounts.some((account) => account.id === previous && account.id !== active);

  const ordered = [...accounts].sort((first, second) =>
    Number(second.favorite) - Number(first.favorite) || collator.compare(first.alias, second.alias)
  );
  const rows = ordered.map((account) => {
    const row = ui["account-row"].content.cloneNode(true);
    row.querySelector(".name").textContent = account.alias;
    const avatar = row.querySelector(".avatar");
    avatar.textContent = Array.from(account.alias)[0].toLocaleUpperCase("es");
    if (account.avatar) {
      const image = document.createElement("img");
      image.alt = "";
      image.referrerPolicy = "no-referrer";
      image.addEventListener("error", () => image.remove(), { once: true });
      image.src = account.avatar;
      avatar.append(image);
    }
    const detail = [];
    if (account.favorite) detail.push("Favorita");
    if (account.id === active) detail.push("Sesión detectada");
    row.querySelector(".detail").textContent = detail.join(" · ");
    const open = row.querySelector(".account");
    open.setAttribute("aria-label", `Cambiar a ${account.alias}`);
    open.addEventListener("click", () => confirmChange("switch", account.id));
    const more = row.querySelector(".more");
    more.setAttribute("aria-label", `Editar ${account.alias}`);
    more.addEventListener("click", () => {
      editingId = account.id;
      ui["edit-alias"].value = account.alias;
      ui.favorite.checked = account.favorite;
      ui.edit.showModal();
    });
    return row;
  });
  ui.accounts.replaceChildren(...rows);
}

function confirmChange(command, id) {
  action = { command, id };
  ui["confirm-title"].textContent = command === "add" ? "Iniciar sesión en otra cuenta" : "Cambiar sesión";
  ui.confirm.showModal();
}

async function run(request, success) {
  if (busy) return;
  busy = true;
  document.querySelector("main").inert = true;
  announce("Un momento…");
  try {
    const result = await request();
    if (result.error) {
      announce(messages[result.error] ?? messages.unexpected, true);
      if (result.error === "recovery") model = await chrome.runtime.sendMessage({ command: "view" });
    } else if (result.destination) {
      announce(result.destination.opened ? "Comprueba tu @usuario en TikTok." : "Abre TikTok para continuar.");
      model = await chrome.runtime.sendMessage({ command: "view" });
    } else {
      model = result;
      announce(success ?? "");
    }
  } catch {
    announce(messages.unexpected, true);
  } finally {
    document.querySelector("main").inert = false;
    busy = false;
    render();
  }
}

function send(command, fields = {}, success) {
  return run(() => chrome.runtime.sendMessage({ command, ...fields }), success);
}

ui.allow.addEventListener("click", () => run(async () => {
  const allowed = await chrome.permissions.request({ origins: [hostPermission] });
  if (!allowed) return { error: "permission" };
  return chrome.runtime.sendMessage({ command: "view" });
}));
ui.unlock.addEventListener("submit", (event) => {
  event.preventDefault();
  const phrase = ui.phrase.value;
  ui.phrase.value = "";
  send("unlock", { phrase });
});
function updateProtectionForm() {
  const needsPhrase = ui.protect.checked && !model.protected;
  ui["new-phrase-fields"].hidden = !needsPhrase;
  ui["new-phrase"].required = needsPhrase;
  ui.lock.hidden = !model.protected;
}

ui.settings.addEventListener("click", () => {
  ui.protect.checked = Boolean(model.protected);
  ui["new-phrase"].value = "";
  updateProtectionForm();
  ui.preferences.showModal();
});
ui.protect.addEventListener("change", updateProtectionForm);
ui.support.addEventListener("click", () => ui["support-dialog"].showModal());
ui["close-settings"].addEventListener("click", () => ui.preferences.close());
ui["preferences-form"].addEventListener("submit", (event) => {
  event.preventDefault();
  const enabled = ui.protect.checked;
  const phrase = enabled ? ui["new-phrase"].value : null;
  ui["new-phrase"].value = "";
  ui.preferences.close();
  if (enabled !== Boolean(model.protected)) send("setProtection", { phrase }, "Configuración guardada.");
});
ui.lock.addEventListener("click", () => {
  ui.preferences.close();
  send("lock");
});
ui.restore.addEventListener("click", () => send("recover", {}, "Sesión anterior restaurada."));
ui.save.addEventListener("submit", (event) => {
  event.preventDefault();
  const alias = ui.alias.value;
  send("save", { alias }, "Sesión guardada.");
});
ui.add.addEventListener("click", () => confirmChange("add"));
ui.previous.addEventListener("click", () => confirmChange("switch", model.previous));
ui["cancel-change"].addEventListener("click", () => ui.confirm.close());
ui["confirm-form"].addEventListener("submit", (event) => {
  event.preventDefault();
  ui.confirm.close();
  send(action.command, { id: action.id });
});
ui["edit-form"].addEventListener("submit", (event) => {
  event.preventDefault();
  ui.edit.close();
  send("edit", { id: editingId, alias: ui["edit-alias"].value, favorite: ui.favorite.checked }, "Cambios guardados.");
});
ui.cancel.addEventListener("click", () => ui.edit.close());
ui.unlink.addEventListener("click", () => {
  ui.edit.close();
  send("forget", { id: editingId }, "Se borró la copia guardada.");
});
for (const id of ["dismiss", "star"]) {
  ui[id].addEventListener("click", () => { send("dismiss"); });
}

send("view");
