import { reportUrl } from "./report.js";
import { hostPermission } from "./sessions.js";

const ui = Object.fromEntries(
  Array.from(document.querySelectorAll("[id]"), (element) => [element.id, element])
);
const messages = {
  account_mismatch: "Selecciona en TikTok el @usuario de la cuenta que quieres reconectar.",
  alias: "Escribe un alias de hasta 48 caracteres.",
  busy: "Hay una operación en curso. Vuelve a intentarlo en un momento.",
  expired: "La sesión guardada venció. Abre su menú y elige Reconectar en TikTok.",
  focus_failed: "No se pudo abrir esta pestaña. Actualiza la lista y vuelve a intentarlo.",
  identity_unconfirmed: "Espera a que TikTok cargue tu perfil y comprueba tu @usuario.",
  interrupted: "El cambio se interrumpió. Comprueba la sesión en TikTok y vuelve al selector.",
  invalid_color: "Elige un color de cuenta válido.",
  invalid_order: "La lista cambió. Revisa el orden y vuelve a intentarlo.",
  locked: "Desbloquea las sesiones con tu frase de acceso.",
  multiple_tabs: "Guarda tu trabajo y deja una sola pestaña de TikTok abierta en este perfil de Chrome.",
  open_failed: "Chrome no pudo abrir TikTok. Usa el enlace de inicio de sesión.",
  park_failed: "Chrome no pudo preparar la pestaña. Guarda tu trabajo y vuelve a intentarlo.",
  permission: "Permite el acceso a TikTok para continuar.",
  phrase_length: "Escribe una frase de acceso de entre 12 y 256 caracteres.",
  recovery: "El último cambio se interrumpió. Restaura la sesión anterior.",
  restored: "Se restauró la sesión anterior. Comprueba tu @usuario en TikTok.",
  save_tab: "Deja una sola pestaña de TikTok abierta para guardar la sesión.",
  setup_active: "Termina o cancela el inicio de sesión en curso.",
  sign_in: "Inicia sesión en TikTok y comprueba que aparezca tu @usuario.",
  storage: "Chrome no pudo guardar los cambios. Vuelve a intentarlo.",
  unknown_account: "La cuenta ya no está guardada.",
  unsaved: "Guarda la sesión abierta antes de cambiar.",
  wrong_phrase: "Comprueba tu frase de acceso e inténtalo de nuevo.",
  unexpected: "La acción quedó sin completar. Cierra y vuelve a abrir el selector."
};
const colorPattern = /^#[0-9a-f]{6}$/i;
const inPanel = window.top !== window;
const view = () => request("view");
let model = {};
let editingId;
let accountColor = null;
let confirmation;
let lastError;
let busy = false;
let refreshJob;
let refreshQueued = false;
let operation = 0;
let poll;
let panelWindowId;
let previousPromptShown;
let renderedAccounts;
let renderedTabs;
let renderedIdentity;
let renderedSetup;

document.body.classList.toggle("panel", inPanel);

function request(command, fields = {}) {
  return chrome.runtime.sendMessage({ command, ...fields });
}

function announce(text, error = false) {
  ui.status.textContent = text;
  ui.status.dataset.error = String(error);
}

function setAvatar(container, text, url) {
  container.textContent = Array.from(text)[0]?.toLocaleUpperCase("es") || "?";
  if (!url) return;
  const image = document.createElement("img");
  image.alt = "";
  image.referrerPolicy = "no-referrer";
  image.addEventListener("error", () => image.remove(), { once: true });
  image.src = url;
  container.append(image);
}

function renderIdentity(account) {
  const identity = model.identity;
  const snapshot = JSON.stringify([identity, account?.alias, model.unsaved]);
  if (snapshot === renderedIdentity) return;
  renderedIdentity = snapshot;

  ui["active-handle"].textContent = identity?.handle || "Identidad por confirmar";
  ui["active-detail"].textContent = model.unsaved
    ? "Sesión sin guardar"
    : identity?.handle && account ? account.alias : "Comprueba qué cuenta está abierta en TikTok.";
  setAvatar(ui["active-avatar"], identity?.handle?.slice(1) || "", identity?.handle ? identity.avatar : null);
}

