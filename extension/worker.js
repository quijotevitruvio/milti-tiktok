import { hasFreshSession, hostPermission, isTikTokUrl, tiktokTabs } from "./sessions.js";
import { applyAccountTool, checkAlias, editedAccount, publicAccount, readHistory, toolCommands } from "./account-tools.js";
import { lock, persist, readVault, setProtection, touchVault, unlock, VaultError } from "./vault.js";
import { readPreferences, savePreferences } from "./preferences.js";
import { registerShortcuts } from "./shortcuts.js";
import {
  changeSession, clearVerification, focusTikTok, inspectSession, isPosting, readVerification, recover, retryTransition,
  saveAccount, transitionPage, transitionView, verificationKey
} from "./session-flow.js";

const popupPage = chrome.runtime.getURL("popup.html");
const permissions = { origins: [hostPermission] };
const knownErrors = new Set([
  "alias", "account_mismatch", "busy", "confirm_account", "expired", "focus_failed", "identity_unconfirmed", "interrupted",
  "invalid_archive", "invalid_backup", "invalid_cleanup", "invalid_color", "invalid_destination", "invalid_order", "locked",
  "multiple_tabs", "open_failed", "park_failed", "permission", "phrase_length", "recovery", "restored", "save_tab",
  "setup_active", "sign_in", "storage", "unknown_account", "unsaved", "wrong_phrase"
]);
const humanCommands = new Set([
  "setProtection", "settings", "recover", "save", "edit", "reorder", "forget", "dismiss", "wipeAccounts",
  "add", "switch", "reconnect", "cancelSetup", "focusTikTok", "transitionRetry", "quickLink", "undo", ...toolCommands
]);
const sessionCommands = new Set(["add", "switch", "reconnect", "recover", "transitionRetry", "quickLink", "undo"]);
let busy = false;

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !message || typeof message.command !== "string") return;
  const fromTransition = sender.url === transitionPage && Number.isInteger(sender.tab?.id);
  if (fromTransition && message.command === "transitionView") {
    transitionView(sender.tab.id, busy).catch(errorResponse).then(respond);
    return true;
  }
  if (fromTransition ? message.command !== "transitionRetry" : sender.url !== popupPage) return;
  if (!fromTransition && !humanCommands.has(message.command) &&
      !["view", "unlock", "lock", "dismissPrevious"].includes(message.command)) return;
  if (!fromTransition && message.command === "transitionRetry") return;

  exclusive(() => dispatch(message, fromTransition ? sender.tab.id : null), message.command).then(respond);
  return true;
});

registerShortcuts({ openPrevious: () => openShortcut((state) => state.previous),
  openFavorite: () => openShortcut((_state, settings) => settings.favoriteShortcutId) });

function errorResponse(error) {
  return { error: error instanceof VaultError && knownErrors.has(error.message) ? error.message : "unexpected" };
}

async function exclusive(action, command) {
  if (busy) return { error: "busy" };
  busy = true;
  if (sessionCommands.has(command) || command === "lock") syncBadge(true);
  try {
    return await action();
  } catch (error) {
    const result = errorResponse(error);
    if (sessionCommands.has(command) && result.error !== "confirm_account") {
      try {
        await chrome.storage.session.set({ lastSessionError: result.error });
      } catch {
        console.warn("MultiTikTok no pudo registrar el estado de la operación.");
      }
    }
    return result;
  } finally {
    busy = false;
    if (command !== "view" || badgeDirty) syncBadge();
  }
}

function write(vault, state) {
  return persist(state, vault.key, vault.salt);
}

async function renew(vault) {
  if (!vault.salt) return;
  try {
    await touchVault();
  } catch {
    console.warn("MultiTikTok no pudo reprogramar el bloqueo de la bóveda.");
  }
}

async function view(vault, allowed) {
  const { state } = vault;
  const [settings, sessionStorage] = await Promise.all([
    readPreferences(), chrome.storage.session.get(["confirmAccount", "lastSessionError", verificationKey])
  ]);
  const defaults = {
    allowed, protected: !state || Boolean(vault.salt), unlocked: Boolean(state), active: null, previous: null,
    recovery: false, invite: false, accounts: [], canSave: false, setup: null, identity: null, tiktokTabs: [],
    unsaved: false, confirmPrevious: null, confirmAccount: null, posting: false, verification: null, history: [], settings
  };
  if (!state) return defaults;
  const session = allowed && !state.pending ? await inspectSession(state) : null;
  const tabs = session?.tabs ?? (allowed ? await tiktokTabs() : []);
  const active = session?.current?.id ?? null;
  const previous = switchableAccount(state, state.previous)?.id ?? null;
  const savedError = sessionStorage.lastSessionError;
  const lastError = session?.error === "account_mismatch" ? "account_mismatch"
    : knownErrors.has(savedError) ? savedError : null;
  const confirmAccount = allowed && !state.pending && !state.setup
    ? switchableAccount(state, sessionStorage.confirmAccount)?.id ?? null : null;
  return {
    ...defaults, active, previous, confirmAccount,
    recovery: Boolean(state.pending), invite: state.invite === "pending",
    confirmPrevious: confirmAccount === previous ? previous : null,
    accounts: state.accounts.map((account) => ({ ...publicAccount(account), health: accountHealth(account, session) })),
    history: readHistory(state), posting: isPosting(tabs),
    verification: readVerification(state, session, sessionStorage[verificationKey]),
    setup: state.setup ?? null, canSave: Boolean(session?.canSave), identity: session?.profile ?? null,
    tiktokTabs: tabs.map(({ id }) => ({ id })),
    unsaved: Boolean(session?.identity && !session.recognized),
    ...(lastError ? { lastError } : {})
  };
}

