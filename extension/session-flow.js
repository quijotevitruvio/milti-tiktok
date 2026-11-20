import { readIdentity } from "./avatar.js";
import {
  fingerprint, home, hostPermission, isProfileSource, login, postingPage, quickTikTokPage, readCookies, replaceCookies,
  safeTikTokPage, tiktokTabs, validQuickDestination
} from "./sessions.js";
import { appendHistory } from "./account-tools.js";
import { persist, VaultError } from "./vault.js";

export const transitionPage = chrome.runtime.getURL("transition.html");
export const verificationKey = "sessionVerification";

export function currentAccount(state, fingerprint) {
  return state.accounts.find((account) => fingerprint && !account.metadataOnly && account.identity === fingerprint);
}

function sameHandle(first, second) {
  return Boolean(first && second && first.toLowerCase() === second.toLowerCase());
}

export function isPosting(tabs) {
  return tabs.some((tab) => postingPage(tab.url) || postingPage(tab.pendingUrl));
}

export async function inspectSession(state) {
  const [tabs, cookies] = await Promise.all([tiktokTabs(), readCookies()]);
  const identity = await fingerprint(cookies);
  const recognized = currentAccount(state, identity);
  const [tab] = tabs;
  const stableTab = tabs.length === 1 && tab.status === "complete" && !tab.pendingUrl;
  const profile = identity && stableTab && isProfileSource(tab.url) ? await readIdentity(tab.id) : null;
  // Cookie changes or a navigation during inspection can leave an old profile in the page.
  if (profile) {
    const [now, openTabs] = await Promise.all([readCookies(), tiktokTabs()]);
    if (await fingerprint(now) !== identity || openTabs.length !== 1 ||
        openTabs[0].id !== tab.id || openTabs[0].url !== tab.url ||
        openTabs[0].status !== "complete" || openTabs[0].pendingUrl) {
      return { tabs: openTabs, canSave: false, error: "unsaved" };
    }
  }
  const byHandle = state.accounts.filter((account) => !account.metadataOnly && sameHandle(account.handle, profile?.handle));
  const mismatch = Boolean(recognized && profile && (
    (recognized.handle && !sameHandle(recognized.handle, profile.handle)) ||
    byHandle.some((account) => account.id !== recognized.id)
  ));
  const current = mismatch ? null : recognized;
  const session = {
    current, recognized, identity, profile, stableTab, tabs,
    verified: Boolean(current && sameHandle(current.handle, profile?.handle))
  };
  const candidate = saveCandidate(state, session, byHandle, mismatch);
  return { ...session, ...candidate, canSave: !candidate.error };
}

function saveCandidate(state, { recognized, identity, profile, stableTab, tabs }, byHandle, mismatch) {
  if (tabs.length !== 1) return { error: "save_tab" };
  if (!identity) return { error: "sign_in" };
  if (!stableTab || !isProfileSource(tabs[0].url)) return { error: "identity_unconfirmed" };
  if (mismatch || byHandle.length > 1) return { error: "account_mismatch" };
  const existing = recognized ?? byHandle[0];
  if (state.setup?.stage === "reconnect") {
    const target = state.accounts.find(({ id }) => id === state.setup.accountId);
    if (!target || target.archived) return { error: "unknown_account" };
    if (existing && existing.id !== target.id) return { error: "account_mismatch" };
    if (identity !== target.identity || target.metadataOnly) {
      if (!profile || (!target.handle && !target.metadataOnly)) return { error: "identity_unconfirmed" };
      if (target.handle && !sameHandle(target.handle, profile.handle)) return { error: "account_mismatch" };
    }
    return { existing: target };
  }
  if (state.setup?.stage === "add" && existing) return { error: "account_mismatch" };
  if (state.setup && !profile && !safeTikTokPage(tabs[0].url)) return { error: "identity_unconfirmed" };
  return { existing };
}

