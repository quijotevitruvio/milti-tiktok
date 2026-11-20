import { reportUrl } from "./report.js";
import { hostPermission } from "./sessions.js";
import { setLocale, translate, translateDom } from "./i18n.js";
import { demoModel, demoChange } from "./popup-demo.js";
import { connectDataDialog } from "./popup-data.js";

const ui = Object.fromEntries(
  Array.from(document.querySelectorAll("[id]"), (element) => [element.id, element])
);
const messages = {
  account_mismatch: "Selecciona en TikTok el @usuario de la cuenta que quieres reconectar.",
  alias: "Escribe un alias de hasta 48 caracteres.",
  busy: "Hay una operación en curso. Vuelve a intentarlo en un momento.",
  expired: "La sesión guardada venció. Abre su menú y elige Reconectar en TikTok.",
  focus_failed: "No se pudo abrir esta pestaña. Actualiza la lista y vuelve a intentarlo.",
  confirm_account: "Confirma que quieres continuar con esta cuenta.",
  invalid_archive: "La cuenta activa no se puede archivar. Cambia de cuenta e inténtalo de nuevo.",
  invalid_backup: "Elige un JSON de organización exportado por MultiTikTok.",
  invalid_cleanup: "La lista de copias antiguas cambió. Revisa la selección de nuevo.",
  invalid_destination: "Este acceso rápido ya no está disponible.",
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
  posting: "TikTok tiene abierta una página de edición o subida. Guarda tu trabajo antes de continuar.",
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
const version = chrome.runtime.getManifest().version;
const reconnectStates = new Set(["reconnect", "expired", "unconfirmed"]);
const healthLabels = {
  active: "En TikTok", ready: "Guardada", reconnect: "Por reconectar",
  expired: "Vencida", unconfirmed: "Por comprobar", archived: "Archivada"
};
const destinations = { profile: "Perfil", upload: "Subir video", studio: "TikTok Studio" };
const collapsedGroups = new Set();
const demoCollapsedGroups = new Set();
let model = {};
let editingId;
let accountColor = null;
let confirmation;
let lastError;
let busy = false;
let refreshRetryTimer;
let refreshRetries = 0;
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
let demo = false;
let liveModel;
let newsInitialized = false;
let permissionPreviouslyGranted = false;
let onDiagnostic;
let aliasManuallyEdited = false;

document.body.classList.toggle("panel", inPanel);

function request(command, fields = {}) {
  return demo ? Promise.resolve({ error: "unexpected" }) : chrome.runtime.sendMessage({ command, ...fields });
}

function announce(text, error = false) {
  ui.status.textContent = text ? translate(text) : "";
  ui.status.dataset.error = String(error);
}

function setAvatar(container, text, url) {
  container.textContent = Array.from(text || "")[0]?.toLocaleUpperCase() || "?";
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
  const snapshot = JSON.stringify([identity, account?.alias, model.unsaved, model.settings?.locale]);
  if (snapshot === renderedIdentity) return;
  renderedIdentity = snapshot;

  ui["active-handle"].textContent = identity?.handle || translate("Identidad por confirmar");
  ui["active-detail"].textContent = model.unsaved
    ? translate("Sesión sin guardar")
    : account?.alias || translate("Comprueba qué cuenta está abierta en TikTok.");
  setAvatar(ui["active-avatar"], identity?.handle?.slice(1) || "", identity?.handle ? identity.avatar : null);
}

function renderTabs(tabs) {
  ui.tabs.hidden = tabs.length < 2;
  if (ui.tabs.hidden) ui.tabs.open = false;
  const snapshot = JSON.stringify([tabs.map(({ id }) => id), model.settings?.locale]);
  if (snapshot === renderedTabs) return;
  renderedTabs = snapshot;
  ui["tabs-summary"].textContent = tabs.length === 1
    ? translate("1 pestaña de TikTok abierta")
    : translate(`${tabs.length} pestañas de TikTok abiertas`);
  ui["tab-hint"].hidden = tabs.length < 2;
  const items = tabs.map(({ id }, index) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.className = "quiet";
    button.type = "button";
    button.textContent = translate(`Ir a la pestaña ${index + 1}`);
    button.addEventListener("click", () => send("focusTikTok", { id }));
    item.append(button);
    return item;
  });
  ui["tab-list"].replaceChildren(...items);
}