function switchableAccount(state, id) {
  return state?.accounts.find((account) => account.id === id && !account.archived && !account.metadataOnly);
}

function accountHealth(account, session) {
  if (account.archived) return "archived";
  if (account.metadataOnly) return "reconnect";
  if (session?.recognized?.id === account.id) return session.verified ? "active" : "unconfirmed";
  if (!account.identity || !hasFreshSession(account.cookies)) return "expired";
  return "ready";
}

async function dispatch(message, tabId) {
  const { command } = message;
  const allowed = await chrome.permissions.contains(permissions);
  let vault = await readVault();
  if (command === "view") return view(vault, allowed);
  if (command === "unlock") {
    vault = await unlock(message.phrase);
    await renew(vault);
    return view(vault, allowed);
  }
  if (command === "lock") {
    await lock();
    return view(await readVault(), allowed);
  }
  if (command === "dismissPrevious") {
    await chrome.storage.session.remove(["confirmAccount", "confirmPrevious"]);
    return view(vault, allowed);
  }
  if (!vault.state) throw new VaultError("locked");
  await renew(vault);
  if (command === "setProtection") {
    await setProtection(vault.state, message.phrase);
    vault = await readVault();
    await renew(vault);
    return view(vault, allowed);
  }
  if (command === "settings") {
    if (message.favoriteShortcutId != null && !switchableAccount(vault.state, message.favoriteShortcutId)) {
      throw new VaultError("unknown_account");
    }
    try {
      await savePreferences({
        quickSwitch: message.quickSwitch, autoLockMinutes: message.autoLockMinutes,
        favoriteShortcutId: message.favoriteShortcutId, density: message.density, sortMode: message.sortMode,
        highContrast: message.highContrast, locale: message.locale, seenVersion: message.seenVersion
      });
    } catch {
      throw new VaultError("storage");
    }
    await renew(vault);
    return view(vault, allowed);
  }
  const { state } = vault;
  if (command === "wipeAccounts") {
    if (state.pending) throw new VaultError("recovery");
    await write(vault, { ...state, accounts: [], active: null, previous: null, setup: null, history: [] });
    await chrome.storage.session.remove(["confirmAccount", "confirmPrevious", "lastSessionError", verificationKey]);
    return view(await readVault(), allowed);
  }
  if (toolCommands.has(command)) {
    if (state.pending) throw new VaultError("recovery");
    const session = allowed && ["archive", "removeOld"].includes(command) ? await inspectSession(state) : null;
    const result = applyAccountTool(state, message, { activeId: session?.recognized?.id });
    if (result.backup) return { backup: result.backup };
    await write(vault, result.state);
    return view(await readVault(), allowed);
  }
  if (!allowed) throw new VaultError("permission");
  if (command === "recover" || command === "transitionRetry") {
    if (command === "recover") {
      await recover(vault);
      await clearVerification();
    } else {
      await retryTransition(vault, tabId);
    }
    await chrome.storage.session.remove("lastSessionError");
    return command === "recover" ? view(await readVault(), allowed) : { opened: true };
  }
  if (state.pending) throw new VaultError("recovery");
  switch (command) {
    case "save": {
      const duplicate = await saveAccount(vault, message.alias, checkAlias);
      await chrome.storage.session.remove("lastSessionError");
      return { ...await view(await readVault(), allowed), duplicate };
    }
    case "edit":
      await editAccount(vault, message);
      break;
    case "reorder":
      await reorderAccounts(vault, message.ids);
      break;
    case "forget": {
      if (!state.accounts.some(({ id }) => id === message.id)) throw new VaultError("unknown_account");
      await write(vault, {
        ...state,
        accounts: state.accounts.filter(({ id }) => id !== message.id),
        active: state.active === message.id ? null : state.active,
        previous: state.previous === message.id ? null : state.previous,
        setup: state.setup?.accountId === message.id ? null : state.setup
      });
      break;
    }
    case "dismiss":
      await write(vault, { ...state, invite: "shown" });
      break;
    case "cancelSetup":
      if (state.setup) await write(vault, { ...state, setup: null });
      break;
    case "focusTikTok":
      await focusTikTok(message.id, state.setup);
      break;
    case "add":
    case "reconnect":
    case "quickLink":
    case "switch":
    case "undo": {
      let id = message.id;
      if (command === "undo") {
        const pending = (await chrome.storage.session.get(verificationKey))[verificationKey];
        if (pending?.accountId !== state.active || !pending?.previousId ||
            pending.previousId !== state.previous || (id && pending.previousId !== id)) {
          throw new VaultError("unknown_account");
        }
        id = pending.previousId;
      }
      await chrome.storage.session.remove(["confirmAccount", "confirmPrevious"]);
      const isQuickLink = command === "quickLink";
      const mode = isQuickLink || command === "undo" ? "switch" : command;
      const destination = await changeSession(vault, mode, id, {
        confirmed: message.confirmed,
        destination: isQuickLink ? message.destination ?? null : undefined
      });
      await chrome.storage.session.remove("lastSessionError");
      return { destination };
    }
    default:
      throw new VaultError("unexpected");
  }
  if (command === "cancelSetup") await chrome.storage.session.remove("lastSessionError");
  return view(await readVault(), allowed);
}

