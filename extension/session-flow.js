import { readIdentity } from "./avatar.js";
import {
  fingerprint, home, isProfileSource, login, readCookies, replaceCookies, safeTikTokPage, tiktokTabs
} from "./sessions.js";
import { persist, VaultError } from "./vault.js";

export const transitionPage = chrome.runtime.getURL("transition.html");

export function currentAccount(state, fingerprint) {
  return state.accounts.find((account) => fingerprint && account.identity === fingerprint);
}

export async function inspectSession(state) {
  const [tabs, cookies] = await Promise.all([tiktokTabs(), readCookies()]);
  const identity = await fingerprint(cookies);
  const current = currentAccount(state, identity);
  const [tab] = tabs;
  const stableTab = tabs.length === 1 && tab.status === "complete" && !tab.pendingUrl;
  const profile = identity && stableTab && isProfileSource(tab.url) ? await readIdentity(tab.id) : null;
  // Cookie changes or a navigation during inspection can leave an old profile in the page.
  if (profile) {
    const [now, openTabs] = await Promise.all([readCookies(), tiktokTabs()]);
    if (await fingerprint(now) !== identity || openTabs.length !== 1 ||
        openTabs[0].id !== tab.id || openTabs[0].url !== tab.url || openTabs[0].pendingUrl) {
      return { tabs: openTabs, current: null, profile: null, canSave: false, error: "unsaved" };
    }
  }
  const error = saveError(state, { current, identity, profile, stableTab, tabs });
  return { current, identity, profile, tabs, canSave: !error, error };
}

function saveError(state, { current, identity, profile, stableTab, tabs }) {
  if (tabs.length !== 1) return "save_tab";
  if (!identity) return "sign_in";
  if (!stableTab) return "identity_unconfirmed";
  const reconnecting = state.setup?.stage === "reconnect";
  if (state.setup?.stage === "add" && current) return "account_mismatch";
  if (reconnecting) {
    const target = state.accounts.find(({ id }) => id === state.setup.accountId);
    if (!target) return "unknown_account";
    if (current && current.id !== target.id) return "account_mismatch";
    if (identity !== target.identity) {
      if (!profile) return "identity_unconfirmed";
      if (!target.handle || target.handle.toLowerCase() !== profile.handle.toLowerCase()) return "account_mismatch";
    }
  }
  if (state.setup && !profile && !safeTikTokPage(tabs[0].url)) return "identity_unconfirmed";
  if (!isProfileSource(tabs[0].url)) return "identity_unconfirmed";
  return null;
}

export async function saveAccount(vault, label, checkAlias) {
  const { state } = vault;
  const session = await inspectSession(state);
  if (!session.canSave) throw new VaultError(session.error);
  const existing = state.setup?.stage === "reconnect"
    ? state.accounts.find(({ id }) => id === state.setup.accountId)
    : session.current;
  const alias = state.setup?.stage === "reconnect" ? existing.alias : checkAlias(label);
  const [cookies, tabs] = await Promise.all([readCookies(), tiktokTabs()]);
  if (tabs.length !== 1) throw new VaultError("save_tab");
  if (await fingerprint(cookies) !== session.identity || tabs[0].id !== session.tabs[0].id ||
      tabs[0].url !== session.tabs[0].url || tabs[0].pendingUrl) throw new VaultError("unsaved");
  const account = {
    ...existing, id: existing?.id ?? crypto.randomUUID(), alias, favorite: existing?.favorite ?? false,
    cookies, identity: session.identity, handle: session.profile?.handle ?? existing?.handle ?? null,
    avatar: session.profile?.avatar ?? existing?.avatar ?? null
  };
  await persist({
    ...state,
    accounts: existing ? state.accounts.map((item) => item.id === account.id ? account : item) : [...state.accounts, account],
    active: account.id, setup: null,
    previous: state.active && state.active !== account.id ? state.active
      : state.previous === account.id ? null : state.previous
  }, vault.key, vault.salt);
}

async function getTab(id) {
  if (!Number.isInteger(id)) return null;
  try {
    return await chrome.tabs.get(id);
  } catch {
    return null;
  }
}

async function transitionStatus() {
  return (await chrome.storage.session.get("sessionTransition")).sessionTransition;
}

async function setTransition(record) {
  await chrome.storage.session.set({ sessionTransition: record });
}

export async function transitionView(tabId, busy) {
  const record = await transitionStatus();
  if (record?.tabId !== tabId) return busy ? { working: true } : { error: "interrupted" };
  if (busy && record.phase !== "error") return { working: true, mode: record.mode, alias: record.alias };
  if (record.phase === "ready") return { error: "open_failed", retry: true };
  // A page parked by a previous worker may outlive the message that started the operation.
  return { error: record.error ?? "interrupted", retry: true };
}