function renderTabs(tabs) {
  const snapshot = JSON.stringify(tabs.map(({ id }) => id));
  if (snapshot === renderedTabs) return;
  renderedTabs = snapshot;
  ui["tabs-summary"].textContent = tabs.length === 1
    ? "1 pestaña de TikTok abierta"
    : `${tabs.length} pestañas de TikTok abiertas`;
  ui["tab-hint"].hidden = tabs.length < 2;
  const items = tabs.map(({ id }, index) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.className = "quiet";
    button.type = "button";
    button.textContent = `Ir a la pestaña ${index + 1}`;
    button.addEventListener("click", () => send("focusTikTok", { id }));
    item.append(button);
    return item;
  });
  ui["tab-list"].replaceChildren(...items);
}

function normalizeSearch(text) {
  return text.toLocaleLowerCase("es").normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function renderAccounts() {
  const accounts = model.accounts ?? [];
  const query = normalizeSearch(ui.search.value.trim());
  const snapshot = JSON.stringify([accounts, query, model.active, model.identity?.handle]);
  if (snapshot === renderedAccounts) return;
  renderedAccounts = snapshot;

  const ordered = [...accounts].sort((first, second) => Number(second.favorite) - Number(first.favorite));
  const matches = ordered.filter(({ alias, handle }) =>
    normalizeSearch(alias).includes(query) || normalizeSearch(handle ?? "").includes(query)
  );
  const rows = matches.map((account) => {
    const row = ui["account-row"].content.cloneNode(true);
    row.querySelector(".name").textContent = account.alias;
    const avatar = row.querySelector(".avatar");
    setAvatar(avatar, account.alias, account.avatar);
    if (colorPattern.test(account.color)) avatar.style.setProperty("--account-color", account.color);
    const active = model.active === account.id;
    row.querySelector(".detail").textContent = [
      account.handle,
      account.favorite ? "Favorita" : "",
      active && model.identity?.handle ? "Sesión abierta" : ""
    ].filter(Boolean).join(" · ");
    const open = row.querySelector(".account");
    if (active) {
      open.disabled = true;
      row.querySelector(".open-label").textContent = model.identity?.handle ? "Abierta" : "";
    } else {
      open.setAttribute("aria-label", `Cambiar a ${account.alias}`);
      open.addEventListener("click", () => change("switch", account.id));
    }
    const more = row.querySelector(".more");
    more.setAttribute("aria-label", `Editar ${account.alias}`);
    more.addEventListener("click", () => openEdit(account));
    return row;
  });
  ui["no-results"].hidden = matches.length > 0 || accounts.length === 0;
  ui.accounts.replaceChildren(...rows);
}

function renderSetup(setup, accounts, tabs) {
  const setupKey = setup ? `${setup.stage}:${setup.accountId ?? ""}` : "";
  const changed = setupKey !== renderedSetup;
  const account = accounts.find(({ id }) => id === setup?.accountId);
  if (changed && setup) ui.alias.value = account?.alias ?? "";
  renderedSetup = setupKey;
  ui.setup.hidden = !setup;
  ui["open-tiktok"].hidden = Boolean(setup);
  ui["open-tiktok-login"].hidden = model.canSave || tabs.length > 0;
  ui["focus-setup-tab"].hidden = model.canSave || tabs.length !== 1;

  if (setup) {
    ui["setup-title"].textContent = account ? `Reconecta «${account.alias}»` : "Inicia sesión en tu nueva cuenta";
    const mismatch = setup.stage === "add"
      ? "La cuenta abierta ya está guardada. Selecciona otra cuenta en TikTok."
      : messages.account_mismatch;
    const hint = tabs.length > 1 ? messages.multiple_tabs
      : model.lastError === "account_mismatch" ? mismatch
      : model.canSave ? "Ya puedes guardar esta sesión."
      : "Completa el inicio de sesión en TikTok y vuelve al selector.";
    if (ui["setup-hint"].textContent !== hint) ui["setup-hint"].textContent = hint;
  }
  ui.save.hidden = setup ? !model.canSave : !model.canSave && !model.unsaved;
  ui["save-session"].disabled = !model.canSave;
  ui["save-session"].textContent = setup?.stage === "reconnect" ? "Guardar reconexión" : "Guardar sesión";
  ui.add.hidden = Boolean(setup);
}

function syncPolling(setup) {
  const needed = Boolean(setup && !document.hidden);
  if (needed && !poll) poll = setInterval(refresh, 2500);
  if (!needed && poll) {
    clearInterval(poll);
    poll = undefined;
  }
}

function render() {
  const {
    allowed, unlocked, protected: protectionEnabled, accounts = [], recovery, active,
    previous, invite, setup, tiktokTabs = [], confirmPrevious
  } = model;
  const managerAvailable = allowed && unlocked && !recovery;
  ui.permission.hidden = allowed !== false;
  ui.unlock.hidden = !allowed || unlocked || !protectionEnabled;
  ui.settings.hidden = !unlocked;
  ui.manager.hidden = !managerAvailable;
  ui.recovery.hidden = !allowed || !recovery;
  ui.invite.hidden = !managerAvailable || !invite;
  const activeAccount = accounts.find(({ id }) => id === active);
  if (!ui.invite.hidden) {
    const question = activeAccount ? `¿Te sirvió cambiar a «${activeAccount.alias}»?` : "¿Te ahorró otro inicio de sesión?";
    ui["invite-message"].textContent = `${question} Una estrella ayuda a que más personas encuentren MultiTikTok.`;
  }

  const reportCode = lastError ?? model.lastError;
  ui.report.href = reportUrl(reportCode);
  ui["recovery-report"].href = reportUrl(reportCode ?? "recovery");
  syncPolling(managerAvailable && setup);
  if (unlocked === false) {
    if (ui.preferences.open) ui.preferences.close();
    if (ui.confirm.open) {
      confirmation = undefined;
      ui.confirm.close();
    }
    ui["new-phrase"].value = "";
    ui["edit-alias"].value = "";
    ui.alias.value = "";
    ui.search.value = "";
    ui.accounts.replaceChildren();
    renderedAccounts = undefined;
  }
  if (!managerAvailable) {
    if (ui.edit.open) ui.edit.close();
    if (ui.confirm.open && (confirmation?.kind === "change" || confirmation?.kind === "guard")) {
      confirmation = undefined;
      ui.confirm.close();
    }
    return;
  }
  ui["account-manager"].hidden = accounts.length === 0;
  ui.onboarding.hidden = accounts.length > 0 || Boolean(setup);
  ui.previous.hidden = !accounts.some((account) => account.id === previous && account.id !== active);
  renderIdentity(activeAccount);
  renderTabs(tiktokTabs);
  renderSetup(setup, accounts, tiktokTabs);
  renderAccounts();
  if (ui.edit.open) renderEditPosition();

  if (!confirmPrevious) previousPromptShown = undefined;
  if (confirmPrevious && confirmPrevious !== previousPromptShown && !document.querySelector("dialog[open]")) {
    previousPromptShown = confirmPrevious;
    change("switch", confirmPrevious, { shortcut: true });
  }
}

function refresh() {
  if (document.hidden) return;
  if (busy || refreshJob) {
    refreshQueued = true;
    return;
  }
  const currentOperation = operation;
  refreshJob = view().then((result) => {
    if (result && !result.error && !busy && currentOperation === operation) {
      model = result;
      render();
    }
  }).catch(() => {
    // La siguiente acción visible puede mostrar el error y permitir reintentar.
  }).finally(() => {
    refreshJob = undefined;
    if (!busy && refreshQueued) {
      refreshQueued = false;
      refresh();
    }
  });
}

async function run(perform, success, handleError) {
  if (busy) return false;
  busy = true;
  operation += 1;
  announce("Un momento…");
  let completed = false;
  let error;
  try {
    await refreshJob;
    const result = await perform();
    if (!result || result.error) {
      error = result?.error ?? "unexpected";
      const current = await view().catch(() => null);
      if (current && !current.error) model = current;
    } else {
      const current = result.destination ? await view() : result;
      if (current && !current.error) model = current;
      else refreshQueued = true;
      completed = true;
    }
  } catch {
    error = "unexpected";
  } finally {
    busy = false;
    lastError = error;
    const detail = error === "account_mismatch" && model.setup?.stage === "add"
      ? "La cuenta abierta ya está guardada. Selecciona otra cuenta en TikTok."
      : messages[error] ?? messages.unexpected;
    announce(error ? detail : success ?? "", Boolean(error));
    render();
    if (error) handleError?.(error);
    if (refreshQueued) {
      refreshQueued = false;
      void refresh();
    }
  }
  return completed;
}

function send(command, fields = {}, success, handleError) {
  return run(() => request(command, fields), success, handleError);
}

function ask({ title, detail, label, kind, onConfirm, onCancel }) {
  if (busy || ui.confirm.open) return;
  confirmation = { kind, onConfirm, onCancel };
  ui["confirm-title"].textContent = title;
  ui["confirm-detail"].textContent = detail;
  ui["confirm-action"].textContent = label;
  ui.confirm.showModal();
}

function discardConfirmation() {
  const pending = confirmation;
  confirmation = undefined;
  ui.confirm.close();
  pending?.onCancel?.();
}

function focusTabs() {
  ui.tabs.open = true;
  ui["tabs-summary"].focus();
}

function guardUnsaved(shortcut = false) {
  const cancel = shortcut ? () => void send("dismissPrevious") : undefined;
  ask({
    title: "Guarda la sesión abierta",
    detail: "Hay una sesión de TikTok sin guardar. Guárdala con un alias y vuelve a elegir la cuenta.",
    label: "Guardar sesión",
    kind: "guard",
    onConfirm: () => {
      cancel?.();
      if (ui.save.hidden || !model.canSave) focusTabs();
      else {
        ui.alias.focus();
        ui.alias.scrollIntoView({ block: "nearest" });
      }
    },
    onCancel: cancel
  });
}

function change(command, id, { shortcut = false } = {}) {
  if (busy) return;
  const { accounts = [], settings, setup, tiktokTabs = [] } = model;
  const account = accounts.find((item) => item.id === id);
  const dismissShortcut = () => {
    if (shortcut) void send("dismissPrevious");
  };
  if (setup) {
    announce(messages.setup_active, true);
    dismissShortcut();
    return;
  }
  if (tiktokTabs.length > 1) {
    announce(messages.multiple_tabs, true);
    focusTabs();
    dismissShortcut();
    return;
  }
  if (model.unsaved) {
    guardUnsaved(shortcut);
    return;
  }
  const perform = () => send(command, id ? { id } : {}, undefined, (error) => {
    if (error === "unsaved") guardUnsaved();
    if (error === "multiple_tabs" || error === "save_tab") focusTabs();
  });
  if (command === "switch" && settings?.quickSwitch) {
    void perform();
    return;
  }
  const title = command === "add" ? "Agregar otra cuenta"
    : command === "reconnect" ? `Reconectar «${account?.alias ?? ""}»`
    : `Cambiar a «${account?.alias ?? ""}»`;
  const detail = command === "switch"
    ? "Guarda lo que estés haciendo y comprueba tu @usuario en TikTok después del cambio."
    : "Guarda lo que estés haciendo. Se abrirá el inicio de sesión oficial de TikTok.";
  if (command === "add" && accounts.length === 0) {
    void perform();
    return;
  }
  ask({ title, detail, label: "Continuar", kind: "change", onConfirm: perform, onCancel: dismissShortcut });
}

function editGroup() {
  const accounts = model.accounts ?? [];
  const account = accounts.find(({ id }) => id === editingId);
  return account ? accounts.filter(({ favorite }) => favorite === account.favorite) : [];
}

function renderEditPosition() {
  const group = editGroup();
  const position = group.findIndex(({ id }) => id === editingId);
  const text = position < 0 ? "" : `Posición ${position + 1} de ${group.length}`;
  if (ui["account-position"].textContent !== text) ui["account-position"].textContent = text;
  ui["move-up"].disabled = position < 1;
  ui["move-down"].disabled = position < 0 || position >= group.length - 1;
  ui["refresh-profile"].disabled = model.active !== editingId || !model.canSave || Boolean(model.setup);
  ui.reconnect.disabled = position < 0 || Boolean(model.setup);
}

function moveAccount(offset) {
  const group = editGroup();
  const position = group.findIndex(({ id }) => id === editingId);
  const neighbor = group[position + offset];
  if (position < 0 || !neighbor) return;
  const ids = model.accounts.map(({ id }) => id);
  const first = ids.indexOf(editingId);
  const second = ids.indexOf(neighbor.id);
  [ids[first], ids[second]] = [ids[second], ids[first]];
  ui["edit-status"].hidden = true;
  void send("reorder", { ids }, undefined, (error) => {
    ui["edit-status"].textContent = messages[error] ?? messages.unexpected;
    ui["edit-status"].hidden = false;
  });
}

function openEdit(account) {
  editingId = account.id;
  accountColor = colorPattern.test(account.color) ? account.color : null;
  ui["edit-alias"].value = account.alias;
  ui.favorite.checked = account.favorite;
  ui.color.value = accountColor ?? "#25f4ee";
  ui["clear-color"].disabled = !accountColor;
  ui["edit-status"].hidden = true;
  renderEditPosition();
  ui.edit.showModal();
}

function updateProtectionForm() {
  const needsPhrase = ui.protect.checked && !model.protected;
  ui["new-phrase-fields"].hidden = !needsPhrase;
  ui["new-phrase"].required = needsPhrase;
  ui["auto-lock"].disabled = !ui.protect.checked;
  ui.lock.hidden = !model.protected;
}

async function loadShortcuts() {
  ui.shortcuts.hidden = true;
  if (!chrome.commands?.getAll) return;
  try {
    const commands = await chrome.commands.getAll();
    const labels = {
      _execute_action: "Abrir el selector",
      "open-previous-account": "Volver a la cuenta anterior"
    };
    const shortcuts = commands.filter(({ name }) => Object.hasOwn(labels, name));
    const items = shortcuts.map(({ name, shortcut }) => {
      const item = document.createElement("li");
      const label = document.createElement("span");
      const key = document.createElement("kbd");
      label.textContent = labels[name];
      key.textContent = shortcut || "Sin asignar";
      item.append(label, key);
      return item;
    });
    ui.shortcuts.replaceChildren(...items);
    ui.shortcuts.hidden = items.length === 0;
  } catch {
    ui.shortcuts.hidden = true;
  }
}

function loadPreferences() {
  const { settings = {} } = model;
  ui.protect.checked = Boolean(model.protected);
  ui["new-phrase"].value = "";
  ui["quick-switch"].checked = Boolean(settings.quickSwitch);
  const minutes = String(settings.autoLockMinutes ?? 0);
  ui["auto-lock"].querySelector("[data-custom]")?.remove();
  if (!Array.from(ui["auto-lock"].options).some(({ value }) => value === minutes)) {
    const option = new Option(`${minutes} minutos`, minutes);
    option.dataset.custom = "";
    ui["auto-lock"].add(option);
  }
  ui["auto-lock"].value = minutes;
  ui.wipe.disabled = !model.accounts?.length;
  updateProtectionForm();
}

ui["open-panel"].addEventListener("click", () => {
  chrome.sidePanel.open({ windowId: panelWindowId }).then(() => window.close()).catch(() => {
    announce("Chrome no pudo abrir el panel lateral. Vuelve a intentarlo.", true);
  });
});
if (!inPanel && chrome.sidePanel?.open) {
  chrome.windows.getCurrent().then(({ id }) => {
    if (!Number.isInteger(id)) return;
    panelWindowId = id;
    ui["open-panel"].hidden = false;
  }).catch(() => {});
}

ui.allow.addEventListener("click", () => {
  if (busy) return;
  const permission = chrome.permissions.request({ origins: [hostPermission] });
  void run(async () => (await permission) ? view() : { error: "permission" });
});
ui.unlock.addEventListener("submit", (event) => {
  event.preventDefault();
  const phrase = ui.phrase.value;
  ui.phrase.value = "";
  void send("unlock", { phrase });
});
ui.settings.addEventListener("click", () => {
  loadPreferences();
  ui.preferences.showModal();
  void loadShortcuts();
});
ui.preferences.addEventListener("close", () => { ui["new-phrase"].value = ""; });
ui.protect.addEventListener("change", updateProtectionForm);
ui.support.addEventListener("click", () => ui["support-dialog"].showModal());
ui["close-settings"].addEventListener("click", () => ui.preferences.close());
ui["preferences-form"].addEventListener("submit", (event) => {
  event.preventDefault();
  if (busy) return;
  const enabled = ui.protect.checked;
  const phrase = enabled ? ui["new-phrase"].value : null;
  const quickSwitch = ui["quick-switch"].checked;
  const autoLockMinutes = enabled ? Number(ui["auto-lock"].value) : 0;
  ui.preferences.close();
  void run(async () => {
    if (enabled !== Boolean(model.protected)) {
      const result = await request("setProtection", { phrase });
      if (result.error) return result;
    }
    return request("settings", { quickSwitch, autoLockMinutes });
  }, "Configuración guardada.");
});
ui.lock.addEventListener("click", () => {
  ui.preferences.close();
  void send("lock");
});
ui.wipe.addEventListener("click", () => {
  ui.preferences.close();
  ask({
    title: "¿Borrar todas las copias?",
    detail: "Se borrarán las cuentas guardadas en este perfil de Chrome. La sesión abierta en TikTok seguirá disponible.",
    label: "Borrar todas las copias",
    onConfirm: async () => {
      if (await send("wipeAccounts", {}, "Se borraron las copias guardadas.")) ui.alias.value = "";
    }
  });
});
ui.restore.addEventListener("click", () => send("recover", {}, "Sesión anterior restaurada. Comprueba tu @usuario en TikTok."));
ui.save.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!model.canSave) return;
  if (await send("save", { alias: ui.alias.value }, "Sesión guardada.", (error) => {
    if (error === "multiple_tabs" || error === "save_tab") focusTabs();
  })) ui.alias.value = "";
});
ui.add.addEventListener("click", () => change("add"));
ui["focus-setup-tab"].addEventListener("click", () => {
  const [tab] = model.tiktokTabs ?? [];
  if (tab) void send("focusTikTok", { id: tab.id });
});
ui["cancel-setup"].addEventListener("click", () => send("cancelSetup", {}, "Inicio de sesión cancelado."));
ui.previous.addEventListener("click", () => change("switch", model.previous));
ui.search.addEventListener("input", renderAccounts);