async function editAccount(vault, message) {
  const { state } = vault;
  const existing = state.accounts.find(({ id }) => id === message.id);
  if (!existing) throw new VaultError("unknown_account");
  const updated = editedAccount(existing, message);
  const accounts = state.accounts.map((account) => account.id === message.id ? updated : account);
  await write(vault, { ...state, accounts });
}

async function reorderAccounts(vault, ids) {
  const { state } = vault;
  const accountsById = new Map(state.accounts.map((account) => [account.id, account]));
  if (!Array.isArray(ids) || ids.length !== accountsById.size || new Set(ids).size !== ids.length ||
      ids.some((id) => !accountsById.has(id))) {
    throw new VaultError("invalid_order");
  }
  await write(vault, { ...state, accounts: ids.map((id) => accountsById.get(id)) });
}

async function openShortcut(selectId) {
  const result = await exclusive(async () => {
    const [allowed, vault, settings] = await Promise.all([
      chrome.permissions.contains(permissions), readVault(), readPreferences()
    ]);
    const { state } = vault;
    const account = state && switchableAccount(state, selectId(state, settings));
    if (!allowed || !account || state.pending || state.setup) return { showPopup: true };
    if (settings.quickSwitch && !account.requireConfirm) {
      try {
        return await dispatch({ command: "switch", id: account.id }, null);
      } catch (error) {
        const { error: code } = errorResponse(error);
        if (code !== "confirm_account") {
          await chrome.storage.session.set({ lastSessionError: code });
          return { showPopup: true };
        }
      }
    }
    await renew(vault);
    await chrome.storage.session.set({ confirmAccount: account.id });
    return { showPopup: true };
  }, "switch");
  if (result.showPopup || result.error) await chrome.action.openPopup();
}

function aliasInitials(alias) {
  const words = alias.trim().split(/\s+/u);
  return words.slice(0, 2).map((word) => Array.from(word)[0] ?? "").join("").toLocaleUpperCase().slice(0, 4);
}

let badgeTimer;
let badgeRevision = 0;
let badgeDirty = false;
let badgeTabId;
let desiredBadge;
let badgeWrite = Promise.resolve();

function writeBadge(text) {
  if (text === desiredBadge) return;
  desiredBadge = text;
  badgeWrite = badgeWrite.then(() => chrome.action.setBadgeText({ text })).catch(() => {
    if (desiredBadge === text) desiredBadge = undefined;
    console.warn("MultiTikTok no pudo actualizar las iniciales del icono.");
  });
}

function syncBadge(clear = false) {
  badgeRevision += 1;
  badgeDirty = true;
  if (clear) writeBadge("");
  if (!busy && badgeTimer === undefined) badgeTimer = setTimeout(refreshBadge, 150);
}

async function refreshBadge() {
  badgeTimer = undefined;
  if (busy) return;
  const revision = badgeRevision;
  badgeDirty = false;
  let text = "";
  let tabId;
  try {
    if (await chrome.permissions.contains(permissions)) {
      const { state } = await readVault();
      if (state && !state.pending && !state.setup) {
        const { current, verified, tabs } = await inspectSession(state);
        if (tabs.length === 1) tabId = tabs[0].id;
        if (verified && current && !current.archived) text = aliasInitials(current.alias);
      }
    }
  } catch {
    console.warn("MultiTikTok no pudo comprobar la sesión para actualizar el icono.");
  }
  if (revision !== badgeRevision) return;
  if (busy) {
    badgeDirty = true;
    return;
  }
  badgeTabId = tabId;
  writeBadge(text);
}

chrome.permissions.onAdded.addListener(() => syncBadge());
chrome.permissions.onRemoved.addListener(() => syncBadge(true));
chrome.cookies.onChanged.addListener(({ cookie }) => {
  if (/(^|\.)tiktok\.com$/i.test(cookie.domain)) syncBadge(true);
});
chrome.tabs.onUpdated.addListener((id, change, tab) => {
  if ((change.url || change.status) &&
      (id === badgeTabId || isTikTokUrl(change.url ?? tab.url) || isTikTokUrl(tab.pendingUrl))) syncBadge(true);
});
chrome.tabs.onRemoved.addListener((id) => syncBadge(id === badgeTabId));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes.vaultKey && !changes.vaultKey.newValue) syncBadge(true);
  if (area === "local" && changes.vaultV1) syncBadge(true);
});
chrome.runtime.onStartup.addListener(() => syncBadge(true));
syncBadge(true);
