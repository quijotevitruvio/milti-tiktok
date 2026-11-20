import { hostPermission, tiktokTabs } from "./sessions.js";
import { lock, persist, readVault, setProtection, touchVault, unlock, VaultError } from "./vault.js";
import { readPreferences, savePreferences } from "./preferences.js";
import { registerShortcuts } from "./shortcuts.js";
import {
  changeSession, focusTikTok, inspectSession, recover, retryTransition, saveAccount, transitionPage, transitionView
} from "./session-flow.js";

const popupPage = chrome.runtime.getURL("popup.html");
const permissions = { origins: [hostPermission] };
const knownErrors = new Set([
  "alias", "account_mismatch", "busy", "expired", "focus_failed", "identity_unconfirmed", "interrupted",
  "invalid_color", "invalid_order", "locked", "multiple_tabs", "open_failed", "park_failed", "permission",
  "phrase_length", "recovery", "restored", "save_tab", "setup_active", "sign_in", "storage", "unknown_account",
  "unsaved", "wrong_phrase"
]);
const humanCommands = new Set([
  "setProtection", "settings", "recover", "save", "edit", "reorder", "forget", "dismiss", "wipeAccounts",
  "add", "switch", "reconnect", "cancelSetup", "focusTikTok", "transitionRetry"
]);
const sessionCommands = new Set(["add", "switch", "reconnect", "recover", "transitionRetry"]);
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

registerShortcuts({ openPrevious });

function errorResponse(error) {
  return { error: error instanceof VaultError && knownErrors.has(error.message) ? error.message : "unexpected" };
}

async function exclusive(action, command) {
  if (busy) return { error: "busy" };
  busy = true;
  try {
    return await action();
  } catch (error) {
    const result = errorResponse(error);
    if (sessionCommands.has(command)) {
      try {
        await chrome.storage.session.set({ lastSessionError: result.error });
      } catch {
        console.warn("MultiTikTok no pudo registrar el estado de la operación.");
      }
    }
    return result;
  } finally {
    busy = false;
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
    readPreferences(), chrome.storage.session.get(["confirmPrevious", "lastSessionError"])
  ]);
  const defaults = {
    allowed, protected: !state || Boolean(vault.salt), unlocked: Boolean(state), active: null, previous: null,
    recovery: false, invite: false, accounts: [], canSave: false, setup: null, identity: null, tiktokTabs: [],
    unsaved: false, confirmPrevious: null, settings
  };
  if (!state) return defaults;
  const session = allowed && !state.pending ? await inspectSession(state) : null;
  const tabs = session?.tabs ?? (allowed ? await tiktokTabs() : []);
  const active = session?.current?.id ?? null;
  const hasAccount = (id) => state.accounts.some((account) => account.id === id);
  const savedError = sessionStorage.lastSessionError;
  const lastError = session?.error === "account_mismatch" ? "account_mismatch"
    : knownErrors.has(savedError) ? savedError : null;
  const confirmPrevious = sessionStorage.confirmPrevious === state.previous && state.previous !== active &&
    hasAccount(state.previous) ? state.previous : null;
  return {
    ...defaults, active, previous: hasAccount(state.previous) ? state.previous : null,
    recovery: Boolean(state.pending), invite: state.invite === "pending", confirmPrevious,
    accounts: state.accounts.map(({ id, alias, favorite, avatar, handle, color }) => ({
      id, alias, favorite: Boolean(favorite), avatar: avatar ?? null, handle: handle ?? null, color: color ?? null
    })),
    setup: state.setup ?? null, canSave: Boolean(session?.canSave), identity: session?.profile ?? null,
    tiktokTabs: tabs.map(({ id }) => ({ id })),
    unsaved: Boolean(session?.identity && !active),
    ...(lastError ? { lastError } : {})
  };
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
    await chrome.storage.session.remove("confirmPrevious");
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
    try {
      await savePreferences({ quickSwitch: message.quickSwitch, autoLockMinutes: message.autoLockMinutes });
    } catch {
      throw new VaultError("storage");
    }
    await renew(vault);
    return view(vault, allowed);
  }
  const { state } = vault;
  if (command === "wipeAccounts") {
    if (state.pending) throw new VaultError("recovery");
    await write(vault, { ...state, accounts: [], active: null, previous: null, setup: null });
    await chrome.storage.session.remove(["confirmPrevious", "lastSessionError"]);
    return view(await readVault(), allowed);
  }
  if (!allowed) throw new VaultError("permission");
  if (command === "recover" || command === "transitionRetry") {
    if (command === "recover") await recover(vault);
    else await retryTransition(vault, tabId);
    await chrome.storage.session.remove("lastSessionError");
    return command === "recover" ? view(await readVault(), allowed) : { opened: true };
  }
  if (state.pending) throw new VaultError("recovery");
  switch (command) {
    case "save":
      await saveAccount(vault, message.alias, checkAlias);
      break;
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
    case "switch": {
      await chrome.storage.session.remove("confirmPrevious");
      const destination = await changeSession(vault, command, message.id);
      await chrome.storage.session.remove("lastSessionError");
      return { destination };
    }
    default:
      throw new VaultError("unexpected");
  }
  if (["save", "cancelSetup"].includes(command)) await chrome.storage.session.remove("lastSessionError");
  return view(await readVault(), allowed);
}

function checkAlias(alias) {
  if (typeof alias !== "string" || !alias.trim() || alias.trim().length > 48) {
    throw new VaultError("alias");
  }
  return alias.trim();
}

async function editAccount(vault, message) {
  const { state } = vault;
  if (!state.accounts.some(({ id }) => id === message.id)) throw new VaultError("unknown_account");
  const alias = checkAlias(message.alias);
  const color = message.color;
  if (color !== undefined && color !== null && (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color))) {
    throw new VaultError("invalid_color");
  }
  const accounts = state.accounts.map((account) => account.id === message.id
    ? { ...account, alias, favorite: Boolean(message.favorite), ...(color === undefined ? {} : { color }) }
    : account);
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

function openPrevious() {
  return exclusive(async () => {
    const allowed = await chrome.permissions.contains(permissions);
    const [vault, settings] = await Promise.all([readVault(), readPreferences()]);
    const previous = vault.state?.previous;
    if (!allowed || !previous || !vault.state.accounts.some(({ id }) => id === previous)) {
      await chrome.action.openPopup();
      return {};
    }
    if (!settings.quickSwitch) {
      await renew(vault);
      await chrome.storage.session.set({ confirmPrevious: previous });
      await chrome.action.openPopup();
      return {};
    }
    if (vault.state.pending || vault.state.setup) {
      await chrome.action.openPopup();
      return {};
    }
    try {
      return await dispatch({ command: "switch", id: previous }, null);
    } catch (error) {
      await chrome.storage.session.set({ lastSessionError: errorResponse(error).error });
      await chrome.action.openPopup();
      throw error;
    }
  }, "switch");
}