async function park({ priorTab, priorPage, mode, alias }) {
  const tabs = await tiktokTabs();
  if (tabs.length > 1) throw new VaultError("multiple_tabs");
  const tab = tabs[0] ?? await getTab(priorTab);
  const returnTo = safeTikTokPage(priorPage) ?? safeTikTokPage(tab?.url) ?? home;
  const parked = tab?.url === transitionPage || tabs.length ? tab
    : await chrome.tabs.create({ url: transitionPage, active: false });
  const tabId = parked.id;
  try {
    await setTransition({ tabId, phase: "working", returnTo, mode, alias });
    if (parked.url !== transitionPage && tabs.length) {
      await chrome.tabs.update(tabId, { url: transitionPage });
    }
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const entry = await getTab(tabId);
      if (!entry) break;
      if (entry.url === transitionPage && entry.status === "complete" && !entry.pendingUrl) {
        if ((await tiktokTabs()).length) throw new VaultError("multiple_tabs");
        return { tabId, returnTo };
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new VaultError("park_failed");
  } catch (error) {
    const code = error instanceof VaultError ? error.message : "park_failed";
    await setTransition({ tabId, phase: "error", returnTo, error: code });
    throw new VaultError(code);
  }
}

async function goToTikTok(tabId, url) {
  const destination = url === login ? login : safeTikTokPage(url) ?? home;
  try {
    if ((await getTab(tabId))?.url === transitionPage) {
      await chrome.tabs.update(tabId, { url: destination, active: true });
    } else {
      await chrome.tabs.create({ url: destination, active: true });
    }
  } catch {
    throw new VaultError("open_failed");
  }
}

async function finishTransition(tabId, url) {
  await setTransition({ tabId, phase: "ready", url });
  await goToTikTok(tabId, url);
  // Keep the destination while Chrome commits navigation, so a restarted worker can still retry.
}

export async function recover(vault) {
  const pending = vault.state.pending;
  if (!pending) return;
  const parked = await park({ priorTab: pending.tabId, priorPage: pending.returnTo, mode: "recover" });
  try {
    await replaceCookies(pending.before);
    if ((await tiktokTabs()).length) throw new VaultError("multiple_tabs");
    await persist({ ...vault.state, pending: null }, vault.key, vault.salt);
  } catch {
    await setTransition({ ...parked, phase: "error", error: "recovery" });
    throw new VaultError("recovery");
  }
  await finishTransition(parked.tabId, parked.returnTo);
}

export async function retryTransition(vault, tabId) {
  if ((await getTab(tabId))?.url !== transitionPage) throw new VaultError("open_failed");
  if (vault.state.pending) {
    await recover(vault);
    return;
  }
  const record = await transitionStatus();
  if (record?.tabId !== tabId) throw new VaultError("interrupted");
  const destination = vault.state.setup && record.phase === "working" ? login : record.returnTo;
  await finishTransition(tabId, record.url ?? destination ?? home);
}

export async function focusTikTok(id, setup) {
  const tabs = await tiktokTabs();
  if (id === undefined && setup && !tabs.length) {
    await goToTikTok(null, login);
    return;
  }
  const tab = tabs.find((entry) => entry.id === id);
  if (!tab) throw new VaultError("focus_failed");
  try {
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  } catch {
    throw new VaultError("focus_failed");
  }
}

export async function changeSession(vault, command, id) {
  const { state } = vault;
  if (state.setup) throw new VaultError("setup_active");
  const target = command === "add" ? null : state.accounts.find((account) => account.id === id);
  if (command !== "add" && !target) throw new VaultError("unknown_account");
  const initial = await fingerprint(await readCookies());
  const initialAccount = currentAccount(state, initial);
  if (initial && !initialAccount) throw new VaultError("unsaved");

  if (command === "switch" && initialAccount?.id === target.id) {
    const tabs = await tiktokTabs();
    if (tabs.length) await focusTikTok(tabs.find((tab) => tab.active)?.id ?? tabs[0].id);
    else await goToTikTok(null, home);
    return { opened: true, login: false };
  }
  if (command === "switch" && await fingerprint(target.cookies) !== target.identity) {
    throw new VaultError("expired");
  }

  const switching = command === "switch";
  const alias = switching && typeof target.alias === "string" ? target.alias.trim().slice(0, 48) : null;
  const { tabId, returnTo } = await park({ mode: switching ? "switch" : "login", alias });
  let before;
  let identity;
  try {
    before = await readCookies();
    identity = await fingerprint(before);
  } catch {
    await finishTransition(tabId, returnTo);
    throw new VaultError("unexpected");
  }
  const current = currentAccount(state, identity);
  if ((identity && !current) || identity !== initial) {
    await finishTransition(tabId, returnTo);
    throw new VaultError("unsaved");
  }
  const saved = {
    ...state,
    accounts: state.accounts.map((account) =>
      account.id === current?.id ? { ...account, cookies: before } : account)
  };
  const pending = { ...saved, pending: { before, tabId, returnTo } };
  try {
    await persist(pending, vault.key, vault.salt);
  } catch {
    await finishTransition(tabId, returnTo);
    throw new VaultError("storage");
  }

  try {
    if ((await tiktokTabs()).length) throw new VaultError("multiple_tabs");
    if (switching || identity) await replaceCookies(switching ? target.cookies : []);
    if ((await tiktokTabs()).length) throw new VaultError("multiple_tabs");
    const previous = current?.id && current.id !== target?.id ? current.id : state.previous;
    const next = {
      ...saved, active: switching ? target.id : null,
      previous: switching && previous === target.id ? null : previous,
      setup: switching ? null : { stage: command, ...(target ? { accountId: target.id } : {}) },
      invite: state.invite ?? (switching && current ? "pending" : null),
      pending: null
    };
    await persist(next, vault.key, vault.salt);
  } catch (error) {
    try {
      await recover({ ...vault, state: pending });
    } catch (recoveryError) {
      if (recoveryError instanceof VaultError && recoveryError.message === "open_failed") throw recoveryError;
      throw new VaultError("recovery");
    }
    throw error instanceof VaultError ? error : new VaultError("restored");
  }
  await finishTransition(tabId, switching ? returnTo : login);
  return { opened: true, login: !switching };
}