function normalizeSearch(text) {
  return text.toLocaleLowerCase("es").normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function accountHealth(account) {
  if (account.archived) return "archived";
  if (account.metadataOnly) return "reconnect";
  return account.health ?? (account.id === model.active ? "active" : "ready");
}

function accountRow(account) {
  const row = ui["account-row"].content.cloneNode(true);
  const avatar = row.querySelector(".avatar");
  setAvatar(avatar, account.alias, account.avatar);
  if (colorPattern.test(account.color)) avatar.style.setProperty("--account-color", account.color);
  row.querySelector(".name").textContent = account.alias;
  row.querySelector(".handle").textContent = account.handle ?? "";
  const health = healthLabels[accountHealth(account)];
  row.querySelector(".health").textContent = [
    account.favorite ? translate("Favorita") : "",
    health ? translate(health) : ""
  ].filter(Boolean).join(" · ");

  const open = row.querySelector(".account");
  open.dataset.accountId = account.id;
  const active = model.active === account.id;
  const reconnect = reconnectStates.has(accountHealth(account)) && !active;
  const label = account.archived ? "Archivada" : active ? "Abierta" : reconnect ? "Reconectar" : "Cambiar";
  row.querySelector(".open-label").textContent = translate(label);
  open.disabled = active || Boolean(account.archived);
  if (active) open.setAttribute("aria-current", "true");
  open.setAttribute("aria-label", translate(reconnect ? `Reconectar «${account.alias}»` : `Cambiar a «${account.alias}»`));
  open.addEventListener("click", () => change(reconnect ? "reconnect" : "switch", account.id));

  const more = row.querySelector(".more");
  more.hidden = demo;
  more.dataset.editId = account.id;
  more.setAttribute("aria-label", translate(`Editar ${account.alias}`));
  more.addEventListener("click", () => openEdit(account));

  const links = row.querySelector(".quick-links");
  links.hidden = Boolean(account.archived || reconnect);
  links.querySelector("summary").setAttribute("aria-label", translate(`Accesos rápidos de «${account.alias}»`));
  for (const button of links.querySelectorAll("button")) {
    button.addEventListener("click", () => {
      links.open = false;
      change("quickLink", account.id, { destination: button.dataset.destination });
    });
  }
  translateDom(row);
  return row;
}

function groupOptions(accounts) {
  const groups = [...new Set(accounts.map(({ group }) => group).filter(Boolean))];
  return groups.sort((first, second) => first.localeCompare(second, model.settings?.locale));
}

function renderAccounts() {
  const accounts = model.accounts ?? [];
  const query = normalizeSearch(ui.search.value.trim());
  const filter = ui["account-filter"].value;
  const archived = filter === "archived";
  const displayed = accounts.filter((account) => Boolean(account.archived) === archived);
  const groups = groupOptions(displayed);
  const groupFilter = ui["group-filter"];
  const selectedGroup = groups.includes(groupFilter.value) ? groupFilter.value : "";
  const locale = model.settings?.locale;
  const snapshot = JSON.stringify([accounts, query, filter, selectedGroup, model.active, locale, model.settings?.sortMode, demo]);
  if (snapshot === renderedAccounts) return;
  renderedAccounts = snapshot;
  const focusedAccount = document.activeElement?.dataset.accountId;
  const focusedEditor = document.activeElement?.dataset.editId;

  groupFilter.replaceChildren(new Option(translate("Todos los grupos"), ""), ...groups.map((name) => {
    const option = new Option(name, name);
    option.dataset.noTranslate = "";
    return option;
  }));
  groupFilter.hidden = groups.length === 0;
  groupFilter.value = selectedGroup;

  const recent = model.settings?.sortMode === "recent";
  const matches = displayed.filter((account) =>
    (!selectedGroup || account.group === selectedGroup) &&
    (filter !== "favorites" || account.favorite) &&
    (filter !== "reconnect" || reconnectStates.has(accountHealth(account))) &&
    [account.alias, account.handle, account.group].some((text) => normalizeSearch(text ?? "").includes(query))
  ).sort((first, second) => {
    const usage = recent ? (second.lastUsedAt ?? 0) - (first.lastUsedAt ?? 0) : 0;
    return usage || Number(second.favorite) - Number(first.favorite);
  });

  const makeList = (items) => {
    const list = document.createElement("ul");
    list.append(...items.map(accountRow));
    return list;
  };
  const buckets = Map.groupBy(matches, ({ group }) => group || "");
  const sections = [];
  for (const [group, items] of buckets) {
    const list = makeList(items);
    if (!group || selectedGroup) {
      sections.push(list);
      continue;
    }
    const section = document.createElement("details");
    const title = document.createElement("summary");
    title.dataset.noTranslate = "";
    title.textContent = group;
    const collapsed = demo ? demoCollapsedGroups : collapsedGroups;
    section.className = "account-group";
    section.open = Boolean(query) || !collapsed.has(group);
    title.addEventListener("click", () => {
      if (section.open) collapsed.add(group);
      else collapsed.delete(group);
    });
    section.append(title, list);
    sections.push(section);
  }
  ui["no-results"].hidden = matches.length > 0 || accounts.length === 0;
  ui.accounts.replaceChildren(...sections);
  if (focusedAccount || focusedEditor) {
    const selector = focusedAccount ? "[data-account-id]" : "[data-edit-id]";
    const replacement = Array.from(ui.accounts.querySelectorAll(selector))
      .find(({ dataset }) => (dataset.accountId ?? dataset.editId) === (focusedAccount ?? focusedEditor));
    (replacement && !replacement.disabled ? replacement : ui.search).focus({ preventScroll: true });
  }
}

function renderSetup(setup, accounts, tabs) {
  const setupKey = setup ? `${setup.stage}:${setup.accountId ?? ""}` : "";
  const changed = setupKey !== renderedSetup;
  const account = accounts.find(({ id }) => id === setup?.accountId);
  if (changed) {
    aliasManuallyEdited = false;
    if (setup) ui.alias.value = account?.alias ?? "";
  }
  renderedSetup = setupKey;
  ui.setup.hidden = !setup;
  ui["open-tiktok-login"].hidden = model.canSave || tabs.length > 0;
  ui["focus-setup-tab"].hidden = model.canSave || tabs.length !== 1;

  if (setup) {
    ui["setup-title"].textContent = translate(account ? `Reconecta «${account.alias}»` : "Inicia sesión en tu nueva cuenta");
    const mismatch = setup.stage === "add"
      ? "La cuenta abierta ya está guardada. Selecciona otra cuenta en TikTok."
      : messages.account_mismatch;
    const hint = tabs.length > 1 ? messages.multiple_tabs
      : model.lastError === "account_mismatch" ? mismatch
      : model.canSave ? "Ya puedes guardar esta sesión."
      : "Completa el inicio de sesión en TikTok y vuelve al selector.";
    const translatedHint = translate(hint);
    if (ui["setup-hint"].textContent !== translatedHint) ui["setup-hint"].textContent = translatedHint;
  }
  ui.save.hidden = setup ? !model.canSave : !model.canSave && !model.unsaved;
  ui["save-session"].disabled = !model.canSave;
  ui["save-help"].hidden = Boolean(setup) || model.canSave || tabs.length !== 1;
  ui["save-session"].textContent = translate(setup?.stage === "reconnect" ? "Guardar reconexión" : "Guardar sesión");
  renderAliasSuggestion();
  const savingFirst = accounts.length === 0 && (model.canSave || model.unsaved);
  ui.add.hidden = demo || Boolean(setup) || savingFirst;
  ui.add.classList.toggle("primary", accounts.length === 0 && !model.canSave);
  ui.add.classList.toggle("secondary", accounts.length > 0 || model.canSave);
}

function renderAliasSuggestion() {
  const suggestion = model.identity?.handle?.replace(/^@/, "");
  const chip = ui["suggest-alias"];
  chip.hidden = !suggestion || !model.canSave || Boolean(ui.alias.value) || aliasManuallyEdited;
  chip.textContent = suggestion ? translate(`Usar «${suggestion}» como alias`) : "";
}

function syncPolling() {
  const status = model.verification?.status;
  const needed = Boolean(!demo && !ui.manager.hidden && !document.hidden &&
    (model.setup || status === "checking" || status === "unconfirmed"));
  if (needed && !poll) poll = setInterval(refresh, 2500);
  if (!needed && poll) {
    clearInterval(poll);
    poll = undefined;
  }
}

function focusTikTok() {
  const [tab] = model.tiktokTabs ?? [];
  if (tab) void send("focusTikTok", { id: tab.id });
}

function renderVerification() {
  const verification = model.verification;
  ui.verification.hidden = !verification;
  if (!verification) return;
  const { status, expected, actual, previousId, accountId } = verification;
  const text = {
    checking: "Comprobando qué cuenta quedó abierta en TikTok…",
    verified: actual ? `Confirmada en TikTok ${actual}` : "La cuenta quedó confirmada en TikTok.",
    mismatch: expected && actual ? `Se esperaba ${expected} y TikTok muestra ${actual}.` : "TikTok muestra otra cuenta.",
    unconfirmed: expected ? `TikTok aún no confirma ${expected}.` : "Todavía no se pudo comprobar el @usuario."
  }[status];
  const message = translate(text || "");
  if (ui["verification-message"].textContent !== message) ui["verification-message"].textContent = message;
  ui.verification.dataset.state = status;
  ui["check-profile"].hidden = demo || !model.tiktokTabs?.length || !["mismatch", "unconfirmed"].includes(status);
  const previous = model.accounts?.find(({ id }) => id === previousId);
  ui.undo.hidden = !previous || previous.archived || previous.metadataOnly || previous.id === accountId ||
    previous.id === model.active || status === "checking";
}

function renderDiagnostics() {
  const error = lastError ?? model.lastError;
  const [tab] = model.tiktokTabs ?? [];
  const actions = {
    expired: ["Ver cuentas por reconectar", () => {
      ui["account-filter"].value = "reconnect";
      renderAccounts();
      ui["account-filter"].focus();
    }],
    identity_unconfirmed: ["Volver a TikTok", focusTikTok],
    multiple_tabs: ["Ver pestañas de TikTok", focusTabs],
    save_tab: ["Ver pestañas de TikTok", focusTabs],
    account_mismatch: ["Volver a TikTok", focusTikTok],
    interrupted: ["Actualizar el selector", refresh],
    open_failed: ["Actualizar el selector", refresh],
    posting: ["Volver a TikTok", focusTikTok],
    unexpected: ["Actualizar el selector", refresh]
  };
  const current = model.allowed && model.unlocked && !model.recovery && !demo ? actions[error] : undefined;
  ui.diagnostics.hidden = !current && !model.posting;
  if (ui.diagnostics.hidden) {
    onDiagnostic = undefined;
    return;
  }
  const [label, action] = current ?? actions.posting;
  const detail = messages[current ? error : "posting"];
  ui["diagnostic-message"].textContent = translate(detail ?? "");
  ui["diagnostic-action"].textContent = translate(label);
  ui["diagnostic-action"].hidden = action === focusTikTok && !tab;
  onDiagnostic = action;
}

function renderNews(managerAvailable) {
  const settings = model.settings;
  const hasAccounts = Boolean(model.accounts?.length);
  ui["whats-new"].hidden = demo || !managerAvailable || !hasAccounts || !settings ||
    settings.seenVersion === version;
  if (demo || !managerAvailable || hasAccounts || !settings || settings.seenVersion === version || newsInitialized) return;
  newsInitialized = true;
  void request("settings", { seenVersion: version }).then((result) => {
    if (!result || result.error) newsInitialized = false;
    else if (!demo && model.settings && !model.settings.seenVersion) {
      model = { ...model, settings: { ...model.settings, seenVersion: version } };
      render();
    }
  }).catch(() => { newsInitialized = false; });
}

function render() {
  const {
    allowed, unlocked, protected: protectionEnabled, accounts = [], recovery, active,
    previous, invite, setup, tiktokTabs = [], confirmPrevious
  } = model;
  const localeChanged = document.documentElement.lang !== (model.settings?.locale ?? document.documentElement.lang);
  setLocale(model.settings?.locale ?? document.documentElement.lang);
  if (localeChanged) renderedAccounts = undefined;
  document.body.classList.toggle("compact", model.settings?.density === "compact");
  document.body.classList.toggle("high-contrast", Boolean(model.settings?.highContrast));
  const managerAvailable = allowed && unlocked && !recovery;
  permissionPreviouslyGranted ||= Boolean(!demo && allowed);
  const permissionRestoredNeeded = permissionPreviouslyGranted || Boolean(accounts.length);
  ui.permission.hidden = allowed !== false;
  ui["permission-title"].textContent = translate(permissionRestoredNeeded ? "Restablece el acceso a TikTok" : "Permite el acceso a TikTok");
  ui.allow.textContent = translate(permissionRestoredNeeded ? "Restablecer acceso a TikTok" : "Permitir acceso a TikTok");
  ui["demo-banner"].hidden = !demo;
  ui.unlock.hidden = !allowed || unlocked || !protectionEnabled;
  ui.settings.hidden = !unlocked || demo;
  ui.manager.hidden = !managerAvailable;
  ui.recovery.hidden = !allowed || !recovery;
  ui.invite.hidden = !managerAvailable || !invite || demo;
  const activeAccount = accounts.find(({ id }) => id === active);
  if (!ui.invite.hidden) {
    const question = activeAccount ? `¿Te sirvió cambiar a «${activeAccount.alias}»?` : "¿Te ahorró otro inicio de sesión?";
    ui["invite-message"].textContent = translate(`${question} Una estrella ayuda a que más personas encuentren MultiTikTok.`);
  }

  const reportCode = lastError ?? model.lastError;
  ui.report.href = reportUrl(reportCode);
  ui["recovery-report"].href = reportUrl(reportCode ?? "recovery");
  syncPolling();
  renderDiagnostics();
  renderNews(managerAvailable);
  translateDom();
  if (unlocked === false) {
    if (ui.preferences.open) ui.preferences.close();
    if (ui["data-dialog"].open) ui["data-dialog"].close();
    ui["history-list"].replaceChildren();
    ui["cleanup-list"].replaceChildren();
    ui["edit-note"].value = "";
    if (ui.confirm.open) {
      confirmation = undefined;
      ui.confirm.close();
    }
    ui["new-phrase"].value = "";
    ui["edit-alias"].value = "";
    ui.alias.value = "";
    ui.search.value = "";
  }
  if (!managerAvailable) {
    ui.accounts.replaceChildren();
    ui["active-handle"].textContent = "";
    ui["active-detail"].textContent = "";
    ui["active-avatar"].replaceChildren();
    renderedAccounts = undefined;
    renderedIdentity = undefined;
    if (ui.edit.open) ui.edit.close();
    if (ui["data-dialog"].open) ui["data-dialog"].close();
    if (ui.confirm.open && (allowed === false || confirmation?.kind === "change" || confirmation?.kind === "guard")) {
      confirmation = undefined;
      ui.confirm.close();
    }
    return;
  }
  ui["account-manager"].hidden = accounts.length === 0;
  ui.onboarding.hidden = accounts.length > 0 || Boolean(setup) || model.canSave || model.unsaved;
  ui.previous.hidden = !accounts.some((account) => account.id === previous && account.id !== active && !account.archived);
  renderVerification();
  ui["active-session"].hidden = !(activeAccount || model.identity?.handle || model.unsaved || model.canSave);
  if (!ui["active-session"].hidden) renderIdentity(activeAccount);
  renderTabs(tiktokTabs);
  renderSetup(setup, accounts, tiktokTabs);
  renderAccounts();
  if (ui.edit.open) renderEditPosition();
  if (ui["data-dialog"].open) dataDialog.render();

  const shortcutId = model.confirmAccount ?? confirmPrevious;
  if (!shortcutId) previousPromptShown = undefined;
  if (shortcutId && shortcutId !== previousPromptShown && !document.querySelector("dialog[open]")) {
    previousPromptShown = shortcutId;
    change("switch", shortcutId, { shortcut: true, forceConfirm: true });
  }
}

function refresh() {
  if (document.hidden || demo) return;
  if (busy || refreshJob) {
    refreshQueued = true;
    return;
  }
  const currentOperation = operation;
  refreshJob = view().then((result) => {
    if (result?.error === "busy") {
      if (!refreshRetryTimer && refreshRetries < 6) {
        refreshRetries += 1;
        refreshRetryTimer = setTimeout(() => {
          refreshRetryTimer = undefined;
          refresh();
        }, refreshRetries * 200);
      }
      return;
    }
    refreshRetries = 0;
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
  let result;
  try {
    await refreshJob;
    result = await perform();
    if (!result || result.error) {
      error = result?.error ?? "unexpected";
      const current = await view().catch(() => null);
      if (current && !current.error) model = current;
      if (current?.error === "busy") refreshQueued = true;
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
    render();
    const message = typeof success === "function" ? success(result) : success;
    announce(error ? detail : message ?? "", Boolean(error));
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

function ask({ title, detail, label, kind, preview, onConfirm, onCancel }) {
  if (busy || ui.confirm.open) return;
  confirmation = { kind, onConfirm, onCancel };
  ui["confirm-title"].textContent = translate(title);
  ui["confirm-detail"].textContent = translate(detail);
  ui["confirm-action"].textContent = translate(label);
  ui["change-preview"].hidden = !preview;
  if (preview) {
    for (const side of ["from", "to"]) {
      const { alias, handle, avatar } = preview[side];
      ui[`${side}-name`].textContent = alias || handle || translate("Cuenta sin identificar");
      ui[`${side}-handle`].textContent = alias && handle && alias !== handle ? handle : "";
      setAvatar(ui[`${side}-avatar`], alias || handle?.slice(1), avatar);
    }
  }
  translateDom(ui.confirm);
  ui.confirm.showModal();
}

function discardConfirmation() {
  const pending = confirmation;
  confirmation = undefined;
  ui.confirm.close();
  pending?.onCancel?.();
}

function focusTabs() {
  if (ui.tabs.hidden) {
    ui.status.focus();
    return;
  }
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

function change(command, id, { shortcut = false, destination, forceConfirm = false } = {}) {
  if (busy) return;
  const { accounts = [], settings, setup, tiktokTabs = [] } = model;
  const account = accounts.find((item) => item.id === id);
  const dismissShortcut = () => {
    if (shortcut) void send("dismissPrevious");
  };
  if (id && (!account || account.archived)) {
    announce(messages.unknown_account, true);
    dismissShortcut();
    return;
  }
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
  const changingAccount = command === "switch" || command === "undo" || (command === "quickLink" && model.active !== id);
  const showConfirmation = (retry = false) => {
    const current = accounts.find((item) => item.id === model.active);
    const identity = model.identity;
    const preview = changingAccount ? {
      from: { alias: current?.alias, handle: identity?.handle ?? current?.handle, avatar: identity?.avatar ?? current?.avatar },
      to: { alias: account.alias, handle: account.handle, avatar: account.avatar }
    } : undefined;
    const title = command === "add" ? "Agregar otra cuenta"
      : command === "reconnect" ? `Reconectar «${account.alias}»`
      : command === "quickLink" ? `Abrir ${destinations[destination]} con «${account.alias}»`
      : `Cambiar a «${account.alias}»`;
    const detail = model.posting ? messages.posting
      : changingAccount ? "Guarda lo que estés haciendo y comprueba tu @usuario en TikTok después del cambio."
      : command === "quickLink" ? "Se abrirá la sección seleccionada en TikTok."
      : "Guarda lo que estés haciendo. Se abrirá el inicio de sesión oficial de TikTok.";
    ask({
      title, detail, label: "Continuar", kind: "change", preview,
      onConfirm: () => perform(true), onCancel: retry ? undefined : dismissShortcut
    });
  };
  const perform = (confirmed = false) => {
    const fields = { ...(id ? { id } : {}), ...(destination ? { destination } : {}), ...(confirmed ? { confirmed } : {}) };
    if (demo) {
      model = demoChange(model, id);
      announce(command === "quickLink" ? `Se simuló abrir ${destinations[destination]}.` : "Cambio simulado.");
      render();
      return;
    }
    void send(command, fields, undefined, (error) => {
      if (error === "unsaved") guardUnsaved(shortcut);
      if (error === "multiple_tabs" || error === "save_tab") focusTabs();
      if (error === "confirm_account" && !confirmed) showConfirmation(true);
    });
  };
  const requiresConfirmation = forceConfirm || Boolean(model.posting) || destination === "upload" ||
    (changingAccount && (!settings?.quickSwitch || account.requireConfirm)) ||
    command === "reconnect" || (command === "add" && accounts.length > 0);
  if (requiresConfirmation) showConfirmation();
  else perform();
}

function editGroup() {
  const accounts = model.accounts ?? [];
  const account = accounts.find(({ id }) => id === editingId);
  return account ? accounts.filter(({ favorite, group, archived }) =>
    favorite === account.favorite && (group ?? "") === (account.group ?? "") && archived === account.archived
  ) : [];
}

function renderEditPosition() {
  const group = editGroup();
  const position = group.findIndex(({ id }) => id === editingId);
  const manual = model.settings?.sortMode !== "recent";
  const text = manual && position >= 0 ? translate(`Posición ${position + 1} de ${group.length}`) : "";
  if (ui["account-position"].textContent !== text) ui["account-position"].textContent = text;
  ui["order-actions"].hidden = !manual;
  ui["move-up"].disabled = position < 1;
  ui["move-down"].disabled = position < 0 || position >= group.length - 1;
  const account = group[position];
  ui.archive.textContent = translate(account?.archived ? "Restaurar cuenta" : "Archivar cuenta");
  ui.archive.disabled = !account || (!account.archived && model.active === account.id);
  ui["refresh-profile"].disabled = model.active !== editingId || !model.canSave || Boolean(model.setup);
  ui.reconnect.disabled = position < 0 || Boolean(model.setup) || Boolean(account?.archived);
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
    ui["edit-status"].textContent = translate(messages[error] ?? messages.unexpected);
    ui["edit-status"].hidden = false;
  });
}

function openEdit(account) {
  editingId = account.id;
  accountColor = colorPattern.test(account.color) ? account.color : null;
  ui["edit-alias"].value = account.alias;
  ui.favorite.checked = Boolean(account.favorite);
  ui["confirm-account"].checked = Boolean(account.requireConfirm);
  ui["edit-group"].value = account.group ?? "";
  ui["edit-note"].value = account.note ?? "";
  ui["group-options"].replaceChildren(...groupOptions(model.accounts).map((name) => new Option(name, name)));
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
      "open-previous-account": "Volver a la cuenta anterior",
      "open-favorite-account": "Cambiar a la favorita"
    };
    const shortcuts = commands.filter(({ name }) => Object.hasOwn(labels, name));
    const items = shortcuts.map(({ name, shortcut }) => {
      const item = document.createElement("li");
      const label = document.createElement("span");
      const key = document.createElement("kbd");
      label.textContent = translate(labels[name]);
      key.textContent = shortcut || translate("Sin asignar");
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
  ui["display-density"].value = settings.density ?? "comfortable";
  ui["sort-accounts"].value = settings.sortMode ?? "manual";
  ui.locale.value = settings.locale ?? "es";
  ui["high-contrast"].checked = Boolean(settings.highContrast);
  const favorites = (model.accounts ?? []).filter(({ favorite, archived, metadataOnly }) => favorite && !archived && !metadataOnly);
  ui["favorite-shortcut"].replaceChildren(new Option(translate("Sin favorita asignada"), ""), ...favorites.map(({ id, alias }) => {
    const option = new Option(alias, id);
    option.dataset.noTranslate = "";
    return option;
  }));
  ui["favorite-shortcut"].value = favorites.some(({ id }) => id === settings.favoriteShortcutId) ? settings.favoriteShortcutId : "";
  ui["manage-data"].hidden = !model.allowed || Boolean(model.recovery);
  const minutes = String(settings.autoLockMinutes ?? 0);
  ui["auto-lock"].querySelector("[data-custom]")?.remove();
  if (!Array.from(ui["auto-lock"].options).some(({ value }) => value === minutes)) {
    const option = new Option(translate(`${minutes} minutos`), minutes);
    option.dataset.custom = "";
    ui["auto-lock"].add(option);
  }
  ui["auto-lock"].value = minutes;
  ui.wipe.disabled = !model.accounts?.length;
  updateProtectionForm();
}

const dataDialog = connectDataDialog({ ui, getModel: () => model, request, run, send, ask, messages });

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
ui["start-demo"].addEventListener("click", () => {
  if (busy || demo) return;
  liveModel = model;
  demo = true;
  demoCollapsedGroups.clear();
  operation += 1;
  model = demoModel(liveModel.settings?.locale ?? document.documentElement.lang);
  ui["account-filter"].value = "visible";
  announce("");
  render();
  ui["end-demo"].focus();
});
ui["end-demo"].addEventListener("click", () => {
  demo = false;
  model = liveModel;
  liveModel = undefined;
  ui.search.value = "";
  ui["account-filter"].value = "visible";
  announce("");
  render();
  if (!ui.permission.hidden) ui["start-demo"].focus();
  refresh();
});
ui["diagnostic-action"].addEventListener("click", () => onDiagnostic?.());
ui["check-profile"].addEventListener("click", focusTikTok);
ui.undo.addEventListener("click", () => {
  if (model.verification?.previousId) change("undo", model.verification.previousId, { forceConfirm: true });
});
ui["dismiss-news"].addEventListener("click", () => {
  void send("settings", { seenVersion: version });
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
  const fields = {
    quickSwitch, autoLockMinutes, density: ui["display-density"].value, sortMode: ui["sort-accounts"].value,
    locale: ui.locale.value, highContrast: ui["high-contrast"].checked,
    favoriteShortcutId: ui["favorite-shortcut"].value || null
  };
  ui.preferences.close();
  void run(async () => {
    if (enabled !== Boolean(model.protected)) {
      const result = await request("setProtection", { phrase });
      if (result.error) return result;
    }
    return request("settings", fields);
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
  const message = (result) => result?.duplicate
    ? "Esta cuenta ya estaba guardada. Actualizamos su sesión y conservamos su organización."
    : "Sesión guardada.";
  if (await send("save", { alias: ui.alias.value }, message, (error) => {
    if (error === "multiple_tabs" || error === "save_tab") focusTabs();
  })) {
    ui.alias.value = "";
    aliasManuallyEdited = false;
    renderAliasSuggestion();
  }
});
ui.alias.addEventListener("input", () => {
  aliasManuallyEdited = true;
  renderAliasSuggestion();
});
ui["suggest-alias"].addEventListener("click", () => {
  if (ui.alias.value || aliasManuallyEdited || !model.identity?.handle) return;
  ui.alias.value = model.identity.handle.replace(/^@/, "");
  aliasManuallyEdited = true;
  renderAliasSuggestion();
  ui.alias.focus();
});
ui.add.addEventListener("click", () => change("add"));
for (const id of ["focus-setup-tab", "focus-save-tab"]) {
  ui[id].addEventListener("click", () => {
    const [tab] = model.tiktokTabs ?? [];
    if (tab) void send("focusTikTok", { id: tab.id });
  });
}
ui["cancel-setup"].addEventListener("click", () => send("cancelSetup", {}, "Inicio de sesión cancelado."));
ui.previous.addEventListener("click", () => change("switch", model.previous));
ui.search.addEventListener("input", renderAccounts);
for (const id of ["account-filter", "group-filter"]) ui[id].addEventListener("change", renderAccounts);
ui["account-manager"].addEventListener("keydown", (event) => {
  const target = event.target;
  if (target !== ui.search && !target.matches(".account")) return;
  const visible = Array.from(ui.accounts.querySelectorAll(".account:not(:disabled)")).filter((button) => button.getClientRects().length);
  if (event.key === "Escape" && target === ui.search && ui.search.value) {
    event.preventDefault();
    ui.search.value = "";
    renderAccounts();
  } else if (event.key === "Enter" && target === ui.search && visible.length) {
    event.preventDefault();
    visible[0].click();
  } else if (["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key) && visible.length) {
    if (target === ui.search && ["Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = visible.indexOf(target);
    const direction = event.key === "ArrowUp" ? -1 : 1;
    if (event.key === "Home") visible[0].focus();
    else if (event.key === "End" || (index === -1 && direction === -1)) visible.at(-1).focus();
    else if (index === 0 && direction === -1) ui.search.focus();
    else visible[Math.min(index + direction, visible.length - 1)]?.focus();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "/" || event.ctrlKey || event.altKey || event.metaKey || ui.manager.hidden ||
      ui["account-manager"].hidden || document.querySelector("dialog[open]") ||
      event.target.matches("input, textarea, select, [contenteditable]")) return;
  event.preventDefault();
  ui.search.focus();
});

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

ui["edit-form"].addEventListener("submit", async (event) => {
  event.preventDefault();
  ui["edit-status"].hidden = true;
  const saved = await send("edit", {
    id: editingId, alias: ui["edit-alias"].value, favorite: ui.favorite.checked, color: accountColor,
    group: ui["edit-group"].value, note: ui["edit-note"].value, requireConfirm: ui["confirm-account"].checked
  }, "Cambios guardados.", (error) => {
    ui["edit-status"].textContent = translate(messages[error] ?? messages.unexpected);
    ui["edit-status"].hidden = false;
  });
  if (saved && ui.edit.open) ui.edit.close();
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
ui.archive.addEventListener("click", () => {
  const account = model.accounts?.find(({ id }) => id === editingId);
  if (!account) return;
  ui.edit.close();
  const archived = !account.archived;
  void send("archive", { id: account.id, archived }, archived ? "Cuenta archivada." : "Cuenta restaurada.");
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
  syncPolling();
  if (!document.hidden) void refresh();
});
window.addEventListener("focus", refresh);
window.addEventListener("pagehide", () => {
  if (model.confirmAccount || model.confirmPrevious) void request("dismissPrevious").catch(() => {});
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
chrome.permissions.onAdded.addListener(refresh);
chrome.permissions.onRemoved.addListener(refresh);

void send("view");