export async function saveAccount(vault, label, checkAlias) {
  const { state } = vault;
  const session = await inspectSession(state);
  if (!session.canSave) throw new VaultError(session.error);
  const { existing } = session;
  const alias = existing?.alias ?? checkAlias(label);
  const [cookies, tabs] = await Promise.all([readCookies(), tiktokTabs()]);
  if (tabs.length !== 1) throw new VaultError("save_tab");
  if (await fingerprint(cookies) !== session.identity || tabs[0].id !== session.tabs[0].id ||
      tabs[0].url !== session.tabs[0].url || tabs[0].status !== "complete" || tabs[0].pendingUrl) {
    throw new VaultError("unsaved");
  }
  const account = {
    ...existing, id: existing?.id ?? crypto.randomUUID(), alias, favorite: existing?.favorite ?? false,
    cookies, identity: session.identity, handle: session.profile?.handle ?? existing?.handle ?? null,
    avatar: session.profile?.avatar ?? existing?.avatar ?? null, metadataOnly: false, lastSavedAt: Date.now(),
    lastPage: safeTikTokPage(tabs[0].url) ?? safeTikTokPage(existing?.lastPage)
  };
  await persist({
    ...state,
    accounts: existing ? state.accounts.map((item) => item.id === account.id ? account : item) : [...state.accounts, account],
    active: account.id, setup: null,
    previous: state.active && state.active !== account.id ? state.active
      : state.previous === account.id ? null : state.previous
  }, vault.key, vault.salt);
  await clearVerification();
  return Boolean(existing && !state.setup);
}

export function clearVerification() {
  return chrome.storage.session.remove(verificationKey);
}

async function verificationRecord() {
  return (await chrome.storage.session.get(verificationKey))[verificationKey];
}