ui["cancel-change"].addEventListener("click", discardConfirmation);
ui.confirm.addEventListener("cancel", (event) => {
  event.preventDefault();
  discardConfirmation();
});
ui["confirm-form"].addEventListener("submit", (event) => {
  event.preventDefault();
  const pending = confirmation;
  confirmation = undefined;
  ui.confirm.close();
  pending?.onConfirm();
});

ui["edit-form"].addEventListener("submit", (event) => {
  event.preventDefault();
  ui.edit.close();
  void send("edit", {
    id: editingId, alias: ui["edit-alias"].value, favorite: ui.favorite.checked, color: accountColor
  }, "Cambios guardados.");
});
ui.cancel.addEventListener("click", () => ui.edit.close());
ui.color.addEventListener("input", () => {
  accountColor = ui.color.value;
  ui["clear-color"].disabled = false;
});
ui["clear-color"].addEventListener("click", () => {
  accountColor = null;
  ui.color.value = "#25f4ee";
  ui.color.focus();
  ui["clear-color"].disabled = true;
});
ui["move-up"].addEventListener("click", () => moveAccount(-1));
ui["move-down"].addEventListener("click", () => moveAccount(1));
ui.reconnect.addEventListener("click", () => {
  ui.edit.close();
  change("reconnect", editingId);
});
ui["refresh-profile"].addEventListener("click", () => {
  const account = model.accounts?.find(({ id }) => id === editingId);
  if (!account || model.active !== editingId) return;
  ui.edit.close();
  void send("save", { alias: account.alias }, "Perfil actualizado.");
});
ui.unlink.addEventListener("click", () => {
  const account = model.accounts?.find(({ id }) => id === editingId);
  if (!account) return;
  ui.edit.close();
  ask({
    title: `¿Borrar la copia de «${account.alias}»?`,
    detail: "La cuenta seguirá disponible en TikTok. Para usarla aquí de nuevo, inicia sesión y guarda una copia.",
    label: "Borrar copia",
    onConfirm: () => send("forget", { id: account.id }, "Se borró la copia guardada.")
  });
});
ui.dismiss.addEventListener("click", () => send("dismiss"));
ui.star.addEventListener("click", () => {
  if (!ui.invite.hidden) void send("dismiss");
});

document.addEventListener("visibilitychange", () => {
  syncPolling(!ui.manager.hidden && model.setup);
  if (!document.hidden) void refresh();
});
window.addEventListener("focus", refresh);
window.addEventListener("pagehide", () => {
  if (model.confirmPrevious) void request("dismissPrevious").catch(() => {});
});
function knownTab(id) {
  return model.tiktokTabs?.some((tab) => tab.id === id);
}

function isTikTokUrl(url) {
  const parsed = URL.parse(url ?? "");
  return parsed?.protocol === "https:" && (parsed.hostname === "tiktok.com" || parsed.hostname.endsWith(".tiktok.com"));
}

chrome.tabs.onUpdated.addListener((id, change, tab) => {
  if (!(change.url || change.status === "complete")) return;
  if (knownTab(id) || isTikTokUrl(change.url ?? tab?.url)) refresh();
});
chrome.tabs.onRemoved.addListener((id) => {
  if (knownTab(id)) refresh();
});
chrome.storage.onChanged.addListener(refresh);

void send("view");