export function readVerification(state, session, record) {
  if (!session || !record || !state.accounts.some(({ id }) => id === record.accountId)) return null;
  const { accountId, expected, previousId, tabId } = record;
  const [tab] = session.tabs;
  const matchingTab = session.tabs.length === 1 && tab.id === tabId;
  const actual = matchingTab ? session.profile?.handle ?? null : null;
  let status = "unconfirmed";
  if (matchingTab && (tab.status !== "complete" || tab.pendingUrl)) status = "checking";
  if (actual && expected && !sameHandle(expected, actual)) status = "mismatch";
  else if (actual && expected && session.verified && session.current.id === accountId) status = "verified";
  return { status, expected, actual, accountId, previousId };
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

async function park({ priorTab, priorPage, mode, alias, confirmed = true }) {
  const tabs = await tiktokTabs();
  if (tabs.length > 1) throw new VaultError("multiple_tabs");
  if (!confirmed && isPosting(tabs)) throw new VaultError("confirm_account");
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
  if ((await tiktokTabs()).length) throw new VaultError("multiple_tabs");
  try {
    if ((await getTab(tabId))?.url === transitionPage) {
      await chrome.tabs.update(tabId, { url: destination, active: true });
      return tabId;
    }
    return (await chrome.tabs.create({ url: destination, active: true })).id;
  } catch {
    throw new VaultError("open_failed");
  }
}

async function finishTransition(tabId, url) {
  await setTransition({ tabId, phase: "ready", url });
  // Keep the destination while Chrome commits navigation, so a restarted worker can still retry.
  return goToTikTok(tabId, url);
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

export async function changeSession(vault, command, id, { confirmed, destination } = {}) {
  const { state } = vault;
  if (state.setup) throw new VaultError("setup_active");
  const switching = command === "switch";
  const target = command === "add" ? null : state.accounts.find((account) => account.id === id);
  if (command !== "add" && (!target || target.archived)) throw new VaultError("unknown_account");
  if (switching && target.metadataOnly) throw new VaultError("expired");
  if (destination !== undefined) {
    if (!validQuickDestination(destination)) throw new VaultError("invalid_destination");
    if (!target?.handle) throw new VaultError("identity_unconfirmed");
  }

  const initial = await inspectSession(state);
  if (initial.tabs.length > 1) throw new VaultError("multiple_tabs");
  if (initial.error === "unsaved" || (initial.identity && !initial.recognized)) throw new VaultError("unsaved");
  const existingVerification = await verificationRecord();
  const correcting = switching && !destination && initial.recognized?.id === existingVerification?.accountId &&
    target.id === existingVerification?.previousId && initial.error === "account_mismatch";
  if (initial.error === "account_mismatch" && !correcting) throw new VaultError("account_mismatch");
  if (confirmed !== true && (target?.requireConfirm || isPosting(initial.tabs) || destination === "upload")) {
    throw new VaultError("confirm_account");
  }

  if (switching && initial.current?.id === target.id) {
    const tabId = initial.tabs[0]?.id;
    if (destination) {
      const openedTab = tabId ?? await goToTikTok(null, home);
      if (tabId !== undefined && !initial.verified) throw new VaultError("identity_unconfirmed");
      await openQuickLink(state, target, openedTab, destination, confirmed, tabId === undefined);
    } else if (tabId === undefined) {
      const openedTab = await goToTikTok(null, safeTikTokPage(target.lastPage) ?? home);
      await trackVerification(openedTab, target, state.previous);
    } else {
      await focusTikTok(tabId);
    }
    return { opened: true, login: false };
  }
  if (switching && (!target.identity || await fingerprint(target.cookies) !== target.identity)) {
    throw new VaultError("expired");
  }

  const alias = switching && typeof target.alias === "string" ? target.alias.trim().slice(0, 48) : null;
  const { tabId, returnTo } = await park({ mode: switching ? "switch" : "login", alias, confirmed: confirmed === true });
  let before;
  let identity;
  try {
    before = await readCookies();
    identity = await fingerprint(before);
  } catch {
    await finishTransition(tabId, returnTo);
    throw new VaultError("unexpected");
  }
  if (identity !== (initial.identity ?? null)) {
    await finishTransition(tabId, returnTo);
    throw new VaultError("unsaved");
  }

  const current = initial.current;
  const previous = initial.recognized?.id ?? state.previous;
  const lastPage = safeTikTokPage(initial.tabs[0]?.url);
  const now = Date.now();
  const saved = {
    ...state,
    accounts: state.accounts.map((account) =>
      account.id === current?.id ? { ...account, cookies: before, ...(lastPage ? { lastPage } : {}) } : account)
  };
  const pending = { ...saved, pending: { before, tabId, returnTo } };
  try {
    await persist(pending, vault.key, vault.salt);
  } catch {
    await finishTransition(tabId, returnTo);
    throw new VaultError("storage");
  }

  let next;
  try {
    if ((await tiktokTabs()).length) throw new VaultError("multiple_tabs");
    if (switching || identity) await replaceCookies(switching ? target.cookies : []);
    if ((await tiktokTabs()).length) throw new VaultError("multiple_tabs");
    next = {
      ...saved,
      accounts: switching ? saved.accounts.map((account) =>
        account.id === target.id ? { ...account, lastUsedAt: now } : account) : saved.accounts,
      active: switching ? target.id : null,
      previous: switching && previous === target.id ? null : previous,
      setup: switching ? null : { stage: command, ...(target ? { accountId: target.id } : {}) },
      invite: state.invite ?? (switching && current ? "pending" : null),
      pending: null
    };
    if (switching) next = appendHistory(next, { from: initial.recognized?.id ?? null, to: target.id, when: now });
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

  const nextPage = switching ? (destination ? home : safeTikTokPage(target.lastPage) ?? home) : login;
  if (switching) await trackVerification(tabId, target, next.previous);
  else await clearVerification();
  const openedTab = await finishTransition(tabId, nextPage);
  if (switching && openedTab !== tabId) await trackVerification(openedTab, target, next.previous);
  if (destination) await openQuickLink(next, target, openedTab, destination, confirmed, true);
  return { opened: true, login: !switching };
}

function trackVerification(tabId, account, previousId) {
  return chrome.storage.session.set({
    [verificationKey]: { tabId, accountId: account.id, expected: account.handle ?? null, previousId: previousId ?? null }
  });
}

async function openQuickLink(state, target, tabId, destination, confirmed, waitForLoad) {
  const url = quickTikTokPage(destination, target.handle);
  if (!url) throw new VaultError("identity_unconfirmed");
  const deadline = Date.now() + (waitForLoad ? 6000 : 0);
  do {
    if (!await chrome.permissions.contains({ origins: [hostPermission] })) throw new VaultError("permission");
    const session = await inspectSession(state);
    if (session.tabs.length > 1) throw new VaultError("multiple_tabs");
    if (session.profile && session.error === "account_mismatch") throw new VaultError("account_mismatch");
    if (session.tabs[0]?.id === tabId && session.current?.id === target.id && session.verified) {
      if (confirmed !== true && isPosting(session.tabs)) throw new VaultError("confirm_account");
      try {
        await chrome.tabs.update(tabId, { url, active: true });
      } catch {
        throw new VaultError("open_failed");
      }
      return;
    }
    if (Date.now() >= deadline || !await getTab(tabId)) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  } while (Date.now() <= deadline);
  throw new VaultError("identity_unconfirmed");
}
